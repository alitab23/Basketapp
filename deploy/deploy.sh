#!/usr/bin/env bash
# Builds the app and uploads it to Loopia over SSH (SPEC.md section 9, "Driftsättning").
#
#   LOOPIA_SSH=user@ssh.loopia.se LOOPIA_PATH=basketapp.se/public_html deploy/deploy.sh
#
# Options:
#   --skip-build   upload the existing app/dist (used by GitHub Actions after its tests)
#   --dry-run      show what would change without uploading
#
# Hosting step 1 uploads only the app. The API, migrations and uploads/ come in step 2.
set -euo pipefail

cd "$(dirname "$0")/.."
: "${LOOPIA_SSH:?Set LOOPIA_SSH, e.g. user@ssh.loopia.se}"
: "${LOOPIA_PATH:?Set LOOPIA_PATH, e.g. basketapp.se/public_html}"
SSH_OPTS=${SSH_OPTS:-}

build=1
dry=()
for arg in "$@"; do
  case "$arg" in
    --skip-build) build=0 ;;
    --dry-run) dry=(--dry-run) ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$build" = 1 ]; then
  (cd app && npm ci && npm test && npm run build)
fi
test -f app/dist/index.html || { echo "app/dist is missing; build first." >&2; exit 1; }

cp deploy/public_html.htaccess app/dist/.htaccess

rsync_base=(rsync -rlptz --human-readable --itemize-changes -e "ssh $SSH_OPTS" ${dry[@]+"${dry[@]}"})
target="$LOOPIA_SSH:$LOOPIA_PATH/"

# 1. New assets first, so no visitor gets an index.html that points to files not there yet.
"${rsync_base[@]}" app/dist/assets/ "$target/assets/"
# 2. Then everything else. Old files are removed, except:
#    - assets/: an open tab of the previous version may still load its chunks;
#    - api/, uploads/ and the server's own folders.
"${rsync_base[@]}" --delete \
  --exclude '/assets/' --exclude '/api/' --exclude '/uploads/' --exclude '/cgi-bin/' --exclude '/.well-known/' \
  app/dist/ "$target"

echo "Done: https://${LOOPIA_PATH%%/*}/"
