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
| 6 | `spraak.naartekst` op het toestel, gemeten op echte telefoons | een stap weg; wacht op `huggingface.co` in het netwerkbeleid; vult SERVICE.md par. 13d zonder `LOCAL_AI_URL` |
| 7 | `tekst.vector` over de Toestelkluis | een stap weg na 4-5 |
| 8 | Samenvatten en herschrijven | een stap weg; het browsermodel als eerste trede |
| 9 | Een kleine algemene LLM | jaren weg op een telefoon, dichterbij op een laptop; te meten, niet te schatten |
| 10 | Verschuiving meten in de kostenlaag | een stap weg na 6 |
| – | WebNN als vereiste | jaren weg: de ondersteuning is experimenteel |

## 7. Besluiten van de eigenaar

1. **`'wasm-unsafe-eval'` op de toestelcel**, en alleen daar. Genomen op 25
   september 2026: ja, op die ene pagina, met `connect-src 'none'` ernaast;
   `test/toestel-routes.test.js` houdt de combinatie vast.
2. **Modelhosting.** Honderden MB tot enkele GB per model, van de eigen origin
   (de CSP staat geen CDN toe). Dat kost bandbreedte en hoort in KOSTEN.md.
   Advies: eigen origin met Range-ondersteuning, per taak.
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
