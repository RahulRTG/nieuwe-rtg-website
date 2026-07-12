# Hardening: de negen zwakheden aangepakt

Kort overzicht van wat er per zwakheid is gedaan, en wat bewust nog openstaat.

## 1. Kindveiligheid  (aangepakt)
Blokkeren (beide kanten dicht: geen verzoek, chat, snap of belsignaal),
melden (naar `db.data.reports` voor de backoffice), en ouder-meekijk: een
beheerder ziet de contacten van elk kind en kan er een verwijderen.
Adult-verzoeken aan een kind worden als "volwassene" gemarkeerd. Knoppen in de
RTF-Contacten en de RTG-ledenchat.

## 2. Datamodel schaalt niet  (opgelost: echte multi-writer)
Opt-in `RTG_STORE=sqlite`: elke collectie is een rij in SQLite (WAL,
transactioneel) met een oplopend versienummer. Meerdere serverprocessen delen
hetzelfde store.db en schrijven TEGELIJK, elk in hun eigen collectie, zonder
elkaar te overschrijven; een korte achtergrondpoll haalt per collectie de
nieuwere versies van andere processen op (per-collectie bijgehouden welke versie
is toegepast). Getest met twee processen die tegelijk verschillende collecties
schrijven en elkaars data zien. Alleen een JSON-bestand herschrijven is niet
meer nodig. (Binnen EEN collectie serialiseert SQLite; geef een collectie aan
een domein. Row-niveau-concurrency binnen een collectie zou de volgende stap zijn.)

## 3. Misbruik/spam  (aangepakt)
Snelheidslimieten: vriendschapsverzoeken (30/uur), berichten (60/min), snaps
(40/5min). Blokkeren en melden zoals bij zwakheid 1.

## 4. God-object kern  (fors ontvlochten)
De routes zaten al in aparte domeinmodules; nu ook de helpers: de cohesieve
sociale laag (vrienden, veiligheid, snaps, verhalen) is een eigen kern-module
`server/kern/sociaal.js`, en zuivere hulp zit in `server/lib/geo.js` en
`server/lib/leeftijd.js`. server.js kromp van ~5900 naar ~2600 regels en het
kern-oppervlak van ~205 naar ~171 losse namen plus modules. Elke module praat
alleen via de meegegeven kern-onderdelen. Verdere clusters (prijzen, ritten)
kunnen op dezelfde manier volgen.

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
ontdaan; de front-end escapet via de gedeelde `Util.escapeHTML`. En de CSP is
nu streng (zie 8): geen `unsafe-inline` meer voor scripts.

## 8. Front-end niet meegegroeid  (aangepakt)
- Strenge CSP met een per-antwoord nonce: `unsafe-inline` voor scripts is weg,
  ingespoten scripts worden geblokkeerd (in de browser getest over zes apps;
  een script zonder nonce wordt geweigerd). Uit te zetten met `RTG_CSP_NONCE=0`.
- Gedeelde front-end-hulp `public/apps/util.js` (veilig escapen, initialen) in
  plaats van een kopie per app.
- `npm run check` bewaakt de afspraken (geen inline handlers, geen brede
  streepjes, kloppende service-worker-shells, alle server-bestanden compileren),
  zodat de frontend zonder zwaar buildsysteem toch gedisciplineerd blijft.
Een volledig componentframework blijft een grotere, aparte migratie.

## 9. Operationeel broos  (aangepakt)
Corrupte `db.json` valt bij het laden terug op de nieuwste dagbackup; een
onverwachte datavorm stopt het opstarten (niet over goede data heen schrijven);
schema-versie toegevoegd. Optionele off-site backup naar `RTG_BACKUP_DIR`.

---

Alle wijzigingen draaien met de bestaande testsuite groen (52 tests), plus
losse unit-tests voor de hulplibs en integratietests voor de veiligheids- en
realtime-laag.
