# Foundation LibraryOS — private Studio en Reader

Deze fase sluit één menselijke kennislus bovenop kernel v1:

```text
Work -> stabiele ContentNodes -> append-only Revisions -> immutable Edition 1
  ^                                                        |
  |                                                        v
nieuwe Revision <- geaccepteerde feedback <- private Reader
  |
  +-> immutable Edition 2

Persoonlijke voortgang / bladwijzer / markering / notitie
  -> eigen readercollectie, nooit onderdeel van het Work
```

Geen publieke catalogus of distributie is toegevoegd. Alleen bestaande
deelnemers aan een Work kunnen de Studio en vrijgegeven edities gebruiken.

## Domeingrenzen

- De Studio projecteert en ordent de bestaande `ContentNode`- en
  `Revision`-objecten. Zij heeft geen eigen documentformaat.
- De Reader leest uitsluitend de immutable snapshot van een released Edition.
  Hij leest nooit mutable draftinhoud.
- Feedback is Work-data, vastgemaakt aan `editionId + nodeId + revisionHash`.
  Accepteren verandert geen inhoud; oplossen vereist een aantoonbaar andere,
  append-only Revision op hetzelfde inhoudsanker.
- Leesvoortgang, bladwijzers, highlights en notities zijn persoonlijke data in
  `libraryReader`. Ze geven geen credit, eigendom, expertise, edit- of
  publicatierecht.
- Zoeken is een momentane projectie over de Edition; zoekopdrachten en openen
  worden niet opgeslagen. Alleen een bewuste bewaarhandeling muteert leesstaat.
- Foundation blijft infrastructuurleverancier. De solowizard laat de maker
  expliciet governance, rechtenverklaring en geen eigendomsoverdracht bevestigen.

## State en migratie

`libraryKernel` gaat van schema 1 naar 2. De deterministische lazy migratie:

1. maakt `structure` uit de stabiele bestaande node-ID's;
2. maakt een lege `feedback`-kaart;
3. laat Edition-snapshots, hashes, releases, grants en auditbytes ongemoeid.

De persoonlijke `libraryReader`-collectie start op schema 1 en ontstaat pas bij
de eerste geslaagde bewaarhandeling. Alleen lezen schept geen collectie. Een
onbekende versie weigert veilig. Beide collecties vereisen de bestaande
SQLite-/PostgreSQL-transacties; er is geen JSON-fallback.

## Nieuwe API-contracten

Projecties:

```text
POST /api/library/context
POST /api/library/work/list
POST /api/library/studio/workspace
POST /api/library/feedback/list
POST /api/library/reader/open
POST /api/library/reader/state
POST /api/library/reader/search
POST /api/library/reader/proof
```

Workmutaties gebruiken dezelfde `operationId + expectedRevision` als kernel v1:

```text
POST /api/library/structure/reorder
POST /api/library/feedback/create
POST /api/library/feedback/decide
POST /api/library/feedback/resolve
```

Persoonlijke mutaties hebben een afzonderlijke persoonlijke revisie en receipt:

```text
POST /api/library/reader/progress
POST /api/library/reader/bookmark
POST /api/library/reader/bookmark/remove
POST /api/library/reader/highlight
POST /api/library/reader/highlight/remove
POST /api/library/reader/note
POST /api/library/reader/note/remove
```

De actor komt altijd uit de sessie. Ook replay controleert de actuele sessie en
Work-toegang. Dezelfde operatie-ID met andere invoer faalt. Een antwoordverlies
na COMMIT herstelt met exact dezelfde invoer zonder een tweede gevolg.

## Reader privacy en audit

Een highlight bewaart node, Edition-revisiehash, posities en een hash van het
fragment; niet nog een kopie van de gepubliceerde tekst. Een persoonlijke notitie
mag maximaal 4.000 tekens bevatten. De Reader heeft een eigen hashjournal met de
bestaande RTG-eventenvelop en persoonsgegevenclassificatie. `reader/proof` toont
alleen het spoor van de ingelogde actor. Dit is lokale integriteit, geen externe
cryptografische verankering.

Readerdata heeft nu nog geen bewaartermijn, export-, wis- of nalatenschapsflow.
Daarom mag deze fase niet als publieke productie-Reader worden geactiveerd.

## Scherm

`/apps/library.html` is een responsieve private pilot in de bestaande RTG-stijl:

- werkenlijst en Work starten;
- geordende inhoudsankers en append-only revisies;
- expliciete solovereenkomst en rechtenverklaring;
- Edition maken, freeze, preview, exacte instemming en confirm;
- released Edition lezen, doorzoeken en leesplek bewust bewaren;
- persoonlijke bladwijzer/notitie;
- editiegebonden feedback beoordelen, via een revisie oplossen en Edition 2 maken.

De bestaande meerpartijen-kernel blijft beschikbaar via dezelfde API. De eerste
UI biedt nog geen volledige coauteur-uitnodigings- en conflictafhandelingswizard.

## Grenzen en volgende stap

- Geen publieke/anonieme Reader, discovery, Saloon, Academy of commerce.
- Geen rich-text, afbeeldingen, tabellen, broneditor of werktypespecifieke Studio.
- Geen vertaalvergelijking, toegankelijkheidsrepresentaties, offline download,
  EPUB/audio/print of preservation service.
- Geen notificatie-inbox voor feedback of uitnodigingen.
- De Reader is een deelnemerpilot; moderatie, privacytermijnen en publieke
  rechtenprojectie zijn voorwaarden voor bredere ontsluiting.
- Opslag blijft begrensd en per collectie geserialiseerd; geen productie-SLO.

De volgende veilige stap is een representatielaag voor gestructureerde tekst en
toegankelijkheid binnen dezezelfde snapshots, plus privacy/export/retentie voor
persoonlijke Readerdata. Publieke discovery of commerce hoort pas daarna.
