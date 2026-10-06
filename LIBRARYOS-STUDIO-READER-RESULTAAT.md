# Foundation LibraryOS — Studio/Reader resultaat

Datum: 4 oktober 2026
Branch: `codex/libraryos-kernel`
Kernel-checkpoint: `22eda5459`
Basis van de branch: `155820a40` (`origin/main`)

Deze vervolgfase bouwt één afgebakende kennislus op kernel v1:

```text
Work -> ContentNodes -> append-only Revisions -> frozen Edition 1
  ^                                                   |
  |                                                   v
nieuwe Revision <- geaccepteerde feedback <- private Reader
  |
  +-> frozen en released Edition 2

persoonlijke leesstaat -> eigen collectie, nooit Work- of Edition-inhoud
```

Er is geen marketplace, publieke distributie, Saloon-discovery, Academy-koppeling,
AI-auteurschap of stewardship toegevoegd.

## Gebouwd

- Creation Studio-projectie op de bestaande `Work`, `ContentNode` en `Revision`;
  stabiele nodevolgorde en append-only inhoud.
- Editiegebonden feedback met `open -> accepted/rejected/needs-information ->
  resolved`; oplossen vereist een latere revisie op hetzelfde inhoudsanker.
- Private Reader die uitsluitend een released immutable Edition-snapshot leest.
- Persoonlijke voortgang, bladwijzers, highlights en notities in een afzonderlijke
  `libraryReader`-collectie met eigen revisie, receipts en hashjournal.
- Zoeken binnen exact één Edition zonder de zoekopdracht of het openen op te slaan.
- Responsive FoundationOS-scherm voor Work, Studio, governance, release, Reader,
  feedback, correctie en Edition 2.
- Een echte ingang in de FoundationOS-wereld en de centrale appcatalogus.
- Bestaande RTG-contracten voor sessieactor, policy, transacties, audit,
  events, CSPRNG-ID's, appgids en routebewijsmeter.

## Architectuurkeuzes

1. De Studio bezit geen tweede documentmodel. Zij ordent en projecteert de
   kernelobjecten.
2. De Reader leest nooit draftstaat. `draft` en `frozen` geven
   `RELEASE_REQUIRED`; alleen `released` wordt geopend.
3. Feedback verandert een Edition niet. Een correctie wordt een nieuwe Revision
   en daarna, na nieuwe rechten- en instemmingscontrole, een nieuwe Edition.
4. Persoonlijke leesdata geeft geen credit, eigendom, expertise, editrecht of
   publicatierecht.
5. Lezen en zoeken creëren geen persoonlijke collectie. Alleen een bewuste
   bewaarhandeling muteert persoonlijke staat.
6. Foundation levert infrastructuur en wordt door gebruik niet impliciet
   eigenaar, uitgever of inhoudelijke beslisser.

## Migratie

`libraryKernel` migreert lazy en deterministisch van schema 1 naar 2:

- `structure` wordt uit de bestaande stabiele node-ID's opgebouwd;
- `feedback` begint als lege kaart;
- bestaande Edition-snapshots, hashes, releases, rechten en auditbytes blijven
  ongewijzigd.

`libraryReader` start als een eigen schema-1-collectie bij de eerste geslaagde
bewaarmutatie. Er zijn geen nieuwe SQL-tabellen, geen data-backfill en geen
migratie van Boeken, Bestanden, Academy of Foundation-projecten.

## Tests en bewijs

| Bewijs | Uitslag |
|---|---:|
| Kernel + Studio + Reader + SQLite + echte HTTP | 33/33 groen |
| Volledige echte browserlus, mobiel en desktop | 1/1 groen |
| PostgreSQL multi-instance/race/replay/herstel | 2/2 groen |
| Routebewijsregister en kantoorprojectie | 8/8 groen |
| Taalbewijs inclusief browser en failover | 27/27 groen |
| Volledige statische RTG-huiskeuring | alles groen |
| Actuele routekaart | 5414/5414 aangeraakt, 0 gaten |

De route-uitkomst is een expliciete incrementele unie van bestaande Living World
CI-/browserjournalen en de finale LibraryOS HTTP-/browserjournalen. Het is geen
claim dat de volledige RTG-suite in deze werkronde opnieuw is uitgevoerd.

De browsertest bewijst zichtbaar:

1. Work starten;
2. inhoud vastleggen;
3. expliciete solo-afspraak en rechtenverklaring;
4. Edition 1 freeze en release;
5. exact die editie lezen en een persoonlijke notitie bewaren;
6. correctiefeedback geven en accepteren;
7. een latere revisie maken en feedback daarmee oplossen;
8. Edition 2 met nieuwe instemming releasen;
9. Edition 1 blijft inhoudelijk `1964`, Edition 2 bevat `1965`;
10. beide edities blijven afzonderlijk opvraagbaar.

Bewijsbeelden:

- `output/library-studio-reader-20261004/library-mobile-editions.png`
- `output/library-studio-reader-20261004/library-desktop-reader.png`

## Performance

- Kernelmutaties kopiëren en hashen de begrensde collectie en zijn daarmee
  O(collectiegrootte); de bestaande grens is 25 MiB.
- Reader-mutaties serialiseren de persoonlijke collectie met een globale grens
  van 10 MiB. Eén zeer actieve actor kan die grens voor anderen uitputten; voor
  productie is partitionering of een aantoonbaar quota per actor nodig.
- Reader-search is O(tekstomvang van één Edition), met maximaal 100 treffers.
- Work-list is O(aantal betrokken Works). Er is nog geen productie-latency-SLO.

## Security en privacy

- De actor komt uitsluitend uit de live sessie en wordt tijdens kritieke
  mutaties opnieuw gecontroleerd.
- Worktoegang wordt ook bij Reader-replay opnieuw gecontroleerd.
- Een gewijzigde replay wordt geweigerd; antwoordverlies na commit herstelt
  zonder dubbel gevolg.
- Highlights bewaren posities en hashes, niet opnieuw het tekstfragment.
- `reader/proof` toont alleen het spoor van de ingelogde actor.
- Het solowerkscherm legt een rechtenverklaring vast; het verifieert geen
  juridische titel en mag dus niet als juridische vaststelling worden getoond.
- Audit is lokaal hashgebonden en nog niet onafhankelijk verankerd.
- Readerdata heeft nog geen retentie-, export-, wis-, nalatenschaps- of
  minderjarigenflow. Daarom blijft dit een private makerpilot.

## Resterende gaten en regressierisico

- Geen rich text, media, tabellen, bronneneditor of werktypespecifieke Studio.
- Geen toegankelijkheidsrepresentaties, vertaalvergelijking, offline download,
  EPUB, audio, print of preservation service.
- Geen volledige meerpartijenwizard of notificatie-inbox in de UI; de kernel-API
  ondersteunt de meerpartijencontracten wel.
- Geen publieke Reader, moderatie, discovery, commerce of Academy-koppeling.
- Verandering aan snapshotserialisatie, nodevolgorde, rechtenprojectie of de
  sessiehercontrole kan historische hashes of releaseveiligheid breken. De
  negatieve, race-, replay- en bytevergelijkingstests moeten daarom verplicht
  blijven.

De volgende veilige fase is een gestructureerde representatielaag met
toegankelijkheidsvarianten, plus retentie/export/wissen voor persoonlijke
Readerdata. Publieke discovery en commerce volgen pas na publieke
rechtenprojectie, moderatie en preservation.

## Exact bestandsmanifest

Handgeschreven LibraryOS-bron en toetsen:

```text
LIBRARYOS.md
LIBRARYOS-STUDIO-READER.md
LIBRARYOS-STUDIO-READER-RESULTAAT.md
public/apps/library.html
public/apps/library/api.js
public/apps/library/app.js
public/apps/library/app/app-01.js
public/apps/library/app/app-02.js
public/apps/library/style.css
scripts/bundel.js
scripts/check.js
server/kern/appcatalogus-rijen/deel1b.js
server/kern/appgids-data/deel9.js
server/kern/library/editions.js
server/kern/library/feedback.js
server/kern/library/index.js
server/kern/library/journal.js
server/kern/library/model.js
server/kern/library/reader.js
server/kern/library/studio.js
server/kern/library/works.js
server/kern/wereldroutes/life.js
server/lib/mutatiecontracten-library.js
server/routes/library.js
test/lib/library-fixture.js
test/library-http.test.js
test/library-studio-reader.e2e.js
test/library-studio-reader.test.js
test/library.pg.test.js
```

Centrale ingangen en afgeleide RTG-registers/afdrukken:

```text
ARCHITECTUUR.md
BEWIJS.md
BUNDELS.md
COMMERCE.json
DEKKING.json
FUNCTIES.md
LANGUAGECAPABILITY.json
LANGUAGEFAILOVER.json
MEANINGPARITY.json
MUTATIECONTRACT.json
MUTATIEINVENTARIS.json
NORM.json
OBJECTMODEL.json
VINDBAAR.json
WERELDLIJST.md
public/apps/app-main.js
public/apps/app-main/app-main-24.js
public/apps/app-main/app-main-24a2b.js
public/images/start/app-schermen/HERKOMST.json
public/images/start/app-schermen/gebruiker.png
public/images/start/app-schermen/organisatie.png
public/images/start/app-schermen/partner.png
public/shared/interface/workspace-world-catalog.js
public/site/website-truth.json
```
