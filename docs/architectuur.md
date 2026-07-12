# Architectuur: gedeelde kern + aparte domeinmodules

De backend is opgesplitst in een gedeelde kern en losse domeinmodules. Elke app
en elke pas heeft zo een eigen, overzichtelijk bestand, terwijl de gedeelde data
en realtime op een plek blijven.

## De kern (`server/server.js`)

De kern bevat alles wat gedeeld is en houdt de staat in het geheugen:

- de Express-app, security-headers en het serveren van de statische bestanden;
- de database (`server/db.js` + `server/accounts.js`) en `save()`;
- sessies, tokens en de `auth`-laag;
- de realtime-bus: de SSE-lijst en `sseToCustomer` / `sseToSupplier` / `sseToOffice`;
- meldingen en web-push;
- de gedeelde reken- en modelhelpers (prijzen, leeftijd, cv, ritten, enz.);
- de infra-endpoints die altijd meedraaien: `/api/health`, `/api/stream`,
  `/api/cluster`, `/api/push`, `/api/notifications`, `/api/translate`,
  `/api/whatsapp`, en de mount van `/api/foundation`.

De kern bouwt aan het eind een `kern`-object met al deze gedeelde onderdelen en
geeft dat door aan de domeinmodules. Domeinen praten **uitsluitend via de kern**
met de gedeelde staat; ze grijpen nergens rechtstreeks in elkaars geheugen.

## De domeinmodules (`server/routes/*.js`)

Elke module is `module.exports = (kern) => { ... }` en registreert alleen zijn
eigen routes op de gedeelde app:

| Module        | Bedient                                                        |
|---------------|---------------------------------------------------------------|
| `social.js`   | vriendenlaag, snaps, 24-uurs verhalen en bellen (RTG + RTF)   |
| `member.js`   | leden-app, live reis, boeken, salon, cv, RTF-brug             |
| `supplier.js` | leverancier-app (alle sectoren)                               |
| `office.js`   | backoffice / kantoor (RTG)                                    |
| `staff.js`    | personeel (PDA)                                               |
| `auth.js`     | registreren, inloggen, identiteitsverificatie                |
| `foundation`  | de RTFoundation-lesapp (eigen router, al langer los)          |

De vriendenlaag zit bewust in `social.js` omdat hij door zowel de leden-app als
de RTFoundation-app gebruikt wordt: één connectiegraaf, twee inlogdeuren.

## Een deel van de domeinen draaien

Standaard draaien alle domeinen in één proces (gedeeld geheugen, zoals nu). Met
`RTG_DOMAINS` kies je welke domeinen dit proces bedient:

```
RTG_DOMAINS=member,social node server/server.js     # alleen leden + social
RTG_DOMAINS=supplier PORT=3003 node server/server.js # alleen de leverancier-app
```

De infra-endpoints en de foundation-mount draaien altijd mee, zodat elk proces
zelfstandig gezond is (`/api/health`) en zijn eigen live-stream heeft.

## De gateway (`server/poort.js`)

Draai je domeinen als losse processen, dan zet je er de poortwachter voor. Die
stuurt op padprefix naar het juiste domeinproces (en pipe't SSE-streams live
door). Je wijst hem met omgevingsvariabelen naar de poorten:

```
RTG_UP_DEFAULT=http://127.0.0.1:3010 \
RTG_UP_SUPPLIER=http://127.0.0.1:3003 \
RTG_UP_OFFICE=http://127.0.0.1:3004 \
node server/poort.js
```

Alles zonder eigen upstream valt terug op `RTG_UP_DEFAULT` (het hoofdproces).

## Gedeelde data en realtime over losse processen (Redis)

De twee dingen die losse processen deelden zaten in het geheugen van de kern:
de data (`db.data`) en de realtime-lijst (SSE). Allebei hebben nu een gedeelde
variant via Redis, aan te zetten met één omgevingsvariabele. Zonder `REDIS_URL`
werkt alles zoals altijd (één proces, lokaal `db.json`, in-proces SSE).

### Realtime-bus (`server/bus.js`)

`sseToCustomer` / `sseToSupplier` / `sseToOffice` / `broadcastSync` / `notify`
publiceren nu op een bus in plaats van rechtstreeks op de lokale verbindingen.

- **Zonder `REDIS_URL`:** in-proces (een `EventEmitter`), synchroon en identiek
  aan vroeger.
- **Met `REDIS_URL`:** Redis pub/sub. Elk proces levert het event af aan zijn
  eigen open verbindingen. Zo bereikt een snap, belsignaal of melding ook een
  gebruiker die met een ánder domeinproces verbonden is. Cross-app bellen,
  snaps en chat blijven dus werken als de domeinen los draaien.

### Gedeelde data (`server/db.js`)

Met `REDIS_URL` spiegelt de schrijver elke `save()` naar Redis (met een oplopend
versienummer) en lezen de andere processen die verse data live mee. De
sessie-index wordt na een externe wijziging opnieuw gevuld, zodat een
lezersproces tokens kent die de schrijver net aanmaakte.

Er schrijft nog steeds precies **één** proces (`db.writable`), net als bij het
failover-trio. Zet de lezers met `RTG_ROL=standby`. Dit dekt het gangbare beeld:
één schrijver plus meerdere lees-/realtime-processen per domein, achter de
gateway.

```
# schrijver (alle domeinen of een subset), bewaart en deelt de data
REDIS_URL=redis://127.0.0.1:6379 PORT=3010 node server/server.js

# los leverancier-proces dat meeleest en dezelfde realtime deelt
REDIS_URL=redis://127.0.0.1:6379 RTG_ROL=standby RTG_DOMAINS=supplier \
  PORT=3003 node server/server.js

# gateway ervoor
RTG_UP_DEFAULT=http://127.0.0.1:3010 \
RTG_UP_SUPPLIER=http://127.0.0.1:3003 node server/poort.js
```

Getest met een echte `redis-server` en twee processen: de vriendschap die de
schrijver maakt ziet de lezer, en een belsignaal dat op de schrijver ontstaat
bereikt een SSE-verbinding op de lezer.

### De laatste stap: meerdere schrijvers

Wil je dat elk domein zijn eigen data ook zelfstandig **schrijft** (in plaats van
één schrijver), dan moet `db.data` van één groot JSON-document naar een echte
database met rijen en transacties (bijv. Postgres), zodat twee processen
tegelijk verschillende delen kunnen bijwerken zonder elkaar te overschrijven.
Omdat alle domeinen alleen via de kern (`db`, `save`, de bus) met de gedeelde
staat praten, verandert er in de domeinmodules niets: alleen `server/db.js`
krijgt dan een relationele in plaats van een blob-implementatie.
