#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'LOOP-FABRIC-COVERAGE.json');
const {FUNCTIES}=require('../server/functies/register');
const policy=require('../server/kern/loop-fabric/coverage-policy');
const executionPolicy=require('./lib/loop-fabric-execution-policy');
const decisionPolicy=require('./lib/loop-fabric-decision-policy');
const prerequisitePolicy=require('./lib/loop-fabric-prerequisite-policy');

const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const routeSource=read('ROUTEBRON.json').perRoute;
const mutation=read('MUTATIECONTRACT.json').rijen;
const screens=read('SCHERMFUNCTIE.json').perScherm;
const symbols=read('SYMBOLEN.json').perBestand,dependencies=new Map(symbols.map(row=>[row.bestand,row.requires||[]]));
const sourceCache=new Map();
const SIGNALS=Object.freeze({
  decision:['besluit','decision','approve','goedkeur','afwijs','reject'],
  feedback:['feedback','review','klacht','complaint','correct','betwist','contest'],
  booking:['boeking','booking','reservation','reserver'],
  transaction:['betaling','payment','settlement','factuur','invoice','order'],
  failure:['incident','storing','failure','retry','rollback','deadletter','dead-letter','recovery','herstel'],
  version:['revision','versie','version','supersed','immutable'],
  event:['outbox','emit','event','envelop'],
  ai:['inference','inferred','ai','model','rahul']
});

function routeMatches(route,prefix) {
  const pad=String(route).replace(/^[A-Z]+\s+/,'');
  return pad===prefix || pad.startsWith(prefix.endsWith('/')?prefix:prefix+'/');
}
function sourcesFor(capability) {
  const matched=routeSource.filter(row=>capability.paden.some(prefix=>routeMatches(row.route,prefix)));
  return [...new Set(matched.map(row=>row.bestand))].sort();
}
function source(file){if(sourceCache.has(file))return sourceCache.get(file);let value='';
  try{value=fs.readFileSync(path.join(ROOT,file),'utf8').toLowerCase();}catch{}sourceCache.set(file,value);return value;}
function dependencyClosure(files) {
  const seen=new Set(files),queue=files.slice();
  while(queue.length&&seen.size<5000){const file=queue.shift();for(const dep of dependencies.get(file)||[])
    if(!seen.has(dep)){seen.add(dep);queue.push(dep);}}
  return [...seen].sort();
}
function evidenceFor(capability) {
  const routes=routeSource.filter(row=>capability.paden.some(prefix=>routeMatches(row.route,prefix)));
  const muts=mutation.filter(row=>capability.paden.some(prefix=>routeMatches(row.route,prefix)));
  const files=[...new Set(routes.map(row=>row.bestand))].sort(),closure=dependencyClosure(files),content=closure.map(source).join('\n');
  const kernels=closure.filter(file=>file.startsWith('server/kern/')||file.startsWith('server/bedrijf/'));
  const signals=Object.entries(SIGNALS).filter(([,words])=>words.some(word=>content.includes(word))).map(([key])=>key);
  const relatedScreens=screens.filter(screen=>(screen.paden||[]).some(p=>capability.paden.some(prefix=>p===prefix||p.startsWith(prefix+'/'))));
  return {routeCount:routes.length,mutationRoutes:muts.length,declaredMutationSemantics:muts.filter(x=>x.herkomst==='mens').length,
    sourceFileCount:files.length,kernelDependencyCount:kernels.length,screenCount:relatedScreens.length,
    sourceFiles:files.slice(0,16),sourceFilesOmitted:Math.max(0,files.length-16),kernelDependencies:kernels.slice(0,24),
    kernelDependenciesOmitted:Math.max(0,kernels.length-24),screens:relatedScreens.map(x=>x.bestand).slice(0,12),
    screensOmitted:Math.max(0,relatedScreens.length-12),signals};
}
function semanticSurfaces() {
  const rows=symbols.filter(row=>row.bestand.startsWith('server/')).map(row=>({file:row.bestand,text:source(row.bestand)}));
  const pick=(regex)=>rows.filter(row=>regex.test(row.text)).map(row=>row.file).sort();
  const kernels=rows.filter(row=>row.file.startsWith('server/kern/')).map(row=>row.file),groups={};
  for(const file of kernels){const rest=file.slice('server/kern/'.length),group=rest.includes('/')?rest.split('/')[0]:'_root';groups[group]=(groups[group]||0)+1;}
  return {evidenceLevel:'STATIC_SOURCE_CANDIDATE_NOT_LEARNING_PROOF',kernelFiles:kernels.length,kernelGroups:Object.entries(groups)
    .map(([group,files])=>({group,files})).sort((a,b)=>a.group.localeCompare(b.group)),
    stateMachineCandidates:pick(/\b(status|stand|state)\b[\s\S]{0,120}(=|switch|includes\()/),
    decisionCandidates:pick(/\b(besluit|decision|approve|goedkeur|afwijs|reject)\b/),
    feedbackComplaintCandidates:pick(/\b(feedback|klacht|complaint|correctie|contest|betwist)\b/),
    deliveryRecoveryCandidates:pick(/\b(outbox|checkpoint|dead.?letter|retry|rollback|recovery|herstel)\b/),
    aiActionCandidates:pick(/\b(inferred|inference|model|ai[-_. ]|rahul)\b/),
    physicalHandoffCandidates:pick(/\b(arrival|scan|poort|deur|dispatch|uitgifte|overdracht|geolocation|locatie)\b/)};
}
function loopShape(signals,status) {
  const possible=name=>signals.includes(name)?['SOURCE_EVENT_CANDIDATE']:[];
  const blocked=['PROHIBITED_FROM_LEARNING','NO_LEARNING_VALUE','HUMAN_REVIEW_REQUIRED'].includes(status);
  return {occurrences:blocked?[]:['SEMANTIC_MUTATION'],observations:blocked?[]:['SOURCE_OWNED_ONLY'],
    expectations:possible('decision'),decisions:possible('decision'),claimsContests:possible('feedback'),
    changes:blocked?[]:['SOURCE_OWNED_CHANGE_REQUIRED'],verification:blocked?[]:['NEW_SOURCE_OBSERVATION'],
    recallOpportunities:blocked?[]:['CONTEXTUAL_SOURCE_RESOLUTION']};
}
function participation(item) {
  const {status,domain,sensitivity,memory}=item;
  const blocked=['PROHIBITED_FROM_LEARNING','NO_LEARNING_VALUE'].includes(status);
  return {eligibility:blocked?'DENY':status==='HUMAN_REVIEW_REQUIRED'?'HUMAN_OR_LEGAL_DECISION_REQUIRED':'SOURCE_MUST_ISSUE',
    purposes:blocked?[]:['DOMAIN_IMPROVEMENT_EXPLICIT'],lawfulBasis:blocked?'NONE':status==='HUMAN_REVIEW_REQUIRED'?'UNDECIDED':'SOURCE_MUST_PROVE',
    consent:domain==='personal-life'||domain==='travelos'||domain==='living-world'?'EXPLICIT_WHERE_PERSONAL':'NOT_INFERRED_FROM_USE',
    allowedMemoryClasses:memory.classes,retention:memory.retention,promotion:memory.promotion,
    crossDomain:blocked?'DENY':'SEPARATE_SOURCE_ISSUED_ELIGIBILITY',ai:blocked?'DENY':'SEPARATE_EXPLICIT_SCOPE',
    minimization:'ALLOWLIST_FIELDS_ONLY',sensitivity};
}
function missing(status) {
  if (status==='LOOP_CAPABLE') return [];
  if (status==='NO_LEARNING_VALUE'||status==='PROHIBITED_FROM_LEARNING') return [];
  if (status==='HUMAN_REVIEW_REQUIRED') return ['lawful-basis-decision','purpose-and-field-allowlist','retention-decision'];
  return ['source-issued-learning-eligibility','semantic-observation-or-outcome','source-change-receipt','recall-policy','vertical-slice-proof'];
}

function build() {
  const capabilities=FUNCTIES.map(capability=>{
    const evidence=evidenceFor(capability),decision=policy.classify(capability,evidence);
    const row={id:capability.id,name:capability.naam,category:capability.categorie,domain:decision.domain,
      semanticOwner:{kind:'capability',id:capability.id,source:'server/functies/register'},entryPoints:capability.paden,
      behaviourEvidence:evidence,classification:decision.status,classificationReason:decision.reason,
      loop:loopShape(evidence.signals,decision.status),participation:participation(decision),
      crossDomainHandoffs:decision.status==='LOOP_CAPABLE'?['SOURCE_REF_TO_AUTHORIZED_CONSUMER']:
        decision.status==='PARTIALLY_LOOP_CAPABLE'?['LIMITED_PROVEN_FLOW_ONLY']:[],missing:missing(decision.status)};
    row.execution=executionPolicy.classify(row);
    const dossier=decisionPolicy.dossierForCapability(row.id);
    if(dossier)row.execution.decisionDossierId=dossier.id;
    const prerequisite=prerequisitePolicy.prerequisiteForCapability(row.id);
    if(prerequisite)row.execution.technicalPrerequisiteId=prerequisite.id;
    if(row.execution.readiness==='BLOCKED_BY_SCALE_ARCHITECTURE')
      row.execution.scaleBlocker=prerequisitePolicy.SCALE_DECISIONS[row.domain];
    return row;
  });
  const domains={};
  for(const row of capabilities){const d=domains[row.domain]||(domains[row.domain]={domain:row.domain,capabilities:0,eligibleFlows:0,
    LOOP_CAPABLE:0,PARTIALLY_LOOP_CAPABLE:0,NOT_YET_LOOP_CAPABLE:0,NO_LEARNING_VALUE:0,PROHIBITED_FROM_LEARNING:0,HUMAN_REVIEW_REQUIRED:0});
    d.capabilities++;d[row.classification]++;if(!['NO_LEARNING_VALUE','PROHIBITED_FROM_LEARNING'].includes(row.classification))d.eligibleFlows++;}
  const consent={explicitConsentNeeded:0,otherBasisMustBeProven:0,organizationalOrTechnicalState:0,prohibited:0,humanOrLegalReview:0};
  for(const row of capabilities){if(row.classification==='PROHIBITED_FROM_LEARNING')consent.prohibited++;
    else if(row.classification==='HUMAN_REVIEW_REQUIRED')consent.humanOrLegalReview++;
    else if(row.participation.consent==='EXPLICIT_WHERE_PERSONAL')consent.explicitConsentNeeded++;
    else if(['workos','hospitality','commerce','mobility','service-support'].includes(row.domain))consent.organizationalOrTechnicalState++;
    else if(row.classification!=='NO_LEARNING_VALUE')consent.otherBasisMustBeProven++;}
  const readiness=Object.fromEntries(executionPolicy.READINESS.map(name=>[name,capabilities.filter(row=>row.execution.readiness===name).length]));
  return {schemaVersion:1,executionSchemaVersion:1,kind:'RTG_LOOP_FABRIC_COVERAGE_REGISTRY',sourceOfTruth:false,
    warning:'Deze afgeleide registry bewijst vindbaarheid en expliciete deelnamekeuzes; brondomeinen blijven eigenaar van betekenis en eligibility.',
    sources:{capabilities:'server/functies/register',routes:'ROUTEBRON.json',mutations:'MUTATIECONTRACT.json',screens:'SCHERMFUNCTIE.json'},
    measured:{capabilities:capabilities.length,routes:routeSource.length,mutationContracts:mutation.length,screens:screens.length},
    classifications:policy.CLASSIFICATIONS,executionReadiness:executionPolicy.READINESS,readinessSummary:readiness,
    semanticSurfaces:semanticSurfaces(),
    domains:Object.values(domains).sort((a,b)=>a.domain.localeCompare(b.domain)),consentCoverage:consent,capabilities};
}
function main(){const next=JSON.stringify(build(),null,2)+'\n';if(process.argv.includes('--controle')){
  const old=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'';if(old!==next){console.error('LOOP-FABRIC-COVERAGE.json loopt achter; draai node scripts/loop-fabric-coverage.js');process.exit(1);}
  console.log('Loop Fabric coverage registry is gelijk aan de bron.');return;}fs.writeFileSync(OUT,next);console.log('LOOP-FABRIC-COVERAGE.json geschreven.');}
if(require.main===module)main();
module.exports={build,OUT};
