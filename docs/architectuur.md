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

## Belangrijk: van modules naar écht losse servers

De code is nu modulair en per domein opstartbaar, maar de domeinen delen nog het
geheugen van de kern: één db-bestand en één in-proces SSE-lijst. Daarom hoort er
op dit moment precies **één** proces naar de data te schrijven (net als bij het
failover-trio in `server/trio.js`).

Voor echt losse, schrijvende servers is nog nodig:

1. **Gedeelde database** met vergrendeling in plaats van het lokale JSON-bestand
   (bijv. Postgres), zodat meerdere processen tegelijk veilig kunnen schrijven.
2. **Gedeelde realtime-bus** (bijv. Redis pub/sub) achter `sseToCustomer` en
   vrienden, zodat een snap of belsignaal ook een gebruiker bereikt die met een
   ander domeinproces verbonden is. Cross-app bellen/snaps/chat hangen hieraan.

Omdat alle domeinen alleen via de kern met de gedeelde staat praten, verandert
er in de domeinmodules niets als die twee lagen later worden vervangen: alleen
de kern krijgt dan een gedeelde in plaats van een in-proces implementatie.
