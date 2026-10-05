'use strict';

const prerequisite=(id,title,consumers,values)=>Object.freeze({id,title,consumers:Object.freeze(consumers),...values,
  unlockCount:consumers.length});
const KNOWLEDGE=['leerhuis','dom-les','dom-leerstof','dom-onderwijs','ov-bijles','rtf-leerpaspoort','dom-library','dom-boeken','ov-krant','dom-site','dom-eigendomein'];
const WORK=['kantoorpakket','ondernemersos','office','bedrijf','command-zien','command-doen','command-besturen','zaakregie','zaakregie-beheer','dom-werkplek'];
const ASSET=['wereld','experience-platform','dom-plaats','ov-stad','vastgoed','verzorging','dom-thuis','dom-residentie','dom-home'];
const SERVICE=['gastos','supplier-haccp','supplier-pos','supplier-salon','supplier-rooms','bk-eten'];

const PREREQUISITES=Object.freeze([
  prerequisite('P01_VERSIONED_SOURCE_RELEASE','Versioned Source Release',KNOWLEDGE,{
    sharedSemantics:'Een bron geeft exact object, versie, scope, doel, geldigheid en withdrawalstatus vrij; de consumer kopieert geen bronwaarheid.',
    reuse:['Library Edition/snapshot/rights','Leerhuis knowledge/curriculum versions','Library journal/outbox'],
    counterexample:'Persoonlijke Reader-state en leerlingvoortgang zijn geen content release.',
    implementationScope:'medium: source-local release records en adapters; geen algemene Rights Engine',risk:'rights laundering en oude release op nieuwe versie',
    dependencies:['source authority','source-issued eligibility','durable source event','withdrawal path','consumer-owned versioned target']}),
  prerequisite('P02_VERSIONED_WORK_PROCESS_TARGET','Versioned Work Process Target',WORK,{
    sharedSemantics:'Een organisatorisch procesobject heeft stabiele lijn, immutable versie en bevoegde source change.',
    reuse:['WorkOS workspace.kennis versioning','loop-source-change','workspace audit/outbox'],
    counterexample:'Een personeelsnotitie of gesprek is geen procesobject.',
    implementationScope:'medium/high: per WorkOS-flow een echt procesdoel kiezen; geen generieke JSON-procedure',risk:'werknemerscontext als procesmemory vermommen',
    dependencies:['process owner','current authority','version-bound decision','source receipt','verification occurrence']}),
  prerequisite('P03_ASSET_INTERVENTION_LIFECYCLE','Asset Intervention Lifecycle',ASSET,{
    sharedSemantics:'Issue, diagnose, interventie, assetversie en verificatie blijven bij het asset-/werelddomein en scheiden actor van asset history.',
    reuse:['Living World ObjectRef/versioning','LivingOS source collections','Loop Fabric unlinking/recall policy'],
    counterexample:'Een reiservaring of bewonersdagboek is geen assetinterventie.',
    implementationScope:'high: owner/supplier/resident authority en intervention state machine per assetfamilie',risk:'vorige bewoner of bezoeker lekt via asset recall',
    dependencies:['asset-scoped authority','versioned intervention','source receipt','actor unlinking','recurrence observation']}),
  prerequisite('P04_VERSIONED_SERVICE_PROCEDURE','Versioned Service Procedure',SERVICE,{
    sharedSemantics:'Een bevoegde serviceowner wijzigt een concrete procedureversie en verifieert bij een volgende service-uitvoering.',
    reuse:['WorkOS runbook slice','hospitality source state','Loop delivery/dead-letter'],
    counterexample:'Gastvoorkeuren, werknemersgedrag en marketingprofielen zijn geen procedure.',
    implementationScope:'medium: één HACCP of serviceprocedure als eerste bronobject',risk:'gast-/werknemerinhoud in organizational lesson',
    dependencies:['procedure owner','versioning','minimal operational observation','source outbox/receipt','next-service verification']}),
  prerequisite('P05_REVIEWED_FAILURE_ARTIFACT','Reviewed Failure Artifact',['dom-foutmelder'],{
    sharedSemantics:'Een technische occurrence wordt pas na bevoegde review een minimale operationele les.',
    reuse:['error correlation','WorkOS incident observation','dead-letter metadata'],
    counterexample:'Ruwe logregels en stacktraces zijn geen memory en mogen geen bronpayload lekken.',
    implementationScope:'small: reviewstate, allowlist en link naar source occurrence',risk:'secrets of persoonsgegevens uit logs kopiëren',
    dependencies:['technical owner','review decision','minimization','retention','change target']}),
  prerequisite('P06_VERSIONED_PHYSICAL_HANDOFF','Versioned Physical Handoff State',['dom-doos'],{
    sharedSemantics:'Een fysieke overdracht heeft stabiele objectidentiteit, custody/version, bevoegde overdracht en bevestigde ontvangst.',
    reuse:['ObjectRef','existing commerce handoff state','source-issued receipt pattern'],
    counterexample:'Een betaling of aankoopclaim is geen fysiek custodybewijs.',
    implementationScope:'medium: fysieke state en authority bij beide zijden',risk:'consumer schrijft bronstate of claimt ontvangst namens tegenpartij',
    dependencies:['custody owner','handoff version','dual authority','source receipt','delivery verification']})
]);

const PROTOCOL_GATES=Object.freeze([
  {id:'G01_ELIGIBILITY',consumers:38,reuse:'server/kern/loop-fabric/learning-eligibility.js',rule:'Iedere bron geeft purpose, basis, memory class, fields, audience, uses en retention uit.'},
  {id:'G02_DURABLE_DELIVERY',consumers:38,reuse:'source-owned outbox/checkpoint/dead-letter',rule:'Committed bronstate overleeft consumeruitval en replay.'},
  {id:'G03_SOURCE_RECEIPT',consumers:36,reuse:'ChangeReceipt plus service-receipt',rule:'Alleen de bron van gewijzigde state bevestigt Change.'},
  {id:'G04_CURRENT_AUTHORITY',consumers:38,reuse:'brondomein-authority adapters',rule:'Decision, Change en Recall herbeoordelen actuele authority.'},
  {id:'G05_POLICY_RECALL',consumers:38,reuse:'Loop Fabric Recall Broker',rule:'Recall resolveert live bron, visibility, retention, contest en correction.'},
  {id:'G06_VERIFICATION_OBSERVATION',consumers:38,reuse:'Observation plus verificationOf, causalClaim=false',rule:'Verification is een nieuwe bronwaarneming en geen causale conclusie.'}
]);

const SCALE_DECISIONS=Object.freeze({
  commerce:{component:'Lineage Index en Change Router',reason:'transactie- en catalogusvolume maakt centrale objectmap en globale rebuild onveilig',
    decision:'tenant/domain partition key, queryprojectie en mass revocation',direction:'partitioneer minimale refs; Pay/Commerce blijven source truth'},
  mobility:{component:'Change Router, checkpoints en Recall projection',reason:'journey- en positie-events zijn hoogvolume, out-of-order en regiongevoelig',
    decision:'partition ownership, event ordering, clock semantics en region failover',direction:'batch per journey/source; projecteer alleen semantische outcomes'},
  'media-culture':{component:'Lineage Index en Recall ranking',reason:'mediafanout en interactievolume overschrijden de 25 MiB centrale projectiegrens',
    decision:'content/domain partitions, bounded recall query en withdrawal fanout',direction:'indexeer versiegebonden refs; geen kijktelemetrie of centrale rankingmemory'}
});

function prerequisiteForCapability(id){return PREREQUISITES.find(p=>p.consumers.includes(id))||null;}
module.exports={PREREQUISITES,PROTOCOL_GATES,SCALE_DECISIONS,prerequisiteForCapability};
