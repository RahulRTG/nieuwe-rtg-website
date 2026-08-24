# RTG native prestaties

Meetpunt: Apple Silicon (`darwin-arm64`), Node v24.18.0, release-Rust met LTO.
De proef gebruikt 5.611 controlepunten, 3.597 API-acties, 257 apps en 1.574
werkprocessen. Alle getallen zijn wandkloktijd; lager is beter.

```bash
npm run prestaties

# Inclusief de read-only Rust-broncodescan:
RTG_CAPABILITY_RUST_BIN="$PWD/motor/target/release/rtg-motor" npm run prestaties

# Inclusief de volledige Node -> HTTP -> Rust Magnaat-keten:
RTG_MOTOR_REKEN_URL=http://127.0.0.1:3100 \
RTG_MAGNAAT_RUST=motor RTG_MOTOR_TOKEN='...' npm run prestaties
```

## Gemeten winst

| Pad | Voor p50 | Na p50 | Winst | Voor p95 | Na p95 | Winst |
|---|---:|---:|---:|---:|---:|---:|
| Capability Graph, volledige scan | 219,4 ms | 180,9 ms | 17,5% | 230,2 ms | 189,0 ms | 17,9% |
| Codecontrole, boardroom | 9,87 ms | 3,82 ms | 61,3% | 15,72 ms | 4,47 ms | 71,5% |
| Codecontrole, één kantoor | 10,16 ms | 2,88 ms | 71,7% | 27,28 ms | 3,55 ms | 87,0% |
| Magnaat, volledige Rust-keten | 8,51 ms | 1,93 ms | 77,4% | 14,38 ms | 2,40 ms | 83,3% |

De Codecontrole-winst komt uit stabiele `Map`-indexen en één publieke omzetting
per punt. De index wordt automatisch vervangen zodra een codescan een nieuw
Graph-object oplevert; overrides blijven dus onmiddellijk zichtbaar.

De Rust-keten kopieerde aanvankelijk vóór ieder verzoek ook het volledige,
groeiende journaal en de historie. Nu wordt alleen het kleine rekenmodel gekopieerd.
Na het native antwoord volgt een mutatieversie-check en één synchrone commit. Een
storing of gelijktijdig besluit kan daardoor nog steeds geen halve dag achterlaten.

## Eerlijke grens

Met de huidige twee spelbedrijven is de bewezen JavaScript-dagberekening zelf
klein: circa 0,15 ms p50. De volledige Rust-keten van circa 1,93 ms is daarvoor
niet sneller, omdat proces-, HTTP- en JSON-overdracht een vaste prijs hebben.
Rust is hier gekozen voor isolatie, geheugenveiligheid en groei naar veel meer
bedrijven; niet om een onmeetbare rekensom mooier te laten lijken. De benchmark
houdt dit verschil zichtbaar zodat een toekomstige wijziging aantoonbaar beter
moet zijn.

## De verzoekketen: p50 en p99 gehalveerd, doorvoer bijna verdubbeld

Gemeten op 24 augustus 2026, Linux, Node v22.22.2, met **twee servers naast
elkaar**: dezelfde machine, dezelfde last, dezelfde datavorm. De ene draait de
stand van `HEAD`, de andere deze wijzigingen. De cijfers hieronder komen van de
SERVERKANT (`rtg_duur_seconden` uit `server/meting.js`) en niet van de client --
de client was bij 5.000 verzoeken per seconde zelf de bodem, en dan meet je je
eigen belastingsgenerator. De last: 2.064 echte routes, vier clientprocessen,
24 gelijktijdige verzoeken elk, 20 seconden.

| Meter | Voor | Na | Winst |
|---|---:|---:|---:|
| Doorvoer | 2.834/s | 5.076/s | **+79%** |
| Gemiddelde duur | 0,747 ms | 0,479 ms | 36% |
| **p50** | 0,27 ms | 0,13 ms | **52%** |
| **p90** | 0,46 ms | 0,23 ms | **50%** |
| **p99** | 0,90 ms | 0,44 ms | **51%** |
| Event-loop p99 | 52,95 ms | 37,84 ms | 29% |

De nieuwe server deed in dezelfde tijd 79% MEER werk en was per verzoek toch
twee keer zo snel. Dat is de eerlijke lezing: de winst zit niet in een enkele
route maar in de vaste heffing die elk verzoek betaalde.

Wat NIET verbeterde: de hoogst gemeten event-loop-uitschieter ging van 87,9 ms
naar 101,5 ms. Dat is één waarneming en geen percentiel, en bij bijna dubbel
zoveel verzoeken zijn er ook bijna dubbel zoveel kansen op een uitschieter. Het
staat hier omdat een tabel die alleen de goede kant laat zien geen meting is.

### Waar de winst vandaan komt

Vier vondsten uit een CPU-profiel (`node:inspector`, 200 µs bemonstering,
60.000 monsters onder last), op volgorde van opbrengst:

1. **De router deed een lineaire scan.** `server/web/routing.js` liep bij elk
   verzoek de hele lagenlijst af tot er iets paste: 8.004 lagen, waarvan 7.939
   een vast pad. Gemeten kostte dat 0,18 ms voor een route in het midden en
   0,33 ms achteraan -- per verzoek, synchroon. Er staat nu een index voor
   (Map op `METHODE\0pad`, plus één lijst voor alles wat geen vast pad is).
   Losgemeten op de echte routeverdeling: 0,177 → 0,0016 ms voor een route in
   het midden (**111×**), 0,299 → 0,0015 ms achteraan (**199×**). En de kosten
   zijn nu VLAK: een route achteraan is niet duurder dan een route vooraan, dus
   de router wordt niet langzamer als de app groeit.
2. **Het doorgeefjournaal verschoof twee arrays per verzoek.** `splice(0, 1)`
   op een venster van 4.000 en een bewaarde lijst van 20.000 verschuift die
   arrays helemaal, voor het weghalen van één regel. Met 8,3% van alle rekentijd
   was dit de duurste functie van de applicatie -- duurder dan het routeren.
   Er wordt nu per BLOK gesnoeid; de grens blijft precies wat hij was.
3. **`server/log.js` deed twee `require()`-aanroepen per verzoek.** Node houdt
   de module in de cache, maar de RESOLUTIE ervoor niet: elke aanroep liep
   opnieuw langs `internalModuleStat`, en dat zijn stat-aanroepen op de schijf.
   5,3% van alle rekentijd, om iets op te zoeken wat de vorige keer al gevonden
   was. Ze zijn nu gememoriseerd (nog steeds laat, maar hooguit één keer laat).
4. **`functieVoorPad()` was een dubbele lus over de hele registratie.** 191
   functies met samen 329 paden, dus 329 `startsWith()` per verzoek. Een cache
   op het pad kan daar niet -- er komt een ECHT pad binnen (`/api/lid/42`), dus
   die kaart groeit mee met het verkeer. De vergelijking is omgedraaid: de
   registratie wordt één keer een kaart, en een verzoek loopt zijn eigen
   voorouders af van lang naar kort. 0,0088 → 0,00014 ms per aanroep (**63×**).

### Hoe dit is nagetrokken

Een index die de goede route vindt is niet genoeg: een router is
volgordegevoelig, en een toets die alleen naar de statuscode kijkt ziet een
overgeslagen middleware niet. `test/routerindex.test.js` houdt daarom de OUDE
lineaire scan als referentie en vergelijkt het SPOOR -- welke lagen draaiden, in
welke volgorde, met welke uitkomst -- over 40 willekeurig gebouwde routetabellen
en 10.000 verzoeken, inclusief lagen die gooien, antwoorden en `req.url`
herschrijven.

Zes moedwillige mutaties in de index (volgorde negeren, herschrijving missen,
HEAD-terugval weghalen, slash vergeten, `:param` verkeerd indexeren, de index
niet ongeldig maken na late registratie) laten die toets alle zes zakken. Een
toets die je niet hebt zien zakken is geen toets (`LAT.md`, regel 2).

Daarnaast is de VOLLEDIGE routekaart end-to-end vergeleken: 2.064 echte routes
tegen beide servers, statuscode naast statuscode. **Nul verschillen**, met de
poortwacht intact (1.778× 401, 128× 403).

## De meetlat zelf: het histogram kon de winst niet eens zien

Dit was de belangrijkste vondst, en hij ging niet over snelheid maar over
eerlijkheid. De emmers van `server/meting.js` begonnen op **5 ms**. Onder last
viel **99,41%** van alle verzoeken in die eerste emmer; het gemiddelde lag op
0,46 ms.

Daarmee waren p50, p90 en p95 geen metingen maar rekenkundige verzinsels binnen
één emmer. Twee servers waarvan de ene aantoonbaar twee keer zo snel was,
rapporteerden **precies dezelfde** p50, p90, p95 én p99. `SLO.md` legt doelen
vast op p90 en p99 van deze reeks en zegt erbij dat wij daarop te controleren
zijn -- maar het instrument kon 0,3 ms niet van 4,9 ms onderscheiden. Een route
die tien keer trager wordt (0,4 → 4 ms) bleef onzichtbaar tot hij de 5 ms
passeerde.

Er staan nu vijf emmers onder de oude ondergrens (0,1 / 0,25 / 0,5 / 1 / 2,5 ms).
Dat het er vijf werden en niet drie is zelf gemeten: met een ondergrens van
0,5 ms viel nog altijd 99,26% in de eerste emmer. De prijs is 45% meer
tijdreeksen; het aantal emmers ligt vast per route, dus het geheugen blijft
begrensd.

**Wat dit niet doet:** de streefwaarden in `SLO.md` bijstellen. Die staan er nog
zoals ze gekozen zijn (p90 < 250 ms, p99 < 1 s) en dat is nu aantoonbaar meer
dan duizend keer ruimer dan wat het systeem werkelijk doet. Bijstellen is een
besluit met een foutbudget eraan vast; dat hoort in `SLO.md` en niet in een
emmerlijst. Het verschil is dat het nu een keuze is en geen gok.


## Meer kernen benutten: onderzocht, en het antwoord is niet "meer processen"

Na het bovenstaande draait een proces op ~5.000 verzoeken per seconde en staan
er in het failover-trio twee servers standby niets te doen. De volgende stap
lijkt dus verkeer verdelen. Dat is onderzocht en gemeten, en de uitkomst staat
in `docs/meerkernig.md`. Kort:

- **Wat al werkt:** drie schrijvende processen delen probleemloos één
  SQLite-store (nul lock-fouten), en een sessie van proces A is meteen geldig op
  proces B (12 van 12, 0 ms) — de Redis-bus in `kern/sessies.js` doet zijn werk.
- **Wat breekt:** read-your-writes. Een lid dat een notitie opslaat op proces A
  ziet hem op proces B pas na de kruisprocespoll: 0 van 10 meteen zichtbaar,
  mediaan 733 ms.
- **En de winst is er niet:** twee processen op een GEDEELDE store halen
  8.589/s met een p99 van 122,8 ms; diezelfde twee processen op een EIGEN store
  halen 11.379/s met een p99 van 49,2 ms. Niet de kernen begrenzen de schaal
  maar het gedeelde schrijfpad -- en dat is logisch bij 8.113 POST-routes die
  allemaal via één `BEGIN IMMEDIATE` gaan.

De volgorde is dus eerst een opslag die echt gelijktijdig schrijft (Postgres,
bestaat al) en sticky routing op de sessie, en pas daarna verkeer verdelen. Die
laatste stap is op een machine met vier kernen en een meedraaiende
belastingsgenerator sowieso niet eerlijk te meten.

## Browserstart

`app-main.js` (circa 584 KB) en `leverancier.js` (circa 788 KB) blokkeerden het
HTML-parsen. Beide laden nu met `defer`: parallel met de HTML, in vaste volgorde
na hun synchrone poorten en vóór `DOMContentLoaded`. Een echte lokale browserproef
laadde beide poorten volledig met nul console-errors. De statische toets
`test/zware-bundels.test.js` bewaakt de laadwijze en de vereiste volgorde.
