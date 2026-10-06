# RTG Loop Fabric Execution Matrix

Datum: 5 oktober 2026

Branch: `codex/libraryos-kernel`

Preflight-HEAD: `df0e9f11cf3be64e8180e79c2cfb63d7ed602b00`

Dit document is de verplichte stop- en faseerpoort vóór verdere codebase-brede runtime-adoptie. De machineleesbare uitkomst staat in `LOOP-FABRIC-EXECUTION-MATRIX.json`. De beslissing per capability staat ook onder `execution` in `LOOP-FABRIC-COVERAGE.json`.

## Preflight

| Onderdeel | Uitkomst |
|---|---|
| Branch en HEAD | `codex/libraryos-kernel`, `df0e9f11c` |
| Werkboom bij start | schoon |
| Coverage Registry | reproduceerbaar, 228/228 capabilities |
| Actuele routes | 5.419 |
| Mutatiecontracten | 5.293 |
| Schermen | 326 |
| Bereikbare kernels | 2.588 |
| Bewezen slices | Living World, WorkOS near-miss, Leerhuis en LibraryOS |
| Gerichte Loop/Library-suite | 80/80 groen op deze preflight |
| Huiskeuring | 73/73 groen op deze preflight |
| Brede Node-baseline | rood: 15.672 tests, 9.513 groen, 6.107 rood, 9 geannuleerd, 43 overgeslagen |
| Volledige `npm test` | host kan pretest niet starten: `cargo` ontbreekt |
| Huidige projectiegrens | 25 MiB |
| 10k Lineage | circa 4,27 MiB, binnen grens |
| 100k Lineage | circa 43,23 MiB, buiten grens |
| Multi-region | niet bewezen |

De brede rode baseline kan niet als acceptatiepoort voor een nieuwe batch dienen zonder een gerichte regressieset. Een nieuwe batch moet daarom haar geraakte domeinen en eigen negatieve tests afzonderlijk groen bewijzen.

## Capability readiness

| Readiness | Aantal | Runtimebetekenis |
|---|---:|---|
| `READY_TO_IMPLEMENT` | 1 | Alleen Loop Fabric zelf; al bewezen, geen nieuwe runtimewijziging nodig. |
| `NEEDS_TECHNICAL_PREREQUISITE` | 38 | Eerst source-object, versioning, durable event, receipt of recoverybewijs. |
| `NEEDS_HUMAN_DECISION` | 144 | Geen runtimelearning vóór product-, governance-, privacy- of juridische keuze. |
| `BLOCKED_BY_SCALE_ARCHITECTURE` | 32 | Geen brede projectie vóór partitionering/query/revocation/recovery bewezen is. |
| `PROHIBITED` | 5 | Deny technisch behouden. |
| `NO_LEARNING_VALUE` | 8 | Buiten de Fabric houden. |

Geen tijdelijke `PARTIALLY_LOOP_CAPABLE` of `NOT_YET_LOOP_CAPABLE` is stil naar `READY_TO_IMPLEMENT` gepromoveerd.

## Korte Execution Matrix

`Prohibited/No value` is in deze tabel de som van beide definitieve eindkeuzes.

| Batch | Capabilities | READY | Prerequisite | Human decision | Prohibited/No value | Scale blocked | Verwachte nieuwe gedeelde primitives | Status |
|---|---:|---:|---:|---:|---:|---:|---|---|
| B00 Final guards | 14 | 1 | 0 | 0 | 13 | 0 | geen | **GO** |
| B01 Proven closure | 5 | 0 | 4 | 1 | 0 | 0 | geen runtimeprimitive; eerst flowdecompositie | **PHASE** |
| B02 Work operations | 13 | 0 | 9 | 4 | 0 | 0 | geen | **PHASE** |
| B03 Knowledge development | 7 | 0 | 7 | 0 | 0 | 0 | geen | **PHASE** |
| B04 World/asset memory | 8 | 0 | 8 | 0 | 0 | 0 | geen | **PHASE** |
| B05 Service operations | 14 | 0 | 10 | 4 | 0 | 0 | geen | **PHASE** |
| B06 High volume | 32 | 0 | 0 | 0 | 0 | 32 | partitionerings- en querycontract | **STOP** |
| B07 Discovery/AI/network | 11 | 0 | 0 | 11 | 0 | 0 | geen | **STOP** |
| B08 Human programs | 38 | 0 | 0 | 38 | 0 | 0 | geen | **STOP** |
| B09 Regulated/private | 86 | 0 | 0 | 86 | 0 | 0 | geen | **STOP** |

`GO` in B00 betekent alleen dat bestaande eindkeuzes en poorten behouden en gecontroleerd mogen worden. Het autoriseert geen nieuwe learning-adapter.

## Blast radius

Dit is het potentieel bereik van de capabilityprefixen, niet een lijst bestanden die een batch mag wijzigen. Overlap tussen batches is mogelijk doordat brede routeprefixen dezelfde kernel kunnen bereiken.

| Batch | Kernmodules | Mutatiecontracten | Routes | Schermen | Data/schema-impact |
|---|---:|---:|---:|---:|---|
| B00 | 2.472 | 59 | 62 | 10 | geen runtimewijziging |
| B01 | 117 | 281 | 281 | 5 | eerst flowmanifest, geen runtime-opslag |
| B02 | 121 | 1.056 | 1.077 | 29 | versioned targets en durable events waar afwezig |
| B03 | 40 | 52 | 52 | 9 | bestaande Editions/kennisversies, adapters per flow |
| B04 | 13 | 93 | 95 | 8 | LivingOS mist intervention/completion/asset target |
| B05 | 31 | 136 | 140 | 20 | versioned process/change targets ontbreken deels |
| B06 | 48 | 527 | 531 | 43 | geen centrale uitbreiding toegestaan |
| B07 | 30 | 134 | 134 | 12 | geen inference- of rankinggeheugen zonder besluit |
| B08 | 117 | 1.102 | 1.131 | 87 | pas na menselijke/product/juridische keuze |
| B09 | 2.495 | 2.071 | 2.093 | 97 | geen learning-opslag vóór grond en purpose |

De uitzonderlijk brede B00- en B09-kernelgrafen komen door capabilityprefixen die grote platformingangen omvatten. Dit is juist een reden om nooit op routeniveau breed te instrumenteren.

## Shared prerequisites

Deze voorwaarden gelden vóór meerdere batches:

1. Brede capabilities moeten eerst worden opgesplitst in source-owned semantische flows. Een capabilitystatus mag geen persoonlijk en organisatorisch pad samen groen verklaren.
2. Iedere uitvoerbare flow heeft een stabiel bronobject en, wanneer Change relevant is, een versioned source-owned change target nodig.
3. Een committed bronmutatie vereist een durable source event/outbox, idempotente receipt en herstelpad.
4. Authority en Learning Eligibility worden bij Decision, Change en Recall opnieuw beoordeeld.
5. High-volume aansluiting wacht op een partitionerings-, query-, mass-revocation- en recoverycontract.

Dit zijn voorwaarden, geen toestemming om één generieke workflow-, memory- of rightsengine te introduceren.

## Independent batches

De volgende batches kunnen na verdere opsplitsing onafhankelijk worden uitgevoerd:

- **B02 Work operations:** uitsluitend organizationele processtate; personeelssignalen blijven buiten de slice.
- **B03 Knowledge development:** Library- en Academy-bronversies; Reader- en leerlingstate blijven lokaal.
- **B04 World/asset memory:** pas na een echte LivingOS intervention lifecycle en assetauthority.
- **B05 Service operations:** één versioned hospitality- of serviceprocedure, zonder gast-, werknemer- of documentinhoud in Lineage.

Geen van deze batches is nu breed `GO`. Iedere batch moet eerst één micro-slice met volledige acceptance gate aanwijzen.

## Decision-bound batches

### B07 Discovery, AI en World Network

Er ontbreekt een productbesluit over recommendation purpose, actuele context, profiling, explainability en withdrawal. AI blijft `PROPOSED` of `INFERRED` en mag geen verified memory produceren.

### B08 Foundation, Living Lab, Travel, Talent en communities

Er ontbreekt per programma een besluit over vrijwilligheid, kwetsbare deelnemers, private travel experience, loopbaanimpact en commons release. Hulp, deelname of kansen mogen niet afhankelijk worden van learning consent.

### B09 Identity, Pay, zorg, persoonlijk, communicatie en governance

Deze batch raakt bijzondere, financiële, private of democratische informatie. Rechtsgrond, purpose limitation, legal hold, wissen en institutionele bevoegdheid zijn niet uit routegedrag afleidbaar.

## Scale-bound batch

### B06 Commerce, Mobility en Media

Deze 32 capabilities zijn high-volume. De huidige Fabric bewaart een centrale objectmap en scant Recall lineair. De 25 MiB-cap wordt vóór 100k relaties geraakt. Een kleine vertical slice kan later semantiek bewijzen, maar brede runtime-aansluiting is `STOP` tot minimaal dit is bewezen:

- tenant/domain partition key;
- queryable minimale Lineage-projectie;
- idempotente cross-partition delivery;
- mass revocation en unlinking;
- rebuild per partition;
- multi-worker ownership;
- expliciete single- of multi-region consistency;
- oude en nieuwe projectie naast elkaar zonder source truth te migreren.

Een grotere centrale JSON-map is geen geldige oplossing.

## Batchbesluiten

### B00 Final guards: GO

Alleen bestaande poorten en definitieve deny/no-valuekeuzes controleren. Geen nieuwe learningdata, schema of adapter.

### B01 Proven closure: PHASE

De vijf brede capabilities bevatten vier bewezen flows en veel onbewezen subflows. Eerst per capability een source-flowregister. `dom-livinglab` blijft decision-bound. De vier andere capabilities mogen hun bewezen slice behouden.

### B02 Work operations: PHASE

Negen capabilities missen technische broncontracten. Vier capabilities raken werknemercontext en vereisen een menselijke beslissing. Eerste eventuele micro-slice mag alleen objectieve processtate gebruiken.

### B03 Knowledge development: PHASE

Technisch het beste vervolg, omdat versioning en authority grotendeels bestaan. Library naar Academy blijft uit tot een expliciete, versioned release en bronstatus zijn gekozen.

### B04 World/asset memory: PHASE

LivingOS heeft nog geen volledige intervention/completion lifecycle of source receipt. Geen runtime-adapter vóór die bronwaarheid bestaat.

### B05 Service operations: PHASE

Een kleine operationele procedure kan later geschikt zijn. Support- en documentinhoud en gast-/werknemerprofielen blijven buiten scope.

### B06 tot en met B09: STOP

Respectievelijk schaalarchitectuur of menselijke/product/juridische beslissingen ontbreken. Geen runtimecode voor deze batches.

## Recommended execution order

1. **B00** behouden als vaste gate.
2. **B01** opsplitsen en alleen de vier bestaande bewezen flows als immutable baseline registreren.
3. **B03** als eerste kandidaat voor een nieuwe micro-slice, omdat versioning en authority al bestaan.
4. **B02**, **B04** en **B05** onafhankelijk, elk met één source-owned micro-slice.
5. **B06** pas na een afzonderlijk schaalarchitectuurbesluit en migratieproef.
6. **B07**, **B08** en **B09** pas na expliciete menselijke beslissingen per flow.

Deze volgorde is gebaseerd op afhankelijkheden en risico. Zij is geen verplicht alfabetisch uitvoerplan.

## Eerstvolgende mogelijke micro-slice

De veiligste kandidaat is binnen **B03**, maar nog niet automatisch `GO`:

```text
Library Edition
  -> expliciete, versioned release voor onderwijsgebruik
  -> Academy ontvangt alleen source ref + edition/version + releasebewijs
  -> bevoegde curriculumowner beslist
  -> Academy maakt eigen curriculumversie
  -> Academy geeft eigen ChangeReceipt uit
  -> Recall resolveert beide bronnen opnieuw
```

`RightsGrant` kent al de afzonderlijke actie `education`, maar de huidige applicability-check is alleen voor `publish` met purpose `publication`. Er bestaat dus nog geen bewezen onderwijsrelease, ontvangerauthority of withdrawal-consumerpad. De slice mag pas `GO` worden wanneer die semantiek uit bestaand beleid volgt en edition-bound getest kan worden. Anders wordt ook deze micro-slice `STOP`.

## Conclusie van de poort

De gevraagde brede implementatie is nu **PHASE**, niet `GO`.

- 14 capabilities hebben al een definitieve eindkeuze: 1 bewezen, 5 verboden en 8 zonder learning value.
- 38 capabilities vragen eerst een technische bronprerequisite.
- 144 capabilities vragen een menselijke, product-, governance-, privacy- of juridische beslissing.
- 32 capabilities zijn voor brede aansluiting schaalgeblokkeerd.

Er is momenteel geen nieuwe brede runtimebatch die alle acceptance-fasen veilig doorloopt. Daarom eindigt deze preflight zonder nieuwe learning-adapter, centrale opslag of impliciete toestemming.
