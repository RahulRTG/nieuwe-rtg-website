'use strict';

const prerequisite=(id,title,consumers,values)=>Object.freeze({id,title,consumers:Object.freeze(consumers),...values,
  unlockCount:consumers.length});
const KNOWLEDGE=['leerhuis','dom-les','dom-leerstof','dom-onderwijs','ov-bijles','rtf-leerpaspoort','dom-library','dom-boeken','ov-krant','dom-site','dom-eigendomein'];
const WORK=['kantoorpakket','ondernemersos','office','bedrijf','command-zien','command-doen','command-besturen','zaakregie','zaakregie-beheer','dom-werkplek'];
const ASSET=['wereld','experience-platform','dom-plaats','ov-stad','vastgoed','verzorging','dom-thuis','dom-residentie','dom-home','dom-doos'];
const SERVICE=['gastos','supplier-haccp','supplier-pos','supplier-salon','supplier-rooms','bk-eten'];
const PERSONAL=['rechterhand','neiging','privekantoor','life','doelen','dagmetingen','gemoed','gewoonten','training','tijdlijn','voeding','rust','ov-spar'];
const WORKFORCE=['staff','dom-werkvloer','ov-kantoorgesprek','ov-werkmail','member-werk','carriereledger','supplier-apply','werving','vakbewijs','dom-metier','dom-vak'];
const TRAVEL=['avondos','arrival','instantreality','dom-reisbureau','bk-reizen','bk-verblijf','bk-reiswijzer'];
const FOUNDATION=['levenos','rugdekking','werk-rtf','dom-rtfkantoor','dom-rtfos'];
const EVENTS=['ontmoetingen','social','rtf-contacten','tickets','supplier-events','dom-agenda','dom-meet','bk-tickets','fs-terrein','fs-werk','fs-gast'];
const COMMONS=['zakelijk','socialewereld','connect','dom-genootschap','salon','kern-waardering'];
const AI=['oog','ghost','knelpunt','kern-rahul','ov-aandacht','stuur'];

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
  prerequisite('P04_VERSIONED_SERVICE_PROCEDURE','Versioned Service Procedure',SERVICE.concat(['service']),{
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
  prerequisite('P07_WORKFORCE_PROCESS_SEPARATION','Workforce Process Separation',WORKFORCE,{
    sharedSemantics:'Alleen versioned processtate kan organizational learning voeden; menselijke prestatie, communicatie en loopbaan blijven afzonderlijk en private-first.',
    reuse:['WorkOS authority','versioned work process target','Learning Constitution LC07'],
    counterexample:'Een werknemersnotitie, mail of populariteit is geen procesles.',implementationScope:'high: source-flowdecompositie vóór één objectieve proces-slice',
    risk:'surveillancegeheugen vermomd als procesverbetering',dependencies:['process owner','field allowlist','no-person-score gate','retention','verification']}),
  prerequisite('P08_PERSONAL_STRUCTURAL_RELEASE','Personal to Structural Release',PERSONAL,{
    sharedSemantics:'Een vrijwillige persoonlijke bijdrage maakt na minimization en unlinking een nieuw structureel artifact; de private bron wordt niet gekopieerd.',
    reuse:['Learning eligibility promotionFrom','unlinking','source retention'],counterexample:'Private Recall blijft Personal Memory en gebruikt geen structurele release.',
    implementationScope:'medium: één vrijwillige bronflow plus unlink/delete/revoke proof',risk:'heridentificatie via provenance of te rijke lesson',
    dependencies:['explicit contribution','minimization','unlinking receipt','new artifact id','source revocation path']}),
  prerequisite('P09_TRAVEL_STRUCTURAL_LESSON','Travel Structural Lesson',TRAVEL,{
    sharedSemantics:'Triprecall blijft Personal; alleen vrijwillig vrijgegeven, geminimaliseerde reisuitkomsten worden losgekoppelde structurele lessons.',
    reuse:['personal structural release','Travel source state','policy-aware Recall'],counterexample:'Een boeking of bewegingshistorie is geen learning consent.',
    implementationScope:'high: eerst één verstorings- of toegankelijkheidsflow',risk:'reizigersprofiel en locatiehistorie lekken',
    dependencies:['trip source version','voluntary release','location minimization','unlinking','future-trip recall policy']}),
  prerequisite('P10_FOUNDATION_VOLUNTARY_LESSON','Foundation Voluntary Lesson',FOUNDATION,{
    sharedSemantics:'Hulp en vrijwillige ervaringsbijdrage zijn afzonderlijke lifecycles; weigering heeft aantoonbaar geen behandel- of kansnadeel.',
    reuse:['Learning eligibility','Foundation source authority','personal structural release'],counterexample:'Toegang tot hulp en dossierinhoud zijn geen learning artifact.',
    implementationScope:'medium/high: no-disadvantage gate plus één vrijwillige projectles',risk:'dwang door machtsasymmetrie',
    dependencies:['service eligibility independence','explicit contribution','minimization','withdrawal','organizational decision']}),
  prerequisite('P11_EVENT_FEEDBACK_RELEASE','Event Feedback Release',EVENTS,{
    sharedSemantics:'Vrijwillige feedback is event- en purpose-bound en wordt pas na review/minimization een structurele eventles.',
    reuse:['Living World observation','WorkOS decision/change','personal structural release'],counterexample:'Eventdeelname, groepslidmaatschap en locatiegeschiedenis zijn geen release.',
    implementationScope:'medium: één versioned eventprocedure met no-disadvantage test',risk:'social graph of langdurige locatiehistorie ontstaat indirect',
    dependencies:['event source version','voluntary feedback','review','unlinking','next-event verification']}),
  prerequisite('P12_VERSION_BOUND_COMMONS_RELEASE','Version-bound Commons Release',COMMONS,{
    sharedSemantics:'De source owner geeft object/versie, doel, audience, reuse, attribution, AI- en derivative scope expliciet vrij en kan withdraw/supersede uitgeven.',
    reuse:['Learning eligibility COMMONS','source rights/versioning','lineage refs'],counterexample:'Waarderen, volgen, aankopen of bereik vormen geen Commons-release.',
    implementationScope:'medium: klein source-local contract met twee concrete release-eigenaren',risk:'impliciete publicatie en epistemic laundering',
    dependencies:['source authority','versioned source','withdrawal','attribution','no-pay-to-rank gate']}),
  prerequisite('P13_AI_PURPOSE_SCOPE','AI Purpose Scope',AI,{
    sharedSemantics:'Assistance, inference en training zijn afzonderlijke source-issued uses; AI-output behoudt epistemische herkomst en mutatieauthority.',
    reuse:['Learning eligibility aiScopes','AI provenance','authority decisions'],counterexample:'Een AI-voorstel is geen source-verified feit en gebruik van assistentie is geen trainingstoestemming.',
    implementationScope:'medium: adapters per AI-entrypoint; training default deny',risk:'inference wordt feit of toegestane context wordt voor training hergebruikt',
    dependencies:['purpose binding','current authorization','provenance type','training deny','source mutation gate']})
]);

const REJECTED_PREREQUISITES=Object.freeze([{id:'P06_VERSIONED_PHYSICAL_HANDOFF',status:'REJECTED_BY_SOURCE_RECHECK',
  reason:'dom-doos is hardwaretelemetrie en updatebeheer, geen fysieke custody-overdracht. De eerdere naamgebaseerde indeling was semantisch onjuist.',
  correctedTo:'P03_ASSET_INTERVENTION_LIFECYCLE',consumers:[]}]);

const TECHNICAL_CONSUMER_COUNT=new Set(PREREQUISITES.flatMap(p=>p.consumers)).size;
const PROTOCOL_GATES=Object.freeze([
  {id:'G01_ELIGIBILITY',consumers:TECHNICAL_CONSUMER_COUNT,reuse:'server/kern/loop-fabric/learning-eligibility.js',rule:'Iedere bron geeft purpose, basis, memory class, fields, audience, uses en retention uit.'},
  {id:'G02_DURABLE_DELIVERY',consumers:TECHNICAL_CONSUMER_COUNT,reuse:'source-owned outbox/checkpoint/dead-letter',rule:'Committed bronstate overleeft consumeruitval en replay.'},
  {id:'G03_SOURCE_RECEIPT',consumers:TECHNICAL_CONSUMER_COUNT,reuse:'ChangeReceipt plus service-receipt',rule:'Alleen de bron van gewijzigde state bevestigt Change.'},
  {id:'G04_CURRENT_AUTHORITY',consumers:TECHNICAL_CONSUMER_COUNT,reuse:'brondomein-authority adapters',rule:'Decision, Change en Recall herbeoordelen actuele authority.'},
  {id:'G05_POLICY_RECALL',consumers:TECHNICAL_CONSUMER_COUNT,reuse:'Loop Fabric Recall Broker',rule:'Recall resolveert live bron, visibility, retention, contest en correction.'},
  {id:'G06_VERIFICATION_OBSERVATION',consumers:TECHNICAL_CONSUMER_COUNT,reuse:'Observation plus verificationOf, causalClaim=false',rule:'Verification is een nieuwe bronwaarneming en geen causale conclusie.'}
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
module.exports={PREREQUISITES,REJECTED_PREREQUISITES,PROTOCOL_GATES,SCALE_DECISIONS,prerequisiteForCapability};
