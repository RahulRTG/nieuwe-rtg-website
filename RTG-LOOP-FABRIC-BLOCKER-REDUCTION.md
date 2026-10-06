# RTG Loop Fabric Blocker Reduction

Datum: 6 oktober 2026

Deze fase reduceert blockers. Zij geeft geen brede runtimegoedkeuring en bevat geen nieuwe learning-adapter.

## Source-owned flows

Het flowregister bevat 24 bronflows: 8 GO, 8 PHASE en 8 STOP.

Nieuw GO: 3. Geïmplementeerde en bewezen GO-flows: `experience.living-world-contribution`, `experience.living-world-commons-release`, `academy.practice-to-knowledge`, `workos.accessibility-procedure`, `workos.near-miss-runbook`, `service.process-improvement`, `library.feedback-to-edition`, `library-edition-to-academy`.

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
| P08_PERSONAL_STRUCTURAL_RELEASE Personal to Structural Release | 13 | medium: één vrijwillige bronflow plus unlink/delete/revoke proof; PROVEN_BOUNDED | heridentificatie via provenance of te rijke lesson |
| P01_VERSIONED_SOURCE_RELEASE Versioned Source Release | 11 | medium: source-local release records en adapters; geen algemene Rights Engine; PROVEN_BOUNDED | rights laundering en oude release op nieuwe versie |
| P07_WORKFORCE_PROCESS_SEPARATION Workforce Process Separation | 11 | high: source-flowdecompositie vóór één objectieve proces-slice; PHASE | surveillancegeheugen vermomd als procesverbetering |
| P11_EVENT_FEEDBACK_RELEASE Event Feedback Release | 11 | medium: één versioned eventprocedure met no-disadvantage test; PROVEN_BOUNDED | social graph of langdurige locatiehistorie ontstaat indirect |
| P02_VERSIONED_WORK_PROCESS_TARGET Versioned Work Process Target | 10 | medium/high: per WorkOS-flow een echt procesdoel kiezen; geen generieke JSON-procedure; PHASE | werknemerscontext als procesmemory vermommen |
| P03_ASSET_INTERVENTION_LIFECYCLE Asset Intervention Lifecycle | 10 | high: owner/supplier/resident authority en intervention state machine per assetfamilie; PHASE | vorige bewoner of bezoeker lekt via asset recall |
| P04_VERSIONED_SERVICE_PROCEDURE Versioned Service Procedure | 7 | medium: één HACCP of serviceprocedure als eerste bronobject; PROVEN_BOUNDED | gast-/werknemerinhoud in organizational lesson |
| P09_TRAVEL_STRUCTURAL_LESSON Travel Structural Lesson | 7 | high: eerst één verstorings- of toegankelijkheidsflow; PHASE | reizigersprofiel en locatiehistorie lekken |
| P12_VERSION_BOUND_COMMONS_RELEASE Version-bound Commons Release | 6 | medium: klein source-local contract met twee concrete release-eigenaren; PROVEN_ONE_SOURCE | impliciete publicatie en epistemic laundering |
| P13_AI_PURPOSE_SCOPE AI Purpose Scope | 6 | medium: adapters per AI-entrypoint; training default deny; PHASE | inference wordt feit of toegestane context wordt voor training hergebruikt |
| P10_FOUNDATION_VOLUNTARY_LESSON Foundation Voluntary Lesson | 5 | medium/high: no-disadvantage gate plus één vrijwillige projectles; PHASE | dwang door machtsasymmetrie |
| P05_REVIEWED_FAILURE_ARTIFACT Reviewed Failure Artifact | 1 | small: reviewstate, allowlist en link naar source occurrence; PHASE | secrets of persoonsgegevens uit logs kopiëren |

### Verworpen prerequisite-hypothese

- **P06_VERSIONED_PHYSICAL_HANDOFF:** dom-doos is hardwaretelemetrie en updatebeheer, geen fysieke custody-overdracht. De eerdere naamgebaseerde indeling was semantisch onjuist. Correctie: P03_ASSET_INTERVENTION_LIFECYCLE.

### Gedeelde bestaande poorten

- **G01_ELIGIBILITY:** Iedere bron geeft purpose, basis, memory class, fields, audience, uses en retention uit. Hergebruik: server/kern/loop-fabric/learning-eligibility.js.
- **G02_DURABLE_DELIVERY:** Committed bronstate overleeft consumeruitval en replay. Hergebruik: source-owned outbox/checkpoint/dead-letter.
- **G03_SOURCE_RECEIPT:** Alleen de bron van gewijzigde state bevestigt Change. Hergebruik: ChangeReceipt plus service-receipt.
- **G04_CURRENT_AUTHORITY:** Decision, Change en Recall herbeoordelen actuele authority. Hergebruik: brondomein-authority adapters.
- **G05_POLICY_RECALL:** Recall resolveert live bron, visibility, retention, contest en correction. Hergebruik: Loop Fabric Recall Broker.
- **G06_VERIFICATION_OBSERVATION:** Verification is een nieuwe bronwaarneming en geen causale conclusie. Hergebruik: Observation plus verificationOf, causalClaim=false.

## Unlock Roadmap

1. **P08_PERSONAL_STRUCTURAL_RELEASE — PROVEN_BOUNDED**
   Semantiek: Een vrijwillige persoonlijke bijdrage maakt na minimization en unlinking een nieuw structureel artifact; de private bron wordt niet gekopieerd.
   Capabilities: `rechterhand`, `neiging`, `privekantoor`, `life`, `doelen`, `dagmetingen`, `gemoed`, `gewoonten`, `training`, `tijdlijn`, `voeding`, `rust`, `ov-spar`
   Bewijs: `experience.living-world-contribution`, `service.process-improvement`
   Volgende grens: Iedere nieuwe bron vereist eigen vrijwilligheid, minimization en unlinkingbewijs.

2. **P01_VERSIONED_SOURCE_RELEASE — PROVEN_BOUNDED**
   Semantiek: Een bron geeft exact object, versie, scope, doel, geldigheid en withdrawalstatus vrij; de consumer kopieert geen bronwaarheid.
   Capabilities: `leerhuis`, `dom-les`, `dom-leerstof`, `dom-onderwijs`, `ov-bijles`, `rtf-leerpaspoort`, `dom-library`, `dom-boeken`, `ov-krant`, `dom-site`, `dom-eigendomein`
   Bewijs: `library-edition-to-academy`
   Volgende grens: Nieuwe source owners blijven PHASE tot hun eigen versioned release en withdrawal zijn bewezen.

3. **P07_WORKFORCE_PROCESS_SEPARATION — PHASE**
   Semantiek: Alleen versioned processtate kan organizational learning voeden; menselijke prestatie, communicatie en loopbaan blijven afzonderlijk en private-first.
   Capabilities: `staff`, `dom-werkvloer`, `ov-kantoorgesprek`, `ov-werkmail`, `member-werk`, `carriereledger`, `supplier-apply`, `werving`, `vakbewijs`, `dom-metier`, `dom-vak`
   Bewijs: geen volledige source-slice
   Volgende grens: Decomposeer eerst processtate en menselijke context; LC07 blokkeert persoonsgerichte organizational memory.

4. **P11_EVENT_FEEDBACK_RELEASE — PROVEN_BOUNDED**
   Semantiek: Vrijwillige feedback is event- en purpose-bound en wordt pas na review/minimization een structurele eventles.
   Capabilities: `ontmoetingen`, `social`, `rtf-contacten`, `tickets`, `supplier-events`, `dom-agenda`, `dom-meet`, `bk-tickets`, `fs-terrein`, `fs-werk`, `fs-gast`
   Bewijs: `experience.living-world-contribution`, `workos.accessibility-procedure`
   Volgende grens: Andere event owners blijven PHASE tot hun eigen source version en no-disadvantage pad bestaan.

5. **P02_VERSIONED_WORK_PROCESS_TARGET — PHASE**
   Semantiek: Een organisatorisch procesobject heeft stabiele lijn, immutable versie en bevoegde source change.
   Capabilities: `kantoorpakket`, `ondernemersos`, `office`, `bedrijf`, `command-zien`, `command-doen`, `command-besturen`, `zaakregie`, `zaakregie-beheer`, `dom-werkplek`
   Bewijs: `workos.accessibility-procedure`, `workos.near-miss-runbook`
   Volgende grens: Kies per capability eerst een concreet, niet-persoonsgebonden procesobject.

6. **P03_ASSET_INTERVENTION_LIFECYCLE — PHASE**
   Semantiek: Issue, diagnose, interventie, assetversie en verificatie blijven bij het asset-/werelddomein en scheiden actor van asset history.
   Capabilities: `wereld`, `experience-platform`, `dom-plaats`, `ov-stad`, `vastgoed`, `verzorging`, `dom-thuis`, `dom-residentie`, `dom-home`, `dom-doos`
   Bewijs: geen volledige source-slice
   Volgende grens: Asset authority, intervention versioning, retention en source receipt ontbreken; dom-doos is hier correct ondergebracht.

7. **P04_VERSIONED_SERVICE_PROCEDURE — PROVEN_BOUNDED**
   Semantiek: Een bevoegde serviceowner wijzigt een concrete procedureversie en verifieert bij een volgende service-uitvoering.
   Capabilities: `gastos`, `supplier-haccp`, `supplier-pos`, `supplier-salon`, `supplier-rooms`, `bk-eten`, `service`
   Bewijs: `service.process-improvement`
   Volgende grens: Hospitality- en leveranciersprocedures blijven source-specifiek PHASE.

8. **P09_TRAVEL_STRUCTURAL_LESSON — PHASE**
   Semantiek: Triprecall blijft Personal; alleen vrijwillig vrijgegeven, geminimaliseerde reisuitkomsten worden losgekoppelde structurele lessons.
   Capabilities: `avondos`, `arrival`, `instantreality`, `dom-reisbureau`, `bk-reizen`, `bk-verblijf`, `bk-reiswijzer`
   Bewijs: geen volledige source-slice
   Volgende grens: Nog geen begrensde vrijwillige tripbron met locatie-minimization en toekomstig recallcontract.

9. **P12_VERSION_BOUND_COMMONS_RELEASE — PROVEN_ONE_SOURCE**
   Semantiek: De source owner geeft object/versie, doel, audience, reuse, attribution, AI- en derivative scope expliciet vrij en kan withdraw/supersede uitgeven.
   Capabilities: `zakelijk`, `socialewereld`, `connect`, `dom-genootschap`, `salon`, `kern-waardering`
   Bewijs: `experience.living-world-commons-release`
   Volgende grens: Geen generiek platformcontract zonder tweede semantisch gelijkwaardige source owner.

10. **P13_AI_PURPOSE_SCOPE — PHASE**
   Semantiek: Assistance, inference en training zijn afzonderlijke source-issued uses; AI-output behoudt epistemische herkomst en mutatieauthority.
   Capabilities: `oog`, `ghost`, `knelpunt`, `kern-rahul`, `ov-aandacht`, `stuur`
   Bewijs: geen volledige source-slice
   Volgende grens: Training blijft constitutioneel deny; adapters wachten op concrete source-owned AI-use contracts.

11. **P10_FOUNDATION_VOLUNTARY_LESSON — PHASE**
   Semantiek: Hulp en vrijwillige ervaringsbijdrage zijn afzonderlijke lifecycles; weigering heeft aantoonbaar geen behandel- of kansnadeel.
   Capabilities: `levenos`, `rugdekking`, `werk-rtf`, `dom-rtfkantoor`, `dom-rtfos`
   Bewijs: geen volledige source-slice
   Volgende grens: Nog geen source-flow die no-disadvantage, withdrawal en organizational decision gezamenlijk bewijst.

12. **P05_REVIEWED_FAILURE_ARTIFACT — PHASE**
   Semantiek: Een technische occurrence wordt pas na bevoegde review een minimale operationele les.
   Capabilities: `dom-foutmelder`
   Bewijs: geen volledige source-slice
   Volgende grens: Technische reviewauthority, allowlist, tijdretentie, versioned change target en source outbox ontbreken.

## Technisch fixed point

**Bereikt: ja.** Alle acht source-flows die zelfstandig alle stoppoorten halen zijn geïmplementeerd. Iedere resterende flow mist source-specifieke authority, retention, versioning/receipt/recovery, een menselijke of juridische beslissing, of bewezen schaalarchitectuur.

Veilig uitvoerbaar technisch werk zonder nieuwe beslissing: **nee**.

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

De begrensde proofs voor D23, D15, D11, D13 en D01 zijn uitgevoerd. Brede capabilityfamilies worden daardoor niet automatisch GO: iedere nieuwe source owner moet dezelfde stoppoorten zelfstandig bewijzen.

