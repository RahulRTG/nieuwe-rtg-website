'use strict';
const {dossierForCapability}=require('./loop-fabric-decision-policy');
const constitution=require('../../server/kern/loop-fabric/constitution');

const READINESS=Object.freeze(['READY_TO_IMPLEMENT','NEEDS_TECHNICAL_PREREQUISITE','NEEDS_HUMAN_DECISION',
  'BLOCKED_BY_SCALE_ARCHITECTURE','PROHIBITED','NO_LEARNING_VALUE']);

const BATCHES=Object.freeze({
  B00_FINAL_GUARDS:{name:'Final dispositions en architectuurpoorten',status:'GO',domains:['loop-fabric','platform'],
    dataSchema:'geen runtimewijziging',sharedPrimitive:'geen',crossDomain:'geen',privacy:'bestaande deny- en no-valuepoorten',
    authority:'geen nieuwe authority',recovery:'niet van toepassing',scale:'geen projectiegroei',
    tests:['coverage-registry','architecture-gates']},
  B01_PROVEN_CLOSURE:{name:'Bestaande bewezen slices per flow afbakenen',status:'PHASE',
    domains:['workos','academy','libraryos','living-world','living-lab'],dataSchema:'eerst flowmanifest; geen runtime-opslag',
    sharedPrimitive:'geen nieuwe runtimeprimitive; build-time flowdecompositie',crossDomain:'alleen reeds bewezen refs',
    privacy:'persoonlijke en institutionele subflows apart classificeren',authority:'bestaande bronauthority per flow bewijzen',
    recovery:'bestaande outbox/replay per bewezen flow',scale:'alleen begrensde slices onder 25 MiB',
    tests:['bestaande vier vertical slices','flow-classification-gate']},
  B02_WORK_OPERATIONS:{name:'WorkOS organisatorische processtate',status:'PHASE',domains:['workos'],
    dataSchema:'versioned source targets en duurzame events waar zij ontbreken',sharedPrimitive:'geen',crossDomain:'standaard uit',
    privacy:'employee-surveillancegrens per flow',authority:'actuele werkrol plus doel',recovery:'source-owned outbox vereist',
    scale:'kleine workspace-slice eerst',tests:['authority','tenant isolation','replay','recovery']},
  B03_KNOWLEDGE_DEVELOPMENT:{name:'Library en Academy kennislevenslopen',status:'PHASE',domains:['libraryos','academy'],
    dataSchema:'bestaande Edition/kennisversies; adapters per bronflow',sharedPrimitive:'geen',
    crossDomain:'Library naar Academy vereist afzonderlijke release',privacy:'Reader-state en leerlingstate blijven lokaal',
    authority:'publicatie- en curriculumauthority blijven gescheiden',recovery:'bronspoor/outbox per domein',
    scale:'begrensde slice eerst',tests:['edition immutability','knowledge laundering','revocation']},
  B04_WORLD_ASSET_MEMORY:{name:'Living World en LivingOS asset memory',status:'PHASE',domains:['living-world','livingos'],
    dataSchema:'LivingOS mist intervention/completion/versioned asset target',sharedPrimitive:'geen',
    crossDomain:'bewoner naar asset vereist unlinking',privacy:'vorige bewoner mag niet meereizen',
    authority:'bewoner, eigenaar, leverancier en assetbeheerder onderscheiden',recovery:'source receipt na intervention',
    scale:'objectgebonden slice eerst',tests:['resident unlinking','supplier authority','recurrence verification']},
  B05_SERVICE_OPERATIONS:{name:'Hospitality, service, document- en fysieke overdrachtsprocessen',status:'PHASE',
    domains:['hospitality','service-support','files-documents','physical-commerce'],dataSchema:'versioned process/change target ontbreekt deels',
    sharedPrimitive:'geen',crossDomain:'supportinhoud niet automatisch organizational memory',
    privacy:'gast-, werknemer- en documentinhoud minimaliseren',authority:'procesowner en behandelaar expliciet',
    recovery:'durable source event en receipt vereist',scale:'kleine operationele slice eerst',
    tests:['content minimization','cross-tenant','dead-letter','source offline']},
  B06_HIGH_VOLUME:{name:'Commerce, Mobility en Media',status:'STOP',
    domains:['commerce','mobility','media-culture'],dataSchema:'geen centrale uitbreiding toegestaan',
    sharedPrimitive:'partitionerings- en querycontract vereist vóór brede aansluiting',crossDomain:'uit',
    privacy:'transactie- en journeydata niet profileren',authority:'brondomein blijft beslissen',
    recovery:'region/partition recovery nog niet bewezen',scale:'geblokkeerd door 25 MiB-cap en lineaire recall',
    tests:['partition consistency','mass revocation','cross-region replay']},
  B07_DISCOVERY_AI_NETWORK:{name:'Edge, Saloon en World Network',status:'STOP',domains:['edge-ai','saloon','world-network'],
    dataSchema:'geen inference- of rankinggeheugen zonder besluit',sharedPrimitive:'geen',
    crossDomain:'recommendationcontext vereist expliciet doel',privacy:'profilering en mensscore verboden',
    authority:'AI kan alleen voorstellen',recovery:'geen stille AI-mutaties',scale:'ranking/projectie nog onbeslist',
    tests:['AI provenance','consent withdrawal','no inferred truth']},
  B08_HUMAN_PROGRAMS:{name:'Foundation, Living Lab, Travel, Talent en communities',status:'STOP',
    domains:['foundationos','living-lab','travelos','talent','community-events'],dataSchema:'pas na product/juridisch besluit',
    sharedPrimitive:'geen',crossDomain:'vrijwillige release per overdracht',
    privacy:'kwetsbare mensen, reizen, loopbaan en deelname',authority:'governance per programma ontbreekt deels',
    recovery:'geen artifact zonder geldige grond',scale:'na semantiek opnieuw meten',
    tests:['no-consent-no-disadvantage','private travel isolation','voluntary contribution']},
  B09_REGULATED_PRIVATE:{name:'Identity, Pay, zorg, persoonlijk, communicatie en governance',status:'STOP',
    domains:['identity-organizations','pay','health-care','personal-life','communication','governance'],
    dataSchema:'geen learning-opslag vóór menselijke/juridische beslissing',sharedPrimitive:'geen',
    crossDomain:'standaard verboden',privacy:'bijzondere, financiële en private inhoud',
    authority:'wettelijke en governancegrond niet uit code afleidbaar',recovery:'verwijdering en legal hold conflicten beslissen',
    scale:'niet beoordelen vóór semantiek',tests:['purpose limitation','erasure','legal hold','cross-tenant']}
});

const PARTIAL_HUMAN=new Set(['dom-livinglab']);
const WORK_HUMAN=new Set(['staff','dom-werkvloer','ov-kantoorgesprek','ov-werkmail']);
const FILE_HUMAN=new Set(['dom-bestanden','kern-memo']);
const SERVICE_HUMAN=new Set(['service','stuur']);
const HUMAN_DOMAINS=new Set(['foundationos','living-lab','travelos','talent','community-events','edge-ai','saloon',
  'world-network','identity-organizations','pay','health-care','personal-life','communication','governance']);
const SCALE_DOMAINS=new Set(['commerce','mobility','media-culture']);

function batchFor(row) {
  if (['LOOP_CAPABLE','NO_LEARNING_VALUE','PROHIBITED_FROM_LEARNING'].includes(row.classification)) return 'B00_FINAL_GUARDS';
  if (row.classification==='PARTIALLY_LOOP_CAPABLE') return 'B01_PROVEN_CLOSURE';
  if (row.domain==='workos') return 'B02_WORK_OPERATIONS';
  if (['libraryos','academy'].includes(row.domain)) return 'B03_KNOWLEDGE_DEVELOPMENT';
  if (['living-world','livingos'].includes(row.domain)) return 'B04_WORLD_ASSET_MEMORY';
  if (['hospitality','service-support','files-documents','physical-commerce'].includes(row.domain)) return 'B05_SERVICE_OPERATIONS';
  if (['commerce','mobility','media-culture'].includes(row.domain)) return 'B06_HIGH_VOLUME';
  if (['edge-ai','saloon','world-network'].includes(row.domain)) return 'B07_DISCOVERY_AI_NETWORK';
  if (['foundationos','living-lab','travelos','talent','community-events'].includes(row.domain)) return 'B08_HUMAN_PROGRAMS';
  return 'B09_REGULATED_PRIVATE';
}

function classify(row) {
  const batchId=batchFor(row);
  if (row.classification==='LOOP_CAPABLE') return {readiness:'READY_TO_IMPLEMENT',batchId,
    action:'NONE_ALREADY_PROVEN',reason:'De capability is al door runtime- en hersteltests bewezen.',blockers:[]};
  if (row.classification==='NO_LEARNING_VALUE') return {readiness:'NO_LEARNING_VALUE',batchId,
    action:'KEEP_OUTSIDE_FABRIC',reason:'De capability bezit geen semantische learning lifecycle.',blockers:[]};
  if (row.classification==='PROHIBITED_FROM_LEARNING') return {readiness:'PROHIBITED',batchId,
    action:'ENFORCE_DENY',reason:'De primaire inhoud mag bewust geen learning artifact worden.',blockers:[]};
  const dossier=dossierForCapability(row.id);
  if (dossier&&constitution.RESOLVED_DECISIONS.includes(dossier.id)) return {
    readiness:'NEEDS_TECHNICAL_PREREQUISITE',batchId,decisionDossierId:dossier.id,
    action:'IMPLEMENT_RESOLVED_POLICY_THROUGH_SOURCE_FLOW',
    reason:'De productgrens is besloten; source-owned state, authority, release/retentie en herstel moeten nu per flow worden bewezen.',
    blockers:['source-flow','source-contract','retention-proof','recovery-proof']};
  if (row.classification==='HUMAN_REVIEW_REQUIRED') return {readiness:'NEEDS_HUMAN_DECISION',batchId,
    action:dossier&&constitution.GENERIC_LEARNING_CLOSED.includes(dossier.id)?'ENFORCE_GENERIC_DENY_UNTIL_VALIDATED':'NO_RUNTIME_IMPLEMENTATION',
    reason:dossier&&constitution.GENERIC_LEARNING_CLOSED.includes(dossier.id)
      ?'Generiek learninggebruik is productmatig gesloten; een gespecialiseerde toepassing blijft afhankelijk van afzonderlijke validatie.'
      :'Rechtsgrond, doel, retentie of maatschappelijke keuze kan niet uit code worden afgeleid.',
    blockers:['human-decision','lawful-basis','retention']};
  if (row.classification==='PARTIALLY_LOOP_CAPABLE') {
    if (PARTIAL_HUMAN.has(row.id)) return {readiness:'NEEDS_HUMAN_DECISION',batchId,action:'KEEP_PROVEN_SLICE_ONLY',
      reason:'De bewezen slice blijft geldig; bredere onderzoeksdeelname vereist menselijke governance.',blockers:['human-decision','purpose-scope']};
    return {readiness:'NEEDS_TECHNICAL_PREREQUISITE',batchId,action:'DECOMPOSE_CAPABILITY_INTO_SOURCE_FLOWS',
      reason:'Een flow is bewezen, maar de brede capability mist nog source-flowdecompositie en expliciete eindkeuzes.',
      blockers:['flow-granularity','source-contract-per-flow']};
  }
  if (WORK_HUMAN.has(row.id)||FILE_HUMAN.has(row.id)||SERVICE_HUMAN.has(row.id)||HUMAN_DOMAINS.has(row.domain))
    return {readiness:'NEEDS_HUMAN_DECISION',batchId,action:'NO_RUNTIME_IMPLEMENTATION',
      reason:'De capability mengt persoonlijke of hoog-impact context met operationele state; de toegestane scheiding is niet besloten.',
      blockers:['human-decision','memory-class','purpose-scope']};
  if (SCALE_DOMAINS.has(row.domain)) return {readiness:'BLOCKED_BY_SCALE_ARCHITECTURE',batchId,
    action:'NO_BROAD_RUNTIME_IMPLEMENTATION',reason:'Brede high-volume aansluiting overschrijdt de bewezen centrale projectiegrens.',
    blockers:['partitioning','query-model','mass-revocation','cross-region-recovery']};
  return {readiness:'NEEDS_TECHNICAL_PREREQUISITE',batchId,action:'BUILD_SOURCE_PREREQUISITE_BEFORE_ADAPTER',
    reason:'Learning value is mogelijk, maar een stabiel source-object, versioned change target, durable event of recoverybewijs ontbreekt.',
    blockers:['source-object','versioned-change-target','durable-event','recovery-proof']};
}

module.exports={READINESS,BATCHES,classify};
