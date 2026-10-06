# LibraryOS kernel — oplevering 3 oktober 2026

Geïmplementeerd in de lokale branch `codex/libraryos-kernel`, vanaf opnieuw
opgehaalde main `155820a406379e0d0b363f00296695bce0c20120`. Geen push, PR, merge
of deployment uitgevoerd. Dit rapport hoort bij de gewijzigde werkkopie;
de bronhashes en ruwe testlogs staan in `../output/library-kernel-20261003/`.

## Resultaat en architectuurkeuzes

De kernel kan werken, bijdragen, expliciete afspraken, rechten, vastgelegde
edities en afzonderlijke publicatiebesluiten opslaan. Het geautomatiseerde
scenario doorloopt twee makers en twee edities: oude inhoud blijft identiek,
oude instemming mag de opvolger niet vrijgeven en beide edities blijven
historisch identificeerbaar. Dit is een besluit tot vrijgave binnen de kernel;
publieke distributie is niet gebouwd.

```text
Bestaande accounts / Concern-organisaties
                   |
                   v
Work -> Contribution -> WorkAgreement -> RightsGrant
  |                            |                |
  v                            v                v
ContentNode -> Revision -> Edition -> freeze -> preview
                    |                    |         |
                    |                    |    exacte instemming
                    |                    |         |
                    |                    +------> confirm
                    |                              |
                    |                       PublicationRelease
                    |                              |
                    +-> nieuwe Revision -> Edition 2
                                                |
                                     nieuwe instemming / release

Alle geslaagde mutaties: één bestaande collectietransactie
bronstaat + revisie + operatiebewijs + audit/eventjournal
Historische Edition 1 blijft inhoudelijk ongewijzigd.
```

- Negen kleine kernmodules; bestaande accounts, Concern, routergrenzen,
  functieschakelkast, collectietransacties en RTG-eventenvelop hergebruikt.
- Eén schrijfbaar domein: `libraryKernel`. Library schrijft geen certificaat,
  Foundation-projectresultaat, settlement of expertiseclaim.
- Editiebevoegdheid, credit, publicatiebevoegdheid en rechtenverlening zijn
  verschillende gegevens en controles. Foundation krijgt geen impliciete rechten.
- `contentHash` bindt inhoud; `snapshotHash` bindt ook credits, afspraak,
  rechten en publicatiecontext. Instemming bindt editie en manifest.
- Confirm herleest Library-rechten en instemmingen onder het SQL-collectieslot.
  Bronstaat, receipt en audit/event worden samen gecommit. Een verloren
  commitantwoord geeft een onzekere uitkomst; dezelfde operatie veilig herhalen.
- Hetzelfde duurzame journal dient als outbox. Geen extra algemene eventbus,
  geen fire-and-forget als publicatiebewijs. Downstream consumers zijn nog niet
  aangesloten; ontvangers moeten op event-ID dedupliceren.

Volledige contracten, API, state machines en bewijsdimensies: [LIBRARYOS.md](LIBRARYOS.md).

## Exacte bestanden

Nieuwe domeinmodules:

```text
server/kern/library/model.js
server/kern/library/policy.js
server/kern/library/works.js
server/kern/library/agreements.js
server/kern/library/rights.js
server/kern/library/editions.js
server/kern/library/publication.js
server/kern/library/journal.js
server/kern/library/index.js
```

Nieuwe adapters, contracten, tests en documentatie:

```text
server/opzet/library.js
server/routes/library.js
server/lib/mutatiecontracten-library.js
test/lib/library-fixture.js
test/lib/library-db-child.cjs
test/library-kernel.test.js
test/library-http.test.js
test/library-sqlite.test.js
test/library.pg.test.js
LIBRARYOS.md
LIBRARYOS-RESULTAAT.md
```

Bestaande bestanden aangepast:

```text
server/opzet/kernlaag6b.js
server/opzet/routes-dwars.js
server/functies/register/cat-domeinen.js
server/lib/mutatiecontracten.js
scripts/lib/pg-toetslijst.js
GRENZEN.json
ARCHITECTUUR.md
BEWIJS.md
COMMERCE.json
FUNCTIES.md
OBJECTMODEL.json
MUTATIECONTRACT.json
MUTATIEINVENTARIS.json
DEKKING.json
NORM.json
```

Registers zijn met hun bestaande generators bijgewerkt. `COMMERCE.json` en
andere inventarissen tellen de nieuwe routes mee; er is geen commercefeature
gebouwd. `NORM.json` wijzigt uitsluitend de vastleggingsdatum. In `DEKKING.json`
is de samengestelde herkomst expliciet toegevoegd; geen kwaliteitsnorm is verlaagd.

## Migratie en herstel

Eén nieuwe collectie met `schemaVersion: 1`, lazy aangemaakt bij de eerste
geslaagde mutatie. Geen SQL-DDL, backfill, dependency of conversie van bestaande
boeken/documenten. Onbekende opslagversies en onduurzame stores weigeren mutaties.

Rollback van de applicatie moet de collectie bewaren. Bij problemen eerst de
bestaande `dom-library`-schakelaar uitzetten; geen historische edities wissen.
Toekomstige migraties moeten historische snapshots en operatiebewijzen behouden.
De routes zijn standaard voor bestaande leden geregistreerd; deze oplevering
heeft ze niet op een live omgeving geactiveerd.

## Tests en bewijsgrenzen

| Uitvoering | Resultaat |
|---|---|
| Kernel, echt HTTP, SQLite en relevante document-/consent-/leer-/Foundation-/Living World-/contractregressies | 234/234 geslaagd; 0 overgeslagen; 11,69 s |
| Echte PostgreSQL, twee instances en eigen tijdelijke database | 1/1 geslaagd; 0 overgeslagen; 0,49 s |
| Aanvullende bestaande journey-/route-regressies | 48/48 geslaagd; 0 overgeslagen; 127,74 s |
| Bestaande PostgreSQL-/CI-indelingssuite | 7/7 geslaagd; 0 overgeslagen; 2,24 s |
| Route-inventaris en bestaande kantoorweergave | 8/8 geslaagd; 0 overgeslagen; 9,80 s |
| Gerichte foutinjecties in tijdelijke bronvarianten | 5/5 door negatieve assertions gedetecteerd; bron hersteld |
| `node scripts/check.js` | Alle 73 statische huisregels in orde |

Samen 298 uitgevoerde tests, nul mislukt of overgeslagen. Herhaalde eerdere
ontwikkelruns zijn niet nogmaals bij dit totaal opgeteld.

Foutinjecties: ontbrekende instemming negeren; ingetrokken rechten negeren;
gewijzigde replay toelaten; opnieuw freeze toelaten; credit tot editrecht maken.
Daarna is de definitieve bron opnieuw getest. Werkelijke SQLite-processen en
PostgreSQL-instances bewijzen slotgedrag, rollback, race en herstel na COMMIT.

De route-inventaris bevat 5395 aangeroepen routes, waaronder alle twintig nieuwe
Library-deuren. Dit is **incrementeel bewijs**: de nieuwe lokale routejournalen
zijn samengevoegd met de bestaande Living World CI-journalen (scherven 1–4),
browserjournalen (delen 2–4) en `living-world-current-route.log` uit `../output/`.
Het bewijst registratie/bereikbaarheid; het certificeert niet alle gedrag op de
huidige werkkopie. Bestandsnamen en hashes staan in het bewijsmanifest.

De volledige RTG-, browser-, Rust-, Redis- en releasepijplijn is niet opnieuw
uitgevoerd. `npm test` vereist vooraf een Cargo-build; Cargo is hier niet
beschikbaar. Daarom is dit geen volledige CI- of productieverklaring.
De nieuwe PostgreSQL-proef staat wel in de bestaande verplichte CI-testlijst.

`git diff --check` meldt alleen de door de bestaande FUNCTIES-generator
toegevoegde Markdown-hardbreak (twee eindspaties); zonder die whitespace-regel
is de controle schoon. Dat generatorformaat is behouden.

## Performance

Geen productiebenchmark of latency-SLO gemeten. Bovenstaande tijden zijn
testlooptijden. Elke mutatie kopieert en hasht de collectie en gebruikt één
collectieslot: O(collectiegrootte), ook serialisatie tussen verschillende werken.
De kernel weigert boven 25 MiB zonder historie te verwijderen. Dit is een
begrensde kernelimplementatie, geen bewijs voor grootschalige opslag.

## Security-bevindingen en resterende gaten

Negatieve tests blokkeren actor-spoofing, vreemde organisaties, credit-only
edit/publicatie, ontbrekende instemming, verlopen of ingetrokken grants,
verkeerde taal/scope, onbekende voorwaarden, brede AI-toestemming, stale
revisies, gewijzigde replay en corrupte snapshots/auditketens.

Tijdens de review aangescherpt: een nieuw conflict maakt een ouder
opvolgingsvoorstel ongeldig; instemmingshistorie is append-only; replay vereist
nog steeds actuele sessie/toegang; proof controleert ook de actuele werkhash.

Open grenzen:

- Een rechtenverklaring is geen juridische titelverificatie; geschillenbeslechting
  en erfopvolging ontbreken. Alleen de bestaande Concern-eigenaar vertegenwoordigt
  een organisatie. De sessie-/organisatiebron blijft de bestaande RTG-adapter.
- Vertrek wordt via een opvolgende afspraak gemodelleerd. Er is nog geen
  volledige offboarding-/leesinzage-intrekking voor voormalige bijdragers;
  historische betrokkenheid blijft leesrecht geven. Niet gebruiken voor een
  vertrouwelijk werk dat zulke intrekking nu vereist.
- Geen minderjarigenprocedure, privacyexport, bewaartermijnen, wisverzoeken,
  moderatie, publieke toegangsprojecties of duurzame archiefgarantie.
- Lokale audit kan herschrijven door een databasebeheerder niet onafhankelijk
  bewijzen. Geen externe verankering of ondertekende juridische attestatie.
- Geen verdeling van gedeeltelijke grants, onherroepelijke Commons-licenties,
  regels voor verkochte/offline exemplaren, grote bestanden of mediapipelines.
- De globale capaciteitsgrens vraagt vóór brede openstelling om quota en
  capaciteitsscheiding; er is nog geen schaal-/misbruikbenchmark.
- Read/preview zijn momentopnamen; alleen de definitieve mutatie onder het
  transactieslot beslist. Geen claim over onmiddellijke cacheverversing bij alle
  toekomstige downstream interfaces.

## Regressierisico's en veilige volgende fase

De bestaande bronmodellen zijn niet gewijzigd. Het raakvlak zit in centrale
kernelinitialisatie, routerregistratie, functieschakelaar en meetregisters.
Die zijn met echte serverstarts en relevante regressies gecontroleerd. Een
volledige kandidaat-CI blijft nodig vóór merge/deployment; productiecapaciteit
en externe consumers vallen buiten het lokale bewijs.

Een beperkte **Creation Studio + Reader voor betrokken makers** kan nu op deze
contracten bouwen: ruwe kennis → concept → immutable Edition → lezen →
feedback/correctie → Edition 2. Publieke distributie vereist eerst de genoemde
privacy-, toegang-, moderatie- en bewaarcontracten. Commerce, Academy,
Saloon-discovery, AI-pipelines en stewardship zijn niet gestart.
