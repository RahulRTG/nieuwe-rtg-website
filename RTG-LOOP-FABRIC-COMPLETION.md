# Federated RTG Loop Fabric: completion report

Datum: 5 oktober 2026

Branch: `codex/libraryos-kernel`

Uitgangspunt: `4e1b0972f926da977da2cc30a2174d904a505f31`

## Conclusie

De Federated RTG Loop Fabric is nu semantisch bewezen over drie verschillende bronwerelden:

1. Living World-deelnemerservaring naar een WorkOS-procedure;
2. WorkOS near-miss naar een versioned WorkOS-runbook;
3. Leerhuis-praktijkclaim naar een versioned kennisregel.

Alle drie gebruiken dezelfde kleine contracten voor versiegebonden `ObjectRef`, Observation, Decision Context, source-issued `ChangeReceipt`, minimale Lineage, policy-aware Recall en niet-causale Verification. De bron blijft telkens eigenaar van inhoud, authority, besluit en mutatie. Er is geen centrale Observation Store, Learning Plane, waarheidsgraaf, mensscore of AI-beslisser ontstaan.

De implementatie is production-ready binnen de bewezen grens: één gedeelde duurzame regio, meerdere workers/processen, actuele authority-herbeoordeling en een projectie onder 25 MiB. Zij is nog niet RTG-breed production-ready voor 100k of meer Lineage-relaties en heeft geen multi-region consistency-garantie. De meting toont dat de huidige objectmap rond 100k relaties ongeveer 43,2 MiB vraagt en dus bewust op de bestaande 25 MiB-cap stopt. Een volgende stap vraagt een niet-destructieve sharded/queryable projectie en een expliciete keuze van shard- en consistencysemantiek. Die keuze volgt niet veilig uit de huidige code en valt onder de afgesproken stopgrens.

## Eindarchitectuur

```text
  BRONDOMEINEN                         FEDERATED LOOP FABRIC

  Living World                         herbouwbare projectie
  ┌─────────────────────┐              ┌───────────────────────────┐
  │ event / contribution│─outbox──────▶│ minimale Observation refs │
  │ inhoud + consent    │              │ minimale ChangeReceipts   │
  │ correctie/intrekking│              │ versiegebonden Lineage    │
  └─────────────────────┘              │ recallpresentaties        │
                                       │ hashketenjournaal          │
  WorkOS                               └─────────────┬─────────────┘
  ┌─────────────────────┐                            │
  │ incident / near-miss│─outbox──────────────┐      │ live resolve
  │ decision + authority│                    │      ▼
  │ procedure / runbook │─signed receipt─────┼─▶ Recall Broker
  └─────────────────────┘                    │   ┌───────────────────┐
                                             │   │ current authority │
  Leerhuis                                  │   │ purpose / policy  │
  ┌─────────────────────┐                    │   │ source lifecycle  │
  │ praktijkvoorstel    │─source trail───────┘   │ version / age     │
  │ governance          │─signed receipt────────▶│ explanation       │
  │ kennisversies       │                        └─────────┬─────────┘
  └─────────────────────┘                                  │
                                                           ▼
                                                bevoegde menselijke actor

  Geen pijl geeft eigendom aan de Fabric. De index kan worden gewist en uit
  bronsporen worden herbouwd. Contentresolutie gaat opnieuw naar de bron.
```

De Fabric bezit verbinding en transport:

- idempotente eventconsumptie;
- minimale, versiegebonden relaties;
- deliveryleases, checkpoints en dead letters;
- recallpresentaties en menselijke dispositions;
- privacyveilige operationele tellers.

De Fabric bezit niet:

- de inhoud van een Observation;
- WorkOS-, Living World- of Leerhuis-state;
- authority of rollen;
- de betekenis van een procedure, runbook of kennisregel;
- de beoordeling of een outcome waar, goed of causaal is.

## De drie bewezen vertical slices

### 1. Living World naar WorkOS

```text
community-event
  → vrijwillige toegankelijkheidsobservatie
  → Living World-review en sharing
  → WorkOS Decision Context met bronhash en verwachting
  → bevoegde WorkOS-beslissing
  → versioned procedurewijziging
  → WorkOS ChangeReceipt
  → Lineage + return update naar de deelnemer
  → policy-aware Recall bij volgende uitvoering
  → nieuwe Living World-observatie
  → observed_after_change, causalClaim=false
```

Living World bezit melding, review, consent, correction, contest en withdrawal. WorkOS bezit beslissing, procedureversies, audit en receipt.

### 2. WorkOS near-miss naar WorkOS-runbook

```text
WorkOS incident/near-miss
  → source-owned incident Observation
  → WorkOS Decision Context
  → bevoegde beslissing
  → nieuwe immutable-identificeerbare runbookversie
  → source-issued ChangeReceipt
  → Recall bij een volgende deploymenttaak
  → nieuwe incident Observation
  → niet-causale Verification
```

Deze slice bewijst dat de contracten niet afhankelijk zijn van Living World, events, plaatsen of deelnemercontent.

### 3. Leerhuis-praktijkclaim naar kennisversie

```text
menselijke praktijkclaim
  → append-only Leerhuis-bronspoor
  → governance: TRIAGED → REVIEW → APPROVED
  → nieuwe kennisversie: DRAFT → REVIEW → ACTIVE
  → voorstel IMPLEMENTED
  → Leerhuis ChangeReceipt in bronhashketen
  → policy-aware Recall bij knowledge.review
  → nieuwe praktijkobservatie
  → niet-causale Verification
```

Deze slice gebruikt andere persistence, governance en semantics. Een afgewezen voorstel is een contest, geen universele uitspraak dat de indiener ongelijk heeft. De Fabric ontvangt geen verborgen indienersprofiel.

## Protocolmatrix

Legenda: `PROVEN`, `INTENTIONALLY LOCAL`, `NOT NEEDED`.

| Familie | Slice | Eigenaar | Persistence | Authority | Evidence | Failure semantics | Test | Status |
|---|---|---|---|---|---|---|---|---|
| Occurrence & Observation | Living World → WorkOS | Living World | Living World history/outbox | contributor + reviewer + sharing | versioned observation, provenance, review | broncommit blijft staan bij delivery-uitval | `loop-fabric.test.js` | PROVEN |
| Occurrence & Observation | WorkOS near-miss | WorkOS | `workspace.loopProtocol` + outbox | actief persoonlijk WorkOS-lid met `service` | incidentref, bronversie, observed/recorded time | replayconflict; geen index nodig voor bronwaarheid | `loop-fabric-workos-slice.test.js` | PROVEN |
| Occurrence & Observation | Leerhuis | Leerhuis | append-only Leerhuisspoor | actieve relatie | praktijkvoorstel met exact spoorrecord | spoor blijft bron; adapter kan niet goedkeuren | `loop-fabric-academy-slice.test.js` | PROVEN |
| Expectation & Decision | Living World → WorkOS | WorkOS | WorkOS-besluit | `kennis` + `besluit` | gevalideerde observationhash, bronversies, expectation, criteria | actuele bron/authority faalt gesloten | `loop-fabric.test.js` | PROVEN |
| Expectation & Decision | WorkOS near-miss | WorkOS | WorkOS-besluit | `kennis` + `besluit` | exact runbook + Observation Context | revoked authority blokkeert definitieve change | `loop-fabric-workos-slice.test.js` | PROVEN |
| Expectation & Decision | Leerhuis | Leerhuis | voorstelhistorie + kennisworkflow | `KNOWLEDGE_OWNER`; maker activeert eigen versie niet | states, notitie, impactklasse, bronspoor | ontbrekende governance blokkeert receipt | `loop-fabric-academy-slice.test.js` | PROVEN |
| Claim & Contest | Living World → WorkOS | Living World | contribution history | contributor/reviewer | correction, contest, supersession | recall resolveert live; oude claim wordt niet stil actueel | `loop-fabric.test.js` | PROVEN |
| Claim & Contest | WorkOS near-miss | WorkOS | bronobservation | lokaal domeinbeleid | status/lifecycle | geen algemene contest nodig voor deze slice | `loop-fabric-lifecycle.test.js` | INTENTIONALLY LOCAL |
| Claim & Contest | Leerhuis | Leerhuis | voorstelhistorie | Leerhuis-governance | rejection als contest met reden/tijd | contest blijft zichtbaar, geen waarheidsscore | `loop-fabric-academy-slice.test.js` | PROVEN |
| Change & Verification | Living World → WorkOS | WorkOS + latere Living World-bron | versioned procedure + receipts | WorkOS bij change; Living World bij nieuwe observation | auditref, receipt, observed-after-change | geen receipt bij mislukte change; causaliteit false | `loop-fabric.test.js` | PROVEN |
| Change & Verification | WorkOS near-miss | WorkOS | versioned runbook + receipts | actuele WorkOS-authority | old/new refs, decisionref, integrityref | answer loss/replay zonder dubbele change | `loop-fabric-workos-slice.test.js`, PG-test | PROVEN |
| Change & Verification | Leerhuis | Leerhuis | versioned knowledge + source hash chain | gescheiden knowledge owners | receipt met vorige/nieuwe versie | Fabric kan geen kennis activeren of receipt fabriceren | `loop-fabric-academy-slice.test.js` | PROVEN |
| Memory & Recall | Living World → WorkOS | Fabric index; bronnen voor resolve | `loopFabric`-projectie | actuele WorkOS-authority | minimale lineage + live source resolution | denied/missing/stale/not_checked blijven onderscheiden | `loop-fabric.test.js` | PROVEN |
| Memory & Recall | WorkOS near-miss | idem | idem | actuele WorkOS-authority en purpose | change/artifact current ref + uitleg | superseded change is expliciet stale | `loop-fabric-lifecycle.test.js` | PROVEN |
| Memory & Recall | Leerhuis | idem | idem | actuele Leerhuis-relatie en bestuursrol | receipt + knowledge current ref | intrekking stopt recall direct | `loop-fabric-academy-slice.test.js` | PROVEN |

Alle vijf families zijn daarmee platformbreed bewezen waar gedeelde semantics bestaan. WorkOS-contest blijft bewust lokaal: een generieke contestworkflow toevoegen zonder natuurlijke consumer zou de kernel verbreden zonder bewijs.

## Gedeelde primitives

### Hergebruikt

- `ObjectRef` en canonieke hashing uit `server/kern/loop-fabric/protocol.js`;
- RTG-envelop met correlatie, oorzaak en classificatie;
- `bewerkCollectie` voor memory, SQLite en PostgreSQL-transacties;
- `eigencollectie` voor collection ownership;
- Living World history/outbox en source resolution;
- WorkOS-rollen, beslissingen, kennisversies en `werkMutatie`-audit;
- Leerhuis-relaties, bestuur, append-only spoor en kennisgovernance;
- bestaande idempotentiesleutel- en mutatiecontractregisters;
- bestaande `lib/zegel` Ed25519-keyinfrastructuur;
- bestaande interne metricsdeur voor `/api/loop/operations`.

### Noodzakelijk toegevoegd

- generieke delivery-state machine voor checkpoints, leases, attempts en dead letters;
- WorkOS incident Observation-adapter;
- WorkOS procedure/runbook source-change-adapter;
- Leerhuis source-adapter;
- lifecycle/unlinking naar niet-herleidbare tombstones;
- minimale source-receiptverificatie;
- architecture invariants op iedere projectiemutatie;
- privacyveilig operations snapshot;
- schaalinstrument voor de huidige projectievorm en delivery-state machine.

### Bewust niet toegevoegd

- centrale Observation Store;
- centrale authority-, Grant-, Evidence- of Recovery-laag;
- algemene relation registry;
- AI-ranking;
- learning-, trust- of confidence-score;
- universele causaliteitsmachine;
- duplicatieve cryptografie;
- domeinspecifieke `V2`-kernel.

## Lineage-contract

De bewezen relaties zijn klein en versiegebonden:

- `observed_at`;
- `produced_observation`;
- `informed_decision`;
- `authorized_change`;
- `confirmed_by`;
- `observed_after_change`.

Iedere relation draagt herkomst, event/receiptref, tijd, visibility, provenance, status en `causalClaim: false`. De architecture gate weigert:

- broninhoud of actoridentiteit in de projectie;
- een receipt waarvan `newRef.domain` niet het brondomein is;
- `confirmed_by` zonder source-issued receipt;
- orphaned receipts;
- iedere impliciete causale claim.

## Retention, unlinking, deletion en revocation

`Lineage existence ≠ permission to resolve content` is technisch afgedwongen:

- Recall vraagt actuele authority bij de consumer;
- Recall vraagt exact doel en geschikte scope;
- de bron wordt live gevraagd of de Observation nog beschikbaar is;
- de veranderde bron wordt live gevraagd welke artifactversie current is;
- withdrawal, deletion, expiry en anonymization blokkeren contentresolutie;
- een verwijderde ref wordt in de index vervangen door een restricted tombstone met alleen een hash;
- rebuild uit source-owned lifecycledata herintroduceert de oorspronkelijke ref niet;
- recallpresentaties en actorcontext worden door retention verwijderd;
- operation-resultaten die de verwijderde recall zouden terugbrengen worden mee verwijderd;
- een zelfstandig gerechtvaardigde organisatieprocedure blijft historisch bestaan nadat de persoonsmelding wordt ingetrokken.

Ondersteunde honest outcomes zijn onder meer `current`, `corrected`, `contested`, `superseded-change`, `denied`, `source_missing`, `stale`, `unavailable` en `not_checked`. `unknown` wordt niet naar `false` omgezet.

## Delivery, outbox en dead-letter lifecycle

De bron bezit event en outbox. De gedeelde state machine bezit alleen transportstatus:

```text
pending
  → lease claimed
  → handled
  → checkpoint complete

lease expired
  → another worker claims

failure
  → bounded attempts
  → dead letter(open)
  → replay requested
  → handled
  → dead letter(replayed)
```

Bewezen gedrag:

- duplicate delivery geeft geen dubbel effect;
- crash vóór verwerking herstelt na lease-expiry;
- crash/answer loss na effect maar vóór antwoord herhaalt idempotent;
- dezelfde event-ID met andere payload wordt geweigerd;
- een volgordegat stopt een geordende WorkOS-bron;
- checkpoint voorbij source-through faalt gesloten;
- een poison message wordt zichtbaar na begrensde pogingen;
- dead-lettermetadata bevat event-ID, effectfamilie, pogingentelling, tijden, reason code, replayveiligheid en interventiestatus;
- dead letters bevatten geen bronpayload of fouttekst;
- een offline consumer verandert bronwaarheid niet;
- replay en restart convergeren naar dezelfde projectie.

## Service identity en signatures

Kritieke WorkOS- en Leerhuis-receipts gebruiken de bestaande RTG-zegelinfrastructuur. Het servicebewijs bindt:

- issuer;
- Ed25519-algoritme;
- key ID;
- protocol/schema version;
- canonicalization version;
- payloadhash;
- issued-at.

Verificatie gebeurt vóór projectie. Een gewijzigde payload faalt. Rotatie en historische verificatie op key ID zijn getest. Binnen dezelfde procesgrens blijft `in-process` een expliciete mode; zodra een adapter over een servicegrens gaat is een geldig bewijs vereist. Er is geen tweede key store of cryptografisch formaat gebouwd.

## Recall-contract

Input:

- server-derived actor;
- consumer/workspace/organization;
- huidige action;
- purpose;
- versioned of stable scope refs.

Selectie vereist tegelijk:

1. actuele consumer-authority;
2. exact purpose;
3. geschikte recipient;
4. scope-match;
5. actuele source resolution;
6. actuele artifact resolution;
7. geldige retention/lifecycle-status.

Output noemt kandidaat of omission, bron, ouderdom, status, contest/correction, current change ref, policybesluit en concrete reden. De actor kan accepteren, negeren of contesten. Presentatie en disposition zijn operation-ID-gebonden en changed replay wordt geweigerd. Er is geen AI nodig voor selectie.

## Causaliteitsregels

- Volgorde is geen causaliteit.
- Lineage is geen causaliteit.
- Een menselijke causaliteitsclaim is een claim en geen systeemfeit.
- `observed_after_change` betekent alleen dat een nieuwe Observation naar een eerdere change verwijst.
- Een assessment als `improved` blijft bronbeoordeling.
- `causalClaim: false` is verplicht voor alle huidige relations.
- AI mag later een hypothese voorstellen, maar kan dit veld niet stil naar true veranderen.

## Recoverymodel

| Failure point | Gegarandeerd resultaat |
|---|---|
| na Observation-commit, delivery faalt | bronobservatie blijft; outbox retryt |
| vóór duurzame broncommit | geen succes en geen half record |
| Decision bestaat, change faalt | geen ChangeReceipt |
| authority ingetrokken vóór change | definitieve mutatie weigert |
| na change-commit, antwoord verloren | retry vindt operation-resultaat; geen tweede change |
| receipt-consumer offline | bronreceipt blijft; checkpoint loopt later bij |
| na Lineage-write, vóór checkpoint | replay van hetzelfde event is idempotent |
| checkpoint corrupt | fail closed met `CHECKPOINT_CORRUPT` |
| index verloren | rebuild uit bronsporen |
| tijdens Recall | geen bronmutatie; mislukte presentatie wordt geen besluit |
| Verification ontbreekt of bron onbeschikbaar | honest outcome; nooit valse verification |

De PostgreSQL-proef gebruikt twee instanties tegen dezelfde database en bewijst serialisatie, payloadgebonden replay, lost commit answer, restart en één projectieresultaat.

## Operational observability

`GET /api/loop/operations` gebruikt de bestaande interne metricsdeur en toont afzonderlijk:

- outbox backlog;
- oudste onverwerkte event;
- checkpoint lag per gehashte scope en consumer;
- open dead letters;
- replayconflicten;
- processing latency;
- worker/lease-status;
- relation-, Observation- en changetellingen;
- index bytes/growth via opeenvolgende snapshots;
- stale/unlinked lineage;
- denied/unresolved recall;
- unknown verification outcomes;
- journalintegriteit.

Het endpoint kopieert geen Observation-content, actor-ID of ruwe scope-ID. Orphaned ObjectRefs staat eerlijk op `not_checked`, omdat correcte vaststelling live bronpolicy vereist. Er is geen samengestelde health- of learningscore.

## Performance en schaal

Meting: Node v24.18.0, lokale host, huidige objectmap en lineaire recallscan. Dit is een absolute meting; de basiscommit had geen gelijkwaardig instrument, dus er is geen geloofwaardige voor/na-delta.

| Relations | Write totaal | Recall p50 | Recall p95/p99 | Serialized/estimated | Heapgroei | Cold start | Rebuild | CPU user/system | Past onder 25 MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| 10k | 6.540 ms | 2.590 ms | 2.855 / 2.855 ms | 4,273,351 B | 4,617,944 B | 17.461 ms | 1.980 ms, 5,049,444/s | 48.194 / 6.477 ms | ja |
| 100k | 61.363 ms | 24.102 ms | 29.956 / 29.956 ms | 43,233,451 B | 45,592,344 B | 228.879 ms | 20.087 ms, 4,978,406/s | 449.698 / 56.224 ms | nee |
| 1M | 744.345 ms | 472.426 ms | 478.040 / 478.040 ms | 427,335,100 B geschat | 377,529,000 B | niet gedraaid | 257.397 ms, 3,885,047/s | 3,438.496 / 410.990 ms | nee |

Delivery-state-machine, 10k events:

- verwerken: 100.116 ms, circa 99,884 events/s;
- replaypad: 14.510 ms, circa 689,176 events/s;
- checkpoint/outbox lag: 10,000 → 0;
- twee-worker claim: eerste claimt, tweede ziet actieve lease;
- checkpoint na serialize/restart: 10,000 en intact;
- CPU: 111.810 ms user, 21.942 ms system.

Dit zijn lokale microbenchmarks en geen productie-SLO. De gemeten bottleneck is niet signing of delivery maar de centrale objectmap plus lineaire scan en volledige JSON-projectie. Correctness blijft beschermd door de harde cap. Alleen de cap verhogen zou memory-, cold-start- en commitkosten verbergen en is daarom niet gedaan.

## Multi-worker en cross-region

| Eigenschap | Status | Bewijs/beperking |
|---|---|---|
| meerdere workers in één gedeelde store | PROVEN | leases, busy claim, expiry takeover |
| twee processen op PostgreSQL | PROVEN | race-, replay- en restarttest |
| checkpoint race | PROVEN | transactionele collection update + lease owner |
| clock skew vóór lease-expiry | PROVEN | achterlopende worker steelt geldige lease niet |
| delayed/duplicate delivery | PROVEN | source sequence + event fingerprint |
| worker/region failure na lease | PROVEN binnen gedeelde klok/store | andere worker neemt na expiry over |
| actieve/actieve multi-region database | NOT PROVEN | geen cross-region databasecontract of latencytest |
| region partition/conflict resolution | NOT PROVEN | vereist expliciete consistencykeuze |

## Security en privacy

- Actoridentiteit komt uit servercontext/routes, niet uit clientclaims.
- WorkOS-source changes vragen een persoonlijk lid; een gedeeld beheer-token volstaat niet.
- Authority wordt bij Decision, definitieve Change, Recall en disposition opnieuw beoordeeld.
- De Fabricprojectie verbiedt broncontent, actorref, authorityref en operation-ID.
- Purpose en recipient moeten exact passen.
- Service receipts worden vóór projectie geverifieerd.
- Dead letters en operations bevatten geen payloaddump.
- Rebuild kan verwijderde refs niet terughalen als de bron een lifecycleevent uitgeeft.
- De geheimenscan is groen.
- Er is geen globale reputatie-, confidence- of learningscore.

Resterend privacywerk voor brede adoptie is juridisch domeinbeleid per nieuwe adapter: concrete bewaartermijnen, legal hold en de vraag wanneer een tombstone volledig mag verdwijnen. De kernel mag die semantiek niet zelf verzinnen.

## Architecture/adoption gates

De runtime-invariants en tests blokkeren:

- Fabric-owned broninhoud of actoridentiteit;
- cross-domain ChangeReceipt ownership;
- change-lineage zonder receipt;
- impliciete causaliteitsclaims;
- orphaned receipt refs;
- Recall zonder live authority/source resolution;
- changed replay;
- onverwacht grote productmodules;
- routes zonder bestaande RTG-poort of mutatiecontract.

Deze gates inspecteren projectievorm en uitgevoerde gedragstests. Ze zijn geen namenregex die alleen `ObservationStore` zou verbieden.

## Testresultaten

| Toets | Uitslag | Betekenis |
|---|---|---|
| 10 gerichte Loop Fabric-files zonder PG | 33/33 groen | drie slices, lifecycle, delivery, routes, crypto, operations |
| geraakte domeinregressies | 174/174 groen | Fabric + WorkOS + Living World + Leerhuis + envelop + zegel |
| echte PostgreSQL-proef | 1/1 groen | twee instanties, race, replay, lost answer, restart |
| mutatiemotor | 1,953 mutaties gedood, 0 overleefd, 162 niet meetbaar | nieuwe tests reageren op semantische bronmutaties; bestaande rode fixtures worden apart gemeld |
| scherpe mutatieronde | 913 zakken op inhoud; 19 alleen op inlog | inhoudelijke gevoeligheid en deurafhankelijkheid apart |
| statische huiskeuring | `Alles in orde` | routes, deuren, modules, registers, architectuur, mutatiecontract |
| taalbewijs | 27/27 groen | gegenereerde taalregisters zijn actueel; geen volledige 114-taal-productionclaim |
| geheimenscan | groen | geen nieuw credentiallek |
| schaaltest | uitgevoerd op 10k/100k/1M | harde 25 MiB-grens zichtbaar |
| browser | niet uitgevoerd | geen UI gewijzigd; HTTP-deurproef levert het relevante bewijs |

### Huisbrede status die niet aan de Fabric mag worden toegeschreven

- `npm test` start op deze host niet via de standaardrunner omdat `cargo` ontbreekt.
- Een directe volledige Node-runner is na meer dan twintig minuten afgebroken. Hij bevatte reeds bestaande LibraryOS/register- en host/netwerkafhankelijke failures en een SMTP-proef van 600 seconden. De run is dus niet groen en niet volledig.
- De eerder uitgevoerde volledige routedekking telde 5,399 van 5,423 routes en bleef op 24 repositorybrede gaten staan. De vier nieuwe WorkOS Loop-routes zijn daarna wel via echte HTTP-tests geraakt, maar er is geen nieuwe volledige suitejournal voor een huisbrede 100%-claim.
- Een ongeconfigureerde run van `loop-fabric.pg.test.js` faalt terecht wegens ontbrekende test-URL. Met de lokale geïsoleerde PostgreSQL-URL is dezelfde proef 1/1 groen.

Deze resultaten zijn geclassificeerd als bestaande repositoryfailure, host/environment failure of niet volledig uitgevoerd; geen ervan is als groene Fabric-test geteld.

## Verschil met `4e1b0972f926da977da2cc30a2174d904a505f31`

De basis bewees één Living World → WorkOS-lus. Daarna zijn toegevoegd:

- tweede WorkOS near-miss/runbookslice;
- derde Leerhuis/praktijkkennis-slice;
- generieke source-adapteraansluiting zonder V2-kernel;
- claim/contest via Living World en Leerhuis;
- source lifecycle, retention, unlinking en tombstones;
- gedeelde deliveryleases, checkpoints en dead letters;
- source receipt signatures en verificatie;
- privacyveilige operations;
- runtime architecture invariants;
- multi-worker/PostgreSQL recoverybewijs;
- schaalinstrument en harde capaciteitsbevinding;
- bijgewerkte RTG-registers, mutatiecontracten en bewijsafdrukken;
- opgesplitste productmodules onder de bestaande 10 KiB-grens.

## Exact bestandsmanifest

```text
M  ARCHITECTUUR.md
M  BEWIJS.md
M  COMMERCE.json
M  FUNCTIES.md
M  HANDLERWACHT.json
M  LANGUAGECAPABILITY.json
M  LANGUAGEFAILOVER.json
M  MEANINGPARITY.json
M  MUTATIECONTRACT.json
M  MUTATIES.json
M  OBJECTMODEL.json
M  VINDBAAR.json
A  RTG-LOOP-FABRIC-COMPLETION.md
A  scripts/loop-fabric-scale.js
M  server/bedrijf/loop-change.js
M  server/bedrijf/loop-context.js
A  server/bedrijf/loop-source-change.js
A  server/bedrijf/loop-source-lifecycle.js
A  server/bedrijf/loop-source-transport.js
M  server/bedrijf/loop-source.js
M  server/kern/leerhuis/acties-kennis.js
M  server/kern/leerhuis/index.js
A  server/kern/leerhuis/loop-source.js
M  server/kern/leerhuis/projectie.js
M  server/kern/living-world/index.js
M  server/kern/living-world/loop-source.js
M  server/kern/loop-fabric/decision-context.js
A  server/kern/loop-fabric/delivery.js
M  server/kern/loop-fabric/index.js
A  server/kern/loop-fabric/invariants.js
A  server/kern/loop-fabric/operations.js
M  server/kern/loop-fabric/projection.js
A  server/kern/loop-fabric/proof.js
A  server/kern/loop-fabric/recall-query.js
A  server/kern/loop-fabric/service-receipt.js
M  server/lib/idemsleutels-loop-fabric.js
M  server/lib/mutatiecontracten-loop-fabric.js
M  server/lib/zegel.js
M  server/opzet/loop-fabric.js
M  server/routes/loop-fabric.js
M  server/server.js
M  test/lib/loop-fabric-fixture.js
A  test/loop-fabric-academy-slice.test.js
A  test/loop-fabric-architecture-gate.test.js
A  test/loop-fabric-delivery.test.js
M  test/loop-fabric-http.test.js
A  test/loop-fabric-lifecycle.test.js
A  test/loop-fabric-operations.test.js
M  test/loop-fabric-routes.test.js
A  test/loop-fabric-service-proof.test.js
A  test/loop-fabric-workos-slice.test.js
```

## Lokale commits

```text
295185e0eb2c16bffa1336daeaf7edb627ee01f8  feat: prove WorkOS loop fabric slice
7a1054c8587c7556f4cd2d40c32450cea6f8b082  feat: prove Academy loop fabric slice
6cf99972b33828e8b45f60de4d143ed3cf8045e9  feat: harden loop fabric lifecycle and delivery
436418b5d3561d7f3d3ff51627a715a71d96ca68  feat: add loop fabric operations and architecture gates
fe012431d9761cd65b8ff74e20499fa58356b078  refactor: bound loop fabric modules
d5f4c1b70bdc4f7558d3fe8273d366ce31653677  docs: refresh loop fabric architecture registers
6ba81d4eb8c0fb54213b35e9ee3121ab4df60689  test: record loop fabric mutation proof
5ee35bd02609a41352eca1db1427889201a6caae  test: measure loop fabric delivery scale
```

Het commit dat dit rapport toevoegt is per definitie de `HEAD` waarin dit bestand voor het eerst voorkomt; de exacte hash staat in het eindbericht naast bovenstaande implementatiecommits.

## Bekende resterende beperkingen

1. De huidige objectmap/projectie schaalt niet tot 100k relaties binnen de 25 MiB-cap.
2. Recall gebruikt een lineaire scan en heeft bij 1M circa 472–478 ms nodig op deze host.
3. Actief/actief multi-region en netwerkpartities zijn niet bewezen.
4. De Fabric heeft geen remote transportprotocol; adapters draaien nu in dezelfde RTG-runtime. Signatures maken een latere grens controleerbaar.
5. Concrete legal-hold- en retentietermijnen blijven domein- en rechtsgebiedspecifiek.
6. Orphaned refs worden operationeel als `not_checked` gerapporteerd; een correcte check vereist actuele bronpolicy.
7. Volledige repositorytest en 100% huisbrede routedekking zijn door bestaande/hostafhankelijke problemen niet bewezen.
8. Er is geen productie-SLO of loadtest met echte cross-region latency.

## Veiligste volgende vertical slice

De veiligste volgende stap is geen vierde productdomein. Eerst is een niet-destructieve storage-slice nodig:

```text
bestaande bronsporen
  → dual-build van huidige projectie en sharded/queryable projectie
  → hash/count/equivalence proof
  → recall shadow read
  → bounded cutover per consumer/domain
  → rollback naar bronrebuild
```

Voor implementatie moet één semantische keuze expliciet worden gemaakt: shard RTG primair per consumer/tenant, per source domain, of per tijdsvenster? Die keuze bepaalt privacy-erasure, cross-domain querykosten, region placement en recovery. De huidige code geeft geen eenduidig antwoord; daarom is geen willekeurige migratie gestart.

Na die storage-slice is TravelOS de beste vierde productslice, omdat reisdisruptie, herstel en latere voorbereiding andere temporaliteit en privacy introduceren zonder eerst nog een variant van organisatiekennis te herhalen.

## Definition of Done

| # | Eis | Status | Conclusie |
|---:|---|---|---|
| 1 | drie semantisch verschillende slices | PROVEN | Living World, WorkOS, Leerhuis |
| 2 | vijf protocolfamilies afgebouwd/bewust lokaal | PROVEN | matrix hierboven |
| 3 | domeinen bezitten Observation/Decision/Change | PROVEN | source adapters kunnen bronstate niet fabriceren |
| 4 | geen Learning Plane/Observation Store | PROVEN | minimale herbouwbare projectie |
| 5 | source-owned receipts duurzaam/idempotent | PROVEN | WorkOS, Leerhuis, PG/replaytests |
| 6 | Lineage duurzaam, minimaal, privacy-safe | PROVEN | invariants, tombstones, rebuild |
| 7 | Recall herbeoordeelt authority/policy | PROVEN | live consumer/source checks |
| 8 | deletion/retention/revocation/unlinking | PROVEN | lifecycle- en adversarial tests |
| 9 | dead-letter/replay/recovery operationeel | PROVEN | state machine + operations |
| 10 | kritieke servicegrenzen verifieerbaar | PROVEN binnen huidige trust boundary | signed WorkOS/Leerhuis receipts; remote transport nog niet gebouwd |
| 11 | geen automatische causaliteit | PROVEN | invariant + drie slices |
| 12 | concurrency/restart/answer-loss | PROVEN | delivery + echte PostgreSQL-test |
| 13 | schaaltests en bottlenecks | PARTIAL | 10k/100k/1M gemeten; huidige vorm faalt cap vóór 100k |
| 14 | multi-worker/cross-region expliciet | PARTIAL | multi-worker bewezen; multi-region niet |
| 15 | privacyveilige observability | PROVEN | interne operationsroute |
| 16 | mutatie/route/credential/architecture/clean-tree gates | PARTIAL | relevante en statische gates groen; volledige repositoryrunner/routedekking niet groen bewezen |
| 17 | eerste slice blijft groen | PROVEN | gerichte suite |
| 18 | tweede en derde E2E | PROVEN | WorkOS + Leerhuis |
| 19 | geen duplicatieve platformlaag | PROVEN | bestaande envelope, authority, zegel, transacties en registers hergebruikt |
| 20 | schone werkboom | PROVEN na rapportcommit | gecontroleerd na de definitieve commit |

De eindstatus is daarom **PARTIAL voor de volledige opdracht**, met een **PROVEN semantische en recovery-kern binnen de bounded single-region deploymentgrens**. Een volledige `PROVEN`-claim zou de gemeten storagecap, ontbrekende multi-regiongarantie en niet-groene huisbrede runner verhullen.
