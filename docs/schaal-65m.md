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

# De chaos-soak: 65M + activiteit + rommel op elke functie

`scripts/mega65-storm.js` gaat een stap verder dan de kale meting hierboven: het
zet 65M in de ledengids (buiten het RAM) én een echte activiteitslaag in het
werkgeheugen (een miljoen orders, plus boekingen, betalingen, verzoeken,
reviews en meldingen), en bestookt daarna ~688 endpoints langdurig met onnozele
invoer (emoji's, gigastrings, diep geneste JSON, verkeerde types, XSS/SQL-achtige
strings), met rol-token-verwisseling. Het meet robuustheid (5xx), geheugen over
de tijd en event-loop-haperingen (een health-sonde).

```
DATABASE_URL=postgres://... node --max-old-space-size=8192 scripts/mega65-storm.js
```

## Wat de soak vond (en wat er gefixt is)

1. **Een echte crash in de auth-laag.** Een leverancier- of kantoor-token dat op
   een leden-endpoint belandt, gaf een 500: de leden-`auth` accepteerde die
   sessie (die geen persona-`tier` heeft) en de ledengids crashte op een
   ontbrekende codenaam. Nu weert de leden-`auth` niet-leden-sessies met 401 en
   is `liveCodename` defensief. (`test/auth-rol.test.js`.)
2. **`/api/auth/register` kon onder druk een onafgevangen 500 geven** doordat de
   account-schrijfstappen na de validatie buiten een try/catch stonden. Nu een
   nette 503. Het aantal register-5xx onder de storm daalde van 16 naar 1.

## Wat de soak leerde over geheugen en de echte grens

- **Geen geheugenlek.** Het RAM slingert in een GC-zaagtand (bijv. ~2,5 GB dal,
  ~8 GB piek) en zakt na elke GC weer terug; de *vloer* (het minimum na GC)
  loopt niet op. Het harnas meet daarom expliciet de vloer-helling, niet de kale
  begin-eind. De eerste meting die "stijgend, mogelijk lek" leek, was deels een
  meet-artefact: de server logt elk verzoek, en dat door een trage pijplijn
  persen gaf backpressure zodat Node in het geheugen bufferde. Sinds het
  serverlog naar een bestand gaat, is dat weg.
- **De echte grens zijn niet de 65M leden — die staan geïndexeerd in Postgres,
  buiten het RAM, en blijven goedkoop.** De grens zijn de grote transactionele
  collecties (orders enz.) die nog wél in het werkgeheugen (`db.data`) staan.
  Lees- en aggregatie-endpoints lopen daar O(N) overheen en serialiseren grote
  JSON; met een miljoen orders blokkeert één zo'n verzoek de (single-threaded)
  event-loop seconden lang (health-sonde p95 ~5 s), waardoor de doorvoer onder
  gelijktijdige last inzakt. Dit is precies de grens die de architectuur voor de
  ledengids al oploste (naar Postgres), maar voor orders/boekingen nog niet.

## Vervolg (bewust nog niet gedaan)

De logische volgende stap is dezelfde behandeling voor de transactionele
collecties als voor de ledengids: orders/boekingen als geïndexeerde rijen in
Postgres met gepagineerde, geaggregeerde lezers, in plaats van als één grote
array in `db.data`. Dan verdwijnt de laatste O(N)-serialisatie uit de hete paden
en schaalt ook de activiteitslaag mee met de 65M.
