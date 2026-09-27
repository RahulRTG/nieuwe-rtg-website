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
- **Een handtekening op het manifest**, met een sleutel die offline blijft en
  kan roteren. Besloten op 25 september 2026; de uitwerking en wat hij wel en
  niet beschermt staan in par. 9.3.
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
| 3 | Toestelcel en echte toestelmeting | **staat** (par. 10) |
| 4 | Toestelrekenaar met twee uitvoerders (eigen WASM, ONNX Runtime) | **staat** voor WASM (par. 10); WebGPU is hier niet te meten, het browsermodel en WebNN een stap weg |
| 5 | Modelmanifest, hashes, licentiegrendel, OPFS-beheer | **staat** (par. 10); terugrollen naar een vorige versie een stap weg |
| 6 | `spraak.naartekst` op het toestel, gemeten op echte telefoons | **staat** als keten, gemeten in Chromium (par. 11), met een lusrem en een Nederlandse proefset (par. 13); een model dat Nederlands aankan, opnamen van mensen, telefoons en een bron die we mogen ondertekenen zijn een stap weg; vult SERVICE.md par. 13d zonder `LOCAL_AI_URL` |
| 7 | `tekst.vector` over de Toestelkluis | **staat** als keten, gemeten in Chromium (par. 12), met een Nederlandse zoekproefset (par. 13) en een index in de Toestelkluis (par. 14); een meertalig model is een stap weg en wacht op het netwerk |
| 8 | Samenvatten en herschrijven | een stap weg; het browsermodel als eerste trede |
| 9 | Een kleine algemene LLM | jaren weg op een telefoon, dichterbij op een laptop; te meten, niet te schatten |
| 10 | Verschuiving meten in de kostenlaag | een stap weg na 6 |
| – | WebNN als vereiste | jaren weg: de ondersteuning is experimenteel |

## 7. Besluiten van de eigenaar

1. **`'wasm-unsafe-eval'` op de toestelcel**, en alleen daar. Genomen op 25
   september 2026: ja, op die ene pagina, met `connect-src 'none'` ernaast;
   `test/toestel-routes.test.js` houdt de combinatie vast.
2. **Modelhosting.** Genomen op 27 september 2026: de eigen server, in
   `RTG_TOESTEL_DIR` via `/toestel/artefact/<sha256>` met Range. RTG draagt de
   bandbreedte (dat hoort in KOSTEN.md), en geen derde ziet welk lid welk model
   ophaalt.
3. **Welke modellicenties toegestaan zijn.** Genomen op 25 september 2026:
   zo breed mogelijk. Alles met bekende voorwaarden die commercieel gebruik
   toestaan, ook Gemma en Llama met hun eisen erbij; onbekend en
   niet-commercieel blijven dicht (`public/shared/toestel/licenties.js`).
4. **Het browsermodel opnemen**, met de voorwaarden van de leverancier.
   Advies: ja als optimalisatie, zichtbaar als "model van uw browser", nooit
   als enige weg.
5. **Standaard downloadbeleid.** Genomen op 25 september 2026: alleen na een
   tik van het lid, en op een mobiele verbinding (of een die de browser niet
   laat zien) nog een keer vragen (`public/shared/toestel/opslag.js`).
6. **Waar de modelsleutel woont.** Genomen op 25 september 2026: offline en
   onder menselijke controle, met rotatie als protocol en een eigen
   vertrouwensdomein, los van de release-trust (par. 9.3).

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

## 9. De beslisvolgorde en vier eigenschappen voor productie

Tweede ronde, 25 september 2026. Wat hier staat, verandert niets aan par. 0-8;
het maakt de planner van par. 3.2 volledig.

### 9.1 De volgorde is een filter, en pas het laatste is een keuze

```
TAAKCONTRACT
  1. beleid       mag deze aanroeper deze taak laten doen?          (weigert)
  2. privacy      mag deze invoer deze PLAATS bereiken?             (weigert)
  3. techniek     welke techniek kan het (regels, algoritme, model)? (weigert)
  4. uitvoerders  welke zijn hier aanwezig en toegelaten (par. 9.3)? (weigert)
  5. kwaliteit    welke halen de GEMETEN minimumkwaliteit (9.2)?    (weigert)
  6. last         welke passen in wachttijd, geheugen, energie (9.4)? (weigert)
  7. kosten       van wat overblijft: de goedkoopste                (kiest)
UITVOEREN -> meting + herkomst + kosten
```

Stap 1 t/m 6 **sluiten uit** en wegen niets. Dat wordt een toets en geen
voornemen: de planner krijgt een kandidaat die op kosten wint en op een
eerdere stap afvalt, en die kandidaat mag nooit gekozen worden, hoe groot
het kostenvoordeel ook is. Alleen stap 7 kiest. Zo kan een
kostenvoordeel nooit een privacy- of kwaliteitsgrens compenseren. Dat is
dezelfde regel als in CONNECT.md (*de mixer verdeelt plekken en geen punten*):
zodra elke eigenschap een getal levert en de hoogste som wint, zit er weer een
gewichtenvector die niemand kan lezen. Elke uitsluiting draagt haar reden in
woorden. Valt alles af, dan is de uitslag *"deze taak kan hier niet"* met de
eerste stap die iedereen uitsloot, en nooit een stille uitwijk naar een
plaats die stap 2 had verboden.

### 9.2 Kwaliteitsgrens vóór kosten

Een minimumkwaliteit bestaat alleen als hij **gemeten** is. Daarom heeft elk
taakcontract een vaste proefset met een maat die bij de taak hoort:

| Taak | Maat | Graad |
|---|---|---|
| `spraak.naartekst` | woordfout (WER) op een vaste Nederlandse set | gemeten |
| `tekst.vector` | recall@10 op een vaste zoekset | gemeten |
| `tekst.taal` | nauwkeurigheid op een vaste set | gemeten |
| `document.tekst` (OCR) | tekenfout (CER) | gemeten |
| `tekst.samenvatten`, `tekst.herschrijven` | **geen automatische maat die de kwaliteit vaststelt** | beoordeeld door een mens op een vaste set, graad `vermoed` |

De laatste rij staat er met opzet zo. Een ROUGE-getal op een samenvatting zegt
iets over woordoverlap en niet over of de samenvatting klopt. Een grens op dat
getal is een schijngrens. Voor die taken is de grens *"een mens keurde deze
uitvoerder op deze set"*, en een nieuwe uitvoerder wacht op die keuring.

### 9.3 Supply chain: het manifest als grendel

Per uitvoerbaar artefact:

```
model-id, versie, sha256, grootte, bron (waar het vandaan komt en wie het
maakte), licentie + naamsvermelding, taakcontracten waarvoor het is toegelaten,
gemeten kwaliteit per contract (met proefset-versie en datum), handtekening
```

De toestelcel laadt een bestand alleen als de hash overeenkomt met een
manifestregel die zelf geldig is ondertekend. Een onbekend of gewijzigd bestand
is **niet uitvoerbaar**, en dat is zichtbaar: het is geen waarschuwing die
toch laadt.

**De controle, in deze volgorde, en elke stap weigert:** bekende sleutel →
handtekening geldig → hash klopt → licentie toegestaan → contract passend →
pas dan laden. Het manifest draagt daarvoor ook `sleutel-id` en de
handtekening zelf.

**Sleutelrotatie is een protocol en geen noodgreep.** De webapp kent een lijst
vertrouwde modelsleutels, en elke regel heeft een id, de publieke helft,
geldig-vanaf en een stand:

| Stand | Controleert handtekeningen | Tekent nieuwe manifesten |
|---|---|---|
| `actief` | ja | ja |
| `uitgefaseerd` | ja | nee |
| `ingetrokken` | **nee** | nee |

Wat een handtekening niet kan dragen is een betrouwbaar TIJDSTIP: wie de
private sleutel heeft, zet er elke datum op. Daarom werkt intrekken over alles
wat onder die sleutel viel en niet over "wat na datum X getekend is". Een
ingetrokken sleutel maakt al zijn modellen onlaadbaar tot ze opnieuw zijn
ondertekend, en dat is de juiste kant om naar te falen. Geldig-tot is
optioneel en is dan een geplande uitfasering, geen bescherming.

**Een eigen vertrouwensdomein, los van de releases.** `server/config/release-trust.js`
kent drie rollen (BUILD, EVIDENCE, PROMOTION), elk met Ed25519, een eigen
publiek bestand en een eigen domeinvoorvoegsel (`RTG:BUILD:v1` enzovoort), zodat
een handtekening uit de ene rol nooit in de andere geldt. De modelsleutel volgt
dat patroon (Ed25519, voorvoegsel `RTG:MODEL:v1`) maar komt er **niet als vierde
rol in**. Die drie zijn vaste ankers zonder rotatie, en een gelekte modelsleutel
mag niets betekenen voor een release, en andersom. Andere sleutel, andere
lijst, andere intrekking.

**Controleren gebeurt in de browser**, met WebCrypto Ed25519. Kan de browser
dat niet, dan laadt de cel niets. Dat is geen terugval op "vertrouw de hash
dan maar".

Wat de handtekening wel en niet beschermt, want dat verschil wordt vaak
gemist. Hij beschermt tegen een gemanipuleerde **opslag** (een spiegel, een
CDN, een aangetaste bucket): die kan het bestand vervangen, maar niet de
handtekening namaken. Hij beschermt **niet** tegen een aangetaste **origin**:
wie de JavaScript of de service worker van RTG kan vervangen, kan ook de code
vervangen die de handtekening controleert. Zo wordt hij dus ook niet
gepresenteerd. De lijst vertrouwde sleutels staat in de
service-worker-schil (vingerafdruk-cache), zodat een wissel een release is en
geen configuratie. De private helft verlaat de offline omgeving niet en woont
niet in de repo of op een server (besluit 6).

### 9.4 Energie en warmte als echte grens

"Lokaal is goedkoper voor RTG" is geen argument als een telefoon heet wordt om
€ 0,002 te besparen. De grens komt daarom vóór de kosten (stap 6), en een lid
kan hem aanscherpen ("spaar mijn batterij").

Wat een browser werkelijk laat zien, en dat is minder dan het voorstel
aanneemt:

| Signaal | Beschikbaar | Gebruik |
|---|---|---|
| Laadt het toestel, batterijniveau | `navigator.getBattery()`, alleen Chromium; niet in Safari of Firefox | zwaar werk alleen aan de lader of boven een drempel; ontbreekt het signaal, dan de strengste aanname |
| Warmte | **geen API** | niet meten; afleiden uit `vertraging_bij_herhaling` (par. 3.2): wordt dezelfde taak binnen een sessie trager, dan stopt de toestelcel met zwaar werk voor die sessie |
| Zuinige stand van het OS | niet betrouwbaar leesbaar | niet gebruiken |
| Rekentijd per taak | zelf gemeten | harde bovengrens in het contract (`reken_max_ms`); daarboven breekt de cel af |

Een grens die we niet kunnen meten, bouwen we dus niet als meting maar als
**voorzichtigheid**: een plafond op rekentijd en een terugval zodra het
toestel trager wordt. Dat staat er zo bij, zodat niemand later denkt dat RTG
de temperatuur van een telefoon kent.

### 9.5 Canary voor een nieuwe uitvoerder of een nieuw model

```
proefset (9.2) -> vergelijking met de huidige uitvoerder op hetzelfde toestel
   -> kleine uitrol -> vergelijking in het veld -> promotie of terugrollen
```

Twee aanpassingen op wat al in dit huis is besloten:

- **Promotie is een besluit van een mens.** Automatisch terugrollen mag, en
  moet zelfs, zodra een meting onder de grens zakt. Automatisch promoveren
  niet: *autonomie wordt gepromoveerd en nooit geslopen* (FABRIC.md), en een
  gegenereerde meting promoveert niets tot een mens hem heeft afgetekend
  (CODE.md par. 7).
- **Voor de livegang is er geen veld.** Zonder leden is een uitrol op een
  percentage zinloos, net als bij drie medewerkers (KANTOORMACHT.md). Tot er
  echte gebruikers zijn, is de canary de proefset op een vaste rij echte
  toestellen, en dat heet dan ook zo.

### 9.6 Wat elke uitvoering oplevert, en waar dat blijft

Elke uitvoering levert een waarneming op: *dit model, met deze uitvoerder, op
deze browser en deze hardware, haalde voor taak X zoveel per seconde, zoveel
ms starttijd en zoveel geheugen*. Daarmee wordt de planner beter.

**Maar die combinatie is een vingerafdruk.** GPU-adapter, browserversie,
geheugen en snelheden samen zijn precies waarmee trackers een toestel
herkennen, en `toestelsleutel.js` zegt met zoveel woorden dat er hier niets
aan de browser wordt gemeten om iemand te herkennen. Daarom twee lagen:

- **Op het toestel** blijft de volledige waarneming staan. De planner van DIT
  toestel leert van zijn eigen metingen, en die verlaten het toestel niet.
- **Naar RTG** gaan alleen grove klassen als tellers (bijvoorbeeld
  `webgpu/wasm`, geheugen in drie banden, taak, uitvoerder, geslaagd of niet
  hier, snelheid in banden). Er gaat geen adapternaam, geen exacte versie,
  geen toestel-id en geen sessiesleutel mee (TOE-07). Een klasse waar maar
  enkele toestellen in vallen, wordt niet gerapporteerd.

Dat kost de centrale planner precisie. Die prijs is bewust: een
optimalisatie die een lid herkenbaar maakt, is geen optimalisatie.

### 9.7 Verder dan AI: een rekentaak, geen handeling

Het contract werkt ook voor taken zonder model: `route.optimaliseer`,
`bestand.omzetten`, `tekst.vertalen`. Sommige doet een algoritme, sommige een
model, sommige het toestel en sommige RTG. Het product hoeft dat niet te
weten.

De grens die dat houdbaar houdt: **een taakcontract dekt alleen rekentaken
zonder bijwerking** (invoer erin, uitkomst eruit, verder niets). Alles wat
iets verandert (opslaan, versturen, betalen, boeken) blijft van de execution
plane (EXECUTIE.md) en komt nooit in een taakcontract. Zonder die grens wordt
het taakcontract de zeventiende motor naast MACHINE.md.

Daarom ook een naamkeuze: de router wordt **geen "execution planner"**.
`kern/stuur/plan.js` is al PLAN (EXECUTIE.md blok 3), en de router beslist
bewust nog niets (blok 8). Hij wordt breder: van *welke techniek* naar *welke
techniek, op welke plaats, met welke uitvoerder*. Hij blijft een router voor
**rekentaken**. De kaart van wat een handeling doet en mag, blijft waar die al
staat.

### 9.8 Wat dit verandert aan de volgorde (par. 6)

De machine vóór de functies: stap 3 t/m 5 worden **toestelcel + taakcontract +
planner met de volgorde van 9.1 + manifestgrendel + meting (9.6)**, samen, en
pas daarna het eerste werk. Spraak en vectoren zijn niet het doel maar de
twee bewijzen dat de machine werkt. Ze zijn gekozen omdat ze een gemeten
kwaliteitsmaat hebben (9.2) en maximaal verschillend zijn: geluid in en tekst
uit tegenover tekst in en een vector uit. Twee punten liggen altijd op een
lijn, dus pas een derde, anders gevormde taak (OCR) zegt dat het contract
generaliseert.

## 10. De machine staat (25 september 2026)

Par. 9 is bevroren; dit is wat de bouw ervan maakte. Stap 3 t/m 5 van par. 6
staan, als machine en zonder werk erop: spraak en vectoren zijn de volgende
twee bewijzen.

| Onderdeel | Waar | Bewijs |
|---|---|---|
| De poorten: zes die uitsluiten, kosten die kiest | `public/shared/toestel/poorten.js` | `test/toestel-poorten.test.js`: 2000 rondes willekeurige kandidaten, een afgevallene wordt nooit gekozen; twee mutaties (kiezen over alle kandidaten, de privacypoort overslaan) zakken |
| De licentiegrendel, zo breed mogelijk | `public/shared/toestel/licenties.js` | onbekend en niet-commercieel dicht, met de reden |
| Het manifest als grendel | `public/shared/toestel/manifest.js` | `test/toestel-manifest.test.js`: elke stap weigert op zijn eigen plek; drie mutaties (hash, intrekking, voorvoegsel) zakken |
| Offline ondertekenen | `scripts/toestel-artefact.js`, `scripts/lib/toestelteken.js` | weigert een private sleutel in de repo en tekenen met een niet-actieve sleutel |
| De vertrouwde sleutels | `public/shared/toestel/sleutels.js` | met opzet **leeg**: zolang er geen echte sleutel bij een mens ligt, laadt geen toestel iets (e2e: de productielijst weigert bij stap 1) |
| Vier serverdeuren | `server/routes/toestel.js` | `test/toestel-routes.test.js`, echte server: de cel draagt `'wasm-unsafe-eval'` alleen met `connect-src 'none'`, een gewone pagina niet |
| De cel | `public/shared/toestel/cel.js`, via `/toestel/cel` | e2e: IN het sandboxframe gemeten -- `fetch` dicht, ouder dicht, OPFS dicht, origin `null` |
| De rekenaar | `public/shared/toestel/rekenaar.js` | e2e: 6 × 7 = 42 met herkomst `toestel`; gewijzigde bytes weigeren bij `hash`; elke cel `sandbox="allow-scripts"` en `allow=""`, en na afloop weg |
| Opslag op het toestel | `public/shared/toestel/opslag.js` | e2e: geen download zonder tik, onbekende verbinding vraagt nog eens, tweede keer uit OPFS |
| De meting | `public/shared/toestel/meting.js` | feiten zonder klasse; energie `null` met de reden; niets naar RTG |
| Tweede uitvoerder: ONNX Runtime Web 1.30 | `scripts/toestelproef.js` | echte runtime in dezelfde cel: [1,2,3] × [4,5,6] = [4,10,18], 209 ms rekentijd, zonder een regel in rekenaar of cel te veranderen |

### 10.1 Wat het bouwen blootlegde

- **De cel heeft geen origin, en dan werkt `same-origin` tegen je.** Het huis
  zet op elk statisch bestand `Cross-Origin-Resource-Policy: same-origin`, dus
  de cel kon haar eigen script niet laden en zei nooit "klaar"
  (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`). Het celscript heeft daarom een
  eigen adres, `/toestel/cel.js`, met `cross-origin` voor dat ene openbare
  bestand. Alleen de echte browser vond dit; elke toets op de server stond
  groen.
- **Een toets die het voorvoegsel niet kon missen, miste het.** Het
  weghalen van `RTG:MODEL:v1` liet de manifesttoets eerst groen: hij bewees
  alleen dat een ANDER voorvoegsel faalt. Er staat nu ook een handtekening
  over de kale inhoud naast.
- **Een isolatieproef die zelf de cel opent, bewijst niets over de
  rekenaar.** De e2e-toets kijkt nu welk kader de rekenaar ZELF bouwt; met
  `allow-same-origin` erbij zakt hij.
- **Een rekencel hoort geen camera te krijgen.** Keuringsregel 38b eiste
  `RTGMedia.kader()` voor elk gebouwd kader; hij kent nu ook het omgekeerde
  besluit voor een gebouwd kader (`allow=""`), zoals hij dat al kende voor de
  App Store-cel.
- **De runtime is een artefact en geen afhankelijkheid.** Het huis heeft nul
  afhankelijkheden (keuringsregel 14), en ONNX Runtime is 14 MB aan
  WebAssembly. Hij komt daarom binnen zoals een model: ondertekend, met hash en
  licentie, als blob-module in de cel. Vandaar `blob:` in de `script-src` van
  de cel, en alleen daar.

### 10.2 Wat er met opzet nog niet is

- **WebGPU**: headless Chromium heeft hier geen adapter, dus alleen de
  WASM-route is bewezen. `feiten().webgpu` staat hier op `false`, en dat is
  gemeten en niet aangenomen.
- **Echte modellen**: Hugging Face wordt door het netwerkbeleid van deze
  omgeving geweigerd. Zodra `huggingface.co` openstaat, volgen
  `spraak.naartekst` (Whisper, MIT) en `tekst.vector` (een Apache-model), elk
  met een proefset en een gemeten maat (par. 9.2).
- **Het rekentijdplafond** staat in de rekenaar maar is niet beproefd: daar
  is een uitvoerder voor nodig die bewust te lang rekent.
- **Een schakelaar in de boardroom**: `/toestel` staat in `kern/bestuursroutes.js` en `kern/platformregister/bediening.js` en niet aan een functie, omdat de functiepoort alleen `/api` afdwingt. De uitknop is nu een lege sleutellijst en geen manifest; een echte schakelaar vraagt dat de functiepoort ook `/toestel` afdwingt.
- **Centrale tellers (TOE-07)**: de meting stuurt niets naar RTG. Grove
  tellers zonder toestel-id komen pas als er iets te tellen valt.
- **Het downloadscherm**: `opslag.haal()` weigert zonder tik, maar het scherm
  dat de tik vraagt (wat, hoe groot, wat blijft) hoort bij de eerste echte
  taak en is er nog niet.
- **De sleutellijst in de service-worker-schil**: `sleutels.js` is nog leeg en
  staat nog niet in `SHELL`; dat gebeurt met de eerste echte sleutel, en dan
  hoort `npm run swcache` erbij.

## 11. Spraak naar tekst: het eerste echte contract (27 september 2026)

`spraak.naartekst` loopt als keten, in een echte browser, over de machine van
par. 10 -- en de rekenaar, de grendel en de opslag zijn er geen letter voor
veranderd. Wat erbij kwam is een derde uitvoerder in de cel en twee modules
aan de ouderkant.

| Onderdeel | Waar | Bewijs |
|---|---|---|
| WAV, herbemonsteren, log-mel, tokens naar tekst, de openingstokens | `public/shared/toestel/spraak.js` (puur) | `test/toestel-spraak.test.js`: het spectrogram tegen een ONAFHANKELIJKE referentie (`test/fixtures/whisper-mel-toon.json`, uit transformers 5.17 en niet uit deze code); zes mutaties zakken, waaronder het Hann-venster, de gespiegelde rand en het overslaan van speciale tokens |
| De ouderkant van het contract | `public/shared/toestel/spraakvoer.js` | vocabulaire, speciale tokens, configuratie en generatie-instelling gaan langs DEZELFDE grendel als het model: een tokenizer die niet klopt, maakt van een goed model een leugenaar |
| De uitvoerder `whisper` | `public/shared/toestel/cel.js` | encoder een keer, decoder token voor token met zijn eigen geheugen; hebzuchtig, met de onderdrukte tokens uit de generatie-instelling van het model zelf. Er gaat een spectrogram in en er komen token-id's uit |
| De meting | `scripts/spraakproef.js` | Chromium, WASM zonder threads: 11 s spraak in **6,3 s** rekentijd (9,5 s totaal met het spectrogram), woordfout **0** tegen de bekende tekst, herkomst `toestel` met acht artefacten op hash |

Het spectrogram is gelijk aan dat van de `WhisperFeatureExtractor` tot op de
precisie van float32: over alle 240.000 waarden van de JFK-opname was het
grootste verschil 1,2e-7.

### 11.1 Waar de bytes vandaan kwamen, en waarom ze niet ondertekend zijn

Hugging Face en jsDelivr worden door het netwerkbeleid geweigerd (403). Het
npm-register niet, en daar staat `sts-whisper-tiny@1.0.0`: een kopie van
`Xenova/whisper-tiny` (q8, de vorm van transformers.js), op 17 september 2026
geplaatst door een onbekende uitgever. **Die is gebruikt om te METEN en wordt
nooit ondertekend**: een handtekening van RTG zegt "deze bytes zijn wat wij
bedoelen", en dat weten we van een anonieme herverpakking niet. De hashes van
wat er gemeten is:

| Bestand | sha256 |
|---|---|
| `onnx/encoder_model_quantized.onnx` | `fd9d995b9dcb0520f0dbf6cf68651af639fc385f594d9d876e69ca2802dc438e` |
| `onnx/decoder_model_merged_quantized.onnx` | `6c0c125986b007d2e3734bec84c18bda0152071b90b87fadac6d7764499927a0` |
| `vocab.json` | `50d6a919f0a0601d56a04eb583c780d18553aa388254ba3158eb6a00f13e2c1a` |
| `added_tokens.json` | `ce949fe720c14311cb6c446e69cfe340dc669d7b006077a6feed6ae571dd7e88` |
| `config.json` | `2b2e4e519084e0ea028b19b153f95202735a971870d6844aa26e559edd292e94` |
| `generation_config.json` | `68ac791fcb4999461a313472125042934656240ba1cba7d1c2627fcbb19ac24c` |

De weg naar een ondertekend model is daarom: dezelfde bestanden van de bron
halen (`onnx-community` of `Xenova` op Hugging Face, of zelf exporteren uit de
gewichten van OpenAI), de hashes naast deze tabel leggen, en pas dan tekenen.
Kloppen ze, dan was de kopie eerlijk; kloppen ze niet, dan weten we dat ook.

### 11.2 Wat dit nog niet bewijst

- **Kwaliteit.** Een opname is een rookproef. De kwaliteitspoort (par. 9.2)
  vraagt een proefset met een gemeten woordfout per taal, en voor Nederlands
  is er nog niets gemeten -- whisper-tiny is daar zwak, en dat hoort een getal
  te worden en geen indruk.
- **Telefoons.** Gemeten op een server-Chromium. De rekentijd op een telefoon
  is onbekend, en 6,3 s voor 11 s spraak laat weinig marge; de lastpoort
  (par. 9.4) moet dat per toestel leren.
- **Sneller.** De decoder draait zonder WebGPU en zonder threads. Threads
  vragen `crossOriginIsolated` (een besluit), WebGPU een adapter die hier
  ontbreekt.
- **Een scherm.** Er is geen knop die de microfoon naar deze keten leidt; de
  meeleesbaan (SERVICE.md par. 13d) is de eerste plek, en die komt pas als er
  een model is dat we mogen ondertekenen.
- **De sleutel.** `sleutels.js` blijft leeg. De private modelsleutel wordt
  niet in deze cloudomgeving gemaakt: een sleutel die hier ontstaat, heeft
  een machine gezien die niet van RTG is, en dan is "offline, bij een mens"
  (besluit 6) al gebroken voordat hij iets tekent. De eigenaar maakt hem met
  `node scripts/toestel-artefact.js nieuwe-sleutel` op een eigen machine en
  zet alleen de publieke helft in de lijst.

## 12. Tekst naar vector: het tweede contract, zonder nieuwe uitvoerder (27 september 2026)

`tekst.vector` loopt als keten in een echte browser, en de cel kreeg er GEEN
uitvoerder bij: het model draait op de algemene uitvoerder `onnx`. Dat is de
belofte van par. 0 in zijn kleinste vorm -- een tweede taak is een contract,
geen nieuwe machine.

| Onderdeel | Waar | Bewijs |
|---|---|---|
| Normaliseren, WordPiece, invoer per tekst, middelen, cosinus | `public/shared/toestel/vector.js` (puur) | `test/toestel-vector.test.js`: de tokens van 13 zinnen (accenten, leestekens, CJK, emoji, een URL, witruimte) exact gelijk aan de Python-bibliotheek `tokenizers` (`test/fixtures/minilm-tokens.json`); zes van zeven mutaties zakken, de zevende is gelijkwaardig (zie onder) |
| De ouderkant van het contract | `public/shared/toestel/vectorvoer.js` | de tokenizer gaat langs dezelfde grendel als het model; elke uitslag draagt een VINGERAFDRUK (sha256 van runtime, model en tokenizer samen) |
| Een reeks runs in een sessie | `public/shared/toestel/cel.js`, uitvoerder `onnx` | `invoer.reeks` naast `invoer.feeds`; de bestaande ONNX-proef en de spraakketen draaien er ongewijzigd op |
| De meting | `scripts/vectorproef.js` | Chromium, WASM: 13 teksten in **612 ms** rekentijd (2,3 s totaal met laden), 384 dimensies, laagste cosinus met de Python-referentie **0,993**, en een tekst los gerekend is gelijk aan dezelfde tekst in de reeks (cosinus 1,0000000) |

### 12.1 Wat het meten blootlegde

- **In een batch hangt een vector af van zijn buren.** Het gekwantiseerde
  model rekent zijn schaal over de hele invoer, dus dezelfde zin gaf naast een
  andere zin een andere vector (cosinus 0,993), ook als hij zelf niet werd
  opgevuld. Een zoekindex waarin "de hond rent" anders klinkt naargelang wat er
  toevallig mee werd ingelezen, is geen index. Daarom is er geen batch: elke
  tekst krijgt een eigen run, en de cel draait ze na elkaar in een sessie.
- **Twee runtimes, twee vectoren.** Dezelfde bytes en dezelfde tokens gaven in
  de browser (WASM) en in Python (x64) een cosinus van 0,993 tot 1,000; met de
  graafoptimalisaties uit bleef dat zo, dus het verschil zit in de rekenkernen
  en niet in onze code. Een vector is daarom alleen vergelijkbaar met een
  vector van DEZELFDE vingerafdruk. Een index slaat die mee op, en een vector
  van een ander toestel of een andere runtime wordt opnieuw berekend en nooit
  naast de eigen gelegd.
- **Een gelijkwaardige mutant is geen gat.** Het weghalen van de deling door
  het aantal tokens laat de toets groen, en terecht: gemiddelde en som wijzen
  na het normaliseren exact dezelfde kant op.

### 12.2 Waar de bytes vandaan kwamen

Net als bij spraak (par. 11.1): Hugging Face wordt geweigerd, en het model kwam
van npm, uit `@ryanstark24/sfgraph-models@1.1.3` -- een kopie van
`Xenova/all-MiniLM-L6-v2` (q8, Apache-2.0) met een eigen `CHECKSUM.json`. Alleen
gebruikt om te meten, niet ondertekend. De hashes: `onnx/model_quantized.onnx`
`afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`,
`tokenizer.json` `da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0`
(gelijk aan wat die kopie zelf opgeeft, en dat zegt alleen dat hij consequent
is -- niet dat hij van de bron komt).

### 12.3 Wat dit nog niet bewijst

- **Nederlands.** all-MiniLM-L6-v2 is getraind op Engels. Gemeten:
  "De hond rent door het park." en "A dog is running through the park." halen
  een cosinus van 0,16, lager dan twee zinnen over iets anders in dezelfde taal.
  Voor leden is een meertalig model nodig (multilingual-e5-small, MIT, of
  paraphrase-multilingual-MiniLM, Apache) -- dezelfde machine, een ander
  artefact, en de tokenizer is dan geen WordPiece maar SentencePiece.
- **Zoekkwaliteit.** Gelijk zijn aan een referentie is geen kwaliteit. Dat
  vraagt een proefset met relevantie-oordelen (par. 9.2).
- **De Toestelkluis.** Staat sinds par. 14, als index NAAST de bestaande
  kluis en niet als tweede kluis.

## 13. Gemeten in het Nederlands (27 september 2026)

De tekortkomingen van par. 11.2 en 12.3 zijn waar het kon GEMETEN in plaats van
beschreven. Waar een meting er niet komt, staat waarom.

### 13.1 Spraak: een Nederlandse proefset, en een lusrem die er zonder hem niet was

`test/fixtures/proefset-spraak-nl.json` heeft twaalf zinnen uit het dagelijks
gebruik; `scripts/spraakset.js` maakt er opnamen van met espeak-ng, en
`scripts/spraakproef.js` met `RTG_SPRAAK_SET` telt de woordfout over de hele set
(alle fouten gedeeld door alle woorden) en per zin.

| Set | Woordfout whisper-tiny | Lussen |
|---|---|---|
| Nederlands, synthetische stem, zonder lusrem | 3,01 (340 fouten op 113 woorden) | 2, tot het plafond |
| Nederlands, synthetische stem, met lusrem | **0,885** | 2, gestopt en gemeld |
| Engels, DEZELFDE synthetische stem, dezelfde zinnen | 0,578 | 0 |
| Engels, echte stem (JFK, par. 11) | 0,000 | 0 |

Drie dingen die de meting laat zien:

- **Een echte fout in onze uitvoerder.** Op twee zinnen schoot het model in een
  lus ("een beetje een beetje ...") en rekende door tot het plafond: 45 s werk
  voor een tekst die er vol uitzag. De cel stopt nu als het staartstuk van 1 tot
  12 tokens zich vier keer herhaalt, laat een exemplaar staan en zegt
  `herhaling: true` (`public/shared/toestel/cel.js`; `test/toestel-spraak.test.js`
  toets 7 op de ECHTE cel.js, twee mutaties zakken). Drie keer mag wel: "ja ja ja"
  is geen lus.
- **De synthetische stem is zelf een slecht instrument.** Dezelfde robotstem gaf
  in het Engels 58% woordfout waar een echte stem 0% gaf. Deze set meet dus model
  plus stem, en zegt niet hoe goed een lid wordt verstaan. De uitslag draagt dat
  voorbehoud in de tekst.
- **Maar het verschil staat.** Met dezelfde stem is Nederlands 88,5% tegen
  Engels 58%. whisper-tiny is te zwak voor Nederlands, en dat is nu een getal en
  geen vermoeden. De weg is een groter Whisper (base of small, ook MIT) door
  dezelfde machine -- een ander artefact, geen andere code -- en opnamen van
  mensen in plaats van espeak.

### 13.2 Zoeken: een Nederlandse proefset, met een woordtelling ernaast

`test/fixtures/proefset-zoeken-nl.json` heeft twaalf notities en achttien vragen,
elk met een soort: `letterlijk` (deelt woorden met het antwoord), `omschrijving`
(zegt hetzelfde met andere woorden) en `andere-taal` (vraagt in het Engels).
`scripts/vectorproef.js` met `RTG_VECTOR_SET` telt treffer@1, treffer@3 en MRR
per soort (`scripts/lib/zoekmaat.js`, getoetst in `test/zoekmaat.test.js` met
vier mutaties), naast BM25 zonder model op dezelfde normalisering.

| Soort | all-MiniLM-L6-v2 (t@1 / t@3 / MRR) | BM25, geen model | Samen (RRF) |
|---|---|---|---|
| letterlijk (6) | 0,83 / 1,00 / 0,92 | **1,00** / 1,00 / 1,00 | 1,00 / 1,00 / 1,00 |
| omschrijving (8) | **0,38** / 0,63 / 0,54 | 0,13 / 0,50 / 0,37 | 0,38 / 0,63 / 0,56 |
| andere taal (4) | **0,50** / 0,50 / 0,55 | 0,25 / 0,25 / 0,33 | 0,00 / 0,25 / 0,25 |
| alles (18) | **0,56** / 0,72 / 0,67 | 0,44 / 0,61 / 0,57 | 0,50 / 0,67 / 0,64 |

- **Het model verdient zijn plek op omschrijvingen** (0,38 tegen 0,13), en daar
  is het ook voor. Op letterlijke vragen verliest het van een woordtelling.
- **Samenvoegen is gemeten en NIET overgenomen.** Reciprocal rank fusion (geen
  gewicht om af te stellen, met opzet) wint op letterlijk en zakt op andere taal
  naar nul; over alles is hij slechter dan het model alleen. Een gewicht dat het
  wel zou laten winnen, zou op deze achttien vragen zijn afgesteld en daarna op
  deze achttien vragen worden geprezen.
- **0,38 is te laag voor een lid.** De vraag "wat mag ik niet eten" vindt de
  allergie niet. Dat is het Engelse model op Nederlandse tekst (par. 12.3), en
  het tweede getal dat op een meertalig model wacht.

### 13.3 Wat hier niet kon, en waarom

Een meertalig vectormodel (multilingual-e5-small, paraphrase-multilingual) en een
groter Whisper staan op Hugging Face, en het netwerkbeleid van deze omgeving
weigert `huggingface.co` (403). npm en PyPI hebben ze niet als pakket. Zodra de
host is toegestaan, draaien dezelfde twee proefsets met het andere artefact; de
enige code die er dan bij moet, is een SentencePiece-tokenizer voor de meertalige
modellen -- en die wordt pas geschreven als er een referentie naast kan, zoals
bij WordPiece (par. 12).

## 14. De zoekindex van de Toestelkluis (27 september 2026)

De kluis bestond al (`public/shared/toestelkluis.js`, par. 1); er komt geen
tweede. `public/shared/toestel/kluisindex.js` legt er een INDEX naast die per
document een vector bewaart en naar het document verwijst op naam.

| Regel | Bewijs (`test/toestel-kluisindex.e2e.js`, Chromium) |
|---|---|
| Een index per vingerafdruk; een vraag van een ander model wordt geweigerd met de reden | stap `vingerafdruk`, "moet opnieuw worden berekend" |
| Een index heeft een vorm; een vector van een andere lengte gaat er niet in | weigering met beide lengtes |
| De kluis is de waarheid: een gewist document valt weg en wordt geteld (`weg`), een document zonder vector ook (`zonderVector`) | beide geteld |
| Vergeten is echt vergeten, in ELKE index | `vergeet()` haalt de vector overal weg; het document blijft |

Vijf mutaties, alle vijf zakken. Twee dingen die met opzet zo zijn:

- **Geen aparte versleuteling.** Een vector is zo gevoelig als zijn tekst (hij is
  deels terug te rekenen) en staat daarom onder dezelfde bescherming als het
  document: OPFS van deze origin, niet over de lijn. Apart versleutelen met een
  sleutel die dezelfde pagina kan gebruiken zou schijn zijn, zolang de documenten
  zelf dat niet zijn. Wordt de kluis versleuteld (`toestelsleutel.js` staat er al
  voor), dan gaat de index mee.
- **Nog geen scherm.** De index werkt en is bewezen; de knop "zoek in mijn
  kluis" komt als er een model is dat Nederlands aankan en dat we mogen
  ondertekenen. Nu zou hij 0,38 halen op de vragen waar hij voor is.
