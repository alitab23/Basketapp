# Driftsättning på Loopia

Den här guiden beskriver **hostingens steg 1** (SPEC.md avsnitt 9): den byggda appen läggs i `public_html/` och fungerar som sessionplan, utan konto. All data ligger i användarnas webbläsare. PHP-API:t, databasen och inloggningen kommer i steg 2 (byggsteg 6–7). Då uppdateras guiden.

## Filerna i den här mappen

| Fil | Vad den gör |
| --- | --- |
| `public_html.htaccess` | Blir `public_html/.htaccess`. Den tvingar HTTPS och skickar alla appens sökvägar (`/pass/…`, `/bibliotek` …) till `index.html`. Filer i `assets/` cachas i ett år. `index.html` och service workern cachas inte, så att alla får nya versioner. |
| `deploy.sh` | Bygger appen och laddar upp den med rsync över SSH. |
| `test-htaccess.sh` | Provar `.htaccess` mot en lokal Apache 2.4, samma version som Loopia kör. |
| `../.github/workflows/deploy.yml` | Kör alla tester vid varje push. På `main` laddar den dessutom upp appen. |

## 1. Det här gör du själv hos Loopia

- [ ] Beställ ett webbhotell med **UNIX-hosting** och koppla domänen, t.ex. `basketapp.se`.
- [ ] Aktivera **SSL-certifikat** för domänen i Loopia Kundzon. Appen kräver HTTPS, både för att kunna installeras som PWA och för att fungera offline.
- [ ] Välj **PHP 8.4 eller senare** i Kundzonen. Det behövs först i steg 2, men det är bra att göra det direkt.
- [ ] Skapa en **SSH-användare** i Kundzonen och notera inloggningen, t.ex. `användare@värd`. Värden står i Kundzonen under SSH.
- [ ] Skapa ett SSH-nyckelpar för driftsättningen och lägg in den **publika** nyckeln hos SSH-användaren:

  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/basketapp_deploy -C "basketapp deploy"
  ```

  Den publika nyckeln finns i `~/.ssh/basketapp_deploy.pub`. Den privata nyckeln (`~/.ssh/basketapp_deploy`) lämnar aldrig din dator, utom som hemlighet i GitHub (se avsnitt 3).

- [ ] Kontrollera vilken mapp som är webbroten. Hos Loopia är det oftast `<domän>/public_html`, t.ex. `basketapp.se/public_html`. Logga in med SSH och kör `ls` om du är osäker.

## 2. Första driftsättningen från din dator

Du behöver Node 22, rsync och ssh. Allt finns på en Mac när Node är installerat. Kör från projektets rotmapp:

```bash
LOOPIA_SSH=användare@värd LOOPIA_PATH=basketapp.se/public_html SSH_OPTS="-i ~/.ssh/basketapp_deploy" deploy/deploy.sh --dry-run
```

`--dry-run` visar bara vad som skulle laddas upp. Ser det rätt ut kör du samma kommando utan `--dry-run`. Skriptet:

1. installerar beroenden, kör enhetstesterna och bygger appen (`app/dist/`)
2. lägger `public_html.htaccess` som `.htaccess` i bygget
3. laddar först upp `assets/`, så att ingen besökare får en `index.html` som pekar på filer som inte finns än
4. laddar upp resten och tar bort gamla filer, men rör aldrig `api/`, `uploads/`, `cgi-bin/` eller `.well-known/`

Gamla filer i `assets/` tas inte bort, eftersom en flik som redan är öppen kan behöva dem. De är små, och du kan rensa filer som är äldre än någon månad då och då:

```bash
ssh användare@värd 'find basketapp.se/public_html/assets -type f -mtime +60 -delete'
```

## 3. Automatisk driftsättning med GitHub Actions

Lägg in de här hemligheterna i GitHub-repot under **Settings → Secrets and variables → Actions → New repository secret**:

| Namn | Innehåll |
| --- | --- |
| `LOOPIA_SSH_KEY` | Hela innehållet i den **privata** nyckeln `~/.ssh/basketapp_deploy` |
| `LOOPIA_SSH` | `användare@värd` |
| `LOOPIA_PATH` | `basketapp.se/public_html` |

Flödet använder miljön `production`. Under **Settings → Environments** kan du kräva att någon godkänner varje driftsättning innan den körs.

Efter det gäller följande:
- **Varje push och pull request** kör enhetstester, bygge och Playwright-tester.
- **En push till `main`** laddar dessutom upp appen, men bara om alla tester gick igenom.
- **Utan hemligheterna** körs testerna ändå, och uppladdningen hoppas över med ett meddelande.

## 4. Kontrollera att allt fungerar

- [ ] `https://basketapp.se/` öppnas, och `http://` skickas vidare till `https://`.
- [ ] Ladda om sidan på en djup länk, t.ex. `https://basketapp.se/bibliotek`. Appen ska visas, inte en 404-sida.
- [ ] Appen går att installera: Chrome visar en installationsknapp i adressfältet, och i Safari på iPhone väljer du Dela → Lägg till på hemskärmen.
- [ ] Stäng av nätet och ladda om. Appen ska fortfarande fungera.
- [ ] En delningslänk (`…/#data=v1:…`) öppnar förhandsvisningen av importen.

## 5. Backup och återställning

- **Användarnas data** ligger i deras egna webbläsare i steg 1. Inget av den finns på servern. Säkerhetskopian är appens JSON-export (Meny → Exportera data). Be tränarna exportera allt då och då, särskilt innan de byter dator eller webbläsare.
- **Själva appen** finns i git. Loopia tar dessutom en daglig backup av webbhotellet, som du återställer i Kundzonen.
- **Gå tillbaka till en tidigare version:** återställ ändringen på `main` med `git revert`, så driftsätter flödet den förra versionen. Du kan också checka ut en tidigare commit och köra `deploy/deploy.sh`. Användarna får den nya, äldre versionen via rutan "En ny version finns".

## 6. Felsökning

| Problem | Trolig orsak |
| --- | --- |
| *500 Internal Server Error* | Apache förstår inte `.htaccess`. Prova den lokalt med `deploy/test-htaccess.sh`. Hos Loopia är `mod_rewrite` och `mod_headers` påslagna. |
| En djup länk ger 404 | `.htaccess` saknas i `public_html/`. Kör `deploy.sh` igen. Den lägger dit filen. |
| Användare ser en gammal version | Service workern väntar på att alla flikar stängs, eller på att användaren väljer "Uppdatera" i rutan "En ny version finns". `index.html` och `sw.js` cachas aldrig. |
| `Permission denied (publickey)` | Den publika nyckeln är inte inlagd hos SSH-användaren, eller så pekar `SSH_OPTS`/`LOOPIA_SSH_KEY` på fel nyckel. |

Testa `.htaccess` lokalt innan du ändrar den. Det kräver ett bygge (`npm run build` i `app/`) och fungerar med den Apache som följer med macOS:

```bash
deploy/test-htaccess.sh
```
