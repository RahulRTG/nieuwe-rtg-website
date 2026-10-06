# RTG Loop Fabric: productiewaardige vertical slice

Status: geïmplementeerd en lokaal bewezen op basiscommit `0055a1b2d`.

## Uitkomst

Deze slice bewijst één volledige federatieve lus over bestaande domeingrenzen:

```text
Living World                         WorkOS
────────────                         ──────
Eventuitvoering
  │
  ├─ vrijwillige Observation ───────────► bevoegde inbox
  │                                        │
  │                                        ├─ verwachting + succescriteria
  │                                        ├─ expliciet Decision
  │                                        └─ actuele bevoegdheid opnieuw toetsen
  │                                                     │
  │                                                     ▼
  │                                          bronversie procedure wijzigen
  │                                                     │
  │                                          source-issued ChangeReceipt
  │                                                     │
  └──────────────────────── return receipt ◄────────────┤
                                                        │
                         herbouwbare Loop Fabric-projectie
                         lineage + duurzame checkpoints
                                                        │
Volgende eventuitvoering ◄──── policy-aware Recall ◄────┘
  │
  ├─ mens accepteert, negeert of betwist recall
  └─ nieuwe Observation
         │
         └─ Verification: observed_after_change
             causalClaim = false
```

Er is geen centrale Learning Plane gebouwd. Living World blijft eigenaar van observaties en eventcontext. WorkOS blijft eigenaar van beslissingen, rollen, procedures, audit en de feitelijke wijziging. De Loop Fabric bewaart alleen herbouwbare relaties, bronverwijzingen, overdrachtsstatus en recallpresentaties.

## Hercontrole van de bestaande code

Voor de implementatie zijn de actuele contracten opnieuw gelezen. De volgende bestaande technieken zijn hergebruikt:

| Behoefte | Bestaande RTG-techniek | Gebruik in deze slice |
|---|---|---|
| Vrijwillige waarneming | Living World `Contribution`, plans, review en history | Een contribution van soort `observation`, gebonden aan exacte place-, plan- en blueprintversies |
| Besluitvorming | WorkOS `besluiten` | Het bestaande besluit krijgt een door brondomeinen gevalideerde, immutable `loopContext` |
| Veranderbaar bronobject | WorkOS versioned knowledge articles | Een bestaande procedure wordt vervallen verklaard en een opvolgende versie wordt atomair gemaakt |
| Bevoegdheid | WorkOS rollenregister en `werkPoort` | `kennis` en `besluit` zijn beide nodig; rollen worden tijdens de definitieve mutatie opnieuw berekend |
| Identiteit | Bestaande sessie en WorkOS-lidrelatie | HTTP accepteert geen aangeleverde actor; de server leidt actor en persoonlijk lid af |
| Duurzame mutatie | `bewerkCollectie` voor memory, SQLite en PostgreSQL | State, receipt, audit, outbox en operatie-uitkomst committen in dezelfde collectietransactie |
| Audit | WorkOS `werkMutatie` | Iedere procedureversie krijgt een bestaand WorkOS-auditevent |
| Eventenvelop | `server/kern/envelop` | Correlatie en bronoorzaak gaan mee zonder de hashketen als causaliteit te presenteren |
| Replay | RTG operation-ID en payloadfingerprintpatroon | Zelfde actor + operation ID + payload geeft replay; gewijzigde payload geeft conflict |
| Herstel | Bestaande duurzame consumercheckpoints en outboxpatronen | Bronstate blijft staan bij consumeruitval; levering hervat vanaf het laatste checkpoint |
| Privacyprojectie | Domeineigen opslag en minimale projecties | De Lineage Index bevat geen meldingstekst of bronactor |
| Functieschakelaars | Bestaande functiecatalogus en doelgroepresolutie | Eén `/api/loop`-schakelaar; de WorkOS-mutatie blijft onder de bestaande `bedrijf`-schakelaar |
| Credentialcensus | `CODECREDENTIALS.json` en server-derived identity | `workspaceCode` is expliciet als contextidentifier beoordeeld; het verleent geen toegang |
| Transportretry | Bestaande vijfseconden-idempotentiepoort | Alle vijf routes verklaren een woordelijk gelijke retry als hetzelfde verzoek, naast domein-idempotentie |
| Routedekking | `routelog` en `DEKKING.json` | Alle vijf ingangen zijn via een echte gemounte HTTP-server geraakt; totaal 5419/5419 |

De bestaande generieke eventbus bleek niet voldoende als enig bewijs voor een kritieke overgang. Daarom staat de bronuitgegeven outbox bij het domein dat de state bezit. Dit is een uitbreiding van het bestaande outboxpatroon en geen tweede algemene eventarchitectuur.

## Nieuwe, noodzakelijke primitives

Alle nieuwe gedeelde primitives hebben in deze slice een concrete producer en consumer:

1. **Versioned ObjectRef**: `{ domain, type, id, version }`. Kritieke overdrachten eisen een exacte versie. Een contextfilter mag expliciet een onversioned ref gebruiken.
2. **Observation protocol record**: een bronsnapshot die zegt wie wat heeft gemeld, met tijd, provenance, visibility, doel, recipients, review, contest en correctie. Het record claimt geen objectieve waarheid.
3. **Validated Decision Context**: de exacte Observation-hash, procedureversie, plek, blueprint, verwachting, succescriteria en purpose die vóór het besluit zijn gecontroleerd.
4. **Source-issued ChangeReceipt**: alleen WorkOS kan bevestigen dat zijn procedure werkelijk is gewijzigd.
5. **Lineage relation**: versiegebonden relatie met originating domain, event/receipt, tijd, visibility, provenance en altijd een expliciete `causalClaim`.
6. **Recall candidate/presentation/disposition**: actuele, opnieuw geautoriseerde context plus reden, ouderdom, bronstatus en menselijke behandeling.

Er is geen algemene `Experience`, `Learning`, `Knowledge` of `Change`-god-entiteit gemaakt.

## Bronwaarheid en protocolcontracten

### Living World Observation

Living World bezit de volledige observation. De Loop Fabric indexeert alleen refs, status, sharing en temporele metadata. Een correction wordt bij recall live bij Living World opgelost. Een withdrawal of rejection stopt nieuwe recall. Een contest blijft zichtbaar.

Tijden blijven semantisch gescheiden:

- `observedAt`: wanneer de gebeurtenis is waargenomen;
- `recordedAt`: wanneer RTG haar heeft vastgelegd;
- `decidedAt`: WorkOS-sluitmoment van het besluit;
- `appliedAt`: broncommit van de procedurewijziging;
- `recalledAt`: presentatie van context bij de volgende handeling.

### WorkOS Decision

WorkOS bevriest alleen een `loopContext` wanneer:

- de Observation exact in de ontvangen projectie staat;
- de bron dezelfde versie en hash teruggeeft;
- visibility, recipient en purpose de WorkOS-werkruimte toelaten;
- place en blueprint bij de Observation horen;
- de procedureversie nog actueel is;
- de actor zowel kennis- als besluitbevoegdheid bezit.

De validatie is input voor het besluit. Een aangenomen besluit bewijst nog geen uitgevoerde verandering.

### Change en ChangeReceipt

De statussen zijn gescheiden:

```text
requested  = een wijziging is voorgesteld
decided    = WorkOS heeft een besluit aangenomen
applied    = WorkOS heeft zijn eigen bronstate atomair gewijzigd en een receipt uitgegeven
verified   = een latere bron heeft opnieuw waargenomen en die waarneming aan het receipt verbonden
```

Het receipt bevat bron, oud/nieuw object, change type, decision- en observationref, operation/correlation ID, `appliedAt`, actuele actor/authority en een verwijzing naar het WorkOS-auditrecord. De integriteitshash dekt de receiptinhoud vóór toevoeging van de integrity-ref.

### Lineage Index

De index bezit geen bronwaarheid. Relaties in deze slice zijn:

- `observed_at`;
- `produced_observation`;
- `informed_decision`;
- `authorized_change`;
- `confirmed_by`;
- `observed_after_change`.

`observed_after_change` is temporele verificatie. Iedere relatie heeft `causalClaim: false`. Verlies van de projectie is herstelbaar uit Living World snapshots en WorkOS receipts.

### Recall Broker

Recall werkt deterministisch zonder AI. De broker filtert op:

- actuele WorkOS-bevoegdheid;
- dezelfde werkruimte;
- exact purpose;
- place en optioneel blueprint;
- live bronbeschikbaarheid;
- huidige procedureversie.

De kandidaat toont waarom hij terugkomt, bronrefs, ouderdom, status, contest/correction, expectation en de policybeslissing. De mens kan accepteren, negeren of betwisten. De disposition is replayveilig en verandert geen brondomein.

## State- en sequence-regels

```text
OBSERVATION
draft -> accepted -> corrected/superseded
                  -> contested
                  -> withdrawn/rejected

WORKOS PROCEDURE
current(v1) --authorized apply--> superseded(v1) + current(v2) + audit + ChangeReceipt

DELIVERY
source commit -> pending outbox -> consumer commit -> source checkpoint
       │                │               │
       └── blijft waar ─┴─ retry ───────┘

RECALL
candidate -> presented -> accepted | ignored | contested

VERIFICATION
new Observation --references--> ChangeReceipt
relation = observed_after_change
causalClaim = false
```

## Privacy, consent en agency

- Een observation wordt alleen gedeeld na expliciete participantactie.
- Sharing noemt visibility, purpose en concrete recipients.
- Return updates zijn afzonderlijk opt-in.
- De actor komt uit de sessie; payload-spoofing verandert hem niet.
- De herbouwbare index kopieert geen meldingstekst en geen source actor.
- Recall controleert rechten, visibility en purpose opnieuw.
- Correction, contest en withdrawal worden live bij de bron opgelost.
- Intrekking stopt persoonlijke recall. Een reeds rechtsgeldig aangenomen organisatieprocedure blijft zelfstandig bestaan.
- De relatie met de observation blijft als restricted historisch bewijsref bestaan; zij wordt geen gebruikersprofiel.
- Geen observation wordt automatisch gepubliceerd of naar communityvisibility gepromoveerd.

De slice heeft nog geen retentiescheduler voor langdurige unlinking of redaction. Dat staat onder resterende gaten.

## Failure en recovery

| Fout | Gegarandeerd gedrag | Bewijs |
|---|---|---|
| Observation commit, consumer offline | Observation en bronhistory blijven bestaan; broncheckpoint schuift niet | Unit/integrationtest met foutinjectie |
| Decision commit, change faalt | Geen procedureversie en geen succesreceipt | Bevoegdheid vóór commit ingetrokken |
| Change commit, antwoord of receiptlevering faalt | Bronchange, audit, receipt en outbox blijven atomair; zelfde operation ID herstelt als replay | Unit + PostgreSQL answer-loss test |
| Zelfde operation ID, zelfde payload | Geen dubbel gevolg; eerder resultaat komt terug | Memory + PostgreSQL |
| Zelfde operation ID, andere payload | `REPLAY_CONFLICT` | Memory + PostgreSQL |
| Twee instances muteren tegelijk | Eén change, één receipt; tweede antwoord is replay | PostgreSQL multi-instance race |
| Consumer offline | Bronwaarheid blijft intact; latere delivery gaat vanaf duurzaam checkpoint | Unit/integrationtest |
| Index verloren | Projectie wordt uit source snapshots en receipts opgebouwd | Rebuildtest, daarna veilige redelivery |
| Gecorrigeerde context | Recall toont actuele correction en presenteert de oude tekst niet als actueel | Correctietest |
| Observation withdrawn | Nieuwe recall geeft nul kandidaten; WorkOS-procedure blijft bestaan | Privacy/intrekkingstest |
| Bevoegdheid vóór definitieve change ingetrokken | WorkOS weigert binnen de transactiemutatie | Revocationtest |
| AI afwezig | Alle filtering, ranking en verklaring blijven werken | Implementatie heeft geen AI-afhankelijkheid |

## Protocolbewijs

| Bewijs | Concrete sluiting |
|---|---|
| ENTRY | Deelnemer maakt vrijwillig een Living World contribution; WorkOS-actor opent de beveiligde inbox |
| AUTHORITY | Sessieactor, persoonlijk WorkOS-lid en actuele rollen worden gecontroleerd |
| HANDOFF | Living World en WorkOS leveren via duurzame bronoutboxes en consumercheckpoints |
| DECISION | WorkOS bewaart een expliciet aangenomen besluit met gevalideerde exacte context |
| STATE | Procedure v1 wordt historisch vervallen; v2 ontstaat als nieuwe bronversie |
| RESULT | WorkOS geeft na de commit een source-issued ChangeReceipt uit |
| RETURN | Opt-in melder ontvangt een beperkte `change-applied` return receipt |
| RECALL | Broker brengt toegestane context terug bij een volgende eventvoorbereiding |
| CHANGE | requested, decided, applied en verified zijn afzonderlijke toestanden |
| REVOKE | Rolintrekking blokkeert change; observationwithdrawal blokkeert recall |
| FAILURE | Geen receipt bij mislukte bronmutatie; onbekend antwoord claimt geen succes |
| RECOVERY | Outboxretry, operation replay, herstart en index rebuild zijn getest |
| REPLAY | Event-ID en operation-ID zijn payloadgebonden; gewijzigde replay wordt geweigerd |
| DEGRADED | Recall werkt zonder AI; consumeruitval tast bronwaarheid niet aan |
| PROOF | WorkOS-audit, receiptintegriteit, hashjournaal en versiegebonden lineage zijn opvraagbaar |

## API-oppervlak

De slice voegt alleen vijf routes toe:

- `POST /api/loop/observation/inbox`
- `POST /api/loop/recall/present`
- `POST /api/loop/recall/disposition`
- `POST /api/loop/proof`
- `POST /api/bedrijf/loop/procedure/change`

De eerste vier gebruiken de bestaande liddeur. De WorkOS-mutatie gebruikt `werkPoort`, vereist `kennis` plus `besluit`, en vereist een persoonlijk WorkOS-lid. Alle actors zijn server-derived.

## Opslag en migratie

Er is geen destructieve datamigratie. Bestaande collecties krijgen alleen lazy, versioned substate:

- `livingWorld`: sharing/provenance/contest/correction, return receipts en delivery checkpoints;
- `werkruimtes[code].loopProtocol`: schema version 1, operations, receipts, outbox en delivery;
- `loopFabric`: een nieuwe domeineigen collectie met schema version 1.

Onbekende Loop Fabric-schemaversies stoppen veilig met `SCHEMA_UNAVAILABLE`. Dezelfde collectietransactie draait op memory, SQLite en PostgreSQL.

## Bestandsmanifest

Nieuwe productcode:

- `server/kern/loop-fabric/protocol.js`
- `server/kern/loop-fabric/model.js`
- `server/kern/loop-fabric/projection.js`
- `server/kern/loop-fabric/decision-context.js`
- `server/kern/loop-fabric/index.js`
- `server/kern/living-world/loop-source.js`
- `server/bedrijf/rollen-beleid.js`
- `server/bedrijf/loop-context.js`
- `server/bedrijf/loop-source.js`
- `server/bedrijf/loop-change.js`
- `server/opzet/loop-fabric.js`
- `server/routes/loop-fabric.js`
- `server/lib/mutatiecontracten-loop-fabric.js`
- `server/lib/idemsleutels-loop-fabric.js`
- `server/functies/register/cat-loop-fabric.js`

Gewijzigde productcode en bedrading:

- `server/bedrijf/besluit.js`
- `server/bedrijf/index.js`
- `server/bedrijf/rollen.js`
- `server/kern/living-world/actions.js`
- `server/kern/living-world/contributions.js`
- `server/kern/living-world/index.js`
- `server/kern/living-world/model.js`
- `server/kern/living-world/plans.js`
- `server/kern/living-world/projection.js`
- `server/lib/mutatiecontracten.js`
- `server/lib/idemsleutels.js`
- `server/functies/register/index.js`
- `server/opzet/kernlaag6b.js`
- `server/opzet/routes-dwars.js`
- `scripts/lib/pg-toetslijst.js`
- `CODECREDENTIALS.json`

Nieuwe tests:

- `test/lib/loop-fabric-fixture.js`
- `test/loop-fabric.test.js`
- `test/loop-fabric-routes.test.js`
- `test/loop-fabric-http.test.js`
- `test/loop-fabric.pg.test.js`

Architectuur- en afgeleide registers:

- `RTG-LEARNING-LOOPS-ARCHITECTUURONDERZOEK.md`
- `RTG-LOOP-FABRIC-VERTICAL-SLICE.md`
- `ARCHITECTUUR.md`
- `BEWIJS.md`
- `BUNDELS.md`
- `COMMERCE.json`
- `FUNCTIES.md`
- `GRENZEN.json`
- `HANDLERWACHT.json`
- `MUTATIECONTRACT.json`
- `MUTATIEINVENTARIS.json`
- `OBJECTMODEL.json`
- `DEKKING.json`
- `NORM.json`

## Teststrategie en resultaten

De tests bewijzen domeincontracten en overdrachten, niet alleen HTTP-routes:

- 11 memory/integrationtests voor de lus, correctie, contest, intrekking, purpose, authority, failure, recovery, replay en rebuild;
- 3 route/transporttests voor server-derived actor, WorkOS-bevoegdheid en de vijf idempotentieverklaringen;
- 1 echte HTTP-test die alle vijf gemounte ingangen raakt en de anonieme deurstatus bewijst;
- 1 PostgreSQL-test voor multi-instance serialisatie, changed replay, answer loss, herstart en duurzame projectie;
- bestaande Living World-, WorkOS-, envelope-, evidence-, policy-, SQLite- en collectietransactietests;
- statische huiskeuring, grenscontrole, deurcontrole en volledige RTG-testsuite.

Definitieve lokale uitslagen:

| Controle | Uitslag |
|---|---|
| Definitieve Loop Fabric memory + route + HTTP-suite | 15/15 groen, 0 skipped |
| Bestaande Living World + nieuwe Loop Fabric regressies | 22/22 groen, 0 skipped |
| WorkOS/community/event HTTP-regressies | 15/15 groen |
| Envelope, evidence, policy, SQLite, transacties en mutatiecontract | relevante suites groen; mutatiecontract 30/30 |
| PostgreSQL Loop Fabric + Living World | 2/2 groen in 2,93 s; multi-instance race, replay, answer loss en herstart |
| Functie-, platform-, credential-, WorkOS-credential- en routedekkingspoorten | 49/49 groen |
| `DEKKING.json` | 5419/5419 gemounte routes waargenomen, 100%, 0 gaten |
| `node scripts/idemschuld.js` | 872 routes verklaard; de 39 resterende nieuwe schuldroutes zijn uitsluitend bestaande LibraryOS-routes van de basiscommit, geen Loop Fabric-route |
| `npm run grenzen` | exit 0 |
| `npm run deuren` | exit 0; 649 routes zonder routerlaag allemaal geclassificeerd, 0 onbewaakt |
| `node scripts/check.js` | exit 0 na herbouw van `ARCHITECTUUR.md`, `BEWIJS.md` en `FUNCTIES.md` |
| `npm run keuring` | exit 0; 0 `STUK`, 15 bestaande `SCHEEF`, 525 bestaande verbeterpunten |
| Volledige `node scripts/test-runner.js` | alle 2001 testbestanden draaiden: 15.782 tests, 15.692 groen, 47 rood en 43 skipped. Dit was vóór de laatste registeraansluitingen. Een vergelijking van de rode niet-PG-bestanden tegen `0055a1b2d` reproduceerde de bestaande LibraryOS/registerachterstand; de vijf nieuwe route-, schakelaar- en credentialgaten zijn daarna afzonderlijk gesloten en groen gemaakt |
| `npm test` | stopt in `pretest`, omdat deze host geen Rust `cargo` heeft; de volledige Node-runner is daarom rechtstreeks uitgevoerd |

De volledige suite is dus niet als volledig groen gerapporteerd. De resterende rode baseline omvat onder meer bestaande LibraryOS-idempotentieschuld en reeds stale registers op `0055a1b2d`, plus hostafhankelijke Rust/PG-proeven zonder hun vereiste runneromgeving. Voor deze slice geldt aantoonbaar: geen van de vijf nieuwe routes staat nog in de idempotentieschuld; PostgreSQL is met een expliciete `DATABASE_URL` groen; `stempel.test.js` is na de lokale commit 4/4 groen; `versheid-uitvoer.test.js` is zelfstandig groen. De circa dertig minuten durende volledige runner is na het sluiten van de vijf registers niet opnieuw gebruikt om bestaande baselineroodheid als nieuw resultaat te presenteren.

Er is geen UI gewijzigd. Een browserflow zou in deze fase geen extra protocolbewijs leveren en is daarom niet toegevoegd.

## Performance-impact

De memory end-to-end lus draait lokaal in circa 40 ms binnen de gerichte test. De definitieve gecombineerde PostgreSQL-run omvat schemaopbouw, meerdere database-instances, race, answer-loss-herstel, projectie en herstart en duurde 2,93 s voor twee testbestanden. Dit is functioneel bewijs, geen productie-loadbenchmark.

De projectie heeft begrensde deliverybatches van maximaal 100 events en een expliciete 25 MiB fail-safe. Rebuild is momenteel lineair in het aantal source snapshots en receipts. Er is nog geen productiebenchmark voor miljoenen relaties, partitionering of cross-region latency.

## Securitybevindingen

- Actor spoofing via de payload is niet mogelijk op de nieuwe routes.
- WorkOS controleert de bevoegdheid opnieuw binnen de definitieve transactiemutatie.
- Exacte bronversies en observationhash voorkomen een besluit op stil gewijzigd materiaal.
- Purpose en concrete recipient worden zowel bij besluitvorming als recall afgedwongen.
- De index bevat geen observationtekst of source actor.
- Event replay is payloadgebonden; een event-ID met andere inhoud wordt geweigerd.
- ChangeReceipt-integriteit verwijst naar het bestaande WorkOS-auditrecord.
- De code maakt geen causale claim uit temporele volgorde.
- Een gedeeld WorkOS-beheertoken volstaat niet voor de bronwijziging; een persoonlijk lid is vereist.

Open securitywerk staat onder resterende gaten.

## Verschillen met het architectuuronderzoek

1. Er was geen nieuwe centrale `Observation`-database nodig. Living World Contribution kon veilig worden uitgebreid.
2. Het bestaande eventtransport was niet alleen voldoende als duurzaam bewijs. Bronoutboxes en checkpoints moesten naast de bestaande envelop worden gebruikt.
3. WorkOS knowledge versioning kon worden hergebruikt, maar de gewone savepaden boden geen atomair receiptcontract. Een smalle WorkOS-sourceadapter was nodig.
4. Alleen clientinput bevriezen was onvoldoende. De Loop Fabric moest de observation, sharing, context en procedure live valideren vóór WorkOS het besluit vastlegt.
5. De return path naar de oorspronkelijke melder was nodig om `RETURN` te sluiten. Deze is bewust opt-in en bevat alleen de beperkte status van de bronwijziging.
6. De Lineage Index heeft voor deze slice geen algemene relation registry of graphdatabase nodig. Een herbouwbare domeincollectie is kleiner en beter toetsbaar.

## Resterende gaten

- Geen UI of Edge-presentatie; daarom is geen browserflow gewijzigd of vereist.
- Geen algemene protocolregistry. De relation types zijn alleen de zes die deze slice gebruikt.
- Geen TravelOS-, LivingOS-, FoundationOS-, LibraryOS- of Academy-adapters.
- Geen AI-ranking, embeddings of generatieve samenvatting.
- Geen cryptografische handtekening tussen afzonderlijk beheerde services; integriteit rust binnen deze monoliet op databasecommit, auditref en hashes.
- Geen cross-region worker, dead-letterbediening of operationeel dashboard voor langdurig geblokkeerde outboxlevering.
- Geen automatische retentie, unlinking, pseudonimisering of redaction na een bewaartermijn.
- Geen juridische-holdworkflow voor een withdrawn observation.
- Geen formele evidencebundels of externe bronverificatie voor claims.
- De return receipt betekent `change-applied`; hij bewijst niet dat de melder hem heeft gelezen.
- Freshness gebruikt bronstatus, correction, current procedure en optionele `validUntil`; er is nog geen gedeelde review scheduler.
- De scenario-event is het bestaande Living World plan/blueprintmodel; er is geen tweede eventdomein gemaakt.
- De 25 MiB projectiegrens stopt veilig en vraagt handmatig onderhoud; partitionering en incrementele rebuild ontbreken.
- Metrics voor recallkwaliteit en menselijke uitkomsten zijn bewust nog niet toegevoegd om Goodhartsturing te voorkomen.

## Niet gebouwd

Geen centrale Learning Plane, universele truth graph, centrale causality engine, persoonlijke profiler, marketplace, betaling, Academy-resultaat, Travel/Living/Foundation-integratie, automatische beleidswijziging, AI-beslisser, pushnotificatie of nieuwe gebruikersinterface.

## Veiligste volgende vertical slice

De veiligste volgende slice is een WorkOS incident of near-miss dat leidt tot een versioned runbookwijziging en bij een volgende vergelijkbare taak wordt teruggebracht. Die slice hergebruikt dezelfde bronadapter, test negatieve kennis en recovery, en voegt geen nieuw extern domein toe. Pas daarna is een TravelOS-disruption naar toekomstige reisvoorbereiding een verstandige volgende domeingrens.
