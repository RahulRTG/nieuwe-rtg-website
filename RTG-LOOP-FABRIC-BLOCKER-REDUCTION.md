# RTG Loop Fabric Blocker Reduction

Datum: 5 oktober 2026

Deze fase reduceert blockers. Zij geeft geen brede runtimegoedkeuring en bevat geen nieuwe learning-adapter.

## B01 source-owned flows

B01 bevat 21 bronflows: 7 GO, 6 PHASE en 8 STOP.

Nieuw GO: 2. Geïmplementeerde en bewezen GO-flows: `experience.living-world-contribution`, `experience.living-world-commons-release`, `academy.practice-to-knowledge`, `workos.accessibility-procedure`, `workos.near-miss-runbook`, `library.feedback-to-edition`, `library-edition-to-academy`.

De volledige velden per flow staan in `LOOP-FABRIC-SOURCE-FLOWS.json`.

## Menselijke beslissingen

84 blockers zijn exact eenmaal verdeeld over 22 beslisfamilies.

| Rang | Dossier | Unlock | Type |
|---:|---|---:|---|
| 1 | D01_PERSONAL_MEMORY Persoonlijke levenscontext | 13 | PRIVACY_POLICY |
| 2 | D06_WORKFORCE_DEVELOPMENT Werknemers-, talent- en loopbaancontext | 11 | MIXED |
| 3 | D11_COMMUNITY_EVENTS Community-, event- en groepsdeelname | 11 | PRIVACY_POLICY |
| 4 | D07_TRAVEL_EXPERIENCE Reiservaring en toekomstige reisrecall | 7 | MIXED |
| 5 | D13_DISCOVERY_COMMONS Saloon, sociaal/professioneel netwerk en Commons | 6 | PRODUCT_POLICY |

Alle opties, defaults, gevolgen en Constitution-kandidaatregels staan in `RTG-LOOP-FABRIC-DECISION-DOSSIERS.md`.

## Technische prerequisite graph

De 98 technische capabilities hebben ieder precies één primaire bronprerequisite. De protocolpoorten eronder worden hergebruikt; zij zijn geen nieuwe engines.

| Prerequisite | Consumers | Omvang | Risico |
|---|---:|---|---|
| P08_PERSONAL_STRUCTURAL_RELEASE Personal to Structural Release | 13 | medium: één vrijwillige bronflow plus unlink/delete/revoke proof | heridentificatie via provenance of te rijke lesson |
| P01_VERSIONED_SOURCE_RELEASE Versioned Source Release | 11 | medium: source-local release records en adapters; geen algemene Rights Engine | rights laundering en oude release op nieuwe versie |
| P07_WORKFORCE_PROCESS_SEPARATION Workforce Process Separation | 11 | high: source-flowdecompositie vóór één objectieve proces-slice | surveillancegeheugen vermomd als procesverbetering |
| P11_EVENT_FEEDBACK_RELEASE Event Feedback Release | 11 | medium: één versioned eventprocedure met no-disadvantage test | social graph of langdurige locatiehistorie ontstaat indirect |
| P02_VERSIONED_WORK_PROCESS_TARGET Versioned Work Process Target | 10 | medium/high: per WorkOS-flow een echt procesdoel kiezen; geen generieke JSON-procedure | werknemerscontext als procesmemory vermommen |
| P03_ASSET_INTERVENTION_LIFECYCLE Asset Intervention Lifecycle | 9 | high: owner/supplier/resident authority en intervention state machine per assetfamilie | vorige bewoner of bezoeker lekt via asset recall |
| P04_VERSIONED_SERVICE_PROCEDURE Versioned Service Procedure | 7 | medium: één HACCP of serviceprocedure als eerste bronobject | gast-/werknemerinhoud in organizational lesson |
| P09_TRAVEL_STRUCTURAL_LESSON Travel Structural Lesson | 7 | high: eerst één verstorings- of toegankelijkheidsflow | reizigersprofiel en locatiehistorie lekken |
| P12_VERSION_BOUND_COMMONS_RELEASE Version-bound Commons Release | 6 | medium: klein source-local contract met twee concrete release-eigenaren | impliciete publicatie en epistemic laundering |
| P13_AI_PURPOSE_SCOPE AI Purpose Scope | 6 | medium: adapters per AI-entrypoint; training default deny | inference wordt feit of toegestane context wordt voor training hergebruikt |
| P10_FOUNDATION_VOLUNTARY_LESSON Foundation Voluntary Lesson | 5 | medium/high: no-disadvantage gate plus één vrijwillige projectles | dwang door machtsasymmetrie |
| P05_REVIEWED_FAILURE_ARTIFACT Reviewed Failure Artifact | 1 | small: reviewstate, allowlist en link naar source occurrence | secrets of persoonsgegevens uit logs kopiëren |
| P06_VERSIONED_PHYSICAL_HANDOFF Versioned Physical Handoff State | 1 | medium: fysieke state en authority bij beide zijden | consumer schrijft bronstate of claimt ontvangst namens tegenpartij |

### Gedeelde bestaande poorten

- **G01_ELIGIBILITY:** Iedere bron geeft purpose, basis, memory class, fields, audience, uses en retention uit. Hergebruik: server/kern/loop-fabric/learning-eligibility.js.
- **G02_DURABLE_DELIVERY:** Committed bronstate overleeft consumeruitval en replay. Hergebruik: source-owned outbox/checkpoint/dead-letter.
- **G03_SOURCE_RECEIPT:** Alleen de bron van gewijzigde state bevestigt Change. Hergebruik: ChangeReceipt plus service-receipt.
- **G04_CURRENT_AUTHORITY:** Decision, Change en Recall herbeoordelen actuele authority. Hergebruik: brondomein-authority adapters.
- **G05_POLICY_RECALL:** Recall resolveert live bron, visibility, retention, contest en correction. Hergebruik: Loop Fabric Recall Broker.
- **G06_VERIFICATION_OBSERVATION:** Verification is een nieuwe bronwaarneming en geen causale conclusie. Hergebruik: Observation plus verificationOf, causalClaim=false.

## Unlock Roadmap

1. **Bouw P01_VERSIONED_SOURCE_RELEASE voor goedgekeurd D23**
   Waarom: begrensde, versiegebonden en goed testbare cross-domain semantiek
   Ontgrendelt: `dom-library`, `leerhuis`
   Bewijsslice: V01 Library Edition X -> interne Academy curriculumversie

2. **Bewijs P04_VERSIONED_SERVICE_PROCEDURE op één serviceprocedure**
   Waarom: D15 begrenst de inhoud; procesmetadata kan zonder klantprofiel leren
   Ontgrendelt: `service`, `supplier-haccp`
   Bewijsslice: V02 bottleneck -> procedureversie -> volgende service verification

3. **Bouw P11_EVENT_FEEDBACK_RELEASE op één eventflow**
   Waarom: D11 bepaalt eventscope, no-disadvantage, review en unlinking
   Ontgrendelt: `ontmoetingen`, `tickets`, `supplier-events`
   Bewijsslice: V03 eventfeedback -> geminimaliseerde les -> volgende event verification

4. **Bouw P08_PERSONAL_STRUCTURAL_RELEASE**
   Waarom: D01 levert de generieke private-first grens voor één vrijwillige promotieslice
   Ontgrendelt: `één begrensde persoonlijke contribution-flow`
   Bewijsslice: V04 personal observation -> unlinked structural lesson

5. **Bouw P12_VERSION_BOUND_COMMONS_RELEASE met twee source owners**
   Waarom: D13 is besloten maar vereist source-local release en withdrawal
   Ontgrendelt: `één Saloon- en één World Network-release`
   Bewijsslice: V05 exact object/version -> Commons -> withdrawal

6. **P02_VERSIONED_WORK_PROCESS_TARGET per objectieve procesflow**
   Waarom: grote technische leverage, maar employee-bound subflows blijven uitgesloten
   Ontgrendelt: `kantoorpakket`, `ondernemersos`, `office`, `command-zien`, `command-doen`, `command-besturen`, `zaakregie`, `zaakregie-beheer`, `dom-werkplek`
   Bewijsslice: V06 project outcome -> process version -> next-project recall

7. **P03_ASSET_INTERVENTION_LIFECYCLE na assetauthoritybesluit**
   Waarom: maakt onderhoudsgeheugen mogelijk zonder bewonersgeschiedenis
   Ontgrendelt: `vastgoed`, `dom-thuis`, `dom-residentie`, `dom-home`
   Bewijsslice: V07 issue -> intervention -> recurrence observation

## Schaalblok

Alle 32 capabilities blijven **STOP**.

| Domein | Capabilities | Fabric-blocker | Benodigde beslissing | Richting |
|---|---:|---|---|---|
| commerce | 11 | Lineage Index en Change Router: transactie- en catalogusvolume maakt centrale objectmap en globale rebuild onveilig | tenant/domain partition key, queryprojectie en mass revocation | partitioneer minimale refs; Pay/Commerce blijven source truth |
| mobility | 12 | Change Router, checkpoints en Recall projection: journey- en positie-events zijn hoogvolume, out-of-order en regiongevoelig | partition ownership, event ordering, clock semantics en region failover | batch per journey/source; projecteer alleen semantische outcomes |
| media-culture | 9 | Lineage Index en Recall ranking: mediafanout en interactievolume overschrijden de 25 MiB centrale projectiegrens | content/domain partitions, bounded recall query en withdrawal fanout | indexeer versiegebonden refs; geen kijktelemetrie of centrale rankingmemory |

Geen van deze schaalblockers is gebruikt om een centrale store, grotere in-memory map of distributed runtime te bouwen.

## Implementatiebesluit

De productbesluiten verplaatsen capabilities naar technische prerequisites, niet rechtstreeks naar GO. Iedere flow blijft dicht totdat zijn broncontract en verticale bewijsslice groen zijn.

De eerste veilige technische proof is de goedgekeurde D23 Library Education Release.

