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

Een profiel onder gemengde last wees uit dat 42% van alle server-CPU naar het
OPSPOREN van wijzigingen ging: om te zien of een collectie veranderd was, werd
hij geserialiseerd -- alle 164, bij elke save, terwijl `sessions` alleen al
780 KB van de 1027 KB is. `server/db/voorcheck.js` slaat die serialisatie nu
over voor grote collecties waarvan het aantal items gelijk is, en hooguit
`RTG_SQLITE_GROOT_MS` (2 s). De grenzen zijn met opzet streng: toevoegen en
verwijderen veranderen het aantal en landen dus altijd meteen (in- en uitloggen
staan direct op schijf), geld wordt altijd exact nagekeken -- op naam én op een
namenlijst -- en netjes afsluiten kijkt alles na en vouwt de WAL dicht. Gemeten
op een sessie-zware last: 5,9 -> 1,2 ms per save. Vastgelegd in
`test/opslag-voorcheck.test.js`.

Daarna bleef er nog een tweede O(alles) staan: een collectie die alleen maar
GROEIT (`orders`) werd bij elke nieuwe order in zijn geheel herschreven -- gemeten
460 KB na 1050 orders, lineair groeiend. Het tx-grootboek bestond daar al voor,
maar werkte alleen met Postgres ("zonder Postgres is dit inert"), dus juist de
standaardopslag hield die serialisatie in stand. Het grootboek is nu
opslag-onafhankelijk: `server/db/tx/ledger.js` kent alleen nog een ACHTERKANT
(`pgachter.js` of `sqliteachter.js`), en dezelfde veeg- en vensterlogica draait op
beide. In de SQLite-stand houdt het RAM een venster van de recentste items en
staat de rest als geindexeerde rij in een eigen `grootboek.db` -- eigen bestand,
zodat de kv-schrijvers en het grootboek niet op dezelfde schrijflock wachten.
Gemeten op een order-zware last: `saveSqlite` van 35,2% naar 26,1% van de CPU en
1119 -> 1380 rondes in dezelfde 25 s. Uit te zetten met `TX_LEDGER_SQLITE=0`.
Vastgelegd in `test/txledger-sqlite.test.js`, dat hetzelfde contract afdwingt als
de Postgres-variant: venster, verlies-vrij vegen, historie voorbij het venster,
doorstromende statuswissels, en dat de kv-blob niet meer meegroeit.

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
- Gedeelde front-end-hulp `public/apps/util.js`: veilig escapen, initialen, en
  een veilige component-/DOM-bouwer `Util.el(tag, props, ...kinderen)` die
  schermen uit kleine stukjes bouwt zonder ooit `innerHTML` met invoer te vullen
  (tekst gaat altijd via `textContent`, handlers via `addEventListener`). De
  RTF-Contacten (de nieuwste, meest gevoelige lijsten) draait nu op deze bouwer
  in plaats van HTML-strings aan elkaar te plakken; andere schermen kunnen
  stapsgewijs volgen. Een volledig componentframework voor alle apps blijft een
  grotere, aparte migratie, maar de veilige bouwsteen is er nu.
- `npm run check` bewaakt de afspraken (geen inline handlers, geen brede
  streepjes, kloppende service-worker-shells, alle server-bestanden compileren),
  zodat de frontend zonder zwaar buildsysteem toch gedisciplineerd blijft.

## 9. Operationeel broos  (aangepakt)
Corrupte `db.json` valt bij het laden terug op de nieuwste dagbackup; een
onverwachte datavorm stopt het opstarten (niet over goede data heen schrijven);
schema-versie toegevoegd. Optionele off-site backup naar `RTG_BACKUP_DIR`.

## Privacy op schijf  (aangepakt)
- **Bestandsrechten**: de datamap is 0700 en alle databestanden (db.json,
  store.db, de dagbackups en het geuploade identiteitsbewijs) zijn 0600, dus
  alleen de proceseigenaar kan ze lezen.
- **Versleuteling-at-rest** (`server/kluis.js`): met `RTG_ENC_KEY` in de omgeving
  wordt alles wat naar schijf (en naar de Redis-mirror) gaat versleuteld met
  AES-256-GCM: de hele db bij de JSON-opslag, elke collectie bij de
  SQLite-opslag, en de KYC-documenten. Een gestolen schijf of backup is dan
  onleesbaar zonder de sleutel; geknoei valt op (GCM-tag). Zonder sleutel
  verandert er niets, en bestaande plaintext-data blijft laden (geleidelijke
  migratie: nieuwe schrijfacties zijn versleuteld). Staat er versleutelde data en
  ontbreekt de sleutel, dan weigert de server te starten in plaats van stil met
  lege data te beginnen. Bewaar de sleutel BUITEN de datamap.
  Getest: op schijf staat cijfertekst (geen plaintext), herstart met dezelfde
  sleutel laadt de data, een foute sleutel wordt geweigerd, en de multi-writer
  merge werkt ook met versleuteling aan.

---

Alle wijzigingen draaien met de bestaande testsuite groen (52 tests), plus
losse unit-tests voor de hulplibs en integratietests voor de veiligheids- en
realtime-laag.
