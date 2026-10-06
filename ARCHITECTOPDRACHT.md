# De Architect — de opdracht, in fasen met een stop/go per fase

Dit is de uitvoeringsopdracht voor de Architect uit `CODE.md` (§2, §7 en de
besluiten 5 en 6 in §8). Hij is geschreven voor een ontwikkelagent (Codex,
Claude Code) en voor de mens die na elke fase beslist of de volgende mag
beginnen.

**De opdracht in één zin:** RTG hoeft niet opnieuw te beschrijven wat de code
is. De Architect leert het bewijs dat er al is samen te voegen tot één
betrouwbare uitleg van zichzelf, met bij elke uitspraak waar die vandaan komt,
hoe hard die is en of die nog geldt.

**Wat dit niet is:** een herstructurering. Er worden geen bestanden verplaatst,
er komt geen nieuwe capabilitylijst, geen nieuwe database en geen nieuwe
gezags- of risicoladder. Fysiek herstructureren komt pas ter sprake als een
meting laat zien dat het iets oplevert (§5).

Alle getallen hieronder zijn gemeten op 6 oktober 2026, op main `6c4d38ac`.

---

## 0. Lees eerst

| Wat | Waarom |
|---|---|
| `CODE.md` §1, §2, §6, §7, §8 | De Architect is daar al besloten. De grenzen staan er. |
| `KEURING.md` (de hoofdregel) | *Volledige dekking is de uitgangstoestand. Versmalling is een recht dat per effect verdiend wordt.* Alles over testselectie volgt daaruit. |
| `LAT.md` regel 13 en 17 | "Mijn controles" is niet het oordeel van de keten, en een poort bewijst alleen zijn eigen bereik. |
| `BEWIJSMACHINE.md` §6a | Een proef kan een geldige uitslag geven en toch het verkeerde experiment zijn. |
| `scripts/lib/stempel.js`, `scripts/versheid.js` | De bestaande stempel en versheid. Fase 2 breidt die uit en bouwt er niets naast. |
| `scripts/attributie.js`, `scripts/veranderbereik.js` | De test-naar-route-kaart bestaat al. Fase 3 sluit hem aan. |
| `WETTEN.json`, `DOCTRINE.json`, `BEWIJSSCHULD.json` | De wetten met bron en handhaver, de kandidaat-wetten, en de verklaarde schuld. |

---

## 1. Harde regels voor de hele opdracht

Elke regel heeft een handhaver. Waar die nog niet bestaat, bouwt de fase die
hem nodig heeft hem eerst.

| # | Regel | Handhaver |
|---|---|---|
| R1 | **De Architect bezit niets.** Hij leest registers en schrijft alleen naar stdout. Geen eigen register, geen cache die als bron dient. | Een toets die zakt als de Architect-code een bestand schrijft. |
| R2 | **Hij woont in `scripts/` en wordt nooit door `server/` geladen.** | Een toets naar het model van `test/gezagsnoemer.test.js`, naast `test/codegrens.test.js`. |
| R3 | **Drie assen, nooit één ladder en nooit een samengesteld cijfer.** Zie §2. | Een toets op de uitvoervorm: elke regel draagt alle drie, en er bestaat geen veld `score` of `confidence`. |
| R4 | **Elke uitspraak heeft een herkomst**: register, pad in het register, instrument, stempelcommit en invoer. | Een toets die van een uitspraak de herkomst volgt en in het register dezelfde waarde vindt. |
| R5 | **Een leeg vak draagt zijn reden.** `onbekend` is een uitslag. Een ontbrekend register geeft `onbekend` met reden en nooit een crash of een oude waarde. | Een toets die een register weghaalt. |
| R6 | **Geen nieuwe namen zonder meting.** Bezet: `capability` (OS.md), `kaart` (`scripts/kaart.js`), `architect` (ook een domein, `server/kern/architect`), `envelop`, `versheid` (bestaat; uitbreiden, niet ernaast). Meet een nieuwe naam met `npm run semantiek`. | De reviewer, en de semantiekmeter. |
| R7 | **Geen nieuw ID-schema.** Regels krijgen hun ID uit `WETTEN.json`. Ontbreekt een wet, dan wordt hij daar toegevoegd met bron en handhaver. | `test/getallen.test.js` en de wettentoetsen. |
| R8 | **Optimaliseren is een verdiend recht** (KEURING.md). Deze opdracht slaat geen enkele toets over. Fase 8 beschrijft hoe dat recht verdiend en ingetrokken wordt; aanzetten is een besluit van de eigenaar. | De bestaande `volleRing`-vlag van `attributie.js`. |
| R9 | **De ontwikkelgrens van besluit 6** (CODE.md §8). Een bewering van een agent is geen bewijs, een besluit van een agent is geen gezag. | De poorten; niemand vertrouwt de samenvatting van een agent. |
| R10 | **Elke fase is een eigen PR**, omkeerbaar, en noemt welke poort groen staat en wat níét is bevestigd (LAT 17). Voor de push draait `npm run ci:lokaal`. | CI. |

---

## 2. De drie assen

Elke uitspraak van de Architect draagt drie onafhankelijke assen.

| As | Standen | Bron |
|---|---|---|
| **Graad** | `onbekend` · `vermoed` · `gemeten` · `bewezen` | De vier bewijsgraden van `BESTUUR.md`. Er komt geen vijfde graad. |
| **Versheid** | `actueel` · `mogelijk-verouderd` · `onbekend` | Fase 2. |
| **Tegenspraak** | `geen-gevonden` · `onbepaald` · `gevonden` | Wat de registers onderling zeggen. Het patroon is `ONBEPAALD` in `EXECUTION_MAP.json`: nooit stil een winnaar kiezen. |

Een uitspraak kan dus eerlijk `bewezen` · `mogelijk-verouderd` ·
`geen-gevonden` zijn. "Bewezen" zonder versheid bestaat niet in de uitvoer.

---

## 3. De fasen

Elke fase heeft dezelfde vorm: **wat er al is**, **wat er gebouwd wordt**, **wat
niet**, en het **stop/go-bewijs**. Dat bewijs is machinaal te controleren en
bevat altijd een mutatie: een toets die je niet hebt zien zakken, is geen toets.
Na elke fase stopt de agent en rapporteert. Een mens zegt go.

### Fase 1 — Agentinstructies opknippen

**Wat er is.** `CLAUDE.md` is 226.798 bytes en wordt bij elke sessie geladen
(geschat 65.000 tot 75.000 tokens, tekens gedeeld door drie tot drie en een
half, graad `vermoed`). Er hangt meer aan dan het lijkt:

- 77 getalmerktekens (`<!--getal:...-->`) die `scripts/getallen.js` bijhoudt
  (`DOCUMENTEN`, regel 675) en `test/getallen.test.js` bewaakt;
- 7 wetten in `WETTEN.json` met `bron.bestand: CLAUDE.md` en een letterlijk
  anker;
- 89 blokken, waarvan het grootste deel een samenvatting is van een
  diepte-document dat het al zegt.

Er is geen `AGENTS.md`. Codex leest `AGENTS.md` en niet `CLAUDE.md`, dus vandaag
krijgt een Codex-agent geen enkele merkregel mee.

**Wat er gebouwd wordt.**

1. **Eerst de inventaris, als script.** Per blok van `CLAUDE.md`: waar het heen
   gaat (grondwet, lokaal bij een map, of verwijzing naar een diepte-document
   dat het al zegt) en welke zin het anker is. Die inventaris is het bewijs
   dat er niets verloren gaat.
2. **Eén bron voor beide agents.** `AGENTS.md` in de root wordt de grondwet,
   streefmaat 10 tot 15 KB: merkregels, toegangs- en AI-regels, wat niet te
   doen, workflow, en per diepte-document één regel *wanneer lees je dit*.
   `CLAUDE.md` wordt een verwijzing (`@AGENTS.md`) plus wat alleen voor Claude
   Code geldt. Twee volledige kopieën is verboden.
3. **Lokale bestanden alleen waar gemeten nodig.** Een `AGENTS.md` (met een
   `CLAUDE.md` die ernaar verwijst) per map, en alleen voor mappen waar een
   blok werkelijk alleen daar geldt, zoals `server/kern/pay/` of
   `server/kern/vrijheid/`. Controleer of beide agents geneste bestanden laden
   op de manier die je aanneemt, en schrijf de uitkomst op.
4. **Getalmerktekens en wetankers verhuizen mee.** `getallen.js` en
   `WETTEN.json` worden bijgewerkt, niet omzeild.

**Wat niet.** Geen regel herschrijven, afzwakken of samenvatten. Dit is
verplaatsen, geen redactie. Twijfel over een blok gaat naar de grondwet.

**Stop/go.**

- `test/agentinstructies.test.js`: elk ankerblok uit de inventaris staat
  letterlijk op zijn bestemming; `AGENTS.md` en `CLAUDE.md` bevatten geen
  dubbele inhoud; de grondwet blijft onder een maximum in bytes.
  Mutatie: haal één verplaatste regel weg, en de toets zakt.
- `test/getallen.test.js` groen, en elke wet in `WETTEN.json` vindt zijn anker.
- **Meting voor en na**: bytes en geschatte tokens bij de start van een sessie,
  voor Claude Code en voor Codex. Geen relevantie- of tijdpercentages; met één
  ontwikkelaar is dat ruis. Wel: een vaste set van vijf ijktaken met een
  controleerbare uitkomst, voor en na gedraaid, met het aantal keer dat een
  poort zakte.

### Fase 2 — Versheid per bewering: de invoer van een generator METEN

**Wat er is.** `scripts/lib/stempel.js` stempelt `op`, `commit`, `boomVuil` en
`instrument`; 147 scripts gebruiken hem. `scripts/versheid.js` zegt per register
of de stempel achterloopt op HEAD, en zegt met opzet niet of de meting nog
klopt: *verouderd is verouderd; of het erg is, beslist een mens.*

De rootmap telt 207 registers. 136 dragen een stempel, van 105 verschillende
commits. 71 dragen er geen. `SYMBOLEN.json` staat op `7df862be`, HEAD op
`6c4d38ac`. De regel "stempel ongelijk aan HEAD, dus verouderd" maakt dus vrijwel
elk antwoord verouderd, en dan zegt de as niets meer.

**Wat er gebouwd wordt.** Versheid die AANTOONT dat de invoer gelijk bleef. Dat
is geen "waarschijnlijk nog goed" en botst dus niet met `versheid.js`.

1. **Invoer meten, niet alleen verklaren.** Een preload
   (`node -r scripts/lib/invoerspoor.js scripts/<generator>.js`) registreert
   welke bestanden de generator werkelijk las (`readFileSync`, `readdirSync`,
   `statSync`, `fs.promises`, `require`), welke mappen hij opsomde en welke
   omgevingsvariabelen hij las. Een opgesomde map is invoer: een nieuw bestand
   erin maakt de meting verouderd.
2. **Wat niet waar te nemen is, wordt `onbekend`.** Een generator die
   `git ls-files` aanroept, een server start of een kindproces spawnt, leest
   buiten het zicht van de preload. Voorbeelden: `IDEMPROEF` en de herstelproef.
   Die krijgen versheid `onbekend` met de reden, tot ze hun invoer langs een
   andere weg aantonen. Nooit raden.
3. **Verklaarde semantische afhankelijkheden ernaast**: de versie van de eigen
   code (die volgt al uit de gemeten `require`s), de Node-versie, de
   configuratie en het beleid dat een generator toepast. Het wordt een blok
   `invoer` in de stempel, met een hash over de gemeten paden op de
   stempelcommit.
4. **De beslisregel.** `actueel` alleen als elk gemeten invoerpad op HEAD
   dezelfde blob heeft als op de stempelcommit, geen opgesomde map veranderde
   en de verklaarde afhankelijkheden gelijk zijn. Anders `mogelijk-verouderd`.
   Geen stempel, geen invoerblok of onwaarneembare invoer: `onbekend`.
5. **De poortsemantiek van `versheid.js` blijft zoals hij is** (beveiliging en
   geld laten zakken). Een andere poortsemantiek is een besluit en hoort niet in
   deze fase.

**Later, en alleen waar het betaalbaar is: per bewering.** Een register dat per
route of per entiteit meet, kan zijn invoer per entiteit toeschrijven, zodat een
wijziging in horeca een uitspraak over pay niet verdacht maakt. Dat mag alleen
als de toeschrijving gemeten is (de preload ziet welke leesacties bij welke
entiteit hoorden), nooit verklaard.

**Wat niet.** Geen nieuw register met versheden; de versheid wordt bij het
lezen berekend uit stempel plus git.

**Stop/go.** Een proef op vijf generatoren: `symbolen`, `aanroepgraaf`,
`routebron`, `executionmap`, en bewust één die een server start.

- **IJking één (te smal):** wijzig een bestand BUITEN de gemeten invoer en
  genereer opnieuw. De uitvoer moet byte voor byte gelijk zijn. Is hij dat niet,
  dan was de invoer te smal en wordt de generator `onbekend`.
- **IJking twee (reageert):** wijzig een bestand BINNEN de invoer, en de
  versheid moet `mogelijk-verouderd` worden.
- **Determinisme vooraf:** twee keer genereren op dezelfde commit geeft dezelfde
  bytes. Zo niet, dan is de versheid `onbekend` (zie de les van
  `HERSTELPROEF.json` in `INTELLIGENTIE.md` §3.5a).
- **Mutatie:** versmal de gemeten invoer kunstmatig, en ijking één moet zakken.
- **De generator die een server start** eindigt op `onbekend` met de reden.
  Komt daar `actueel` uit, dan is de fase niet af.

### Fase 3 — De test-naar-route-kaart aansluiten, niet bouwen

**Wat er is, en dat is meer dan gedacht.** `test/helper.js` (geladen door 1279
toetsen) geeft elke kindserver `RTG_TOETS` mee. `server/routelog.js` schrijft
met `RTG_ROUTELOG` per toets welk routepatroon hij raakte (`TOETS`-regels), op
het moment dat de route matcht. `scripts/attributie.js` maakt daar per toets
`waargenomen`, `deels` of `ongemeten` van, en elke toets die niet `waargenomen`
is draagt `volleRing: true`. `scripts/veranderbereik.js` knoopt dat via
`ROUTEBRON.json` aan bronbestanden. Beide draaien in `ci.yml` en blokkeren
niets. Ze laten alleen een CI-artefact achter, dus de Architect kan ze vandaag
niet lezen.

**Wat er gebouwd wordt.**

1. **Lezen uit CI.** Een gestempelde samenvatting van `attributie` en
   `veranderbereik` per main-commit, op een plek die de Architect kan lezen,
   met de fase-2-stempel erop. Of het register in de repo komt of als artefact
   wordt opgehaald, is een keuze die je met reden opschrijft. `takken.js`
   bewaakt welke registers met de hand geschreven zijn.
2. **Stabiliteit over rondes.** Een relatie tussen toets en route die in één
   ronde werd waargenomen, is een waarneming. Houd per relatie bij in hoeveel
   van de laatste N rondes hij gezien werd. Een toets die een route één keer
   niet raakte, bewijst niet dat hij hem nooit raakt.
3. **De blinde vlekken bij naam.** Ongeveer dertig toetsen starten een eigen
   proces buiten `helper.js` om, en `scripts/lib/proefserver.js` wordt door elf
   scripts gebruikt. Zet ze op een lijst met per stuk de reden. `ongemeten`
   blijft `ongemeten`.

**Wat niet.** Geen selectie, geen overslaan, geen cache. KEURING.md en
`CODE.md` §4 (content-addressed caching) gelden onverkort.

**Stop/go.**

- Een bekende toets die een bekende route raakt, staat in de samenvatting.
- Een samenvatting van een vorige commit komt als `mogelijk-verouderd` door, en
  nooit als actueel.
- Mutatie: laat de routelog één toetsnaam weglaten, en die toets wordt
  `ongemeten` met `volleRing`, niet `waargenomen`.
- De dekkingsgetallen (toetsen `waargenomen` tegenover `ongemeten`) staan in de
  PR, met de lijst blinde vlekken.

### Fase 4 — De Architect: `map`, `explain`, `impact`, `unknowns`

Vier commando's, alleen lezend, met `--json` voor agents. Draaien via één
npm-script. Meet de naam eerst (R6); `architect` is ook een domein.

**Waarover een vraag gaat.** Een route, een bestand, een symbool, een domein uit
`GRENZEN.json`, of een wet-ID uit `WETTEN.json`. Er komt geen nieuw begrip
"capability". Is een vraag dubbelzinnig, dan noemt de Architect de kandidaten
en kiest hij er niet stil één.

- **`map`** gebruikt dezelfde gegevens als `scripts/kaart.js` en
  `ARCHITECTUUR.md` (die bestaan al als kaart; dit wordt geen tweede kaart).
- **`explain <ding>`** geeft per regel de waarde, de drie assen en de herkomst.
  Doel en invarianten komen alleen uit een bestaand document of een wet, met
  graad `vermoed` en de zin erbij. Een document is een bewering, geen meting.
- **`impact <bestanden of diff>`** heeft drie blokken die nooit worden opgeteld:
  *statisch* (de require-graaf en de aanroepgraaf), *waargenomen* (fase 3) en
  *kennisgaten* (de blinde vlek van `impactbereik.js`, `ongemeten` toetsen).
  Plus een vaste regel: **toetsreductie: niet toegestaan**, met de reden.
- **`unknowns [scope]`** zegt waar de kennis over RTG ophoudt, in vier bakken:
  graad `onbekend`, versheid `onbekend` of `mogelijk-verouderd`, tegenspraak
  `gevonden` of `onbepaald`, en de verklaarde schuld uit `BEWIJSSCHULD.json`.
  Bekende risico's die nog in geen register staan (de zelfgebouwde SAML-code,
  type-checking) komen er via `BEWIJSSCHULD.json` in, met een post. Nooit via
  een lijst in de Architect zelf, want dan bezit hij iets.

**Stop/go.**

- Gouden toetsen op drie onderwerpen: `server/kern/pay/poort.js`, een route uit
  de tafelketen, en het domein `knelpunt`.
- **Herkomstproef:** voor elke regel in de uitvoer van die drie volgt een toets
  de herkomst en vindt in het register dezelfde waarde.
- **Mutaties:** verander een waarde in een register, en `explain` verandert mee.
  Haal een register weg, en de regel wordt `onbekend` met reden. Laat `server/`
  de Architect importeren, en de toets van R2 zakt.
- `unknowns` op de hele boom geeft een getal per bak. Dat getal is de
  nulmeting.

### Fase 5 — Proef op twee domeinen: RTG Pay en de tafelketen

Gekozen omdat ze maximaal verschillen en omdat er al ketenproeven liggen
(`BEWIJSLUS.md`, `npm run tafelproef`).

**Wat er gebeurt.** Schrijf per domein tien vragen op die een nieuwe
ontwikkelaar echt stelt (waar staat het, wat schrijft het, welke wet geldt,
welke toets bewijst het, wat breekt er als ik X wijzig), en beantwoord ze met de
Architect. Per vraag komt er een antwoord met herkomst, of een eerlijk
`onbekend` met de reden.

**Wat niet.** Geen manifest per functie. Mist er verklaarde intentie, dan is de
kleinste stap een verwijzing per domein naar zijn diepte-document. Elk veld dat
te meten is (wat het leest, schrijft, uitzendt, aanroept, wie het toetst) wordt
nooit met de hand getypt.

**Stop/go.** Twintig vragen met een uitslag per vraag: beantwoord met herkomst,
`onbekend` met reden, of mislukt. Mislukt wordt een bevinding met een sluitweg.
De verdeling staat in de PR. Een go betekent niet dat alles beantwoord is, maar
dat geen enkel antwoord zonder herkomst kwam.

### Fase 6 — Poorten schrijven hun reden uit, en `why`

Elke poort in de keten (afgeleid door `scripts/ci-lokaal.js` uit
`.github/workflows`) schrijft bij een besluit welke regel afging: wet-ID, wat er
gemeten werd, en de graad van die meting.

**De MAX-regel.** De zwaarte van de keuring is de strengste van de regels die
afgingen. Een verklaarde lage zwaarte wint nooit van een gemeten hogere. Een
ontbrekend gegeven geeft de strengste keuring. Er komt **geen label** zoals
LOW, HIGH of CRITICAL: de uitvoer is de lijst afgegane regels plus de getallen
van het bereik (symbolen, routes, schermen, geldopslag, identiteitsflows). Het
huis heeft al genoeg schalen (gewicht, frictie, effectbon, gezagsnoemer).

**`why <poort of besluit>`** leest die redenen en toont ze met herkomst.

**Stop/go.** Een wijziging in `kern/pay` laat de juiste regels afgaan en `why`
noemt ze. Mutatie: verklaar een lagere zwaarte in een document, en de keuring
verandert niet. Haal een meting weg, en de keuring wordt strenger, niet lichter.

### Fase 7 — Contextvoldoendheid, eerst in de schaduw, en `context`

**`context <taak>`** bouwt voor een ontwikkelagent een pakket: het domein, de
relevante symbolen en routes, de wetten die gelden (met ID), de grenzen, de
bekende bevindingen, de toetsen die waargenomen zijn, de toetsen die mogelijk
relevant zijn, de kennisgaten, en wat de agent **niet mag aannemen** (dat
dekking compleet is, dat een register actueel is, en elk punt uit besluit 6).

**Voldoendheid wordt UITGEREKEND door de Architect en nooit door de agent
afgevinkt.** Ze geldt per taakklasse, want een toets toevoegen vraagt minder dan
een geldregel wijzigen. Omdat toetsdekking voorlopig voor een groot deel
`ongemeten` blijft, zou een harde poort altijd dicht staan, en een poort die
altijd dicht staat leert mensen hem te negeren. Daarom: **schaduw**. Hij meet en
meldt, en houdt niets tegen tot de eigenaar besluit.

**Stop/go.** Over vijf ijktaken geeft hij een uitslag per taak, en de PR noemt
hoe vaak hij `onvoldoende` zei en waarom. Mutatie: haal de wetten uit het
pakket, en de uitslag wordt `onvoldoende`.

### Fase 8 — Het verdiende recht om te versmallen (alleen beschrijven)

Dit is KEURING.md, uitgeschreven als trap. Deze opdracht bouwt hem niet aan;
de eigenaar besluit elke trede apart.

| Trede | Mag | Voorwaarde |
|---|---|---|
| 0 | meten, niets overslaan | vandaag |
| 1 | een selectie **voorstellen**, die naast de volle ronde wordt vergeleken | fase 3 stabiel over N rondes |
| 2 | beperkt versmallen binnen één domein | **mutatieproef**: een vaste set mutaties in de gewijzigde bestanden wordt door de gekozen set gevangen, zonder één te missen |
| 3 | adaptief draaien | trede 2 houdt over een periode stand |

**Intrekken gaat vanzelf.** Mist de gekozen set één mutatie, of wordt een
relatie `mogelijk-verouderd`, dan vervalt het recht direct en draait de volle
ronde. Het intrekken vraagt geen besluit, het toekennen wel.

---

## 4. Parallel, en niet in deze opdracht

Deze opdracht maakt RTG leesbaar. De gaten in volwassenheid lost hij niet op.
Die staan als eigen opdrachten naast deze, en moeten via `BEWIJSSCHULD.json` in
`unknowns` te zien zijn:

- **`OFFICE_CODE`:** de kantoorroutes achter de gedeelde code overzetten op
  toegang op naam (`KANTOORMACHT.md`, `kern/kantoor/kluispoort.js`);
- **type-checking:** `// @ts-check` met JSDoc, eerst op `kern/pay`, `accounts`
  en `db`;
- **SAML:** `server/sso/saml/` (eigen XML-parser, c14n en handtekening) extern
  laten beoordelen of vervangen.

---

## 5. Fysiek herstructureren: pas als het meetbaar iets oplevert

Er staan 75.866 verwijzingen naar `server/kern/` in 1314 bestanden (scripts,
toetsen, registers, documenten), en de koppeling loopt grotendeels via de
kern-tas en niet via mappen. Verplaatsen komt alleen ter sprake als een meting
aantoont dat het bouwtijd, koppeling, onboarding of eigenaarschap verbetert, en
dan per domein, met gereedschap dat de verwijzingen herschrijft en bewijst dat
de uitvoer van elke generator byte voor byte gelijk blijft.

---

## 6. Wat elke PR in deze opdracht vermeldt

1. De fase, en welk stop/go-bewijs gehaald is (met de mutatie die zakte).
2. Welke poorten groen staan, bij naam (LAT 17), en wat níét bevestigd is.
3. De nulmeting en de meting erna, met graad.
4. Wat de fase vond dat buiten de opdracht valt, als bevinding met een
   sluitweg, en niet stil gerepareerd.
