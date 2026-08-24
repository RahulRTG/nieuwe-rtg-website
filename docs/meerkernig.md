# Meer kernen benutten — de haalbaarheidsproef

_Gemeten op 24 augustus 2026. Dit document bestaat omdat de uitkomst niet is wat
je zou verwachten, en omdat het opnieuw uitzoeken duur is._

De aanleiding: na de verzoekketen-optimalisatie (zie `PRESTATIES.md`) draait één
serverproces op ~5.000 verzoeken per seconde. De machine heeft meer kernen, Node
gebruikt er één voor JavaScript, en het failover-trio (`server/trio.js`) zet twee
van de drie servers als **standby** — die staan dus niets te doen. De voor de hand
liggende volgende stap is: verdeel het verkeer, gebruik alle kernen.

**Die stap leverde op deze codebase geen winst zolang de processen dezelfde
opslag deelden.** Dat wás de kern van dit document — en later diezelfde dag klopte
het niet meer. De metingen staan hieronder in de volgorde waarin ze gedaan zijn;
lees de nameting verderop erbij vóór je er een besluit op baseert.

## Wat er al wél is, en dat is meer dan verwacht

Drie dingen die je zou moeten bouwen, staan er al. Alle drie gemeten, niet
gelezen:

| Wat | Uitkomst |
|---|---|
| Drie schrijvende processen op één SQLite-store | Draaien naast elkaar, alle drie `writable: true`, **nul** lock- of BUSY-fouten |
| Sessie aangemaakt op proces A, gebruikt op proces B | **12 van 12 meteen geldig, 0 ms vertraging** |
| SSE/realtime tussen processen | `server/bus.js` doet dit al via Redis pub/sub |

De sessieproef is de belangrijkste van de drie, want dat was de gevreesde
showstopper: `server/kern/sessies.js` houdt sessies in een `Map` per proces, dus
je zou verwachten dat een lid bij elk tweede verzoek uit zijn sessie valt. Dat
gebeurt niet — `koppelBus()` publiceert elke sessiemutatie over de Redis-bus en
elk proces past hem meteen lokaal toe. Dat werkt precies zoals het bedoeld is.

## Wat er wél breekt: read-your-writes

Een lid bewaart een notitie op proces A en vraagt zijn lijst op bij proces B.

```
metingen                        10
meteen zichtbaar op ander proces 0
nooit zichtbaar                  0
mediaan                        733 ms
maximum                        787 ms
```

Nul van de tien. De data komt er wel, maar pas na de kruisprocespoll van
`server/db/sqlite.js` (`RTG_POLL_MS`, standaard 750 ms) — en de mediaan van
733 ms zegt dat het precies dát is en niets anders.

Dit gaat niet over een verouderd lijstje ergens in een hoek. Dit is een lid dat
zijn eigen zojuist opgeslagen notitie niet ziet staan. Verkeer verdelen zonder
hier iets aan te doen levert een bug op die willekeurig lijkt en onmogelijk te
reproduceren is, want of je hem ziet hangt af van welk proces je verzoek ving.

De sessies hebben dit probleem niet omdat ze over de bus lopen; de data loopt
over de poll. Dat verschil is de hele zaak.

## En de winst die het moest opleveren, is er niet

Alle proeven hieronder: 4 kernen, twee clientprocessen (in béide opstellingen
even veel, anders meet je je eigen belastingsgenerator), 2.064 echte routes,
24 gelijktijdige verzoeken per client, 20 seconden.

| Opstelling | Doorvoer | client p50 | client p99 |
|---|---:|---:|---:|
| 1 serverproces | 7.386/s | 3,93 ms | 51,3 ms |
| 2 processen, **gedeelde** store | 8.589/s | 2,53 ms | 122,8 ms |
| 2 processen, **eigen** store elk | 11.379/s | 2,34 ms | 49,2 ms |

Twee processen op een gedeelde store leveren dus nauwelijks doorvoer op en maken
de staart **twee en een half keer slechter**. Diezelfde twee processen op een
eigen store halen 11.379/s met een staart die net zo goed is als bij één proces.

Het verschil tussen die twee regels is de enige variabele die veranderde: of ze
dezelfde `store.db` delen. Daarmee is het niet de CPU die de schaal begrenst,
maar het schrijfpad. Dat is ook logisch zodra je het ziet: van de 8.261 routes
zijn er 8.113 een POST, elk verzoek schrijft een regel in het doorgeefjournaal,
en `saveSqlite()` pakt daarvoor met `BEGIN IMMEDIATE` de exclusieve schrijflock.
Twee processen die dat allebei doen, staan op elkaar te wachten — en betalen
bovendien allebei de merge- en serialisatiekosten.

### Wat deze cijfers NIET zeggen

Deze machine heeft **vier kernen**, en de belastingsgenerator draait erop mee.
Twee clients plus twee servers is al vier processen op vier kernen. Een eerdere
ronde met drie servers en zes clients (negen processen op vier kernen) gaf
event-loop-uitschieters tot 2,1 seconde; die cijfers staan hier bewust niet in de
tabel, want dat is uitgehongerde CPU en geen eigenschap van de software.

De conclusie "gedeelde opslag is de rem" is wél houdbaar, want die volgt uit het
verschil tussen twee metingen onder identieke omstandigheden. De conclusie "N
processen geven N keer zoveel" is op deze machine **niet te meten**, in geen van
beide richtingen. Daar is een machine voor nodig met meer kernen dan het
experiment processen heeft, en een belastingsgenerator die er niet op meedraait.

En hij bleek nóg minder te zeggen dan dat: lees de volgende paragraaf voordat je
op deze conclusie afgaat.

## Nagemeten, later op dezelfde dag — en de conclusie hierboven klopt niet meer

De metingen hierboven zijn gedaan vóórdat het journaal naar een eigen bestand ging
(`server/kern/journaalbestand.js`). Dat is precies de blob die de gedeelde store
op slot hield: elk verzoek schreef een regel in `db.data.doorgeefjournaal`, dus
elk verzoek nam met `BEGIN IMMEDIATE` de exclusieve schrijflock. Sinds die regel
naar een append-only bestand gaat, schrijft een gewoon verzoek helemaal niet meer
in de gedeelde store.

Dezelfde last, dezelfde machine, vier opstellingen achter elkaar (2 clientprocessen,
2.064 echte routes, 24 gelijktijdige verzoeken per client, 20 seconden):

| Opstelling | Doorvoer | p50 | p99 |
|---|---:|---:|---:|
| 1 proces, SQLite | 8.586/s | 4,07 ms | 22,2 ms |
| 1 proces, Postgres | 7.851/s | 4,55 ms | 23,5 ms |
| 2 processen, **gedeelde** SQLite | 12.894/s | 2,22 ms | 23,0 ms |
| 2 processen, **gedeelde** Postgres | 13.760/s | 2,23 ms | **18,1 ms** |

Daar staan twee dingen tegelijk in.

**Gedeelde SQLite schaalt nu wél.** 8.586 → 12.894/s is 1,5x op twee processen,
en de staart wordt niet slechter maar iets beter. In de tabel hierboven was dat
7.386 → 8.589/s met een staart die van 51 naar 123 ms ging. De rem zat niet in
SQLite maar in wat wij erin schreven.

**Postgres is daarmee geen voorwaarde meer, maar een verbetering.** Op één proces
is Postgres iets langzamer dan SQLite (−9% doorvoer; er gaat een socket en een
wire-protocol tussen). Op twee processen draait dat om: +7% doorvoer en −21% op
de p99 ten opzichte van gedeelde SQLite. Dat is precies het patroon dat je
verwacht van een opslag die niet op één bestandslock serialiseert — alleen is het
verschil nu een marge en geen orde van grootte.

### En read-your-writes op Postgres

Dezelfde proef als hierboven, twee keer gedraaid, op een schone opstelling:

| | SQLite | Postgres |
|---|---:|---:|
| Sessie geldig op het andere proces | 0 ms | 0 ms |
| Meteen zichtbaar | 0 van 10 | 0 van 10 |
| Mediaan | 733 ms | **139–141 ms** |
| Maximum | 787 ms | 169–200 ms |

Vijf keer kleiner venster, maar **niet nul**. Postgres heeft `LISTEN/NOTIFY`, dus
het andere proces hoort er meteen van; wat overblijft is de write-behind-cache in
het geheugen plus de tijd om de melding te verwerken. Dat was de open vraag in de
oude stap 1 hieronder, en het antwoord is: nee, die cache verdwijnt er niet mee.
Een lid dat op proces A bewaart en binnen ~140 ms op proces B leest, ziet zijn
eigen notitie nog steeds niet staan.

**Sticky routing blijft dus nodig** — niet als optimalisatie, maar als de enige
van de drie stappen die read-your-writes echt sluit.

### Een valkuil die twee metingen kostte

`RTG_DEMO=1` met twee instanties op één database is geen geldige opstelling: het
opstarten van de tweede zet het wachtwoord van de eigenaar opnieuw, en het eerste
proces heeft dat dan nog in zijn cache staan — waarna inloggen op het ene proces
lukt en op het andere 401 geeft. Twee metingen zijn daarop gesneuveld voordat het
opviel. De demo-zaaier hoort niet in een meeropstelling thuis.

## De volgorde die hieruit volgt

_Bijgesteld na de nameting hierboven: stap 1 en stap 3 zijn van plaats gewisseld._

Niet "verdeel het verkeer". Wel, op deze volgorde:

1. **Sticky routing op de sessie.** Nu de eerste stap, want dit is het enige dat
   read-your-writes echt sluit — op SQLite (733 ms) én op Postgres (140 ms). Het
   trio proxyt al per verzoek (`server/trio.js`), dus een lid consequent naar
   hetzelfde proces sturen is een kleine ingreep op een bestaande laag, en het
   valt netjes terug op een ander proces als er een omvalt: de sessie blijft
   immers geldig (de bus doet zijn werk, zie boven).
2. **Verkeer verdelen**, en meten op een machine waar het te meten valt. Dit mag
   nu vóór de opslagkeuze: gedeelde SQLite schaalt 1,5x op twee processen zonder
   dat de staart eronder lijdt.
3. **Een opslag die echt gelijktijdig schrijft.** Geen voorwaarde meer, wel een
   verbetering. `STORE=postgres` bestaat al in deze codebase
   (`server/db/postgres.js`, write-behind met `DATABASE_URL`) en levert op twee
   processen +7% doorvoer en −21% p99, plus gedeelde accounts via
   `server/pgaccounts.js` (LISTEN/NOTIFY). Daar staat het beheer van een Postgres
   tegenover. Een inrichtingsbeslissing dus, geen blokkade.

Stap 2 zonder stap 1 kost geen doorvoer meer, maar levert nog steeds de
read-your-writes-bug op die willekeurig lijkt en onmogelijk te reproduceren is,
want of je hem ziet hangt af van welk proces je verzoek ving.

## De proeven overdoen

De scripts staan niet in de repo (het zijn wegwerpmetingen), maar de opstelling
is in drie regels na te bouwen:

```bash
redis-server --port 6399 --save '' --appendonly no --daemonize yes
# twee processen op DEZELFDE map -> gedeelde store
RTG_DATA_DIR=/tmp/gedeeld RTG_STORE=sqlite REDIS_URL=redis://127.0.0.1:6399 PORT=3301 npm start
RTG_DATA_DIR=/tmp/gedeeld RTG_STORE=sqlite REDIS_URL=redis://127.0.0.1:6399 PORT=3302 npm start
```

Voor de Postgres-opstelling dezelfde twee processen, maar met `DATABASE_URL` in
plaats van `RTG_STORE` — en **elk een eigen `RTG_DATA_DIR`**, want de gedeelde
toestand zit dan in Postgres en niet meer op schijf:

```bash
DATABASE_URL=postgresql://rtg@127.0.0.1:5433/rtgproef RTG_DATA_DIR=/tmp/p1 PORT=3301 npm start
DATABASE_URL=postgresql://rtg@127.0.0.1:5433/rtgproef RTG_DATA_DIR=/tmp/p2 PORT=3302 npm start
```

Zonder `RTG_DEMO`, om de reden die hierboven bij de valkuil staat.

De sessieproef: inloggen op 3301, het token meteen op 3302 gebruiken. De
read-your-writes-proef: `POST /api/notities/bewaar` op 3301, daarna
`POST /api/notities/mijn` op 3302 tot de notitie er staat, en de tijd meten. Log
één keer in en gebruik dat ene token: twaalf inlogpogingen achter elkaar laten de
inlogrem terecht 429 geven, en dan meet je de rem.
