# RTG Loop Fabric codebase coverage

Datum: 5 oktober 2026

Branch: `codex/libraryos-kernel`

Uitgangspunt: `b0cea6c64` en het bewezen fundament in `RTG-LOOP-FABRIC-COMPLETION.md`

## Uitkomst

RTG heeft nu een actuele, machineleesbare coverage-registry en een afgedwongen Learning Eligibility-contract. De registry verbindt de 228 productcapabilities met 5.419 actuele routes, 5.293 mutatiecontracten, 326 schermen en hun transitieve kernelafhankelijkheden. Zij classificeert iedere capability expliciet en bewaart per capability eigenaar, entry points, semantische signalen, deelnamegrond, memory class, retentie, mogelijke overdracht en ontbrekende contracten.

De codebasis is daarmee bestuurbaar gemaakt voor gefaseerde adoptie. De volledige codebasis is nog niet Loop Fabric-capable. Dat zou nu ook geen correcte uitkomst zijn: 163 capabilities missen een bewezen brondomeincontract, 46 vereisen een menselijke of juridische beslissing en 5 zijn bewust uitgesloten. Ik heb geen toestemming, rechtsgrond, bronobject of change-semantiek uit routegedrag afgeleid.

Deze batch voegt daarnaast de vierde bewezen kennislevenscyclus toe:

```text
Library feedback
  -> source-owned Observation
  -> bevoegde behandeling
  -> nieuwe Revision
  -> immutable Edition 2
  -> source-issued ChangeReceipt
  -> Lineage
  -> policy-aware Recall
  -> nieuwe feedback-Observation
  -> niet-causale Verification
```

De veilige stopgrens is bereikt voor TravelOS, LivingOS, FoundationOS, Hospitality en een drie-domeinenoverdracht. Hun ontbrekende bronsemantiek of rechtsgrond heeft meerdere redelijke invullingen die niet uit de actuele code volgt. Een adapter daarop bouwen zou precies de verboden centrale betekenislaag maken.

## Coverage Registry

De bron is `LOOP-FABRIC-COVERAGE.json`. `npm run loopfabric:coverage` bouwt haar opnieuw; `npm run loopfabric:coverage:controle` faalt wanneer de afdruk achterloopt.

De registry gebruikt productcapabilities als noemer. Routes en bronbestanden zijn bewijs voor bereik en gedrag, niet de telemetrie-eenheid. De aanvullende bronanalyse markeert mogelijke state machines, decisions, feedback, recovery, AI en physical handoffs uit daadwerkelijk bereikbare kernels. Deze rijen heten bewust `STATIC_SOURCE_CANDIDATE_NOT_LEARNING_PROOF`.

### Gemeten oppervlak

| Maat | Aantal |
|---|---:|
| Productcapabilities | 228 |
| Actuele routes | 5.419 |
| Mutatiecontracten | 5.293 |
| Schermen | 326 |
| Bereikbare kernbestanden | 2.588 |
| Kerngroepen | 178 |
| State-machinekandidaten | 2.407 |
| Decision-kandidaten | 902 |
| Feedback/complaint-kandidaten | 157 |
| Delivery/recovery-kandidaten | 333 |
| AI-action-kandidaten | 845 |
| Physical-handoffkandidaten | 1.574 |

Kandidaataantallen overlappen en mogen niet worden opgeteld. Zij betekenen evenmin dat een learning path is toegestaan.

### Classificatie

| Classificatie | Aantal | Betekenis |
|---|---:|---|
| `LOOP_CAPABLE` | 1 | De gedeelde Fabric-capability zelf is volledig bewezen. |
| `PARTIALLY_LOOP_CAPABLE` | 5 | WorkOS, Leerhuis, Living World, Living Lab en Library hebben minstens één bewezen flow; de volledige capability is breder. |
| `NOT_YET_LOOP_CAPABLE` | 163 | Er is betekenisvol gedrag, maar nog geen complete source-owned learninglus. |
| `NO_LEARNING_VALUE` | 8 | Presentatie, transport of read model zonder eigen semantische leeruitkomst. |
| `PROHIBITED_FROM_LEARNING` | 5 | Primaire private inhoud wordt bewust niet tot learning artifact gemaakt. |
| `HUMAN_REVIEW_REQUIRED` | 46 | Gereguleerd, kwetsbaar of hoog-impact; code kan de juiste rechtsgrond niet kiezen. |

`LOOP_CAPABLE` wordt streng op capabilityniveau geteld. De vier bewezen scenario's maken hun brede productcapability daarom `PARTIALLY_LOOP_CAPABLE`, niet volledig groen.

### Coverage per domein

| Domein | Capabilities | Eligible | Loop | Partial | Nog niet | Geen waarde | Verboden | Review |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Academy | 6 | 6 | 0 | 1 | 5 | 0 | 0 | 0 |
| Commerce | 11 | 11 | 0 | 0 | 11 | 0 | 0 | 0 |
| Communication | 11 | 9 | 0 | 0 | 9 | 0 | 2 | 0 |
| Communities/events | 12 | 12 | 0 | 0 | 10 | 0 | 0 | 2 |
| Edge/AI | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 0 |
| Files/documents | 7 | 4 | 0 | 0 | 4 | 2 | 1 | 0 |
| FoundationOS | 9 | 9 | 0 | 0 | 5 | 0 | 0 | 4 |
| Governance | 8 | 8 | 0 | 0 | 8 | 0 | 0 | 0 |
| Health/care | 4 | 3 | 0 | 0 | 0 | 0 | 1 | 3 |
| Hospitality | 6 | 6 | 0 | 0 | 6 | 0 | 0 | 0 |
| Identity/organizations | 20 | 20 | 0 | 0 | 8 | 0 | 0 | 12 |
| LibraryOS | 3 | 3 | 0 | 1 | 2 | 0 | 0 | 0 |
| Living Lab | 4 | 4 | 0 | 1 | 3 | 0 | 0 | 0 |
| Living World | 4 | 4 | 0 | 1 | 3 | 0 | 0 | 0 |
| LivingOS | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 0 |
| Loop Fabric | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Media/culture | 9 | 9 | 0 | 0 | 9 | 0 | 0 | 0 |
| Mobility | 12 | 12 | 0 | 0 | 12 | 0 | 0 | 0 |
| Pay | 32 | 32 | 0 | 0 | 9 | 0 | 0 | 23 |
| Personal life | 15 | 14 | 0 | 0 | 12 | 0 | 1 | 2 |
| Physical commerce | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| Platform | 6 | 0 | 0 | 0 | 0 | 6 | 0 | 0 |
| Saloon | 2 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| Service/support | 3 | 3 | 0 | 0 | 3 | 0 | 0 | 0 |
| Talent | 7 | 7 | 0 | 0 | 7 | 0 | 0 | 0 |
| TravelOS | 7 | 7 | 0 | 0 | 7 | 0 | 0 | 0 |
| WorkOS | 14 | 14 | 0 | 1 | 13 | 0 | 0 | 0 |
| World Network | 4 | 4 | 0 | 0 | 4 | 0 | 0 | 0 |

## Learning Eligibility

Een operationeel object wordt alleen als learning artifact geprojecteerd wanneer het brondomein een versiegebonden eligibility heeft uitgegeven. De gate bindt:

- exacte source ref en versie;
- purpose;
- memory class;
- begrensd publiek;
- aantoonbare grond en evidence ref waar van toepassing;
- veldallowlist;
- afzonderlijke uses voor decision, recall, cross-domain, AI, aggregatie en publicatie;
- issued/valid time;
- expliciete retentiepolicy;
- epistemische herkomst;
- supersession.

De gate wordt opnieuw beoordeeld bij Decision en Recall. Een historisch recht geeft dus geen permanent leesrecht. Client-supplied actor identity is geen authoritybron.

### Memory classes

- `PERSONAL`: alleen de persoon; cross-domain, aggregatie en publicatie blokkeren zonder afzonderlijke promotie.
- `RELATIONSHIP_SHARED`: bewust gedeeld met afgebakende partijen.
- `ORGANIZATIONAL`: institutionele context met een aangetoonde organisatiegrond.
- `DOMAIN_ASSET`: geschiedenis van een bronobject of asset zonder bewoners- of gebruikersprofiel te worden.
- `COMMONS`: vereist expliciete vrijwillige vrijgave.

Een overgang tussen classes is een nieuwe eligibility en geen statuswijziging van het oude artifact.

### Epistemische herkomst

`HUMAN_STATED`, `SYSTEM_OBSERVED`, `AUTHORITY_DECIDED` en `SOURCE_VERIFIED` blijven gescheiden van `INFERRED`, `PROPOSED`, `SUMMARIZED` en `GENERATED`. AI-gebruik vereist een eigen expliciete scope. Een AI-uitkomst kan geen consent, authority, verified fact of causale conclusie fabriceren.

### Consent coverage

| Deelnamegrond | Capabilities |
|---|---:|
| Expliciete toestemming nodig | 23 |
| Andere grond moet door bron worden bewezen | 100 |
| Uitsluitend organizational/technical state | 46 |
| Verboden | 5 |
| Menselijke/juridische beoordeling | 46 |

Gebruik van RTG levert nooit impliciet learning consent op.

## Bewezen vertical slices

1. Living World naar WorkOS: vrijwillige toegankelijkheidsmelding, procedurewijziging, recall en latere observatie.
2. WorkOS near-miss: incident, besluit, versioned runbook, receipt, next-task recall en verification.
3. Leerhuis: praktijkclaim, governance, versioned kennisregel, receipt, recall en verification.
4. LibraryOS: inhoudelijke feedback, Revision, immutable Edition 2, source receipt, recall en latere feedback.

De Library-adapter hergebruikt Library identity, governance, feedback, revision, edition, publication en immutable snapshot. Persoonlijke Reader-state is expliciet geen Observation. Een Edition 2 mag oude editiegebonden rechten of instemmingen niet hergebruiken.

## Cross-domain bewijs

De bestaande Living World naar WorkOS-slice is een echte overdracht tussen twee semantische domeinen. De code bevat nog geen veilige drie-domeinenflow met een expliciete productpurpose, overdraagbaar bronobject, rechtsgrond, ontvangerauthority en revoke-pad. Ik heb daarom geen Travel claim via Library naar Academy gestuurd. Dat zou knowledge laundering en impliciete consent kunnen introduceren.

Een drie-domeinenbewijs is `NOT PROVEN` en blijft een product- en juridische keuze, geen ontbrekende router.

## Retention, forgetting en honest outcomes

De bestaande Fabric ondersteunt expiry, source withdrawal, deletion, anonymization, unlinking, restricted tombstones, supersession en live authority revocation. De Lineage Index geeft nooit zelfstandig recht op broninhoud.

Recall kan afzonderlijk uitleggen: `denied`, `source_missing`, `stale`, `unavailable` en `not_checked`. Deze batch mapte ook verlopen eligibility en gewijzigde source eligibility naar `stale`, en ontbrekende policy/authority-evaluatie naar `not_checked`. Geen van deze uitkomsten wordt `false` of `verified`.

## Architectuurpoorten

De bestaande Fabric-poorten blijven gelden:

- geen Fabric-owned domeinwaarheid;
- geen centrale Observation Store;
- geen critical Change zonder source-issued receipt;
- geen causale claim door temporele opvolging;
- geen gevoelige inhoud of actoridentiteit in minimale Lineage;
- geen Recall zonder live source-, policy- en authority-evaluatie;
- geen gewijzigde replay onder dezelfde operation ID;
- geen projectie zonder source-issued eligibility.

De nieuwe coveragepoort voegt toe:

- iedere functieschakelaar staat exact eenmaal in de registry;
- gevoelige capabilities falen naar `PROHIBITED` of `HUMAN_REVIEW`;
- een bewezen Fabric-capability blijft zichtbaar;
- de registry meet semantische mutaties en geen HTTP-requestaantallen;
- afgeleide coverage blijft reproduceerbaar uit actuele registers.

## Privacy- en securityresultaat

Bewezen invarianten:

- Personal Memory promoveert niet stil naar Organizational of Commons.
- AI krijgt geen eligibility zonder aparte AI-scope.
- Reader-state wordt geen Library-kennis.
- ingetrokken authority blokkeert actuele Decision en Recall.
- verwijderde bronrefs worden niet via Lineage resolveerbaar.
- deliverymetadata en dead letters bevatten geen bronpayload.
- changed replay, checkpointcorruptie en receiptmanipulatie falen gesloten.
- source receipts blijven service-verifieerbaar met bestaande RTG-zegel/keyinfra.

Niet bewezen voor nog niet aangesloten domeinen:

- vorige-bewonerprivacy in een volledige LivingOS-interventielus;
- private Travel experience tegenover organizational recall;
- Foundation-hulp onafhankelijk van learning consent in een uitvoeringsslice;
- Hospitality zonder gast- of werknemersprofilering;
- mass revocation over een toekomstige gesharde projectie;
- cross-tenant security voor adapters die nog niet bestaan.

## Veilige stopgrenzen

### TravelOS

Er zijn boekingen, historie, menselijke besluiten en een ervaringlaag. Er ontbreekt een versioned Travel Experience-bron met expliciet vrijwillige learning scope, eigen lifecycle en duurzame outbox. Koop- of boekgedrag mag die toestemming niet vervangen.

### LivingOS

`woningonderhoud` bezit nu alleen een persoonlijke melding en annulering. De code zegt expliciet dat toewijzing en planning later bij de echte dienstverlener horen. Er is geen intervention/completion, asset authority, overdracht naar leverancier of source-issued ChangeReceipt. Een loopadapter zou dus succes fabriceren.

### FoundationOS

Foundation heeft projecten, indicators, evidence, rapportages, evaluaties en besluiten. De flows raken hulpvragers, vrijwilligers, financiën en kwetsbare personen. De correcte grond verschilt per flow en kan niet uit Foundation-lidmaatschap of hulpgebruik worden afgeleid. Vier capabilities blijven daarom `HUMAN_REVIEW_REQUIRED`.

### Hospitality

Er zijn reserverings-, service-, POS-, room- en HACCP-mutaties, maar nog geen eenduidig versioned process-object dat een bottleneckbesluit als bronwijziging kan bevestigen. Gast- en werknemersdata mogen niet als vervangend procesgeheugen dienen.

### Drie domeinen

Een overdracht heeft nog een expliciete release-, authority-, minimization- en revoke-semantiek nodig. Lineage alleen is geen toestemming en herhaling door meerdere domeinen verhoogt de waarheid niet.

## Schaal en performance

De completion-benchmark blijft de geldende grens:

- 10k Lineage-relaties zijn binnen de huidige objectmap bruikbaar;
- rond 100k relaties mat de projectie circa 43,2 MiB;
- de huidige harde cap is 25 MiB;
- 1M relaties hoort niet in deze centrale objectmap.

Deze batch vergroot de Fabricprojectie niet met broncontent. De coverage-registry is een build-time artifact en geen runtime learning store. De nieuwe kernelanalyse verwerkt 2.588 bereikbare bestanden in ongeveer vijf seconden bij het verversen van `SYMBOLEN.json`; de coveragecontrole zelf liep in circa 1,7 seconden. Dit zijn lokale waarnemingen, geen productie-SLO's.

De resterende schaalkeuze blijft: niet-destructieve gesharde/queryable Lineage- en Recall-projecties met expliciete tenant/domain shard key en consistencycontract. Er is bewust geen grote centrale store toegevoegd.

## Tests en poorten

Uitgevoerd:

- gecombineerde Loop Fabric- en Librarysuite met lokale HTTP en PostgreSQL: 75/75 groen;
- een eerdere sandboxrun gaf 73/75 en bevestigde dat uitsluitend de geblokkeerde listener en ontbrekende test-URL de twee tests verhinderden;
- HTTP-ingang afzonderlijk buiten de sandbox: 1/1 groen;
- geïsoleerde PostgreSQL race/replay/restarttest afzonderlijk: 1/1 groen;
- na moduleopsplitsing: 29/29 kern-, delivery-, lifecycle-, eligibility-, Library-, WorkOS- en Leerhuistests groen;
- `npm run loopfabric:coverage:controle`: groen;
- `node scripts/check.js`: alle 73 huiscontroles groen;
- `git diff --check`: groen.

Niet groen of niet uitvoerbaar:

- `npm test` startte niet omdat de host geen `cargo` heeft; dit is een pretest/hostfailure en geen uitgevoerde Node-suite;
- `node scripts/test-runner.js` is rechtstreeks uitgevoerd en is rood: 15.672 tests, 9.513 geslaagd, 6.107 mislukt, 9 geannuleerd en 43 overgeslagen, exitcode 1. De output bevat onder meer ontbrekende demo-fixtures, lokale listenerblokkades (`EPERM`), ontbrekende database/Redis-omgevingen en zes SMTP-tests die elk hun 600-seconden-timeout bereikten;
- geïsoleerde voorbeelden zijn `vloot.test.js` (geen vier vrije hostpoorten) en `zaakdoos.test.js` (sandbox blokkeert `127.0.0.1`);
- de door de runner geschreven teststempel is na het uitlezen teruggedraaid, omdat gegenereerde teststatus geen bronwijziging van deze implementatie is.

Geen van de gerichte Loop Fabric-, Library-, PostgreSQL- of architecturetests faalde. De volledige repositoryrunner blijft desondanks eerlijk `FAIL/HOST-DEPENDENT`, conform de reeds bekende onafhankelijke repositorytoestand.

## Exacte wijzigingen sinds `b0cea6c64`

### Nieuw

- `LOOP-FABRIC-COVERAGE.json`
- `scripts/loop-fabric-coverage.js`
- `server/kern/loop-fabric/coverage-policy.js`
- `server/kern/loop-fabric/learning-eligibility.js`
- `server/kern/loop-fabric/projection-records.js`
- `server/kern/library/loop-source.js`
- `server/kern/leerhuis/loop-delivery.js`
- `server/kern/living-world/loop-delivery.js`
- `test/loop-fabric-coverage.test.js`
- `test/loop-fabric-learning-eligibility.test.js`
- `test/loop-fabric-library-slice.test.js`
- `RTG-LOOP-FABRIC-CODEBASE-COVERAGE.md`

### Gewijzigd

- `package.json`
- `server/bedrijf/loop-source.js`
- `server/kern/leerhuis/loop-source.js`
- `server/kern/library/feedback.js`
- `server/kern/library/index.js`
- `server/kern/living-world/index.js`
- `server/kern/living-world/loop-source.js`
- `server/kern/loop-fabric/decision-context.js`
- `server/kern/loop-fabric/index.js`
- `server/kern/loop-fabric/invariants.js`
- `server/kern/loop-fabric/projection.js`
- `server/kern/loop-fabric/recall-query.js`
- `server/opzet/library.js`
- `server/opzet/loop-fabric.js`
- `test/loop-fabric-architecture-gate.test.js`
- `ARCHITECTUUR.md`
- `BEWIJS.md`
- `COMMERCE.json`
- `FUNCTIES.md`
- `OBJECTMODEL.json`
- `ROUTEBRON.json`
- `SCHERMFUNCTIE.json`
- `SYMBOLEN.json`

## Commits

- `e0c8089c2` - coverage registry en eerste codebaseclassificatie;
- `07e10a22f` - source-issued Learning Eligibility en memory classes;
- `ee3ec0b26` - Library feedback/Edition vertical slice;
- `0a6329b53` - transitieve kernel- en semantische surfaceanalyse;
- `5308e4022` - actuele bronregisters, honest Recall-uitkomsten en modulegrenzen.

Het document zelf wordt in een afzonderlijke afsluitende commit vastgelegd.

## Definition of Done

| Vereiste | Status | Bewijs of reden |
|---|---|---|
| Volledige Coverage Registry | `PROVEN` | 228/228 functieschakelaars exact eenmaal, reproduceerbaar. |
| Coverage per OS/domein | `PROVEN` | 28 domeinrijen met expliciete classificatie. |
| Learning Eligibility gate | `PROVEN` | source/version/purpose/audience/use/retention tests. |
| Memory classes zonder stille promotie | `PROVEN` | Personal, Shared, Organizational, Asset en Commons-poorten. |
| Vier verschillende bewezen slices | `PROVEN` | Living World, WorkOS, Leerhuis en Library. |
| Alle grote domeinen hebben een expliciete keuze | `PROVEN` op capabilityniveau | Loop, partial, nog niet, geen waarde, verboden of review. |
| Alle grote domeinen zijn runtime aangesloten | `PARTIAL` | Alleen bewezen bronsemantiek is aangesloten. |
| TravelOS vertical slice | `NOT PROVEN` | Experience-bron, consent en outbox ontbreken. |
| LivingOS vertical slice | `NOT PROVEN` | intervention/completion/asset receipt ontbreken. |
| FoundationOS vertical slice | `NOT PROVEN` | rechtsgrond verschilt per kwetsbare flow. |
| Hospitality vertical slice | `NOT PROVEN` | versioned process/change target ontbreekt. |
| Library/Academy knowledge loop | `PARTIAL` | Beide apart bewezen; overdracht tussen hen niet vrijgegeven. |
| Drie-domeinen cross-domain loop | `NOT PROVEN` | purpose/release/revoke semantiek niet gekozen. |
| Geen automatic knowledge laundering | `PROVEN` in kernel | epistemische herkomst en source verification blijven apart. |
| Retention/forgetting | `PROVEN` voor aangesloten bronnen | Niet automatisch bewezen voor toekomstige adapters. |
| Privacy/adversarial coverage | `PARTIAL` | Kern en aangesloten bronnen groen; toekomstige domeinadapters bestaan nog niet. |
| Schaal boven 25 MiB | `NOT PROVEN` | Bewuste stopgrens; geen centrale store gebouwd. |
| Huisarchitectuur en registers | `PROVEN` | 73/73 huiscontroles groen. |

## Aanbevolen volgende batch

De veiligste volgende slice is LivingOS nadat het brondomein zelf deze vier zaken bezit:

1. een stabiele woning/assetref die geen bewonersidentiteit is;
2. een intervention lifecycle met leverancierauthority en completion;
3. een versioned maintenance artifact of plan;
4. een source-issued receipt voor de werkelijk uitgevoerde wijziging.

Daarna kan een bewoner vrijwillig melden, kan persoonsinformatie worden losgekoppeld, kan asset memory blijven bestaan en kan een volgende bewoner alleen de toegestane technische historie zien. Zonder die bronobjecten hoort Loop Fabric daar nog niets te onthouden.

Parallel moet product/juridisch per Foundation-, Travel- en Pay-flow de participationgrond vastleggen. Die beslissing moet uit het brondomein komen en daarna als eligibility-adapter worden getest. Het coveragepercentage mag pas stijgen wanneer de menselijke lus en privacygrens werkelijk sluiten.
