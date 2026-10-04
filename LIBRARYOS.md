# Foundation LibraryOS — kernel v1

Deze fase bouwt uitsluitend Work → Edition → Contribution/Agreement → Rights →
PublicationRelease. Uitgangspunt is main 155820a406379e0d0b363f00296695bce0c20120,
opnieuw opgehaald vóór implementatie. Geen publieke distributie of productievrijgave.

## Domeingrenzen en invarianten

- Een Work is een intellectueel werk, geen bestand. `responsible` betekent
  operationeel werkbeheer, nooit automatisch auteursrecht.
- Foundation krijgt geen eigendom, uitgeverschap of redactioneel vetorecht door
  het beschikbaar stellen van infrastructuur. Een maker kan zichzelf of een
  bestaande vertegenwoordigde Concern-entiteit als verantwoordelijke kiezen.
- Credit en acceptatie van een bijdrage zijn geen bewerkrecht, publicatierecht,
  juridische titel of expertise. Een rechtenverklaring bewijst geen juridische titel.
- Library schrijft uitsluitend `libraryKernel`. Geen Academy-certificaten,
  Foundation-projectresultaten, settlements of Talent-kwalificaties.
- Accounts en Concern blijven identiteit en organisaties bezitten. De adapter
  ondersteunt bestaande `user-N`-sleutels en `entiteit:ent_…`-verwijzingen.
  Een organisatie wordt in deze fase uitsluitend door haar bestaande
  Concern-eigenaar vertegenwoordigd, niet door willekeurige medewerkers.
- Een frozen snapshot wordt niet aangepast. Nieuwe inhoud vergt een nieuwe
  Edition. Beschikbaarheid, waarschuwingen en intrekking veranderen die inhoud niet.
- Geen bevestiging vóór duurzame commit. Geen stille verwijdering van edities,
  audit, pending events of idempotentiebewijzen bij het bereiken van een limiet.
- Dezelfde serverpolicy geldt voor preview en confirm; confirm herleest onder
  het collectieslot alle Library-rechten, instemmingen en conflicten.

## Objectmodel

| Object | Betekenis |
|---|---|
| Work | Stabiele ID, titel, beschrijving, uitbreidbare typecode, oorspronkelijke taal, verantwoordelijke partij, governance-ref, lifecycle en actor/tijdmetadata. |
| ContentNode | Stabiel inhoudsanker met type; bezit een append-only rij revisies. |
| Revision | ID, volgnummer, titel, tekst, wijzigingssamenvatting, actor, tijd en inhoudshash. |
| Contribution | Bestaande actor/org, rol, scope, creditnaam, zichtbaarheid, uitnodiging, acceptatie en optionele agreement-ref. |
| WorkAgreement | Versie, partijen, governance, editors, publisher, rechtenverklaarders, instemmende partijen, wijziging/vertrek en conflict. |
| RightsGrant | Verlener/ontvanger, verklaarde bevoegdheidsgrond, scope, handelingen/doel, talen/territoria, termijn, voorwaarden en intrekking/vervanging. |
| Edition | Eigen kopie van geselecteerde conceptrevisies, voorganger, taal/territorium, toelichting en drie tijdstippen. Freeze voegt afspraak-, credits-, rechten- en policy-snapshots toe. |
| PublicationRelease | Afzonderlijk besluit met actor, publisher, editie/contenthash, manifesthash, instemmingen, grant-IDs en policyversie. |

`contentHash` bindt de inhoud met stabiele ankers en revisies. `snapshotHash`
bindt daarnaast credits, afspraak, rechten en publicatiecontext. SHA-256 wordt
over canonieke JSON berekend (gesorteerde objectsleutels, betekenisvolle arrayvolgorde).
Dit is integriteitscontrole, geen bewijs dat de inhoud waar is.

Het concept blijft bewerkbaar na editiecreatie. De kandidaat-editie is al een
eigen kopie: later aanpassen van het concept verandert de kandidaat niet.
Freeze maakt de aanvullende publicatiecontext definitief. Een onbruikbare
frozen editie wordt niet gerepareerd door haar rechtenmanifest te herschrijven:
maak een opvolgende editie en verkrijg nieuwe instemming.

## State machines

```text
Work:           create -> active (geen automatische eigendomsoverdracht)
Contribution:   invited -> accepted
Agreement:      proposed -> alle vereiste partijen aanvaarden -> accepted
                accepted -> conflict -> opvolgend gezamenlijk voorstel
                accepted -> opvolgende afspraak aanvaard -> superseded
RightsGrant:    active -> revoked / superseded; geldigheidsduur apart getoetst
Edition:        draft -> frozen -> released
Distribution:   not-released -> released -> withdrawn
Consent:        accepted -> revoked -> nieuwe expliciete acceptatie
```

Conflictstatus wordt niet door een beheerder alleen gewist. Een opvolgende
afspraak bindt de concrete conflictreferentie; een later bezwaar maakt een
eerder voorstel onbruikbaar. Een opvolger vraagt acceptatie van alle oude en
nieuwe partijen. Deze regel moet expliciet worden gekozen; zij is geen fallback
als governance ontbreekt. Andere besluitvormingsmodellen worden geweigerd.

## Rechten en instemmingen

De eerste ondersteunde governance is expliciet:

- `decisionRule: all-listed-approvers`;
- `amendmentRule: all-current-and-proposed-parties`;
- `departureRule: successor-agreement`.

Alle afsprakenpartijen accepteren dezelfde `termsHash`. De lijst `editors`
verleent conceptbewerkbevoegdheid; `publisher` is de operationele publiceerder.
`rightsHolders` zijn gezamenlijk overeengekomen rechtenverklaarders, geen door
RTG gecertificeerde rechthebbenden. Alle geaccepteerde bijdragers moeten bij
freeze in de afspraak zijn opgenomen.

Voor elke vereiste rechtenverklaarder is een geldige publicatieverlening aan de
publisher nodig. Een eigen publicatie vereist ook een expliciete eigen grant.
Een `edit`-verlening kan een `publish`-verlening niet vervangen. Een recht op
gebruik is bovendien geen automatische toewijzing van een operationele rol.

Scopes: het eigen Work, één eigen Edition of een expliciete set ContentNodes.
In deze kernel moet één toepasselijke verlening per rechtenverklaarder de
volledige editie afdekken; het combineren van meerdere gedeeltelijke licenties
is niet geïmplementeerd. `WORLD` is expliciete wereldwijde scope, geen ontbrekende
territoriumwaarde. Taal, doel en termijn moeten passen.

Ondersteunde uitvoerbare voorwaarde: expliciete `attributionRequired`. Daarvoor
moet een geaccepteerde bijdrage met openbare creditnaam in het snapshot staan.
Onbekende voorwaarden worden geweigerd, niet als vrije tekst stil genegeerd.
De bevoegdheidsgrond is voorlopig een aantoonbaar afgelegde
`rights-holder-declaration`, met verklaring en optionele bewijsverwijzing.
Juridische titelverificatie is niet gebouwd.

AI is opgesplitst in `ai.private-summary`, `ai.external-inference`,
`ai.embeddings`, `ai.training` en `ai.synthetic-voice`. Eén AI-grant heeft één
specifiek doel. Dit registreert rechten; geen AI-verwerking wordt uitgevoerd.

Preview toont ontbrekende rechten en instemmingen. Een instemming bindt
`editionId + snapshotHash + consentDigest`. De digest omvat de actuele selectie
van vastgelegde grants, afspraak, publisher, vereiste partijen en policy.
Confirm herbeoordeelt alles; preview verleent geen bevoegdheid.

Intrekking na release wist het historische besluit niet. De actuele
`rightsStatus`/`available`-projectie wordt beperkt. Dit is een conservatieve
kernelstatus, geen uitgewerkte juridische regel voor verkochte exemplaren,
onherroepelijke Commons-licenties of offline downloads.

## API

Alle routes zijn POST onder `/api/library`, achter bestaande `auth` en de
bestaande functieschakelkast (`dom-library`). Geen anonieme inhoudsroute.

| Route | Soort |
|---|---|
| `/work/create`, `/work/get` | Werk creëren/opvragen |
| `/revision/add` | Nieuw inhoudsanker of nieuwe revisie op bestaand anker |
| `/contribution/invite`, `/contribution/accept` | Bijdrage aanbieden/aanvaarden |
| `/agreement/propose`, `/agreement/accept`, `/agreement/conflict` | Samenwerking |
| `/rights/grant`, `/rights/revoke` | Rechten |
| `/edition/create`, `/edition/freeze`, `/edition/get` | Edities |
| `/edition/withdraw`, `/edition/warn` | Distributie en waarschuwingen, geen inhoudsmutatie |
| `/publication/preview`, `/publication/consent` | Vereisten bekijken en instemmen |
| `/publication/revoke-consent`, `/publication/confirm` | Instemming intrekken of vrijgeven |
| `/proof` | Werkgebonden audit en lokale integriteitscontrole |

Schrijfinvoer:

```json
{
  "operationId": "unieke_operatie_00001",
  "workId": "lib_…",
  "expectedRevision": 12,
  "data": { "editionId": "lib_…", "consentDigest": "…" }
}
```

`work/create` heeft geen workId/expectedRevision. Leesvragen bevatten workId en,
waar nodig, editionId. Een bijdrager ontvangt de invite-ID en werkrevisie van
de uitnodigende partij; deze fase heeft nog geen uitnodigingsinbox of UI.

De actor komt uit `req.session.key`. De bestaande live sessiehercontrole
(`req.documentAuthority`, ook gebruikt door documentmutaties) wordt binnen het
slot aangeroepen. Een expliciete `partyRef` of `grantor` kan slechts namens de
eigen persoon of een daadwerkelijk vertegenwoordigde bestaande organisatie.
Onbekende velden, waaronder een aangeleverde actor, worden geweigerd.

Alle wijzigingen verhogen de werkrevisie. Stale invoer: 409. Ontbrekende
operatie-ID: 428. Geen toegang: 401/403, afgeschermd werk: 404. Opslaguitkomst
onzeker: 503 `OUTCOME_UNKNOWN`; herhaal exact dezelfde invoer en operatie-ID.
Herhaling met andere payload, actie of verwachte revisie: 409 `REPLAY_CONFLICT`.
Een succesvol herhaald verzoek heeft geen tweede gevolg.

## Opslag, migratie, audit en events

Eén nieuwe eigen collectie `libraryKernel`, schemaversie 1, via bestaande
`eigencollectie` en `bewerkCollectie`. Alleen SQLite/PostgreSQL mogen bevestigen;
geen onduurzame JSON-fallback. Geen nieuwe SQL-tabellen of backfill van boeken,
persoonlijke bestanden, Academy, Foundation-dossiers of journalistiek.

De collectie ontstaat bij de eerste geslaagde mutatie. Een onbekende toekomstige
schemaversie weigert veilig. Bij toekomstige migraties moeten gepubliceerde
snapshotbytes behouden blijven; modelwijziging is geen reden om historische
edities opnieuw te serialiseren. Deze fase belooft geen decennia-archief.

In één transactie worden bronstaat, operatiebewijs en journalregel vastgelegd.
Audit bindt actor, actie, inputhash, resulterende werkhash, policy, werkrevisie,
resultaat, tijd en vorige eventhash. Belangrijke records en instemmingshistorie
blijven aanwezig. Geweigerde verzoeken maken geen halve domeinmutatie.

De bestaande RTG-eventenvelop draagt correlatie, causaliteit en classificatie.
De vereiste eventnamen bestaan: `library.work.created`,
`library.contribution.accepted`, `library.agreement.accepted`,
`library.edition.frozen`, `library.publication.released`. Acceptatie van één
afsprakenpartij heet `library.agreement.party-accepted` zolang de afspraak nog
niet volledig aanvaard is. Alle overige mutaties krijgen ook een journalregel.

Hetzelfde journal is de duurzame uitgaande wachtrij; er is geen tweede bus.
`deliver(consumer, handle)` is uitsluitend een interne adapter. Een ontvanger
moet event-ID's idempotent verwerken en duurzaam bevestigen voordat `handle`
voltooit. Een mislukte bevestiging herlevert hetzelfde event. Checkpoints zijn
duurzaam; levering is ten minste eenmaal, niet magisch exactly-once. Er zijn nog
geen downstream consumers aangesloten. Een lokale keten bewijst geen onafhankelijke
verankering of bescherming tegen een beheerder die alle hashes herschrijft.

## Privacy en grenzen van deze pilot

Werk, snapshot, rechtenverklaringen en audit zijn alleen voor betrokken partijen.
De `visibility` van een credit is opgeslagen intentie voor een latere publieke
projectie; deze kernel publiceert geen persoonsprofielen of bestanden.
Een uitnodiging alleen geeft geen algemene draftinzage. Afsprakenpartijen
kunnen het werk inspecteren om de afspraak te beoordelen.

Geen specifieke minderjarigenworkflow, juridische vertegenwoordiging van
personen, rechtenconflict-arbitrage, AVG-retentie/export/wisworkflow of
onafhankelijke archivering. Daarom is dit geen publieke productievrijgave.
Bestaande beschermde Foundation-routes worden niet gewijzigd of geopend.
Voordat echte publieke publicatie wordt aangesloten zijn doelgroepbeleid,
privacy/consent-registratie, bewaartermijnen, verwijdering en moderatie vereist.

## Bewijs en performance

- `test/library-kernel.test.js`: invarianten, actorgrenzen, rechten, conflicten,
  instemmingen, snapshotintegriteit, idempotentie, uitval, outbox en domeingrenzen.
- `test/library-http.test.js`: alle routes via echte server en accounts, volledige
  tweemakers/twee-editieslus, bestaande Concern-organisatie, optionele diensten uit.
- `test/library-sqlite.test.js`: afzonderlijke processen, gelijktijdig freeze,
  release/revoke, rollback, restart en antwoordverlies na echte commit.
- `test/library.pg.test.js`: twee echte PostgreSQL-instances met dezelfde
  race-, rollback-, replay- en herstelgrenzen; eigen tijdelijke database.
  Geregistreerd in `scripts/lib/pg-toetslijst.js`, zodat de bestaande verplichte
  PostgreSQL-job deze proef uitvoert en gewone CI-scherven hem niet verliezen.

| Bewijsdimensie | Daadwerkelijke controle |
|---|---|
| ENTRY | Echte HTTP-deuren; geen sessie weigert. |
| AUTHORITY | Andere actor, credit-only, grantor, organisatie en sessie-intrekking. |
| DECISION | Geaccepteerde afspraak + exacte instemmingen + rechten bij confirm. |
| STATE | SQL-transacties, rollback, cross-process revisiecontrole. |
| RESULT | Eén PublicationRelease voor een concreet snapshot. |
| RECALL | Herstart en historisch opvraagbare editie 1. |
| CHANGE | Nieuwe revisie en editie 2; byte/hashvergelijking van editie 1. |
| REVOKE | Grant/consent-intrekking en conflict blokkeren nieuwe vrijgave. |
| FAILURE | Fouten vóór en na COMMIT, veilige onzekere status. |
| RECOVERY | Zelfde operatie herhalen, restart, uitgaande gebeurtenis opnieuw leveren. |
| REPLAY | Geen dubbele freeze/edition/release; gewijzigde payload weigert. |
| PROOF | Hashketen, actuele werkhash, snapshotcontrole en negatieve corruptieproef. |

Implementatiekosten: collectieslot en volledige kopie/hash van de kernelcollectie
per mutatie, dus O(collectiegrootte) en serialisatie tussen werken. Limiet 25 MiB:
nieuwe mutatie weigert, niets wordt weggegooid. Maximaal 1000 nodes per werk,
1000 revisies per node en 50.000 tekens per revisie. Geschikt voor begrensde
kernelproeven; geen bewezen productiecapaciteit of latency-SLO. Opsplitsing per
werk vereist later behoud van atomaire rechten/release en duurzame receipts.

## Niet gebouwd en volgende fase

Geen marketplace, royalty-engine, reader-UI, discovery, Academy-integratie,
AI-studio, EPUB/audio/printpipeline, lineagegraaf, archiefdienst of stewardship.
Geen uitnodigingsmail, notificatie, externe publicatie of betaling verstuurd.

De volgende functionele fase kan een beperkte Creation Studio en Reader rond
deze contracten bouwen: kennis vastleggen → concept → editie → lezen →
feedback/correctie → nieuwe editie. Publieke distributie blijft afhankelijk van
de genoemde privacy-, bewaar-, toegankelijkheids- en moderatievoorwaarden.
