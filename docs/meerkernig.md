# Meer kernen benutten — de haalbaarheidsproef

_Gemeten op 24 augustus 2026. Dit document bestaat omdat de uitkomst niet is wat
je zou verwachten, en omdat het opnieuw uitzoeken duur is._

De aanleiding: na de verzoekketen-optimalisatie (zie `PRESTATIES.md`) draait één
serverproces op ~5.000 verzoeken per seconde. De machine heeft meer kernen, Node
gebruikt er één voor JavaScript, en het failover-trio (`server/trio.js`) zet twee
van de drie servers als **standby** — die staan dus niets te doen. De voor de hand
liggende volgende stap is: verdeel het verkeer, gebruik alle kernen.

**Die stap levert op deze codebase geen winst zolang de processen dezelfde
opslag delen.** Dat is de kern van dit document.

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

## De volgorde die hieruit volgt

Niet "verdeel het verkeer". Wel, op deze volgorde:

1. **Een opslag die echt gelijktijdig schrijft.** `STORE=postgres` bestaat al in
   deze codebase (`server/db/postgres.js`, write-behind met `DATABASE_URL`).
   Postgres serialiseert niet op één schrijflock per bestand. Dit is de
   voorwaarde, niet een optimalisatie achteraf: zonder dit levert stap 3 niets.
   Let op dat de write-behind-cache in het geheugen blijft bestaan, dus punt 2
   verdwijnt hier niet vanzelf mee — dat moet apart nagemeten worden.
2. **Sticky routing op de sessie.** Het trio proxyt al per verzoek
   (`server/trio.js`), dus een lid consequent naar hetzelfde proces sturen is
   een kleine ingreep op een bestaande laag. Dat lost read-your-writes op zonder
   dat er ook maar iets aan de opslag hoeft te veranderen, en het valt netjes
   terug op een ander proces als er een omvalt — de sessie blijft immers geldig
   (de bus doet zijn werk, zie boven).
3. **Pas dan verkeer verdelen**, en meten op een machine waar het te meten valt.

Stap 2 is los van stap 1 en 3 nuttig en klein. Stap 1 is een
inrichtingsbeslissing met kosten (een Postgres om te beheren). Stap 3 zonder
stap 1 en 2 is aantoonbaar schadelijk: minder doorvoer dan nu, een staart die
tweeënhalf keer slechter is, en een read-your-writes-bug die niemand kan
reproduceren.

## De proeven overdoen

De scripts staan niet in de repo (het zijn wegwerpmetingen), maar de opstelling
is in drie regels na te bouwen:

```bash
redis-server --port 6399 --save '' --appendonly no --daemonize yes
# twee processen op DEZELFDE map -> gedeelde store
RTG_DATA_DIR=/tmp/gedeeld RTG_STORE=sqlite REDIS_URL=redis://127.0.0.1:6399 PORT=3301 npm start
RTG_DATA_DIR=/tmp/gedeeld RTG_STORE=sqlite REDIS_URL=redis://127.0.0.1:6399 PORT=3302 npm start
```

De sessieproef: inloggen op 3301, het token meteen op 3302 gebruiken. De
read-your-writes-proef: `POST /api/notities/bewaar` op 3301, daarna
`POST /api/notities/mijn` op 3302 tot de notitie er staat, en de tijd meten.
