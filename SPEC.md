# Basketapp – Kravspecifikation

Nov 14, 2026 · @Someone

## 1. Översikt och mål

Bygg en webbapp där basketlag planerar träningspass och ritar övningar på en planskiss, i samma upplägg som sessionplan.de: ett pass är en lista av tidsblock med beräknade klockslag och summerad totaltid. Skillnaden mot sessionplan är att varje block kan ha en ritad övning, och att flera inloggade tränare delar och redigerar samma data samtidigt.

Så här ska specifikationen användas: ge hela dokumentet till en AI-kodassistent och be den bygga appen steg för steg enligt avsnitt 10 (byggordning). Basketappen ska ha samma teknikstack och arkitektur som sessionplan.de (avsnitt 8).

**Referens – hur sessionplan.de fungerar (från webbplatsen, inställningsmenyn och exempellänken):**

- Passets huvud: titel, datum, plats, antal deltagare, ansvarig, starttid (t.ex. 09:00) och beskrivning.
- Blocktyper med namn, ikon och färg (t.ex. Föreläsning blå #3B82F6, Övning grön #22C55E, Paus grå #6B7280, Diskussion orange #F97316, Energizer lila #A855F7).
- Varje block: titel, längd i minuter, blocktyp, anteckningar i markdown och material.
- Start- och sluttid per block räknas fram från passets starttid och blockens längder; totaltiden visas.
- Hela passet kan delas som en länk där datan ligger komprimerad i URL:en (`#data=v2:` + lz-string).

**Mer som sessionplan har och som basketappen ska ha på samma sätt:**

- Gratis webbapp i webbläsaren, installerbar som PWA och användbar offline.
- Inget konto krävs: data sparas lokalt i webbläsaren som standard och delas bara när användaren själv väljer det.
- Delning och samarbete via länk, med krypterad synk via server.
- Hostad i EU (servrar i Tyskland), GDPR-anpassad, öppen källkod.
- Inställningsmeny med: visa tidsvisualisering, korta ner beskrivningar, ljudsignaler, ljust/mörkt tema, språkval (DE/EN), Exportera som PDF, Exportera som kalkylark (CSV), Exportera data, Importera data (JSON-fil), Kortkommandon, Skapa pass med AI och Rensa allt.
- Blockmallar och passmallar (templates) att utgå från, samt ett blockbibliotek.
- Startsidan listar sparade pass med antal block, total tid och när de senast ändrades.
- Live-läge som visar pågående block medan passet körs.

**Mål för version 1:**

- Skapa säsonger och träningspass, spara, ladda om och redigera.
- Rita övningar med färdiga symboler (X, O, screens, pilar för pass, dribbling och cuts).
- Tid per övning, automatisk totaltid och klockslag.
- Instruktionstext per övning.
- Inloggning och realtidssamarbete i delade lag.
- Bibliotek och Templates; export och import av JSON-filer; PDF, CSV och delningslänk.

**Utanför version 1:** videoanalys, animation av övningar steg för steg (se framtida idéer i avsnitt 10), mobilapp i appbutik.

## 2. Användare, inloggning och samarbete

All data tillhör ett **lag (workspace)**; alla medlemmar i laget ser och redigerar samma säsonger och pass i realtid.

**Utan konto (som sessionplan):** appen ska gå att använda direkt utan inloggning. Då sparas allt lokalt i webbläsaren, och man delar via länk eller JSON-fil. Inloggning behövs först när man vill dela ett lag med andra tränare; det lokala innehållet kan då flyttas in i laget med ett klick.

**Inloggning**

- E-post + lösenord samt “magisk länk” via e-post. Google-inloggning som tillval.
- Glömt lösenord, verifiering av e-post.
- En användare kan vara med i flera lag och byter lag i en meny.

**Roller per lag**

| Roll | Får göra |
| --- | --- |
| Ägare | Allt, inklusive bjuda in, ta bort medlemmar, radera laget |
| Tränare | Skapa, redigera och radera säsonger, pass och övningar |
| Läsare | Se och skriva ut pass, inga ändringar (t.ex. spelare, assisterande ledare) |

**Inbjudan:** ägaren bjuder in via e-post eller en inbjudningslänk med vald roll; länken går ut efter 7 dagar.

**Realtidssamarbete**

- Ändringar syns direkt hos alla som har samma pass öppet (den egna skärmen direkt, andra inom 1–2 sekunder; se avsnitt 9).
- Visa vilka som är inne i passet (avatarer i toppen) och deras markörer på ritytan med namn och färg.
- Konflikthantering med CRDT (Yjs), så två personer kan rita i samma övning utan att skriva över varandra.
- Om nätet bryts: fortsätt arbeta lokalt och synka när anslutningen är tillbaka.
- Ångra/gör om (Ctrl+Z / Ctrl+Shift+Z) gäller bara den egna användarens ändringar.

**Historik:** spara automatiskt; visa “senast ändrad av X, tid” och låt tränare återställa en tidigare version av ett pass (minst 30 dagar bakåt).

## 3. Datamodell

Hierarkin är Lag → Säsong → Träningspass → Block (övning) → Ritning. Allt som sparas – säsonger, pass och övningar – samlas i Biblioteket, och Templates är färdiga utgångspunkter som kopieras in (avsnitt 6).

```typescript
type Role = "owner" | "coach" | "viewer";

interface Team { id: string; name: string; logoUrl?: string; createdAt: string }
interface Membership { userId: string; teamId: string; role: Role }

// teamId = null betyder lokalt innehåll utan konto (bara i webbläsaren)

interface Season {
  id: string; teamId: string | null;
  name: string;            // t.ex. "Säsong 2026/27 – U16 Flickor"
  startDate: string; endDate: string;
  description?: string;
  archived: boolean;
  updatedAt: string;
}

interface BlockType {        // per lag, redigerbara
  id: string; teamId: string | null;
  name: string; icon: string; color: string; // hex
}

interface Session {          // ett träningspass
  id: string; teamId: string | null;
  seasonId: string | null;   // null = fristående pass i Biblioteket
  title: string;
  date?: string;             // YYYY-MM-DD
  startTime: string;         // "18:00"
  location?: string;         // hall
  participants?: number;
  coach?: string;            // ansvarig
  focus?: string;            // tema, t.ex. "Pick and roll-försvar"
  description?: string;      // markdown
  maxDuration?: number;      // valfri maxtid för hallen i minuter; varning om passet blir längre
  items: Block[];            // ordnad lista
  fromTemplateId?: string;
  updatedAt: string; updatedBy?: string;
}

interface Block {            // en rad i passet
  id: string;
  kind: "block" | "section"; // section = rubrikrad utan tid, t.ex. "Uppvärmning"
  title: string;
  duration: number;          // minuter, 0–240
  blockTypeId?: string;
  instructions: string;      // markdown: syfte, organisation, coachingpunkter
  material?: string;         // bollar, koner, västar
  playersNeeded?: string;    // t.ex. "4 mot 4 + 2"
  diagrams: Diagram[];       // 0..n ritningar (“steg” i övningen), ordnade
  images: ImageAttachment[]; // 0..n uppladdade bilder, ordnade
  sourceDrillId?: string;    // om hämtad från Biblioteket (kopia, inte länk)
}

interface Diagram {
  id: string;
  court: "half" | "full";
  caption?: string;
  elements: CourtElement[];  // se avsnitt 5
}

interface ImageAttachment {  // foto eller skiss som laddats upp
  id: string;
  fileName: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number; height: number;
  caption?: string;
  localBlobId?: string;      // i IndexedDB
  url?: string;              // på servern när laget synkar
}

interface Drill {            // sparad övning i Biblioteket
  id: string; teamId: string | null;
  title: string; tags: string[]; defaultDuration: number;
  blockTypeId?: string;
  instructions: string; material?: string; playersNeeded?: string;
  diagrams: Diagram[];
  images: ImageAttachment[];
  updatedAt: string;
}

interface Template {         // färdig utgångspunkt, kopieras vid användning
  id: string;
  teamId: string | null;     // null + builtIn = levereras med appen
  builtIn: boolean;          // inbyggda templates är skrivskyddade
  kind: "season" | "session" | "drill";
  name: string; description?: string; tags: string[];
  content: SeasonTemplate | Omit<Session, "id" | "teamId" | "seasonId"> | Omit<Drill, "id" | "teamId">;
}

interface SeasonTemplate {   // t.ex. "U14, 2 pass/vecka, 90 min"
  name: string; weeks: number; sessionsPerWeek: number;
  sessions: Omit<Session, "id" | "teamId" | "seasonId">[];
}
```

Koordinater på planen lagras i **meter** i ett fast koordinatsystem (FIBA: helplan 28 × 15 m, halvplan 14 × 15 m, origo i planens mitt), så att ritningar ser likadana ut oavsett skärmstorlek.

All data sparas först lokalt i webbläsaren (IndexedDB), som i sessionplan. För inloggade lag är varje pass även ett Yjs-dokument som synkas via servern; servern håller dessutom en databas med användare, lag och behörigheter.

## 4. Passplanering (sessionplan-format)

Passvyn ska se ut och fungera som sessionplan.de: ett rent, ljust gränssnitt med passets huvud överst och en vertikal lista av färgkodade block, där varje rad visar klockslag, längd och innehåll.

**Navigering**

1. Startsida (som sessionplan): knapparna “Nytt pass” och “Öppna template”, samt senast ändrade pass och säsonger med antal block, total tid och “ändrad för 3 dagar sedan”.
2. Säsongsvy: passen i datumordning som lista och som månadskalender, med summerad träningstid för säsongen. Knappar: “Nytt pass”, “Duplicera pass”, “Skapa från template”.
3. Passvy: redigeringsläget som beskrivs nedan.
4. Bibliotek: alla sparade säsonger, pass och övningar, samt Templates (avsnitt 6).

**Passets huvud**

- Titel, datum, starttid, hall, antal spelare, ansvarig tränare, tema och beskrivning – alla redigerbara direkt på plats.
- Sammanfattning: total tid (t.ex. “1 h 30 min”), sluttid (t.ex. “18:00–19:30”) och fördelning per blocktyp som en liten färgad stapel.

**Blocklistan**

- Varje block visar: klockslag start–slut (beräknat), titel, längd i minuter, blocktyp som färgad etikett med ikon, en miniatyr av ritningen och de första raderna av instruktionen.
- Klick på ett block fäller ut det: fullständig ritning med verktyg (avsnitt 5), markdown-editor för instruktioner, fält för material och antal spelare.
- Längd ändras med sifferfält och snabbknappar (−5 / +5 min). Alla klockslag och totaltiden räknas om direkt.
- Ordningen ändras med dra och släpp; klockslagen följer med.
- Lägg till: “+ Övning”, “+ Paus”, “+ Rubrik” (rubrikrad delar in passet, t.ex. Uppvärmning / Huvuddel / Avslutning, och visar summa för sin del) och “+ Från bibliotek” (sidopanel där man drar in övningar och block-templates).
- Per block: duplicera, radera, spara i Biblioteket, spara som template.

**Förvalda blocktyper för basket** (redigerbara per lag)

| Blocktyp | Färg |
| --- | --- |
| Uppvärmning | #F59E0B |
| Teknik / fundamentals | #3B82F6 |
| Skott | #EF4444 |
| Anfall / spelsystem | #22C55E |
| Försvar | #8B5CF6 |
| Spel / scrimmage | #F97316 |
| Kondition | #EC4899 |
| Paus / vatten | #6B7280 |

**Tidsberäkning (exakt regel):** blockets start = passets starttid + summan av längden för alla tidigare block; slut = start + egen längd; totaltid = summan av alla block (rubrikrader räknas som 0). Visa varning om passet blir längre än en valfri maxtid för hallen.

**Spara och ladda:** allt sparas automatiskt lokalt i webbläsaren och, för inloggade lag, synkas till servern; ingen spara-knapp behövs, men visa status “Sparat” / “Sparar…” / “Offline – sparas lokalt”. Pass kan dupliceras, sparas som template och flyttas mellan säsonger.

## 5. Ritverktyget och moduler

Ritytan är en vektorbaserad basketplan (SVG) med en verktygspalett till vänster; man klickar på en symbol och sedan på planen för att placera den, och alla objekt kan flyttas, roteras, färgas och raderas efteråt.

**Planen**

- Halvplan (standard) och helplan, korrekt skalade enligt FIBA: träpanlinje 6,75 m, straffområde 4,9 × 5,8 m, no-charge-halvcirkel 1,25 m, korg och tavla.
- Valbar planfärg (trä / vit för utskrift) och rutnät med fäst-funktion som går att stänga av.

**Symbolpalett (färdiga moduler)**

| Symbol | Betydelse | Utseende |
| --- | --- | --- |
| O1–O5 | Anfallsspelare | Ring med nummer, färg valbar |
| X1–X5 | Försvarsspelare | X med nummer |
| C | Tränare / passare | Fylld fyrkant med C |
| Boll | Bollhållare | Liten orange cirkel, kan fästas vid en spelare |
| Kon | Kon / markering | Triangel |
| Pass | Passning | Streckad pil |
| Dribbling | Dribbling | Sicksack-linje med pil |
| Cut | Löpning utan boll | Heldragen pil |
| Screen | Screen / blockering | Heldragen linje som slutar i ett kort tvärstreck (T) |
| Handoff | Hand-off | Linje med dubbelstreck |
| Skott | Skott mot korg | Pil med dubbel spets eller pil + “S” |
| Defensiv glidning | Försvarsförflyttning | Pil med dubbel linje |
| Text | Etikett | Fritext på planen |
| Zon | Markerat område | Halvgenomskinlig rektangel eller ellips |
| Frihand | Penna | Fri linje |

**Linjer och pilar**

- Ritas genom att klicka startpunkt och dra till slutpunkt; mittpunkten kan dras ut till en kurva (kvadratisk Bézier). Valfritt antal brytpunkter med dubbelklick.
- En pil som startar på en spelare fästs vid spelaren och följer med när spelaren flyttas.
- Valfri numrering av pilar (1, 2, 3 …) för att visa ordningen i övningen.

**Redigering**

- Markera med klick eller ruta; flytta, rotera, ändra färg och nummer i en egenskapspanel.
- Kopiera, klistra in, radera (Delete), ångra/gör om, zooma.
- Flera bilder per övning: valfritt antal ritningar (“Steg 1, Steg 2 …”) med knappen “Kopiera till nästa steg”, plus uppladdade foton eller skisser.
- Fungerar med mus och med pekfinger/penna på surfplatta.

**Flera bilder per övning**

- Bilderna visas som en rad miniatyrer under övningen; klick öppnar bilden stort, pilar bläddrar.
- “+ Ritning” skapar en ny tom plan eller en kopia av föregående steg; “+ Bild” laddar upp ett foto (JPG, PNG, WebP).
- Bilder kan också dras in direkt från datorn eller klistras in från urklipp.
- Ordningen ändras med dra och släpp; varje bild kan få en bildtext.
- Uppladdade bilder skalas ner i webbläsaren till högst 1600 px och komprimeras innan de sparas, så att appen förblir snabb.
- Alla bilder följer med när övningen sparas i Biblioteket, blir en template, exporteras som JSON (bilder som base64) och skrivs ut som PDF.

**Element i datamodellen**

```typescript
type CourtElement =
  | { id: string; type: "offense" | "defense" | "coach" | "ball" | "cone";
      x: number; y: number; label?: string; color?: string; rotation?: number }
  | { id: string; type: "pass" | "dribble" | "cut" | "screen" | "handoff" | "shot" | "slide";
      points: { x: number; y: number }[]; curved: boolean;
      fromElementId?: string; order?: number; color?: string }
  | { id: string; type: "text"; x: number; y: number; text: string; size: number }
  | { id: string; type: "zone"; shape: "rect" | "ellipse";
      x: number; y: number; w: number; h: number; color: string }
  | { id: string; type: "freehand"; points: { x: number; y: number }[]; color: string };
```

## 6. Bibliotek och Templates

Allt som sparas hamnar i **Biblioteket**; **Templates** är färdiga utgångspunkter som man kopierar från, så att originalet aldrig ändras av misstag.

**Biblioteket**

- En sida med tre flikar: Säsonger, Pass och Övningar. En fjärde flik, Templates, beskrivs nedan.
- Varje post visas som ett kort i sessionplan-stil: titel, antal block, total tid och “ändrad för X dagar sedan”.
- Sök på titel och text, filtrera på taggar (t.ex. skott, försvar, transition, uppvärmning), blocktyp och säsong, sortera på senast ändrad eller namn.
- Åtgärder per post: öppna, duplicera, flytta till annan säsong, arkivera, radera (hamnar i papperskorg i 30 dagar), dela länk, exportera JSON, spara som template.
- I passvyn finns Biblioteket som sidopanel; man drar en övning in i passet. Den läggs in som en kopia, så att ändringar i passet inte påverkar Biblioteket och tvärtom.
- Utan konto ligger Biblioteket lokalt i webbläsaren; i ett lag delas det av alla medlemmar.

**Templates**

- Tre sorter, som i sessionplan (som har block- och passmallar) plus en för hela säsonger: säsongs-templates, pass-templates och övnings-templates.
- Två källor: inbyggda templates som levereras med appen (skrivskyddade) och lagets egna, skapade med “Spara som template” från en säsong, ett pass eller en övning.
- “Använd template” skapar alltid en ny kopia med nya id:n; man väljer säsong, datum och starttid i samma steg.
- En säsongs-template skapar en säsong med pass utlagda veckovis enligt valda veckodagar (t.ex. tisdag och torsdag).
- Templates kan exporteras och importeras som JSON, så att tränare kan dela dem mellan lag och klubbar.

**Inbyggda templates i version 1** (innehållet skrivs med ritning och instruktion)

| Namn | Sort | Längd | Innehåll |
| --- | --- | --- | --- |
| Standardpass 90 min | Pass | 90 min | Uppvärmning 15, teknik 20, skott 15, anfall/försvar 25, spel 15 |
| Kort pass 60 min | Pass | 60 min | Uppvärmning 10, teknik 15, skott 10, spel 25 |
| Matchdagsförberedelse | Pass | 45 min | Uppvärmning, skott, genomgång av spelsystem |
| Säsong 2 pass/vecka | Säsong | 16 veckor | 32 pass baserade på Standardpass 90 min |
| Mikan drill | Övning | 3 min | Lay-ups med växelvis händer nära korgen |
| 3-man weave | Övning | 8 min | Passningar i full fart över hela planen |
| 2 mot 1 / 3 mot 2 fastbreak | Övning | 10 min | Kontring med övertal |
| Shell drill 4 mot 4 | Övning | 12 min | Försvarsplacering vid bollens förflyttning |
| Closeout-drill | Övning | 6 min | Försvarare springer ut mot skytt |
| Pick and roll 2 mot 2 | Övning | 12 min | Screen på bollförare, roll mot korg |

## 7. Inställningar, export och import

Som i sessionplan ska allt kunna lämna appen och komma tillbaka: JSON-fil för säkerhetskopia och flytt, PDF för utskrift, CSV för kalkylark och länk för snabb delning.

**Sidomenyn (samma upplägg som sessionplan)**

- Reglage: Visa tidsvisualisering, Korta ner beskrivningar, Ljudsignaler (i live-läget), Ljust/mörkt tema.
- Exportera som PDF, Exportera som kalkylark (CSV), Exportera data (JSON), Importera data (JSON).
- Kortkommandon, Ge feedback, Rensa allt (röd, kräver bekräftelse och erbjuder först en JSON-export).
- Inställningar och språkval SV / EN längst ner.
- “Skapa pass med AI” finns i sessionplan men tas med först i en senare version.

**Exportera data (JSON)**

- Omfattning väljs i en dialog: aktuellt pass, en säsong, hela Biblioteket, egna templates eller allt.
- Filnamn: `basketapp-<titel>-<YYYY-MM-DD>.json`. Ritningar ingår med koordinater i meter.
- Filen har ett kuvert med formatnamn och version, så att äldre filer kan läsas även när formatet ändras:

```json
{
  "format": "basketapp",
  "version": 1,
  "exportedAt": "2026-11-14T17:00:00Z",
  "scope": "season",
  "blockTypes": [],
  "seasons": [],
  "sessions": [],
  "drills": [],
  "templates": []
}
```

**Importera data (JSON)**

1. Användaren väljer eller drar in en fil.
2. Filen valideras mot ett schema (t.ex. Zod). Ogiltig fil eller okänd version ger ett tydligt felmeddelande; äldre versioner migreras automatiskt.
3. Förhandsvisning: “2 säsonger, 24 pass, 40 övningar, 3 templates”.
4. Val: “Lägg till som kopior” (nya id:n, standard) eller “Ersätt befintliga med samma id”.
5. Importen fungerar även utan konto och hamnar då i det lokala Biblioteket.

Extra: kunna importera en sessionplan-länk eller sessionplan-JSON (fälten workshop, blockTypes, items) och göra om den till ett pass.

**Övrig export**

- PDF: se “Snygg PDF av ett pass” nedan.
- CSV: en rad per block med start, slut, titel, blocktyp, minuter och instruktion.
- PNG/SVG av en enskild ritning.
- Delningslänk: passet komprimerat i URL:en som i sessionplan (`#data=v1:` + lz-string). Blir länken för lång (många ritningar) sparas passet krypterat på servern och länken innehåller bara id och nyckel.
- Skrivskyddad länk till ett lagpass som fungerar utan inloggning och kan stängas av.

**Snygg PDF av ett pass**

Ett pass med flera övningar ska bli en PDF som ser professionell ut och går att dela ut till tränare och spelare direkt. PDF:en skapas i webbläsaren (t.ex. med @react-pdf/renderer) och inte via webbläsarens utskriftsdialog, så att den ser likadan ut i alla webbläsare.

1. **Första sidan:** lagnamn och logotyp, passets titel, datum, tid (t.ex. 18:00–19:30), hall, ansvarig tränare och tema. Därunder tidtabellen: klockslag, övning, blocktyp som färgmarkering och minuter, med totaltid sist.
2. **En sektion per övning:** rubrik med nummer, klockslag och längd; blocktypens färg som kantlinje; instruktioner med rubriker och punktlistor; material och antal spelare.
3. **Bilderna:** alla ritningar och foton i övningen i ett rutnät, 1, 2 eller 3 per rad (väljs vid export), med bildtext. Ritningarna är vektorgrafik, så de blir skarpa även utskrivna.
4. **Sidbrytning:** en övning delas aldrig mitt i en bild; får den inte plats börjar den på ny sida.
5. **Sidhuvud och sidfot:** passets titel och datum i huvudet, “Sida 2 av 6” i foten.

Exportdialogen har en förhandsvisning och dessa val: A4 stående eller liggande; färg eller svartvitt; med eller utan instruktioner (bara tidtabell + bilder); 1–3 bilder per rad; språk svenska eller engelska. Ett pass med 10 övningar och 20 bilder ska ta högst 3 sekunder att skapa. Samma mall används för att exportera en hel säsong som en PDF (ett pass per avsnitt).

## 8. Teknikstack (samma som sessionplan)

Basketappen byggs med samma arkitektur som sessionplan.de: en statisk webbapp (PWA) som körs helt i webbläsaren, sparar lokalt först och bara använder en server för delning, inloggning och synk. Sessionplan publicerar inte vilket ramverk den är byggd med, så ramverksvalen nedan är gjorda i samma anda och kan bytas om AI:n motiverar det.

| Lager | Val | Motsvarighet i sessionplan |
| --- | --- | --- |
| Gränssnitt | React + TypeScript, byggt med Vite till statiska filer | Webbapp i webbläsaren |
| Installerbar app | PWA (vite-plugin-pwa), fungerar offline | PWA, offline-läge |
| Utseende | Tailwind CSS, ljust och mörkt tema | Ljust/mörkt tema |
| Dra och släpp | dnd-kit (mus, pekfinger och tangentbord) | Drag & drop-timeline |
| Lokal lagring | IndexedDB (via Dexie), även för bilder | Data sparas lokalt i webbläsaren |
| Delningslänk | lz-string-komprimerad data i URL:en | `#data=v2:` + lz-string |
| Samarbete | Yjs i webbläsaren; ändringar skickas till och hämtas från PHP-API:t | Synk via länk |
| Server (tillägg) | PHP 8.4 + MariaDB på Loopias UNIX-hosting (avsnitt 9) | Sessionplan kräver inget konto |
| Ritning | SVG i React | Finns inte |
| PDF | @react-pdf/renderer, skapas i webbläsaren | Exportera som PDF |
| Språk | i18next, endast svenska och engelska | Tyska och engelska |
| Tester | Vitest, Playwright och PHPUnit | – |

**Tekniska krav**

- Behörigheter kontrolleras i servern vid varje synk- och API-anrop, inte bara i gränssnittet.
- Responsivt: dator och surfplatta fullt stöd; mobil minst läsläge och enklare redigering.
- Språk: endast svenska (standard) och engelska, valbart i sidomenyn; all text i översättningsfiler, även i PDF-exporten.
- Tillgänglighet: tangentbordsnavigering i blocklistan, kontrast enligt WCAG AA.
- Enhetstester för tidsberäkningen och behörigheter; end-to-end-test (Playwright) för flödet i acceptanskriterierna.

**Dra och släpp överallt**

Allt som har en ordning eller en plats ska kunna flyttas med dra och släpp, med mus och pekfinger, och med tangentbord som alternativ.

- Block i ett pass: ändra ordning, flytta mellan rubrikdelar (Uppvärmning, Huvuddel …).
- Från Biblioteket och Templates i sidopanelen in i passet.
- Mellan två pass som är öppna sida vid sida, och pass mellan datum i säsongskalendern.
- Symboler från paletten till planen; spelare, pilar och text på planen.
- Bilder i en övning: ändra ordning, dra in filer från datorn.
- JSON-filer: dra in var som helst i appen för att importera.
- Tydlig feedback: en “skugga” av objektet följer markören, en linje visar var det hamnar, klockslagen räknas om redan medan man drar, och Ångra fungerar efter varje flytt.

**Prestanda – appen ska kännas omedelbar**

| Mått | Krav |
| --- | --- |
| Första laddning på 4G | Under 2 s till användbar sida |
| Senare laddningar (PWA-cache) | Under 0,5 s |
| Grundpaket JavaScript | Under 250 KB komprimerat; ritverktyg och PDF laddas först när de behövs |
| Svar på klick och tangent | Under 100 ms |
| Dra och släpp, ritning, zoom | 60 bilder per sekund, även med 100 objekt på planen |
| Öppna ett pass | Under 300 ms (läses lokalt) |
| Sök i Biblioteket med 1 000 poster | Resultat medan man skriver, under 100 ms |
| PDF med 10 övningar och 20 bilder | Under 3 s |

Så nås kraven: allt läses och sparas lokalt först och synkas i bakgrunden (användaren väntar aldrig på servern), långa listor virtualiseras, bilder komprimeras och visas som miniatyrer, och tunga jobb (PDF, bildkomprimering, JSON-import) körs i en Web Worker. Kraven mäts automatiskt med Lighthouse i byggflödet.

## 9. Hosting på Loopia (UNIX-hosting)

Basketappen ska kunna köras helt på ett vanligt Loopia-webbhotell med UNIX-hosting, utan egen server eller Docker. Loopias UNIX-plattform kör PHP på Apache 2.4 med MariaDB 10.6 och SSH, så serverdelen skrivs i PHP och appen i övrigt är statiska filer.

**Det Loopia ger och vad appen använder det till**

| Del | Loopia UNIX | Används till |
| --- | --- | --- |
| Webbserver | Apache 2.4 | Statiska filer och PHP-API |
| PHP | Välj version själv i Kundzonen; senaste är 8.5 | API:t; kräver PHP 8.4 eller senare |
| Databas | MariaDB 10.6; antal och storlek beror på paket (0,5–2 GB) | Användare, lag, behörigheter, synkdata |
| SSH | Ingår | Driftsättning och databasmigreringar |
| Backup | Dagliga backuper av webb och databas | Kompletteras med appens JSON-export |

Källor: [Loopia – specifikationer](https://www.loopia.com/hosting/specifications), [Loopia – PHP-versioner](https://support.loopia.com/wiki/upgrade-php-at-loopia/), [Loopia – SSH](https://support.loopia.com/wiki/ssh/). Loopia uppgraderar UNIX-sajter från PHP 8.2 till 8.4 från 1 november 2026, så koden ska fungera på 8.4 och 8.5.

**Mappstruktur på webbhotellet**

- `public_html/` – den byggda appen (index.html, assets, service worker) och en `.htaccess` som skickar alla app-sökvägar till index.html, tvingar HTTPS och sätter lång cache på assets.
- `public_html/api/` – PHP-API:t i ren PHP med PDO. Composer-paket får användas men installeras vid bygget och laddas upp färdiga.
- `public_html/uploads/` – uppladdade bilder, med `.htaccess` som förbjuder körning av skript.
- `config/` utanför public\_html – databaslösenord och e-postinställningar.

**Samarbete utan egen serverprocess**

Ett webbhotell kör PHP en gång per anrop och håller inga WebSocket-anslutningar öppna, så realtid byggs med korta anrop:

1. Varje ändring blir en liten Yjs-uppdatering som skickas med `POST /api/sync/{passId}`.
2. Ett öppet pass hämtar nya uppdateringar med `GET /api/sync/{passId}?since=N` varje sekund när flera redigerar, var 5:e sekund annars, och pausar när fliken ligger i bakgrunden.
3. Servern sparar uppdateringarna i MariaDB och slår ihop dem till en ögonblicksbild efter 200 uppdateringar.
4. Närvaro och markörer följer med i samma anrop.

Den egna skärmen uppdateras direkt; andra ser ändringen inom 1–2 sekunder.

**Inloggning:** PHP-sessioner med säkra cookies (HttpOnly, Secure, SameSite), lösenord med `password_hash`, och inloggningslänkar och inbjudningar skickas via SMTP från ett e-postkonto på Loopia, t.ex. noreply@basketapp.se.

**Två steg**

- Steg 1: bara den byggda appen i `public_html/`. Fungerar som sessionplan, utan konto.
- Steg 2: lägg till `api/`, databasen och inloggning för lag och samarbete.

**Driftsättning**

1. Bygg appen med `npm run build`.
2. Ladda upp `dist/` och `api/` med rsync över SSH (eller SFTP).
3. Kör databasmigreringar med ett PHP-skript via SSH.

GitHub Actions gör steg 1–3 automatiskt vid push till main-grenen.

**Det här behöver du göra själv**

- [ ] Beställa webbhotell med UNIX hos Loopia och koppla domänen.
- [ ] Välja PHP 8.4 eller senare i Loopia Kundzon.
- [ ] Aktivera SSL-certifikat för domänen.
- [ ] Skapa en MariaDB-databas och en databasanvändare.
- [ ] Skapa en SSH-användare och lägga in din publika nyckel.
- [ ] Skapa ett e-postkonto för utskick.
- [ ] Skapa ett GitHub-repo och lägga in SSH-nyckel och lösenord som hemligheter.

AI:n ska leverera `.htaccess`-filerna, PHP-API:t med databasmigreringar, en exempelfil för konfiguration, GitHub Actions-flödet och en README som steg för steg beskriver installation, backup och återställning på Loopia.

## 10. Byggordning och acceptanskriterier

**Byggordning**

1. Projektstruktur, PWA och lokal lagring i webbläsaren (utan konto).
2. Säsonger och pass med blocklista, tidsberäkning och autospar (utan ritning).
3. Ritytan med plan, symboler, pilar och redigering.
4. Bibliotek, Templates och export/import av JSON.
5. PDF, CSV och delningslänk. Driftsätt steg 1 av hostingen.
6. Server med inloggning, lag och roller.
7. Realtidssamarbete med närvaro och markörer. Driftsätt steg 2.
8. Polering och tester.

**Acceptanskriterier**

- [ ] Tränare A skapar ett lag, bjuder in tränare B, och båda ser samma säsong.
- [ ] Ett pass med starttid 18:00 och blocken 10 + 15 + 5 + 30 + 20 min visar klockslagen 18:00, 18:10, 18:25, 18:30, 19:00 och totaltid 1 h 20 min, slut 19:20.
- [ ] När ett block dras till ny position eller får ny längd uppdateras alla tider direkt.
- [ ] A och B ritar samtidigt i samma övning; båda ser varandras ändringar inom 2 sekunder och inget försvinner.
- [ ] En pil som startar på O1 följer med när O1 flyttas.
- [ ] Efter omladdning av sidan finns allt kvar exakt som det var.
- [ ] En läsare kan se och skriva ut men inte ändra något, även inte via API:t.
- [ ] PDF-utskriften av ett pass med 8 övningar är läsbar på A4.

* [ ] Utan konto: skapa ett pass, stäng webbläsaren, öppna igen – passet finns kvar.
* [ ] Exportera allt som JSON, kör Rensa allt, importera filen – allt är tillbaka, inklusive ritningar.
* [ ] Ett pass skapat från en template kan ändras utan att templaten ändras.
* [ ] En övning dragen från Biblioteket in i ett pass blir en kopia.
* [ ] Appen går att installera som PWA och öppna offline.
* [ ] En sessionplan-länk kan importeras som ett pass.

- [ ] En övning med 3 ritningar och 2 foton visar alla 5 bilder i appen, i JSON-exporten och i PDF:en.
- [ ] PDF av ett pass med 10 övningar skapas på under 3 sekunder, ingen övning delas mitt i en bild, och ritningarna är skarpa utskrivna.
- [ ] Hela appen, med inloggning och samarbete, körs på ett Loopia-webbhotell med UNIX-hosting och PHP 8.4.
- [ ] Alla texter, även i PDF:en, finns på svenska och engelska och byts direkt i sidomenyn.
- [ ] Block, övningar från Biblioteket, symboler och bilder kan flyttas med dra och släpp med både mus och pekfinger.
- [ ] Prestandakraven i avsnitt 8 uppfylls i Lighthouse och i Playwright-tester.

**Framtida idéer (ej version 1):** animerad uppspelning av stegen i en övning, närvaro per spelare, statistik över träningstid per blocktyp under säsongen, delning av övningar mellan lag i klubben.
