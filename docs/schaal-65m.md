# Schaal: 65 miljoen klanten — geheugen en opslag gemeten

Hoeveel kost het om 65 miljoen leden in het systeem te hebben? De korte
versie: het **serverproces blijft rond de 117 MB RAM**, of er nu duizend of
65 miljoen leden zijn, en de 65 miljoen kosten **~11 GB opslag in Postgres**.

Dat komt door een bewuste ontwerpkeuze: de ledengids (`member_dir`) staat bij
miljoenen leden als **geïndexeerde rijen in Postgres**, buiten het
procesgeheugen — niet als een object/array in RAM dat bij elke `save()` als
één string geserialiseerd zou moeten worden (zie `server/kern/gids.js` en de
`ledenGids*`-functies in `server/db.js`). Zonder Postgres (JSON/sqlite) draait
alles op `db.data.memberDir` zoals voorheen; dat is prima tot ~1–1,5M leden.

## De meting (`scripts/mega65.js`)

Draai met een echte Postgres:

```
DATABASE_URL=postgres://user@host/db node scripts/mega65.js
```

Knoppen: `MEGA_LEDEN` (65000000), `MEGA_CHUNK` (5000000), `MEGA_DUUR` (30000 ms).
Zet `MEGA_LEDEN` kleiner voor een snelle proef — het beeld (vlakke RAM, opslag
in Postgres, geïndexeerd zoeken) is hetzelfde.

De test: boot op Postgres, zaai N leden in `member_dir` (bulk, indexen na
afloop), meet RAM (RSS) en schijf, controleert de zware leesroutes, en draait
dan het hele ecosysteem (De Butler, Care, tickets, Salon, kantoor) ~30 s
bovenop de volle gids.

## Uitkomst bij 65.000.000 leden

| | Leeg | Bij 65.000.000 |
| --- | --- | --- |
| Server-RAM (RSS) | 114 MB | **117 MB** (+3 MB voor 65M) |
| RAM-piek onder volle last | — | 231 MB |
| Postgres `member_dir` totaal | — | **~10,7–11,7 GB** (~165–180 byte/lid) |
| Kantoor-totalen (ledental) | — | **4 ms**, O(1) |
| Nieuw lid registreren + 1e call | — | 68 ms |
| Codenaam-deelzoeken (trigram) | — | ~150 ms |

Onder de storm van ~30 s: tienduizenden calls, **0 serverfouten (5xx)**; de
enige 4xx zijn nette rate-limits (429) op de AI- en zoekroutes.

## De zoekindex (waarom trigram)

Exact opzoeken op codenaam (de betaal-/Tik-weg, `codename_lower = $1`) gebruikt
de gewone btree-index en is O(log n) — bij 65M snel. Het **deelzoeken** van
"vind een vriend" doet `LIKE '%q%'`; een btree-index kan dat wildcard-voorvoegsel
niet gebruiken en scant dan alle rijen (bij 65M seconden per zoekopdracht). De
**`pg_trgm` trigram-index** (`gin(codename_lower gin_trgm_ops)`) maakt juist die
`LIKE '%q%'` geïndexeerd: gemeten daalde het deelzoeken over 10M van seconden
naar ~136 ms. De index wordt best-effort aangemaakt bij het opstarten; mag de
extensie niet (geen rechten), dan valt alleen het deelzoeken terug op een scan
en werkt de rest gewoon door. De trigram-index kost extra opslag (~15 byte/lid),
vandaar de bandbreedte 165–180 byte/lid hierboven.

## Waarom "Leden in de gids" nu de O(1)-teller gebruikt

De kantoor- en afdelingen-KPI's telden het ledental met
`Object.keys(memberDir).length`. Dat is met Postgres 0 (de leden staan buiten
het geheugen) én O(N). Ze gebruiken nu `ledenAantal()` — de onderhouden teller
die ook de leden in Postgres meetelt (O(1)). Zo klopt het ledental in beide
opslagmodi. `server/kern/paspoort.js` haalt de codenaam nu via `gidsHaal(key)`
in plaats van rechtstreeks uit `memberDir`, om dezelfde reden.

# De chaos-soak: een oordeel-harnas, geen groene tabellen

`scripts/mega65-storm.js` is bewust een *oordeel*-harnas: het print geen mooie
cijfers die altijd slagen, maar toetst harde drempels (SLO's) en **eindigt met
exitcode 1** als er een zakt. Het is deterministisch (seeded PRNG, zelfde run =
zelfde uitkomst), zet 65M in de ledengids (buiten het RAM) plus een activiteits-
laag in het werkgeheugen, en bestookt daarna systematisch elk endpoint uit de
bron met (a) het juiste rol-token, (b) elk verkeerde rol-token en (c) rommel-
invoer (emoji's, gigastrings, diep geneste JSON, verkeerde types, XSS/SQL).

De vijf oordelen: **ROBUUSTHEID** (nul onverwachte 5xx; een 503 voor een uitge-
schakelde functie en een 429 rate-limit tellen expliciet niet mee), **ROL-
SCHEIDING** (een verkeerd-rol token krijgt nooit 2xx), **DEKKING** (elk endpoint
minstens N keer geraakt; ongeraakte endpoints worden benoemd), **GEHEUGEN** (geen
lek: zie hieronder de eerlijke meetmethode), **LATENTIE** (p99 onder de SLO). De
uitvoer sluit af met een blok "wat deze test NIET bewijst".

Dat de drempels écht kunnen zakken is geen theorie: in dezelfde ronde vond de
harnas een echte 500 (zie hieronder), waardoor **ROBUUSTHEID** terecht rood sloeg
tot de fix erin zat. Een test die alleen groen kan slaan bewijst niets.

```
DATABASE_URL=postgres://... node --max-old-space-size=8192 scripts/mega65-storm.js
```

## Wat de chaos vond -- en wat vals alarm was (eerlijk)

1. **Een echte crash in de auth-laag (gefixt).** Een leverancier- of kantoor-
   token dat op een leden-endpoint belandt, gaf een 500: de leden-`auth`
   accepteerde die sessie (die geen persona-`tier` heeft) en de ledengids
   crashte op een ontbrekende codenaam. Geverifieerd via de stacktrace,
   gereproduceerd en gefixt: de leden-`auth` weert niet-leden-sessies nu met 401
   en `liveCodename` is defensief. `test/auth-rol.test.js` toetst dit
   **uitputtend**: het leest élke `auth`-route uit de bron (ruim 200) en eist dat
   een leverancier- en kantoor-token daar 401 krijgen, nooit 2xx of 5xx.
2. **Vals alarm door een tel-bug in de harnas zelf.** Eerdere runs "vonden" 5xx
   op `/api/munt/*` en `/api/auth/register`. Dat waren geen serverfouten: het
   waren nette **503**'s (munt-betalen staat standaard uit) en 429/503-
   antwoorden. De harnas checkte `status >= 500` vóór `status === 503` en telde
   503 (dat óók >= 500 is) daardoor als serverfout. Dat is precies zo oneerlijk
   als een test die onterecht groen slaat: nu staat de volgorde goed (503 en 429
   eerst), en de robuustheid slaat terecht PASS.
3. **Een defensieve verbetering meegenomen.** `/api/auth/register` deed de
   account-schrijfstappen na de validatie buiten een try/catch. Onder een
   database-fout zou dat een onafgevangen 500 geven; dat is nu een nette 503.
   Een echte latente kwetsbaarheid, los van de tel-bug hierboven.
4. **Nog een echte crash (gefixt).** `/api/office/ontmoeting/signaal` gaf een 500
   zodra het de allereerste aanraking met de Salon-ontmoetingen was. Oorzaak:
   `db.data.ontmoetDates` wordt lui aangemaakt (`lijsten()`), en bij een
   Postgres-boot waar die collectie nog nooit was weggeschreven is hij `undefined`;
   `signaalNaarLid` deed er direct `.find` op. Gefixt door de gedeelde toegang
   (`dateVoor`) de `lijsten()`-borging te geven en `signaalNaarLid` daar doorheen
   te leiden. `test/ontmoeting-leeg.test.js` dekt precies dit: een verse server,
   het signaal-endpoint als eerste call, eist een 404 in plaats van een 500.

## Geheugen eerlijk meten: heapUsed na GC, niet de RSS

De eerste opzet mat de *RSS-vloer* (minimum uit `/proc`) en noemde dat "na GC".
Dat is oneerlijk: V8 geeft vrijgekomen pagina's niet terug aan de OS, ook niet na
een volledige GC. Gemeten gaf 200 MB vrijmaken maar ~38 MB RSS-daling. De RSS
loopt dus met een ruime heap gewoon op zonder dat er iets lekt, en een RSS-drempel
zou onterecht rood slaan. Twee dingen zetten dat recht:

1. **Meet `heapUsed`, niet RSS, en forceer eerst een GC.** De harnas start de
   server met `--expose-gc` en een test-preload (`scripts/gc-hook.js`); op SIGUSR2
   draait de server een volledige GC en schrijft het levende `heapUsed` weg. Dat
   is het bereikbare geheugen, niet de opgeblazen RSS. (De productieserver blijft
   ongemoeid: de haak zit in de test-preload.)
2. **Scheid eenmalige opwarming van een echt lek, met LEES-rondes.** Na de soak
   meet de harnas de vloer, herhaalt dan een paar *identieke, puur lezende* rondes
   (de zware O(N)-leespaden) en meet de vloer telkens opnieuw, na uitademen en GC.
   Lezen voegt geen data toe, dus een oplopende vloer kan dan geen "meer orders
   opgeslagen" zijn -- alleen een echt lek. De eenmalige opwarming (caches en
   afgeleide staat die bij eerste toegang vollopen, hier ~1,6 GB) valt buiten de
   fit. Uitkomst: de vloer keert elke ronde terug naar hetzelfde niveau (helling
   rond 0, soms licht negatief). **Geen lek.**

De eerdere "stijgend, mogelijk lek"-meting was dus deels een meet-artefact (RSS in
plaats van heapUsed) en deels legitieme opwarming, niet een lek.

## De echte grens: latentie, en wat eraan gefixt is

De echte grens zijn niet de 65M leden -- die staan geïndexeerd in Postgres, buiten
het RAM, en blijven goedkoop. De grens zijn de grote transactionele collecties
(orders enz.) die nog wél in het werkgeheugen (`db.data`) staan. Lees- en
aggregatie-endpoints lopen daar O(N) overheen; met een miljoen orders blokkeert
zo'n verzoek de single-threaded event-loop, waardoor de p99 oploopt. De
**LATENTIE**-drempel is dáárom bedoeld om te kunnen falen: bij een zware werkset
zakt hij, en dat is de eerlijke uitkomst -- een rode drempel, geen groene tabel.

Twee schrijf-pad-stalls die de latentie onnodig verergerden, zijn wél gefixt (de
p99 zakte in deze run van ~6800 ms naar ~2000 ms):

- **`server/pg.js` (flush).** Verandering opsporen deed per collectie een
  `JSON.stringify`. Voor een grote, meestal-onveranderde collectie (honderden MB's)
  was dat elke flush (~150 ms) een event-loop-stall. Nu een goedkope voorcheck
  voor grote collecties: gelijke lengte en recent volledig gecontroleerd -> sla de
  dure stringify over (een toevoeging verandert de lengte en wordt meteen opgepikt).
- **`server/db.js` (lokale snapshot).** Bij Postgres is de lokale snapshot alleen
  een warme-start-cache -- Postgres is de duurzame waarheid. Hem bij elke flush
  volledig serialiseren (honderden MB's) belastte het hete pad dubbel. Nu ten
  hoogste eens per 30 s, en niet meer óók vanuit `save()` ingepland.

Wat daarna overblijft is de echte O(N)-lees-vloer: die vergt de architectuur-stap
hieronder en is bewust niet met een lapmiddel weggepoetst.

## Vervolg (bewust nog niet gedaan)

De logische volgende stap is dezelfde behandeling voor de transactionele
collecties als voor de ledengids: orders/boekingen als geïndexeerde rijen in
Postgres met gepagineerde, geaggregeerde lezers, in plaats van als één grote
array in `db.data`. Dan verdwijnt de laatste O(N)-serialisatie uit de hete paden
en schaalt ook de activiteitslaag mee met de 65M.
