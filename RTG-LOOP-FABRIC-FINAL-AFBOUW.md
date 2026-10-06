# RTG Loop Fabric - definitieve technische afbouw

Datum: 6 oktober 2026
Branch: `codex/libraryos-kernel`
Uitgangspunt van deze afbouw: `2569d2c1b`
Actuele Constitution: `2026-10-06.1`

## 1. Uitkomst

De afgesproken technische fixed point is bereikt. RTG heeft acht volledig bewezen source-owned flows op dezelfde kleine, federatieve protocollen. Alle acht flows die de volledige stoppoort zelfstandig halen zijn geïmplementeerd. De acht resterende PHASE-flows en acht STOP-flows missen aantoonbaar source-specifieke authority, retention, versioning, ChangeReceipt/recovery, een menselijke of juridische beslissing, of de bewezen schaalarchitectuur.

Er is geen centrale Learning Plane, Observation Store, waarheidsdatabase of generieke `trackEverything`-laag toegevoegd. Canonical state, betekenis, authority, mutatie en ChangeReceipt blijven bij het brondomein. Lineage en Recall dragen alleen toegestane context.

## 2. Capability counts voor en na

De Registry bevat nog steeds 228 capabilities. Dat is juist: een begrensde source-flow mag niet de volledige capabilityfamilie automatisch promoveren.

| Capabilityclassificatie | Voor | Na |
|---|---:|---:|
| LOOP_CAPABLE | 1 | 1 |
| PARTIALLY_LOOP_CAPABLE | 5 | 5 |
| NOT_YET_LOOP_CAPABLE | 163 | 163 |
| NO_LEARNING_VALUE | 8 | 8 |
| PROHIBITED_FROM_LEARNING | 5 | 5 |
| HUMAN_REVIEW_REQUIRED | 46 | 46 |
| **Totaal** | **228** | **228** |

De uitvoeringsreadiness veranderde wel:

| Readiness | Voor productbesluiten | Na fixed point |
|---|---:|---:|
| READY_TO_IMPLEMENT | 1 | 1 |
| NEEDS_TECHNICAL_PREREQUISITE | 38 | 98 |
| NEEDS_HUMAN_DECISION | 144 | 84 |
| BLOCKED_BY_SCALE_ARCHITECTURE | 32 | 32 |
| PROHIBITED | 5 | 5 |
| NO_LEARNING_VALUE | 8 | 8 |

De 60 opgeloste menselijke blockers zijn niet als runtime-GO witgewassen. Zij zijn verplaatst naar concrete technische bronprerequisites. Runtime-connected, volledig bewezen source-flows gingen van 5 naar 8.

De actuele meting op de samengevoegde main-basis telt 5.444 routerroutes, waarvan 5.440 herleidbaar zijn naar een bronbestand, 5.313 mutatiecontracten en 326 schermen.

## 3. Human blockers

De oorspronkelijke 144 blockers zijn teruggebracht tot 22 echte beslisfamilies. Acht families zijn productmatig opgelost. Daarmee zijn 60 capabilities beleidsmatig ontgrendeld en blijven 84 capabilities bij 14 open dossiers.

| Dossier | Capabilities | Klasse | Vereiste beslissing |
|---|---:|---|---|
| D20 Payment Operations | 21 | LEGAL_VALIDATION_REQUIRED | doelgebonden financieel gebruik en wettelijke validatie |
| D17 Security Credentials | 11 | LEGAL_VALIDATION_REQUIRED | scheiding securitygebruik, learning en retention |
| D04 Communication Content | 9 | MIXED | selectie, inhoudsgebruik, relatie en bewaartermijn |
| D19 Governance | 8 | GOVERNANCE | wie collectieve lessen en besluiten mag uitgeven |
| D21 Financial Profiling | 8 | LEGAL_VALIDATION_REQUIRED | blijft generiek gesloten |
| D16 Account/Organization | 6 | PRIVACY_POLICY | organisatiecontext versus persoonlijke context |
| D09 Child Education | 4 | LEGAL_VALIDATION_REQUIRED | leeftijd, vertegenwoordiging en doelbinding |
| D10 Research Participation | 4 | MIXED | secondary use, withdrawal, datasetretentie en recall |
| D03 Health Context | 3 | LEGAL_VALIDATION_REQUIRED | blijft generiek gesloten |
| D18 Identity Verification | 3 | LEGAL_VALIDATION_REQUIRED | verificatiedoel versus hergebruik |
| D22 Commercial Claims | 3 | MIXED | claimauthority, correctie en wettelijke validatie |
| D05 Document Content | 2 | PRIVACY_POLICY | inhoudselectie, audience en retention |
| D02 Location Context | 1 | PRIVACY_POLICY | precieze locatiescope en tijdretentie |
| D12 Dating | 1 | ETHICAL/SAFETY | blijft generiek gesloten |

Zorg, minderjarigen, credentials/security, identiteitsverificatie, Pay en financiële profilering hebben een conservatieve productdefault: geen generiek Loop Fabric-learningpad. Een later gespecialiseerd pad vereist een apart contract en waar nodig juridische validatie.

## 4. Constitution

`RTG-LEARNING-CONSTITUTION.json` is machineleesbaar, versioned, reproduceerbaar en runtime-afgedwongen.

1. LC01: dienstgebruik is geen toestemming voor optionele learning.
2. LC02: memory classes promoveren alleen via een afzonderlijk source-issued artifact en eligibility.
3. LC03: Commons vereist een expliciete versiegebonden release.
4. LC04: AI-assistentie, inference en training zijn afzonderlijke doelen.
5. LC05: persoonlijke ervaring wordt niet automatisch Organizational Memory.
6. LC06: Foundation-hulp en kansen hangen niet af van optionele learning.
7. LC07: werknemerscontext wordt geen surveillance- of mensscoregeheugen.
8. LC08: asset history bevat niet automatisch geschiedenis van bewoners of gebruikers.
9. LC09: cross-domain transfer verhoogt epistemische status niet.
10. LC10: Recall controleert actuele authority, purpose, eligibility en retention.
11. LC11: optionele learning rond minderjarigen blijft generiek gesloten.
12. LC12: zorg, financiële profilering, credentials en intieme context hebben geen generiek learningpad.
13. LC13: source domains behouden betekenis en canonical state.
14. LC14: alleen de source owner bevestigt Change met een source-issued receipt.
15. LC15: Change is geen bewezen verbetering; Verification is een nieuwe waarneming.
16. LC16: failed, reversed, mixed, unknown, contested en not reproducible blijven first-class.
17. LC17: volgorde, correlatie en lineage vormen geen causaliteitsbewijs.
18. LC18: retention heeft een bron- en purposebeleid; forever is geen default.

Runtime-enforcement zit in Learning Eligibility, projectie-invariants, capability deny-lijsten, source adapters en de Coverage/Execution-governance. De vijf verboden, acht niet-leerbare en 51 generiek gevoelige capabilities worden ook indirect via Recall, AI of cross-domain adapters geweigerd.

## 5. Productbesluiten

- **D01 Personal Memory:** private-first; structurele les vereist vrijwillige release waar nodig, minimization, afzonderlijk artifact en unlinking.
- **D11 Community/Events:** event-scoped, purpose-bound, vrijwillig en zonder afleiding uit deelname, groep of locatiegeschiedenis.
- **D13 Discovery Commons:** exact object en versie, aparte release, zichtbare reuse/attribution/AI/derivative scope, geen pay-to-rank.
- **D15 Service Improvement:** process-first; ticketinhoud en gesprekken worden niet automatisch organizational memory.
- **D23 Library Education Release:** exact Edition X, geselecteerde ContentNodes, één interne Academy-context, gratis, citation en attribution verplicht, geen derivatives of AI-use zonder aparte scope.

## 6. De acht bewezen source-flows

| Flow | Owner(s) | Status |
|---|---|---|
| `experience.living-world-contribution` | Living World en WorkOS | GO |
| `experience.living-world-commons-release` | Living World | GO |
| `academy.practice-to-knowledge` | Leerhuis | GO |
| `workos.accessibility-procedure` | Living World en WorkOS | GO |
| `workos.near-miss-runbook` | WorkOS | GO |
| `service.process-improvement` | Service en WorkOS | GO |
| `library.feedback-to-edition` | Library | GO |
| `library-edition-to-academy` | Library en Leerhuis | GO |

De drie nieuwe GO-flows in deze afbouw zijn Library naar Academy, Living World Commons en Service Improvement. De bestaande persoonlijke bijdrage/eventflow is aangescherpt als de concrete Personal naar Structural- en Community/Event-proof.

## 7. Library naar Academy

De nieuwe cross-domain slice bewijst:

`Library Work -> exact Edition -> geselecteerde ContentNodes -> EducationRelease -> Academy curriculumversie -> use/audit -> afzonderlijke feedback`

Library bezit de Edition, rechten en release. Academy bezit curriculum, onderwijsgebruik en kwalificatie. Academy kan geen Library-recht fabriceren. Library-feedback wijzigt geen Edition; een nieuwe Edition ontstaat uitsluitend via Library-governance.

Afgedwongen grenzen:

- geen future-Edition-recht;
- geen niet-geselecteerde ContentNode;
- geen andere Academy-context;
- gratis in deze slice;
- citation en attribution verplicht;
- geen derivative work;
- geen AI-training;
- AI-assistentie alleen met eigen latere scope;
- withdrawal blokkeert toekomstig gebruik en nieuwe curriculumversies;
- historische, rechtmatig vastgelegde curriculumversies blijven alleen auditcontext;
- actuele Library- en Academy-authority worden bij commit herzien;
- tenantgrens, replay en changed replay zijn fail-closed.

## 8. Service Improvement

De service-lus is:

`Service Case -> bevoegde review -> allowlisted procesmetadata -> Organizational Observation -> WorkOS Decision -> versioned serviceprocedure -> source ChangeReceipt -> volgende servicecontext -> Recall -> Verification`

De organizational Observation bevat procescode, kanaal, timing en statusvelden die expliciet op de allowlist staan. Ticketinhoud, gesprek, melderidentiteit en medewerkeridentiteit worden niet gekopieerd. De Observation heeft een doelgebonden retentie van 180 dagen. Case en gesprek blijven bij Service onder hun eigen lifecycle.

Delivery gebruikt source-owned outbox, checkpoint en dead-letter. Consumeruitval, replay, changed replay, withdrawal en antwoordverlies veroorzaken geen tweede artifact of tweede change.

## 9. Community/Event

De Living World accessibility/event-slice bewijst:

`Event-scoped vrijwillige feedback -> review -> minimale Observation -> WorkOS Decision -> procedurechange -> volgende eventcontext -> Recall -> Verification`

Eventdeelname blijft werken zonder learningbijdrage. Groepslidmaatschap en langdurige locatiehistorie worden niet toegevoegd. De structurele les gebruikt een afzonderlijk brondocument en claimt niet meer dan de vrijwillige Observation rechtvaardigt.

## 10. Commons

Living World levert de eerste concrete source-owned Commons-release. De release is gebonden aan exact één contribution-versie en legt purpose, audience, reuse, attribution, AI-scope en derivative scope vast. Zonder release blijft de contribution private. Withdrawal maakt toekomstige resolution onmogelijk en bewaart alleen passende historie.

Een generiek platformbreed Commons-contract is bewust niet gebouwd. P12 is `PROVEN_ONE_SOURCE`; een tweede semantisch gelijkwaardige source owner is vereist voordat gedeelde abstractie gerechtvaardigd is.

## 11. Personal naar Structural

De Living World contribution- en Service-reviewflows bewijzen de private-first grens:

`Personal/relationship source -> vrijwillige of bevoegde selectie -> minimization -> nieuw structural artifact -> unlinking -> source-owned change -> later recall`

De structurele les heeft een eigen ID, versie, purpose, audience en retention. De bronidentiteit wordt niet als Lineage-content gekopieerd. Withdrawal of source deletion verhindert toekomstige resolution; de zelfstandig gerechtvaardigde, reeds uitgevoerde bronchange blijft als bronhistorie bestaan zonder de verwijderde persoon opnieuw resolveerbaar te maken.

## 12. Gebouwde en begrensd bewezen prerequisites

| Prerequisite | Resultaat |
|---|---|
| P01 Versioned Source Release | PROVEN_BOUNDED door Library naar Academy |
| P02 Versioned Work Process Target | bestaande bounded proofs in twee WorkOS-flows; brede consumers PHASE |
| P03 Asset Intervention Lifecycle | PHASE; assetauthority, versioning, retention en receipt ontbreken |
| P04 Versioned Service Procedure | PROVEN_BOUNDED door Service Improvement |
| P05 Reviewed Failure Artifact | PHASE; reviewauthority, allowlist, tijdretentie, change target en outbox ontbreken |
| P08 Personal to Structural Release | PROVEN_BOUNDED |
| P11 Event Feedback Release | PROVEN_BOUNDED |
| P12 Version-bound Commons Release | PROVEN_ONE_SOURCE |

P06 Versioned Physical Handoff is na bronhercontrole verworpen. `dom-doos` beheert hardwaretelemetrie en updates, geen fysieke custody-overdracht. Die flow hoort onder P03 en blijft PHASE.

## 13. Bewust niet geïmplementeerde flows

Het source-flowregister bevat naast 8 GO ook 8 PHASE en 8 STOP. Twee belangrijke broncorrecties:

- `service.browser-failure-review` blijft PHASE: de publieke foutteller heeft geen reviewauthority, versioned change target, purpose-retention of source outbox.
- `zaakdoos.device-update-learning` blijft PHASE: doelversie en apparaatmeting bestaan, maar immutable decision context, ChangeReceipt, operation ID, outbox en asset-learningretention ontbreken.

Ruwe logs zijn geen kennis. Een apparaat-self-report is geen onafhankelijke Verification. Deze gaten zijn niet met generieke JSON of TODO-authority gevuld.

## 14. Eligibility en memory classes

Iedere learning eligibility is capability-bound en legt minimaal vast:

- source object en version;
- purpose en lawful basis/consenttype;
- memory class;
- audience en uses;
- minimale velden;
- retention/expiry;
- AI-scopes;
- promotion source en nieuw artifact waar memory class verandert.

Personal, Relationship/Shared, Organizational, Domain/Asset en Commons worden niet stil gepromoveerd. Een memory promotion maakt een afzonderlijk source-issued artifact.

## 15. Retention, unlinking en withdrawal

- geen `forever` als default;
- expired eligibility wordt denied/unknown, niet `false` of verified;
- source deletion maakt Lineage unresolved/source_missing zonder inhoud terug te halen;
- unlinking verwijdert recipient/actor resolution waar de bron dat opdraagt;
- withdrawal blokkeert toekomstig gebruik en Recall;
- superseded changes blijven historisch maar komen expliciet `stale` terug;
- historische Library Editions en geldige curriculumversies blijven immutable auditcontext;
- Lineage existence geeft nooit toestemming om broninhoud te resolven.

## 16. Authority en security

- actoridentiteit is server-derived;
- Decision, definitieve Change, Recall en disposition herbeoordelen actuele authority;
- Library en Academy controleren ieder hun eigen bevoegdheid;
- Service-review vraagt actuele Service-authority;
- WorkOS-change vraagt actuele kennis- en besluitbevoegdheid;
- capability-, tenant-, purpose-, recipient- en versiongrenzen zijn fail-closed;
- service signatures/receipts gebruiken de bestaande RTG service identity en crypto-agility;
- secretscan is groen;
- de Fabricprojectie bevat geen broninhoud, actorref, authorityref of gevoelige operation payload.

## 17. Epistemiek, causaliteit en AI

Cross-domain overdracht bewaart de oorspronkelijke epistemische herkomst. Een user claim wordt geen fact door Library, Academy of WorkOS te passeren. `causalClaim: false` blijft de default. Verification is een nieuwe Observation en mag `unknown`, `conflicting`, `not_checked` of `unavailable` opleveren.

AI-assistance, inference en training zijn afzonderlijke scopes. Training staat standaard dicht. AI-output mag een voorstel zijn, maar geen HUMAN_STATED, AUTHORITY_DECIDED of SOURCE_VERIFIED feit fabriceren.

## 18. Delivery, recovery en replay

Bewezen gedrag:

- duplicate delivery is idempotent;
- same operation ID met andere payload wordt geweigerd;
- crash voor consumerverwerking laat het source event leverbaar;
- crash na verwerking maar voor checkpoint convergeert via replay;
- poison delivery gaat na begrensde pogingen naar zichtbare dead-letter zonder payloadlek;
- langdurige consumeruitval beschadigt de bron niet;
- checkpointcorruptie faalt gesloten;
- source change na verloren antwoord is via replay terugvindbaar;
- Lineage Index kan uit source-issued events worden herbouwd;
- concurrency geeft één semantische change en één replay;
- geen ChangeReceipt wanneer source change faalt;
- geen Verification wanneer de nieuwe waarneming ontbreekt.

## 19. Observability

De operationele Fabricweergave toont losse metingen voor backlog, oudste event, checkpoint/outbox lag, dead letters, replayconflicten, denied recalls, unresolved refs, unknown verification, stale lineage, indexgroei, latency en workerstatus. Zij toont geen Observation-inhoud of melderidentiteit en vormt geen samengestelde health-, trust- of learningscore.

## 20. Performance en schaal

Actuele lokale microbenchmark op Node `v24.18.0`:

| Relaties | Write totaal | Recall p50 | Recall p95/p99 | Serialized/estimate | Heapgroei | Cold start | Rebuild | Binnen 25 MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| 10k | 7,198 ms | 2,585 ms | 3,047 / 3,047 ms | 4.273.351 B | 4.664.288 B | 18,164 ms | 2,917 ms | ja |
| 100k | 59,697 ms | 24,383 ms | 32,350 / 32,350 ms | 43.233.451 B | 45.683.944 B | 225,792 ms | 16,204 ms | nee |
| 1M | 764,392 ms | 504,584 ms | 543,724 / 543,724 ms | 427.335.100 B geschat | 387.896.952 B | niet gedraaid | 263,470 ms | nee |

Delivery op 10k events: 101,181 ms verwerken, circa 98.833 events/s; replay 13,488 ms, circa 741.375 events/s; checkpoint/outbox lag 10.000 naar 0; twee-worker lease en serialize/restart bleven intact.

De 25 MiB-grens blijft hard. De 32 commerce-, mobility- en media/culture-capabilities blijven STOP. Een expliciete keuze voor partition key, bounded Recall-projecties, mass revocation en multi-region consistency is nodig. Er is geen centrale store vergroot of distributed architectuur vooruitgelopen.

## 21. Testresultaten

| Toets | Resultaat |
|---|---|
| Gerichte Fabric- en geraakte domeintests | 151/151 groen |
| Echte HTTP-deurtest | 1/1 groen |
| PostgreSQL race/replay/restart | 1/1 groen met geïsoleerde database |
| Governancegenerators en registers | 21/21 groen in de gerichte governanceset |
| Gerichte mutatieronde | 9/9 tests zakten op bronmutatie |
| Repository mutatiemeter | 2.166 gedood, 0 overleefd, 174 niet meetbaar |
| Scherpe mutatieronde uit register | 1.074 inhoud, 25 alleen inlog |
| Statische huiskeuring | 73/73 regels, `Alles in orde` |
| Secretscan | schoon |
| Schaaltest | 10k, 100k en 1M uitgevoerd |

De 151 tests omvatten Constitution, eligibility, architecture, delivery, lifecycle, operations, routes, Living World, WorkOS, Leerhuis, Library, Service, foutsignalen en Zaakdoos-regressies.

## 22. Repositorybaseline

De brede repositorystatus is niet groen en is niet als Fabricbewijs gepresenteerd:

- `npm test` start niet via de standaardscriptketen omdat `cargo` op deze host ontbreekt;
- een directe `node scripts/test-runner.js` toont bestaande product/registerfailures en sandboxgebonden `listen EPERM`-failures, en is na een lang stilstaand segment afgebroken;
- de afgebroken run is **niet uitgevoerd tot voltooiing** en dus niet groen;
- de mutatie-inventaris telt 5.313 schrijfroutes, waarvan 5.287 geclassificeerd en 26 bestaande legacygaten;
- de geïsoleerde Loop Fabric PostgreSQL-test is wel afzonderlijk werkelijk groen;
- de werkboomwijziging `SUITE.json` van de afgebroken baseline-run is teruggezet.

Nieuwe onverklaarde Loop Fabric-regressies: 0. Opgeloste nieuwe failures: de brede-streep-huisregel en achtergelopen `BEWIJS.md` zijn vóór de definitieve huiskeuring hersteld. Bestaande/hostfailures zijn niet hernoemd tot groen.

## 23. Architecture gates

CI/huiskeuring en gerichte tests bewaken:

- capability zonder classificatie;
- eligibility zonder capability/purpose/version/retention;
- stille memory-class promotion;
- Commons zonder expliciete release;
- AI-training zonder eigen scope;
- gevoelige of verboden capability die toch eligibility uitgeeft;
- Fabric-owned domeinwaarheid of gevoelige projectie-inhoud;
- Change-lineage zonder source-issued receipt;
- Recall zonder live source resolution en actuele authority;
- cross-domain epistemic laundering;
- implicit causal claim;
- changed replay;
- orphaned receipt references;
- nieuwe routes zonder mutatiecontract of bestaande deur.

## 24. Exacte lokale commits

1. `130afd9415f257190575e7e4ec71185411da3d2d` - `feat: enforce RTG learning constitution`
2. `21166e263ab5853ebc7ff59e29dacea615cbf4e6` - `docs: recalculate loop fabric unlock gates`
3. `c24b9a169a11ff81a7c0999fd38a6311e0ef74e5` - `feat: prove edition-bound Library Academy release`
4. `520b2432b227ed68fa699d350c48dc5366946df3` - `feat: require explicit Living World commons release`
5. `7aae311de53a4006260458e0b65fa3a4bc60d859` - `feat: prove minimized service improvement loop`
6. `8a5ebfc156bdd64daae0b54876746bdc1c7cc506` - `feat: enforce capability-bound learning eligibility`
7. `c2261401909f51cc0f65d78b2cf9d483ab7a506b` - `docs: prove loop fabric fixed point`
8. `42f33160a329e97549ec13f2097ebd0ecd3013b6` - `test: record final loop fabric mutation proof`
9. `c0246cf67` - `docs: finalize loop fabric technical fixed point`

De aansluiting op de actuele `main`-basis wordt vastgelegd in de daaropvolgende integratiemerge. De uiteindelijke PR- en merge-identiteit staan in het eindbericht.

## 25. Exact bestandsmanifest

Nieuw:

- `RTG-LEARNING-CONSTITUTION.json`
- `scripts/loop-fabric-constitution.js`
- `server/kern/loop-fabric/constitution.js`
- `server/kern/library/education.js`
- `server/kern/leerhuis/acties-library.js`
- `server/kern/service/loop-source.js`
- `server/kern/service/loop-source-delivery.js`
- `server/routes/service-kantoor-learning.js`
- `test/loop-fabric-constitution.test.js`
- `test/library-academy-release.test.js`
- `test/living-world-commons-release.test.js`
- `test/loop-fabric-service-slice.test.js`
- `RTG-LOOP-FABRIC-FINAL-AFBOUW.md`

Gewijzigd:

- `ARCHITECTUUR.md`, `BEWIJS.md`, `COMMERCE.json`, `FUNCTIES.md`, `GRENZEN.json`
- `LOOP-FABRIC-COVERAGE.json`, `LOOP-FABRIC-DECISION-DOSSIERS.json`, `LOOP-FABRIC-EXECUTION-MATRIX.json`, `LOOP-FABRIC-SOURCE-FLOWS.json`, `LOOP-FABRIC-UNLOCK-ROADMAP.json`
- `MUTATIECONTRACT-AFGELEID.json`, `MUTATIECONTRACT.json`, `MUTATIES.json`, `OBJECTMODEL.json`, `ROUTEBRON.json`, `SYMBOLEN.json`, `VINDBAAR.json`
- `RTG-LOOP-FABRIC-BLOCKER-REDUCTION.md`, `RTG-LOOP-FABRIC-DECISION-DOSSIERS.md`, `package.json`
- `scripts/lib/loop-fabric-decision-policy.js`, `scripts/lib/loop-fabric-execution-policy.js`, `scripts/lib/loop-fabric-prerequisite-policy.js`, `scripts/lib/loop-fabric-source-flow-policy.js`
- `scripts/loop-fabric-coverage.js`, `scripts/loop-fabric-decisions.js`, `scripts/loop-fabric-execution.js`, `scripts/loop-fabric-source-flows.js`, `scripts/loop-fabric-unlock.js`, `scripts/mutatie.js`
- `server/bedrijf/loop-source.js`
- `server/kern/leerhuis/index.js`, `server/kern/leerhuis/loop-source.js`, `server/kern/leerhuis/projectie.js`
- `server/kern/library/index.js`, `server/kern/library/journal.js`, `server/kern/library/loop-source.js`, `server/kern/library/model.js`, `server/kern/library/rights.js`, `server/kern/library/works.js`
- `server/kern/living-world/contributions.js`, `server/kern/living-world/index.js`, `server/kern/living-world/loop-source.js`, `server/kern/living-world/model.js`, `server/kern/living-world/projection.js`
- `server/kern/loop-fabric/decision-context.js`, `server/kern/loop-fabric/index.js`, `server/kern/loop-fabric/invariants.js`, `server/kern/loop-fabric/learning-eligibility.js`
- `server/lib/mutatiecontracten-library.js`, `server/lib/mutatiecontracten-service-kantoor.js`
- `server/lib/mutatiecontracten.js`
- `server/opzet/loop-fabric.js`, `server/opzet/servicelaag.js`
- `server/routes/leerhuis.js`, `server/routes/library.js`, `server/routes/service-kantoor.js`
- `test/lib/living-world-fixture.js`, `test/lib/loop-fabric-fixture.js`
- `test/library-http.test.js`, `test/living-world-http.test.js`, `test/living-world-sources.test.js`, `test/living-world.test.js`
- `test/loop-fabric-decisions.test.js`, `test/loop-fabric-execution.test.js`, `test/loop-fabric-learning-eligibility.test.js`, `test/loop-fabric-source-flows.test.js`, `test/loop-fabric-unlock.test.js`, `test/loop-fabric.test.js`

## 26. Geen verwijderde duplicatie

Er is geen tweede authority-, rights-, evidence-, request-context-, recovery-, crypto- of eventarchitectuur toegevoegd. De implementatie hergebruikt Library Editions/rights/journal, Leerhuis curriculumspoor, WorkOS authority/versioning, Living World contributions, RTG-envelop/service identity, idempotentie, source outboxes, checkpoints en de bestaande Fabric Lineage/Recall-kernel. P06 is verwijderd als foutieve planningsabstractie voordat runtimecode ontstond.

## 27. Resterende schaalblokkades

32 capabilities blijven `BLOCKED_BY_SCALE_ARCHITECTURE`:

- Commerce: partitionering van minimale refs, mass revocation en queryprojectie;
- Mobility: journey/source ownership, ordering, clock semantics en region failover;
- Media/Culture: contentpartities, bounded Recall en withdrawal fanout.

Single-region/multi-worker is bewezen. Actief-actief multi-region, network partitions en conflict resolution zijn niet bewezen.

## 28. Resterende juridische en productblokkades

Juridisch/safety gesloten: D03, D09, D12, D17, D18, D20 en D21. Product/governance open: communicatie, governance, accounts/organizations, onderzoek, commerciële claims, documenten en locatie. Geen van deze beslissingen is door code verzonnen.

De 98 technische prerequisites zijn bovendien capabilityfamilies, geen brede bouwopdracht. Voor iedere nieuwe source owner moet eerst een concreet bronobject, authority, versioning, eligibility, retention, receipt, recovery en verificationpad bestaan.

## 29. Waarom het fixed point is bereikt

De unlockcyclus is herhaald tot de bronhercontrole geen nieuwe zelfstandige GO-flow meer opleverde:

`Registry -> decisions -> prerequisites -> source flows -> runtime -> tests -> mutation -> coverage -> recalculation`

Iedere resterende PHASE- of STOP-flow raakt minimaal één harde stopconditie. De twee kleinste technische kandidaten bleken bij bronlezing niet GO: `dom-foutmelder` mist een verantwoordelijke review/change lifecycle en `dom-doos` was semantisch verkeerd als physical handoff ingedeeld. Verdere runtimecode zou authority, retention, brondoel of schaalkeuze moeten verzinnen. Daarom is er geen veilig technisch werk over zonder een nieuwe beslissing of eerst een nieuwe source-owned capability in het betreffende domein.

## 30. Expliciete eindantwoorden

### 1. Kan iedere technisch en beleidsmatig ontgrendelde RTG-capability nu veilig leren?

**Ja, binnen de bewezen source-flows.** Alle acht flows die alle stoppoorten halen zijn runtime verbonden en getest. Een bounded proof promoveert niet automatisch alle routes of een hele capabilityfamilie.

### 2. Kan RTG aantoonbaar niet leren waar dat verboden of niet toegestaan is?

**Ja.** De vijf verboden, acht niet-leerbare en 51 generiek gevoelige capabilities worden door capability-bound eligibility en Constitution-regels geweigerd. Negatieve tests bewijzen ook indirecte weigering via Commons, AI en cross-domain adapters.

### 3. Welke capabilities kunnen uitsluitend nog worden ontgrendeld door een menselijke, juridische of schaalbeslissing?

**De 84 capabilities in de 14 open dossiers en de 32 schaalgeblokkeerde capabilities.** Daarnaast blijven technische families PHASE totdat hun eigen source owner authority, versioning, retention, receipt, recovery en verification levert; een bestaande bounded proof is daarvoor geen generieke vrijgave.

### 4. Is er nog technisch werk dat veilig kan worden uitgevoerd zonder zo'n nieuwe beslissing?

**Nee.** Binnen de huidige source-owned flows en bewezen 25 MiB-grens is het technische fixed point bereikt. De volgende stap vereist een expliciete domeinbeslissing, juridische validatie, nieuw source-owned contract of bewezen schaalarchitectuur.
