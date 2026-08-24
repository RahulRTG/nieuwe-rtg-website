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

## Waar het staat, alles bij elkaar

De ronde van 24 augustus 2026 in één tabel: de stand van commit `3244afd` tegen
de stand van nu, twee rondes elk, dezelfde machine, dezelfde last (2.064 echte
routes, drie clientprocessen, 24 gelijktijdige verzoeken elk, 20 seconden) en --
belangrijk -- dezelfde meetlat aan beide kanten.

| Meter (serverkant) | Basislijn | Nu | Winst |
|---|---:|---:|---:|
| Doorvoer | 3.170/s | 7.885/s | **2,5x** |
| Gemiddelde duur | 0,606 ms | 0,334 ms | 45% |
| **p50** | 0,205 ms | 0,060 ms | **71%** |
| **p90** | 0,42 ms | 0,15 ms | **64%** |
| **p99** | 0,825 ms | 0,385 ms | **53%** |
| Event-loop p99 | 29,4 ms | 22,7 ms | 23% |
| Event-loop max | 124,5 ms | 42,1 ms | **66%** |

Die laatste regel stond hier een ronde lang andersom, en dat is het vermelden
waard. De hoogst gemeten uitschieter ging eerst OMHOOG (124,5 -> 151,4 ms), want
er bleef één moment over waarop het volle journaal werd weggeschreven, en bij
tweeënhalf keer zoveel verzoeken zijn er ook tweeënhalf keer zoveel kansen om
dat moment te raken. Dat is daarna opgelost door het journaal helemaal uit de
database te halen (zie onder); de max staat nu op 42,1 ms en dus ruim onder de
basislijn.

Wat er in die twee en een half keer zit, per onderdeel:

1. de lineaire scan van de router (hieronder);
2. twee arrays die per verzoek helemaal verschoven;
3. twee `require()`-aanroepen per verzoek die stat-syscalls deden;
4. een dubbele lus over 329 paden per verzoek;
5. het journaal dat bij elke schrijfactie opnieuw werd geserialiseerd.

En, los daarvan maar minstens zo belangrijk: de meetlat die het verschil eerst
niet eens kon zien.

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


## De staart daarna: saveSqlite serialiseerde het journaal bij elke schrijfactie

Na het bovenstaande stond de event-loop-p99 nog op tientallen milliseconden,
terwijl een verzoek zelf 0,44 ms duurt. Die wanverhouding is een aanwijzing: een
verzoek is niet traag, er staat iets ANDERS de lus stil te zetten.

Gemeten met een wikkel om `saveSqlite` heen, onder 25 seconden last:

```
saveSqlite  n=121  totaal geblokkeerd 3.981 ms  gemiddeld 32,9 ms  max 101,1 ms
event-loop  p99 66,0 ms   max 111,2 ms
journaal    19.469 regels
```

Die getallen liggen boven op elkaar: de gemeten event-loop-piek van 111 ms en de
langste `saveSqlite` van 101 ms zijn hetzelfde moment. Over die 25 seconden stond
de lus **3,98 seconden** stil in deze ene functie -- 16% van de wandkloktijd.

De oorzaak zit in de voorcheck van `server/db/voorcheck.js`. Die mag een dure
collectie overslaan zolang het AANTAL items gelijk blijft. Voor gewone toestand
klopt dat precies. Voor een LOGBOEK is groeien juist de normale toestand -- er
komt per verzoek een regel bij -- en dus greep de overslaan-regel daar nooit.
`doorgeefjournaal` groeit naar zijn plafond van 20.000 regels (3,6 MB JSON), en
werd dus bij **elke** schrijfactie ergens in de applicatie opnieuw geserialiseerd,
versleuteld en weggeschreven.

Er staat nu een korte, met de hand geschreven lijst logboeken waarvoor alleen het
TIJDvenster telt en niet de lengte. Gemeten op dezelfde last:

| Meter | Voor | Na | Winst |
|---|---:|---:|---:|
| saveSqlite, totaal geblokkeerd | 3.981 ms | 516 ms | **87%** |
| saveSqlite, gemiddeld | 32,90 ms | 3,46 ms | **89%** |
| **Event-loop p99** | 66,0 ms | 26,5 ms | **60%** |
| Doorvoer | 7.128/s | 9.779/s | **+37%** |
| Serverkant p99 | 0,39 ms | 0,33 ms | 15% |
| Journaalregels bewaard | 19.469 | 19.315 | gelijk |

Die laatste regel is de belangrijkste van de tabel: er gaat geen historie
verloren. Wat verandert is niet de garantie maar het MEELIFTEN.
`kern/doorgeefjournaal.js` regelt zijn eigen duurzaamheid al -- het zegt met
zoveel woorden "NIET bij elke regel save()" en plant zijn eigen spoeling met een
rem van een seconde. Dat andere schrijfacties het journaal onderweg meenamen was
toeval, geen belofte. Nagemeten op schijf na een ronde: 3,22 MB, 19.559 regels,
de nieuwste regel van het einde van de last.

Drie toetsen in `test/opslag-voorcheck.test.js` leggen de grenzen vast: een
groeiend logboek MAG binnen het venster worden overgeslagen, het blijft daarna
NIET hangen (overslaan mag uitstellen, nooit weglaten), en geld wint altijd --
`exactNodig()` staat vóór de logboekregel, ook als iemand een geldcollectie op de
lijst zet. Alle drie worden rood van hun eigen mutatie. De duurzaamheidssuite
(38 toetsen, inclusief de SIGKILL-proef op een bevestigde betaling) blijft groen.

### Wat hieruit volgt en niet is gedaan

Bij 7.000 verzoeken per seconde is een plafond van 20.000 regels nog geen drie
seconden geschiedenis. Het plafond belooft "terugkijken wat er vannacht misging"
en dat doet het bij dit verkeer niet meer. Dat is een productbesluit -- minder of
juist anders bewaren -- en geen prestatiekwestie, dus het staat hier alleen
opgeschreven en is niet stilletjes veranderd.

## En daarna helemaal uit de database: het journaal is een bestand geworden

Het tijdvenster hierboven maakte het goedkoper, niet goedkoop. Er bleef eens per
twee seconden een volle serialisatie van 3,6 MB over, en bij rustig verkeer viel
die precies op het verzoek van een lid: ~33 ms extra wachten omdat het journaal
toevallig aan de beurt was, honderd keer de duur van het verzoek zelf.

Het probleem was nooit de omvang maar de VORM. Verandering opsporen in de
opslaglaag gebeurt door te serialiseren en te vergelijken; voor een lijst die
alleen maar aangroeit is dat elke keer hetzelfde werk voor dezelfde 19.999
regels. Een logboek is geen toestand. Het staat nu in een append-only bestand
(`server/kern/journaalbestand.js`), gebatcht en asynchroon weggeschreven,
geroteerd en begrensd.

| Meter | In de database | Met tijdvenster | In een bestand |
|---|---:|---:|---:|
| saveSqlite, totaal geblokkeerd | 3.981 ms | 516 ms | **133 ms** |
| saveSqlite, gemiddeld | 32,90 ms | 3,46 ms | **1,10 ms** |
| saveSqlite, max | 101,1 ms | 88,0 ms | **8,5 ms** |
| Event-loop p99 | 66,0 ms | 26,5 ms | **17,4 ms** |
| Event-loop max | 111,2 ms | 117,7 ms | **42,1 ms** |
| Bewaarde journaalregels | 19.469 | 19.315 | **72.473** |

Twee dingen aan die tabel zijn belangrijker dan de snelheid. De max van
`saveSqlite` valt van 101 naar 8,5 ms: de uitschieter is niet kleiner geworden
maar wég. En er wordt ruim drie en een half keer zoveel geschiedenis bewaard,
want vijf bestanden van 2 MB is meer dan één blob van 20.000 regels -- terwijl
het bewaren nu minder kost in plaats van meer.

### Wat daarbij is nagelopen

Het journaal verhuist naar buiten de database, en dat is precies de beweging
waardoor `grootboek.db` en `papieren.json` ooit stilzwijgend uit de back-up
vielen (zie de kop van `server/opzet/backup-lijst.js`). De journaalmap staat
daarom in `BACKUP_MAPPEN`, met een toets die het bewaakt.

`test/journaalbestand.test.js` legt tien dingen vast: volgorde, rotatie, dat een
geroteerd bestand leesbaar BLIJFT (rotatie is geen weggooien), dat de schijf
begrensd is, dat een verminkte regel wordt overgeslagen in plaats van het hele
journaal onleesbaar te maken, dat er met een sleutel cijfertekst op schijf staat,
dat de rechten besloten zijn op BEIDE schrijfwegen, dat een bestaande installatie
zijn geschiedenis niet kwijtraakt, dat het in de back-uplijst staat, en dat een
journaal dat niet kan schrijven het verzoek niet raakt.

Zes moedwillige mutaties zijn erop losgelaten. Vijf werden meteen rood; de zesde
-- de rechten van 0600 naar 0644 op de ASYNCHRONE schrijfweg -- kwam er
ongemerkt doorheen, omdat de rechtentoets alleen de synchrone weg raakte. Dat is
de zeldzame weg (alleen bij afsluiten) terwijl de asynchrone in bedrijf élke
regel schrijft. De toets dekt nu allebei en pakt de mutatie wel.

De rotatietoets vond bovendien een echte fout in de nieuwe module: de geroteerde
bestandsnaam was `Date.now()`, dus twee rotaties binnen dezelfde milliseconde
schreven stilzwijgend over elkaar heen -- een heel journaalbestand weg zonder
foutmelding. De stempel loopt nu altijd door.

## De grootste post nagemeten: hij is grotendeels geen verspilling

Na het bovenstaande stond `writev` bovenaan het profiel, en dat leek de volgende
grote slag. Een verse profielronde op een stille machine (77.909 monsters, 200 us,
onder 6.967 verzoeken per seconde) splitst die post echter in twee heel
verschillende dingen, en dat verschil is de hele uitkomst:

| Post | Aandeel | Wie roept het aan |
|---|---:|---|
| `writev` | 17,1% | `res.json` -> het ANTWOORD naar de klant |
| `writeBuffer` | 5,2% | `writeSync` -> `SyncWriteStream` -> `log.js` |

De eerste is geen verspilling maar het werk zelf: bytes naar een socket schrijven
IS wat een webserver doet. Daar valt niets weg te halen zonder minder of kleinere
antwoorden te sturen, en dat is een productbesluit en geen optimalisatie. Dat is
de eerlijke uitkomst van deze ronde: de grootste post is geen defect.

De tweede is dat wel, en hij zat verstopt achter een aanname. Node kiest zijn
stdout-stroom op wat eraan hangt:

```
een PIJP    (systemd, docker, `| logger`)  ->  Socket           asynchroon
een BESTAND (`node server.js > log`)       ->  SyncWriteStream  SYNCHROON
```

Met `LOG_LEVEL=info` -- de standaard -- schrijft elk verzoek een regel. Op een
bestand is dat dus per verzoek een synchrone schrijfactie, midden op de
event-loop. Gemeten, dezelfde last, alleen de bestemming van stdout verschilt:

| Meter | log -> bestand | log -> pijp | Verschil |
|---|---:|---:|---:|
| Event-loop p99 | 26,7 ms | 19,8 ms | **26%** |
| Event-loop max | 114,3 ms | 68,0 ms | **40%** |
| Gemiddelde duur | 0,313 ms | 0,320 ms | gelijk |

**Let op wat hier NIET staat: doorvoer.** Die was in de pijp-opstelling juist
lager (143k tegen 156k verzoeken), en dat is een eigenschap van de meetmachine en
niet van de software: de `cat` die aan de andere kant van de pijp leest, vecht op
vier kernen mee om dezelfde CPU. Op een machine met een echte logverzamelaar
speelt dat niet. De event-loop-cijfers zijn wel houdbaar, want die meten precies
waar een synchrone schrijfactie pijn doet.

Wat hieruit volgt is geen codewijziging maar een INRICHTINGSkeuze, en die hoort
niet stil te blijven. Techniekcontrole **LOG-01** op het bord kijkt sinds vandaag
naar de stroom en zegt het met de meting erbij: staat stdout aan een bestand
terwijl er per verzoek gelogd wordt, dan is dat een waarschuwing met het advies
(pijp, of `LOG_LEVEL=warn`). Hangt er een pijp aan, of wordt er niet per verzoek
gelogd, dan staat hij groen.

`test/logstroom.test.js` start daarvoor ECHTE processen in plaats van
process.stdout na te bootsen: het ding dat getoetst wordt is het gedrag van Node
zelf, en een nagemaakte stroom met de goede constructornaam bewijst alleen dat de
check een string vergelijkt.

## Wat de winst vasthoudt

Een prestatiewinst die alleen in dit document staat, is een winst die over een
half jaar weg is zonder dat iemand een besluit heeft genomen -- precies waar
`scripts/norm.js` voor bestaat. De ratel daar kijkt echter naar statische meters
(dekking, keuring, dependencies) en niet naar snelheid, en De Beproeving die dat
wel doet draait een kwartier en is dus geen poort bij elke wijziging.

Daarom staan er nu twee VANGRAILS in de suite, op dezelfde leest als de
bestaande vangrail in `test/opslag-voorcheck.test.js`:

| Vangrail | Waar | Eist | Gemeten |
|---|---|---|---:|
| Dispatch-index tegen de lineaire scan | `test/routerindex.test.js` (7) | >= 15x | 111x |
| Vlakke dispatch: achteraan niet duurder dan vooraan | idem | < 4x verschil | vlak |
| Prefixkaart tegen de dubbele lus | `test/toegangprefix.test.js` (4) | >= 8x | 63x |

Ze meten een VERHOUDING tussen twee implementaties in dezelfde run, en met opzet
geen absolute drempel in milliseconden: die zegt op een drukke bouwmachine niets
en levert een toets op die willekeurig knippert. Een verhouding valt weg tegen
hoe snel de machine toevallig is. De marges zijn ruim, dus ze zakken pas als de
winst grotendeels weg is en niet als hij schommelt.

De reden dat dit nodig is: de gedragstoetsen bewaken dat de index zich hetzelfde
GEDRAAGT als de scan. Een index die zich precies zo gedraagt en precies zo traag
is, haalt ze allemaal.

### Waar het werk terechtkwam

De keuring meldt elke servermodule boven 10.240 byte en `NORM.json` ratelt daarop.
Dit werk duwde er zes overheen en is daarom langs zijn naden geknipt -- niet door
de uitleg weg te halen, want die is het duurst verworven deel:

| Bestand | Wat erin zit |
|---|---|
| `server/web/routeindex.js` | de dispatch-index van de router |
| `server/functies/toegangpad.js` | welke functie bewaakt dit pad (toegangscode) |
| `server/kern/journaalbestand.js` | het append-only journaal: verzamelen en spoelen |
| `server/kern/journaalrotatie.js` | wegschuiven en de schijf begrenzen |
| `server/kern/journaalvorm.js` | `padVorm`/`bestemmingVorm`, ook los gebruikt door `log.js` |
| `server/kern/journaalverhuizing.js` | de eenmalige verhuizing uit de database |

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
