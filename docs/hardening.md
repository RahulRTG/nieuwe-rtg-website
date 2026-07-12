# Hardening: de negen zwakheden aangepakt

Kort overzicht van wat er per zwakheid is gedaan, en wat bewust nog openstaat.

## 1. Kindveiligheid  (aangepakt)
Blokkeren (beide kanten dicht: geen verzoek, chat, snap of belsignaal),
melden (naar `db.data.reports` voor de backoffice), en ouder-meekijk: een
beheerder ziet de contacten van elk kind en kan er een verwijderen.
Adult-verzoeken aan een kind worden als "volwassene" gemarkeerd. Knoppen in de
RTF-Contacten en de RTG-ledenchat.

## 2. Datamodel schaalt niet  (grote stap, rest gedocumenteerd)
Opt-in `RTG_STORE=sqlite`: elke collectie wordt een rij in SQLite (WAL,
transactioneel, multi-proces), en alleen gewijzigde collecties worden
weggeschreven, in plaats van steeds een heel JSON-bestand. Volledige
relationele sharding (meerdere gelijktijdige schrijvers) blijft de laatste stap.

## 3. Misbruik/spam  (aangepakt)
Snelheidslimieten: vriendschapsverzoeken (30/uur), berichten (60/min), snaps
(40/5min). Blokkeren en melden zoals bij zwakheid 1.

## 4. God-object kern  (eerste stap gezet)
Zuivere helpers naar losse, geteste modules: `server/lib/geo.js` en
`server/lib/leeftijd.js`. De routes zaten al in aparte domeinmodules. De kern
verder ontvlechten is een doorlopend traject.

## 5. Realtime "at-most-once"  (aangepakt)
Persoonlijke events (chat, snap, belsignaal) krijgen een id en worden twee
minuten per ontvanger bewaard; bij herverbinden speelt EventSource ze via
Last-Event-ID opnieuw af. Werkt ook over de Redis-bus, dus tussen processen.

## 6. Bellen zonder TURN  (aangepakt binnen de mogelijkheden)
Alle apps halen bij elke oproep verse ICE-servers (roterende TURN-credentials
werken dan), en tonen een nette melding als de verbinding toch mislukt. Een
echte TURN-server draaien blijft een infrastructuurkeuze (zie docs/turn-server.md).

## 7. Demo-deuren en XSS  (aangepakt)
Demo-inlog en het demo-account werken alleen buiten productie of met
`RTG_DEMO=1`; `OFFICE_CODE` valt in productie zonder eigen code terug op een
onraadbare waarde. Berichten en snaptekst worden server-side van `<`/`>`
ontdaan; de front-end escapet via de gedeelde `Util.escapeHTML`. CSP staat nog
`unsafe-inline` toe omdat de apps bewust self-contained zijn (build-stap nodig
om dat te verwijderen).

## 8. Front-end niet meegegroeid  (eerste stap gezet)
Gedeelde front-end-hulp `public/apps/util.js` (veilig escapen, initialen) in
plaats van een kopie per app. Een build-stap/componentframework blijft het
grote openstaande werk.

## 9. Operationeel broos  (aangepakt)
Corrupte `db.json` valt bij het laden terug op de nieuwste dagbackup; een
onverwachte datavorm stopt het opstarten (niet over goede data heen schrijven);
schema-versie toegevoegd. Optionele off-site backup naar `RTG_BACKUP_DIR`.

---

Alle wijzigingen draaien met de bestaande testsuite groen (52 tests), plus
losse unit-tests voor de hulplibs en integratietests voor de veiligheids- en
realtime-laag.
