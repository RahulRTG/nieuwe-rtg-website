# TOESTEL.md — AI op het toestel van het lid

Dit is een richtingsdocument, net als PLATFORM.md en ECONOMIE.md. Elk onderdeel
heeft een stand: **staat**, **een stap weg**, **vraagt een besluit** of **jaren
weg**. Het gaat over rekenen in de browser van het lid (WebGPU, WebNN,
WebAssembly, of het model dat de browser zelf meebrengt) als derde plaats naast
de eigen modelserver van RTG en een externe aanbieder.

## 0. Het principe

> **Geen model is infrastructuur. Een taakcontract is infrastructuur.**

Rahul vraagt nooit "draai Whisper op WebGPU". Hij vraagt "voer
`spraak.naartekst` uit onder deze voorwaarden voor privacy, kwaliteit, kosten
en wachttijd". De techniek eronder mag elk jaar wisselen zonder dat Rahul
verbouwd hoeft te worden. Een toestel uit 2029 wordt vanzelf beter benut,
omdat het contract een gemeten feit vergelijkt met een eis en niet met een
klasse.

Daaronder ligt een tweede regel, die in code staat en niet alleen hier:

> **De server beweert nooit `toestel`.** Waar het toestel rekent, ziet de
> server per definitie niets. De badge "op dit toestel" is waar omdat de
> rekencel geen netwerk heeft, niet omdat RTG dat heeft gecontroleerd.

`test/ai-herkomst.test.js` toets 3 zakt zodra `server/ai-stand.js` het woord
gebruikt.

## 1. Wat er al staat

| Onderdeel | Waar | Stand |
|---|---|---|
| Lokaal eerst, extern alleen als het expliciet mag | `server/ai.js`, `RTG_EXTERNE_AI_UIT`, `RTG_AI_UIT` | staat (server) |
| Techniekrouter: regels → algoritme → optimalisatie → voorspelling → ai | `server/kern/ai/router.js` | staat, **in de schaduw** |
| Opslag op het toestel die RTG niet kan lezen | `public/shared/toestelkluis.js` (OPFS, persistent storage) | staat |
| Sleutel die het toestel niet kan verlaten | `public/shared/toestelsleutel.js` (IndexedDB, `extractable: false`) | staat |
| CSP zonder netwerk | `server/middleware/csp.js`, de Magnaat-variant (`connect-src 'none'`) | staat, wordt hergebruikt |
| Een cel voor code van buiten | `server/routes/appstore/cel.js` | staat, als vorm |
| Spraak: lokaal of helemaal niet | `server/kern/spraaktekst.js` (geen Web Speech API) | staat, alleen via `LOCAL_AI_URL` |
| Kostenmeter zonder namen | `server/kern/kosten/` (tellers, geen journaal) | staat |
| **Herkomst per antwoord** | `server/ai-context.js` + `ai-stand.js` `uitgevoerd()` | **staat sinds 25 september 2026** (par. 8) |

## 2. Namen

Een deel van de namen uit het voorstel is al bezet. Dit is de goedkoopste
paragraaf van het document.

- **`op-dit-apparaat` is weg.** Het betekende de server van RTG en werd aan het
  lid getoond als "privé op deze Mac". Het heet nu `rtg-server`. Er zijn drie
  plaatsen en ze blijven apart: **`toestel`** (de browser van het lid),
  **RTG-omgeving** (`rtg-server` of `eigen-netwerk`) en **`externe-provider`**.
- **"Execution layer" is bezet, en dat in de strengste betekenis.**
  EXECUTIE.md: *alleen de execution plane veroorzaakt effecten*. Het toestel
  veroorzaakt geen effecten. Het levert tekst, een vector, een label of een
  transcript: **intentie en inhoud, nooit een handeling.** Deze laag heet dus
  **toestelrekenlaag** en niet uitvoeringslaag. Wie hem "executor" noemt,
  maakt er binnen een jaar een tweede uitvoerpad van.
- **Geen ladder `NONE/LIGHT/STANDARD/POWER`.** Dat zou de zesde gezagsladder
  zijn (EXECUTIE.md, AFSPRAAK.md). Het woord *capability* is bovendien
  platformvermogen (OS.md). Wat er komt is een **meting** (par. 3.2).
- **Het woord `kluis` niet gebruiken.** Het staat in 192 bestanden en betekent
  de identiteitskluis. De opslag op het toestel heet al Toestelkluis; modellen
  komen daar in een eigen map naast te staan.
- **Vrije namen** (gemeten op 25 september 2026, 0 treffers in `server`,
  `public`, `scripts`, `test` en de documenten): `taakcontract`, `toestelcel`,
  `modelmanifest`, `toestelrekenaar`.

## 3. De vorm

```
                        RAHUL / RTG
                             │
                      BESTAANDE ROUTER
             techniek (welke)  +  plaats (waar)
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
       TOESTEL          RTG-OMGEVING          EXTERN
          │           rtg-server / eigen-    aanbieder
          │           netwerk (LOCAL_AI_URL)
   TOESTELREKENAAR (in de toestelcel, connect-src 'none')
          │
   browsermodel* → WebGPU → WebNN (later) → WASM (SIMD/threads) → niet hier
```

\* Alleen als de browser een passend ingebouwd model aanbiedt: een
optimalisatie en geen fundament.

### 3.1 Het taakcontract

Een taak verklaart wat hij nodig heeft, niet hoe:

```
spraak.naartekst
  plaats:        toestel            (of: toestel, dan rtg-omgeving na toestemming)
  netwerk:       verboden
  start_max:     1500 ms
  snelheid_min:  realtime (1,0x)
  model_max:     180 MB
  uitwijk:       rtg-omgeving alleen na een expliciete keuze van het lid
                 extern: nooit (kern/spraaktekst.js)
```

Het contract is een **verklaring** in de vorm van `kern/appstore/machtigingen.js`
(doel en grens) en geen interface met verplichte methodes. Taken die er als
eerste op komen: `spraak.naartekst`, `tekst.vector`, `tekst.taal`,
`tekst.samenvatten`, `tekst.herschrijven`, `document.tekst` (OCR). Een vrije
chat komt als laatste en vraagt de meeste twijfel.

### 3.2 De meting: een planner, geen score

Per toestel worden **feiten** gemeten en geen klasse:

| Feit | Hoe | Graad |
|---|---|---|
| `gpu` | `navigator.gpu.requestAdapter()`, plus `adapter.limits` | gemeten |
| `wasm_simd`, `wasm_threads` | functietoets; threads vragen `crossOriginIsolated` | gemeten |
| `geheugen_budget` | `navigator.deviceMemory` (grof, alleen Chromium) plus een proeflading | vermoed / gemeten |
| `opslag_ruimte` | `navigator.storage.estimate()` | gemeten |
| `model_laad_ms` | echte lading van een klein proefmodel | gemeten |
| `spraak_snelheid`, `vectoren_per_sec` | proefinferentie op vaste invoer | gemeten |
| `vertraging_bij_herhaling` | dezelfde proef tien keer; de helling | gemeten |
| `energie` | **geen browser-API** (de Battery API is grotendeels weg) | **onbekend, met die reden** |

Twee correcties op het voorstel. "Thermische degradatie" is in een browser niet
te meten, alleen de **vertraging** die het gevolg is. Die heet daarom zo, anders
beweert het veld een oorzaak die niemand zag. En "energieklasse" staat op
`onbekend` in plaats van geschat, om dezelfde reden als INT-04: een verzonnen
getal is erger dan een leeg veld met een reden.

De planner vergelijkt het contract met de meting. Voldoet het toestel niet, dan
is de uitslag *"deze taak kan op dit toestel niet"* **met het feit dat
ontbrak**, en nooit een stille uitwijk.

### 3.3 De toestelcel

```
RTG-WEBAPP                      normale CSP, géén wasm-unsafe-eval
    │  postMessage: alleen de geselecteerde context (positieve veldlijst)
    ▼
TOESTELCEL (eigen pagina/worker)
    ├── CSP: connect-src 'none'; script-src 'self' 'wasm-unsafe-eval'
    ├── model uit OPFS (zelfde origin), nooit van een CDN
    ├── begrensd geheugen, afbreekbaar
    └── GEEN NETWERK: de browser houdt het tegen, niet onze code
```

`'wasm-unsafe-eval'` komt **alleen** op de cel en niet op alle andere
schermen. Het modelbestand haalt de webapp op (die heeft `connect-src 'self'`)
en schrijft het in OPFS. De cel leest het daar en kan zelf niets ophalen. Zo
geldt "dit toestel nooit verlaten" als een grens van de browser.

### 3.4 Modelbeheer

- **Pas downloaden als de taak voor het eerst nodig is**, en nooit stil. Vooraf
  staan er drie dingen op het scherm: wat het doet, hoe groot het is, en wat er
  daarna op het toestel blijft (*"Lokale spraakherkenning · 94 MB · eenmalig ·
  audio blijft daarna op dit toestel"*). Op een mobiele verbinding vraagt hij
  het nog een keer.
- **Adresseren op inhoud**: de bestandsnaam is de SHA-256 van het bestand. Het
  `modelmanifest` noemt per taak het bestand, de hash, de grootte, de
  **licentie** en de naamsvermelding. Het downloaden moet kunnen hervatten
  (HTTP Range), en een half binnengehaald bestand wordt nooit geladen.
- **Licentie als grendel en niet als veld** (de vorm van KAARTEN.md par. 5a):
  een model zonder toegestane licentie in het manifest laadt de cel niet.
- **Een handtekening op het manifest** voegt pas iets toe als modellen ook van
  een spiegel komen. Van de eigen origin is de hash voldoende. Stand: vraagt
  een besluit (par. 7).
- **Terugrollen**: de vorige versie blijft staan tot de nieuwe één keer goed
  heeft geladen. Ruimte gaat per taak op volgorde van laatst gebruikt, en het
  lid ziet en wist het zelf.
- **Niet in de service worker.** `public/sw.js` heeft een cache met een
  vingerafdruk van de schil (`npm run swcache`). Een model daarin zou bij elke
  schilwijziging opnieuw worden binnengehaald.

### 3.5 Het model dat de browser meebrengt

Chrome heeft ingebouwde modellen voor vertalen, samenvatten, schrijven en
herschrijven. Die gelden als **`toestel`, met uitvoerder `browser`**. Ze rekenen
op het toestel, maar met een model en voorwaarden van de browserleverancier, en
de download beheert de browser zelf. De grootte daarvan kent RTG niet, en dat
staat er zo bij. Het taakcontract kent geen Chrome-API. Een Safari-,
Firefox- of OS-model komt er later naast zonder dat Rahul verandert.

## 4. De grenzen

Zeven stuks. Ze staan bovenop FABRIC.md par. 5 en EXECUTIE.md.

1. **TOE-01. Het toestel levert inhoud, nooit een handeling.** Wil een
   toestelmodel iets met RTG-gegevens, dan gaat dat langs dezelfde weg als elke
   andere aanroep (`kern/stuur/beleid.js`, de resolver, `RTGGewicht.voer`). Het
   lid kan het model vervangen, dus wat het toestel zegt autoriseert niets.
2. **TOE-02. Wat het toestel oplevert is invoer van het lid.** Een transcript,
   een label ("dit vraagt RTG-gegevens") of een samenvatting wordt op de server
   net zo behandeld als getypte tekst: nooit als bewijs en nooit als besluit.
3. **TOE-03. Het toestel roept nooit zelf een externe aanbieder aan.** Ook niet
   met een sleutel van het lid. Anders is `RTG_EXTERNE_AI_UIT` te omzeilen.
   Escaleren naar extern blijft een besluit van de server.
4. **TOE-04. Twee sloten, en het strengste wint.** De beheerder zegt wat het
   huis mag (env). Het lid zegt wat zijn taak mag ("dit toestel nooit
   verlaten"). Het tweede is een voorkeur van het lid, geen env-vlag. De server
   houdt hem bij en weigert dan ook zelf om die taakklasse met een model te
   verwerken. Zo is de voorkeur aan beide kanten een slot. Dezelfde vorm als
   `kern/kosten/grens.js`.
5. **TOE-05. AI-CONTEXT-01 geldt ook op het toestel.** Wat de cel krijgt is
   een positieve lijst velden, nooit "alles, want het blijft toch lokaal".
6. **TOE-06. Niets stil.** Geen stille download, geen stille uitwijk, geen
   "het werkt" zonder meting. Kan een taak niet, dan zegt het scherm dat, met
   de reden.
7. **TOE-07. De kostenmeting kent geen mensen.** Er wordt geteld per taak,
   plaats en model, zonder sessiesleutel, codenaam of toestel-id. Dezelfde
   grens als KOSTEN.md.

## 5. Kosten als stuurinformatie

Het voorstel is om kosten mee te laten wegen in de routering. Dat klopt, met
één aanpassing: de router staat in de schaduw (EXECUTIE.md blok 8), en de
reden daarvoor geldt hier net zo. Er wordt **eerst gemeten** wat het toestel
had gekund, en pas daarna verschuift de volgorde.

Per taak telt de meter (tellers, geen journaal): `taak`, `plaats`,
`uitvoerder`, `model` (de hash), `download_bytes`, `reken_ms`, `wachttijd_ms`,
`geslaagd`/`niet-hier`, en aan de serverkant de tokens en rekentijd die al
worden geteld. Het getal waar het om gaat is een **tegenfeit**: *wat had dit
op de server gekost?* Dat draagt daarom de graad `vermoed`. De besparing wordt
pas `gemeten` als een taakklasse aantoonbaar van de server naar het toestel is
verschoven en de serverteller voor die klasse daalt.

Wat er eerlijk bij moet: het toestel is voor RTG niet gratis. Er is
bandbreedte voor de modellen, en het lid betaalt met batterij en ruimte. De
grootste besparing zit waarschijnlijk in de vele kleine taken (vectoren, taal,
transcripten, classificatie) en niet in chat. Ook dat is een verwachting tot de
meter er staat.

## 6. De volgorde, per onderdeel

| # | Onderdeel | Stand |
|---|---|---|
| 1 | Herkomst per antwoord en drie plaatsnamen | **staat** (par. 8) |
| 2 | Dit document en de grenzen | **staat** |
| 3 | Toestelcel en echte toestelmeting (leeg geraamte) | een stap weg; wacht op besluit 1 |
| 4 | Toestelrekenaar: browsermodel → WebGPU → WASM, WebNN als latere trede | een stap weg na 3 |
| 5 | Modelmanifest, hashes, licentiegrendel, OPFS-beheer, terugrollen | een stap weg; wacht op besluit 2 en 3 |
| 6 | `spraak.naartekst` op het toestel, gemeten op echte telefoons | een stap weg na 4-5; vult SERVICE.md par. 13d zonder `LOCAL_AI_URL` |
| 7 | `tekst.vector` over de Toestelkluis | een stap weg na 4-5 |
| 8 | Samenvatten en herschrijven | een stap weg; het browsermodel als eerste trede |
| 9 | Een kleine algemene LLM | jaren weg op een telefoon, dichterbij op een laptop; te meten, niet te schatten |
| 10 | Verschuiving meten in de kostenlaag | een stap weg na 6 |
| – | WebNN als vereiste | jaren weg: de ondersteuning is experimenteel |

## 7. Besluiten van de eigenaar

1. **`'wasm-unsafe-eval'` op de toestelcel**, en alleen daar. Dit versoepelt de
   strengste regel van het huis op één pagina. Advies: ja, op die ene pagina,
   met `connect-src 'none'` ernaast en een toets die de combinatie vasthoudt.
2. **Modelhosting.** Honderden MB tot enkele GB per model, van de eigen origin
   (de CSP staat geen CDN toe). Dat kost bandbreedte en hoort in KOSTEN.md.
   Advies: eigen origin met Range-ondersteuning, per taak.
3. **Welke modellicenties toegestaan zijn.** Apache-2.0 en MIT zijn
   eenvoudig. Voor de voorwaarden van Gemma en de Llama-licentie is eerst een
   juridisch oordeel nodig. Advies: begin met alleen Apache/MIT.
4. **Het browsermodel opnemen**, met de voorwaarden van de leverancier.
   Advies: ja als optimalisatie, zichtbaar als "model van uw browser", nooit
   als enige weg.
5. **Standaard downloadbeleid.** Advies: alleen na een tik van het lid, en op
   een mobiele verbinding nog een keer vragen.

## 8. Wat er op 25 september 2026 is gerepareerd

Het label onder een Rahul-antwoord kwam uit de **configuratie**
(`ai-stand.js beschikbaarheid`) en niet uit wat er gebeurde. Stond er een
externe aanbieder in de keten, dan zei elk antwoord "externe uitwijk
zichtbaar", ook als het lokale model antwoordde of als er helemaal geen model
aan te pas kwam. Daarnaast hield de keten de laatst gebruikte aanbieder bij op
een gedeeld object (`client.actief`). Dat werd niet als label gelezen, maar
wie het ervoor aanzag, gaf bij twee gelijktijdige vragen het ene antwoord de
herkomst van het andere.

Wat er nu is:

- `ai-context.js` `noteerUitvoering()` legt per verzoek aanbieder en plaats
  vast. Geen prompt, geen tokens, geen persoon.
- `ai-stand.js` `uitgevoerd()` verantwoordt dat: `zonderModel`, `plaatsen`,
  `aanbieders`, `extern`. Dat is een eigen veld naast de stand en vervangt de
  stand niet.
- `/api/fluister`, `/api/ai` en `/api/supplier/ai` sturen het mee. De Rahul-tab toont eerst wat er
  gebeurde en valt anders terug op de stand.
- `op-dit-apparaat` heet `rtg-server`, en "deze Mac" komt op geen enkel scherm
  meer voor.

`test/ai-herkomst.test.js` laat twee verzoeken tegelijk door één keten lopen.
Het ene antwoordt lokaal, het andere wijkt uit naar extern, en elk verzoek
hoort alleen zijn eigen plaats te zien. Twee mutaties laten de toets zakken:
de noteerregel weghalen, en de lijst delen in plaats van per context bijhouden.

Wat nog **niet** gedekt is: andere schermen met een eigen AI-aanroep (de
fluisterlaag van het personeel, de schrijfhulp in Office) tonen de stand of
niets. Die krijgen `uitgevoerd` wanneer ze een herkomstlabel gaan tonen, en
niet eerder.
