# Basketapp – instruktioner för Claude

Basketapp är en webbapp där basketlag planerar säsonger och träningspass och ritar övningar på en planskiss. Upplägg och utseende följer sessionplan.de.

**Läs alltid `SPEC.md` innan du börjar på en uppgift.** Den är kravspecifikationen och gäller före allt annat. Om något i en uppgift strider mot SPEC.md, eller om SPEC.md är oklar, fråga mig i stället för att gissa.

## Arbetssätt

- Bygg i den ordning som står i SPEC.md, avsnitt 10 (Byggordning). Ett steg i taget.
- Börja varje uppgift med en kort plan: vilka filer du skapar eller ändrar och hur du testar. Vänta på mitt OK innan du skriver kod.
- Gör små, fungerande ändringar. Appen ska gå att starta efter varje steg.
- Skriv eller uppdatera tester för det du bygger. Kör alla tester innan du säger att något är klart.
- Avsluta varje steg med en kort sammanfattning på svenska: vad som är klart, hur jag testar det själv och vad som återstår.
- Committa när ett steg fungerar, med tydliga commit-meddelanden på engelska.
- Om jag ändrar ett krav, uppdatera SPEC.md i samma ändring.

## Teknik (se SPEC.md avsnitt 8)

- Frontend: React + TypeScript (strict), Vite, Tailwind CSS, PWA (vite-plugin-pwa).
- Dra och släpp: dnd-kit. Ritning: SVG i React. PDF: @react-pdf/renderer.
- Lokal lagring: IndexedDB via Dexie. Appen ska fungera helt utan konto och offline.
- Samarbete: Yjs i webbläsaren, synk via PHP-API med polling (ingen WebSocket).
- Server: PHP 8.4 med PDO och MariaDB 10.6. Inga Node-processer, ingen Docker på servern.
- Språk: i18next, endast svenska (standard) och engelska. Ingen hårdkodad text i komponenter.
- Tester: Vitest (frontend), PHPUnit (API), Playwright (end-to-end).

## Hosting – Loopia UNIX (se SPEC.md avsnitt 9)

- Allt måste kunna köras på ett Loopia-webbhotell: Apache 2.4, PHP 8.4/8.5, MariaDB 10.6, SSH.
- Frontend byggs till statiska filer i `public_html/`. API:t ligger i `public_html/api/`.
- Hemligheter (databaslösenord, SMTP) ligger i `config/` utanför `public_html/` och committas aldrig.
- Använd bara PHP-tillägg som finns på ett vanligt webbhotell. Fråga mig om du är osäker.

## Mappstruktur

```
/app        React-appen (Vite)
/api        PHP-API, migreringar och PHPUnit-tester
/e2e        Playwright-tester
/deploy     .htaccess-filer, exempel på konfiguration och deploy-skript
SPEC.md     Kravspecifikation
CLAUDE.md   Den här filen
```

## Kodregler

- Koordinater på planen lagras i meter enligt FIBA (se SPEC.md avsnitt 3).
- Tidsberäkningen (start, slut, totaltid) ligger i en ren funktion med egna enhetstester.
- Behörigheter kontrolleras alltid i PHP-API:t, aldrig bara i gränssnittet.
- JSON-exportformatet har `format` och `version`. Ändras formatet ska äldre versioner gå att importera.
- Prestandakraven i SPEC.md avsnitt 8 gäller. Ladda ritverktyg och PDF först när de behövs, och kör tunga jobb i en Web Worker.
- Variabel- och funktionsnamn på engelska, texter för användaren via översättningsfilerna.

## Gör inte

- Lägg inte till funktioner som inte står i SPEC.md utan att fråga.
- Byt inte ramverk eller bibliotek utan att fråga.
- Committa aldrig lösenord, nycklar eller `config/`-filer.
- Hoppa inte över tester för att bli klar snabbare.
