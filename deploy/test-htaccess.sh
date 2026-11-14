#!/usr/bin/env bash
# Checks public_html.htaccess against a local Apache 2.4 (the version Loopia runs).
# Needs app/dist (npm run build) and Apache with mod_rewrite/mod_headers (built into macOS).
#   deploy/test-htaccess.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${PORT:-8089}
MODULES=${APACHE_MODULES:-/usr/libexec/apache2}
work=$(mktemp -d)
trap 'kill "$(cat "$work/httpd.pid" 2>/dev/null)" 2>/dev/null || true; rm -rf "$work"' EXIT

cp -R app/dist "$work/public_html"
cp deploy/public_html.htaccess "$work/public_html/.htaccess"
mkdir -p "$work/public_html/api" && echo '{"ok":true}' > "$work/public_html/api/ping.json"

cat > "$work/httpd.conf" <<CONF
ServerRoot "$work"
Listen 127.0.0.1:$PORT
PidFile "$work/httpd.pid"
ErrorLog "$work/error.log"
LoadModule mpm_prefork_module $MODULES/mod_mpm_prefork.so
LoadModule authz_core_module $MODULES/mod_authz_core.so
LoadModule unixd_module $MODULES/mod_unixd.so
LoadModule dir_module $MODULES/mod_dir.so
LoadModule mime_module $MODULES/mod_mime.so
LoadModule rewrite_module $MODULES/mod_rewrite.so
LoadModule headers_module $MODULES/mod_headers.so
LoadModule deflate_module $MODULES/mod_deflate.so
LoadModule filter_module $MODULES/mod_filter.so
TypesConfig /private/etc/apache2/mime.types
ServerName localhost
DocumentRoot "$work/public_html"
<Directory "$work/public_html">
  AllowOverride All
  Require all granted
</Directory>
CONF

httpd -f "$work/httpd.conf" -k start
for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.1; done

fail=0
check() { # description, actual, expected (substring)
  if [[ "$2" == *"$3"* ]]; then echo "ok   $1"; else echo "FAIL $1: got '$2', expected '$3'"; fail=1; fi
}
url="http://127.0.0.1:$PORT"
asset=$(cd "$work/public_html" && ls assets/*.js | head -1)
# Loopia terminates TLS before Apache; pretend the request came over HTTPS.
H=(-H 'X-Forwarded-Proto: https')

check "http redirects to https" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$url/pass/abc")" "301 https://127.0.0.1:$PORT/pass/abc"
check "start page" "$(curl -s "${H[@]}" -o /dev/null -w '%{http_code}' "$url/")" "200"
check "app path gets index.html" "$(curl -s "${H[@]}" "$url/pass/abc" | head -c 200)" "<!doctype html>"
check "app path is not cached" "$(curl -s "${H[@]}" -D - -o /dev/null "$url/bibliotek" | tr -d '\r' | grep -i '^cache-control')" "no-cache"
check "index.html is not cached" "$(curl -s "${H[@]}" -D - -o /dev/null "$url/index.html" | tr -d '\r' | grep -i '^cache-control')" "no-cache"
check "sw.js is not cached" "$(curl -s "${H[@]}" -D - -o /dev/null "$url/sw.js" | tr -d '\r' | grep -i '^cache-control')" "no-cache"
check "assets are cached for a year" "$(curl -s "${H[@]}" -D - -o /dev/null "$url/$asset" | tr -d '\r' | grep -i '^cache-control')" "max-age=31536000, immutable"
check "assets are JavaScript" "$(curl -s "${H[@]}" -D - -o /dev/null "$url/$asset" | tr -d '\r' | grep -i '^content-type')" "text/javascript"
check "missing asset is 404" "$(curl -s "${H[@]}" -o /dev/null -w '%{http_code}' "$url/assets/gone-123.js")" "404"
check "manifest type" "$(curl -s "${H[@]}" -D - -o /dev/null "$url/manifest.webmanifest" | tr -d '\r' | grep -i '^content-type')" "application/manifest+json"
check "api is not rewritten" "$(curl -s "${H[@]}" "$url/api/ping.json")" '{"ok":true}'
check "missing api path is 404" "$(curl -s "${H[@]}" -o /dev/null -w '%{http_code}' "$url/api/nothing")" "404"
check "compressed" "$(curl -s "${H[@]}" -H 'Accept-Encoding: gzip' -D - -o /dev/null "$url/$asset" | tr -d '\r' | grep -i '^content-encoding')" "gzip"
check "nosniff header" "$(curl -s "${H[@]}" -D - -o /dev/null "$url/" | tr -d '\r' | grep -i '^x-content-type-options')" "nosniff"
check "no directory listing" "$(curl -s "${H[@]}" -o /dev/null -w '%{http_code}' "$url/assets/")" "40"

if [ "$fail" != 0 ]; then echo "--- error log"; cat "$work/error.log"; exit 1; fi
echo "All .htaccess checks passed."
