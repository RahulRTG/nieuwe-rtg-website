# RTG Loop Fabric Blocker Reduction

Datum: 5 oktober 2026

Deze fase reduceert blockers. Zij geeft geen brede runtimegoedkeuring en bevat geen nieuwe learning-adapter.

## B01 source-owned flows

B01 bevat 20 bronflows: 5 GO, 6 PHASE en 9 STOP.

Nieuw GO: 0. De GO-flows waren al geïmplementeerd en bewezen: `experience.living-world-contribution`, `academy.practice-to-knowledge`, `workos.accessibility-procedure`, `workos.near-miss-runbook`, `library.feedback-to-edition`.

De volledige velden per flow staan in `LOOP-FABRIC-SOURCE-FLOWS.json`.

## Menselijke beslissingen

144 blockers zijn exact eenmaal verdeeld over 22 beslisfamilies.

| Rang | Dossier | Unlock | Type |
|---:|---|---:|---|
| 1 | D20_PAYMENT_OPERATIONS Betaaluitvoering en financieel bronspoor | 21 | LEGAL_VALIDATION_REQUIRED |
| 2 | D01_PERSONAL_MEMORY Persoonlijke levenscontext | 13 | PRIVACY_POLICY |
| 3 | D06_WORKFORCE_DEVELOPMENT Werknemers-, talent- en loopbaancontext | 11 | MIXED |
| 4 | D11_COMMUNITY_EVENTS Community-, event- en groepsdeelname | 11 | PRIVACY_POLICY |
| 5 | D17_SECURITY_CREDENTIALS Credentials, toegang en veiligheidscontext | 11 | LEGAL_VALIDATION_REQUIRED |

Alle opties, defaults, gevolgen en Constitution-kandidaatregels staan in `RTG-LOOP-FABRIC-DECISION-DOSSIERS.md`.

## Technische prerequisite graph

De 38 technische capabilities hebben ieder precies één primaire bronprerequisite. De protocolpoorten eronder worden hergebruikt; zij zijn geen nieuwe engines.

| Prerequisite | Consumers | Omvang | Risico |
|---|---:|---|---|
| P01_VERSIONED_SOURCE_RELEASE Versioned Source Release | 11 | medium: source-local release records en adapters; geen algemene Rights Engine | rights laundering en oude release op nieuwe versie |
| P02_VERSIONED_WORK_PROCESS_TARGET Versioned Work Process Target | 10 | medium/high: per WorkOS-flow een echt procesdoel kiezen; geen generieke JSON-procedure | werknemerscontext als procesmemory vermommen |
| P03_ASSET_INTERVENTION_LIFECYCLE Asset Intervention Lifecycle | 9 | high: owner/supplier/resident authority en intervention state machine per assetfamilie | vorige bewoner of bezoeker lekt via asset recall |
| P04_VERSIONED_SERVICE_PROCEDURE Versioned Service Procedure | 6 | medium: één HACCP of serviceprocedure als eerste bronobject | gast-/werknemerinhoud in organizational lesson |
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

1. **Besluit D23_LIBRARY_EDUCATION_RELEASE**  
   Waarom: begrensde, versiegebonden en goed testbare cross-domain semantiek  
   Ontgrendelt: `P01_VERSIONED_SOURCE_RELEASE`  
   Bewijsslice: V01 Library Edition X -> interne Academy curriculumversie

2. **Bewijs P04_VERSIONED_SERVICE_PROCEDURE op één HACCP-procedure**  
   Waarom: operationele state zonder gastprofiel en hergebruik van WorkOS runbookpatroon  
   Ontgrendelt: `supplier-haccp`  
   Bewijsslice: V02 bottleneck -> procedureversie -> volgende service verification

3. **Besluit D15_SERVICE_IMPROVEMENT**  
   Waarom: maakt grens tussen ticketinhoud en structurele procesles expliciet  
   Ontgrendelt: `service`  
   Bewijsslice: V03 geminimaliseerde supportles met return path

4. **Bouw P05_REVIEWED_FAILURE_ARTIFACT**  
   Waarom: kleinste technische occurrence-to-learning promotie  
   Ontgrendelt: `dom-foutmelder`  
   Bewijsslice: V04 browserfailure -> review -> runbookchange -> verification

5. **Besluit D11_COMMUNITY_EVENTS en pas daarna één eventflow**  
   Waarom: hoge productwaarde maar deelnemerprivacy moet eerst zijn besloten  
   Ontgrendelt: `ontmoetingen`, `tickets`, `supplier-events`, `dom-agenda`, `dom-meet`, `bk-tickets`, `fs-terrein`, `fs-werk`, `fs-gast`  
   Bewijsslice: V05 eventprocedure zonder deelnemersprofiel

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

Er is geen nieuwe B01-flow GO geworden. Daarom is in deze fase geen runtimecode gebouwd. De vijf GO-sourceflows waren reeds bewezen; PHASE- en STOP-flows blijven dicht.

De eerstvolgende productbeslissing met een veilige technische proof is D23 Library Education Release. Zonder dat besluit blijft ook die overdracht gesloten.

