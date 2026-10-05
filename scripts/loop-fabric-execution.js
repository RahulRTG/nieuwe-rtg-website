#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'LOOP-FABRIC-EXECUTION-MATRIX.json');
const {build:buildCoverage}=require('./loop-fabric-coverage');
const {READINESS,BATCHES}=require('./lib/loop-fabric-execution-policy');
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));

function routeMatches(route,prefix) {
  const value=String(route).replace(/^[A-Z]+\s+/,'');
  return value===prefix||value.startsWith(prefix.endsWith('/')?prefix:prefix+'/');
}
function unique(rows,key){return [...new Map(rows.map(row=>[key(row),row])).values()];}
function build() {
  const coverage=buildCoverage(),routes=read('ROUTEBRON.json').perRoute,mutations=read('MUTATIECONTRACT.json').rijen,
    screens=read('SCHERMFUNCTIE.json').perScherm,symbols=read('SYMBOLEN.json').perBestand,
    dependencies=new Map(symbols.map(row=>[row.bestand,row.requires||[]]));
  const batches=[];
  for(const [id,meta] of Object.entries(BATCHES)) {
    const capabilities=coverage.capabilities.filter(row=>row.execution.batchId===id),prefixes=capabilities.flatMap(row=>row.entryPoints);
    const routeRows=unique(routes.filter(row=>prefixes.some(prefix=>routeMatches(row.route,prefix))),row=>row.route+'|'+row.bestand);
    const mutationRows=unique(mutations.filter(row=>prefixes.some(prefix=>routeMatches(row.route,prefix))),row=>row.route+'|'+(row.bestand||''));
    const screenRows=unique(screens.filter(row=>(row.paden||[]).some(route=>prefixes.some(prefix=>routeMatches(route,prefix)))),row=>row.bestand);
    const sourceFiles=[...new Set(routeRows.map(row=>row.bestand))],seen=new Set(sourceFiles),queue=sourceFiles.slice();
    while(queue.length&&seen.size<10000) for(const dep of dependencies.get(queue.shift())||[]) if(!seen.has(dep)){seen.add(dep);queue.push(dep);}
    const kernels=[...seen].filter(file=>file.startsWith('server/kern/')||file.startsWith('server/bedrijf/'));
    const readiness=Object.fromEntries(READINESS.map(name=>[name,capabilities.filter(row=>row.execution.readiness===name).length]));
    const status=id==='B00_FINAL_GUARDS'?'GO':readiness.NEEDS_TECHNICAL_PREREQUISITE>0?'PHASE':'STOP';
    batches.push({id,name:meta.name,status,domains:[...new Set(capabilities.map(row=>row.domain))].sort(),
      capabilities:capabilities.map(row=>row.id),readiness,
      decisionDossiers:[...new Set(capabilities.map(row=>row.execution.decisionDossierId).filter(Boolean))].sort(),
      technicalPrerequisites:[...new Set(capabilities.map(row=>row.execution.technicalPrerequisiteId).filter(Boolean))].sort(),
      blastRadius:{sourceOwners:capabilities.length,kernelModules:kernels.length,mutationContracts:mutationRows.length,
        routes:routeRows.length,screens:screenRows.length,dataSchema:meta.dataSchema,newSharedPrimitive:meta.sharedPrimitive,
        crossDomainDependencies:meta.crossDomain,privacyImpact:meta.privacy,authorityImpact:meta.authority,
        recoveryImpact:meta.recovery,scaleImpact:meta.scale,expectedTests:meta.tests},
      blockers:[...new Set(capabilities.flatMap(row=>row.execution.blockers))].sort()});
  }
  return {schemaVersion:1,kind:'RTG_LOOP_FABRIC_EXECUTION_MATRIX',sourceOfTruth:false,
    warning:'Dit is een preflight- en migratieregister. GO autoriseert alleen de beschreven scope; source domains blijven eigenaar.',
    readinessClasses:READINESS,goRule:'Default bij twijfel is PHASE. Een batch met technische candidates blijft PHASE totdat afzonderlijke source-flows alle poorten halen.',
    sharedPrerequisites:['source-flowdecompositie per brede capability','versioned source change target waar afwezig',
      'durable source event/outbox en recoverybewijs','actuele authority plus source-issued eligibility per flow',
      'partitioneringsbesluit vóór high-volume aansluiting'],
    independentBatches:['B02_WORK_OPERATIONS','B03_KNOWLEDGE_DEVELOPMENT','B04_WORLD_ASSET_MEMORY','B05_SERVICE_OPERATIONS'],
    decisionBoundBatches:['B07_DISCOVERY_AI_NETWORK','B08_HUMAN_PROGRAMS','B09_REGULATED_PRIVATE'],
    scaleBoundBatches:['B06_HIGH_VOLUME'],
    recommendedOrder:['B00_FINAL_GUARDS','B01_PROVEN_CLOSURE','B02_WORK_OPERATIONS','B03_KNOWLEDGE_DEVELOPMENT',
      'B04_WORLD_ASSET_MEMORY','B05_SERVICE_OPERATIONS','B06_HIGH_VOLUME','B07_DISCOVERY_AI_NETWORK','B08_HUMAN_PROGRAMS',
      'B09_REGULATED_PRIVATE'],batches};
}
function main(){const next=JSON.stringify(build(),null,2)+'\n';if(process.argv.includes('--controle')){
  const old=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'';if(old!==next){console.error('LOOP-FABRIC-EXECUTION-MATRIX.json loopt achter.');process.exit(1);}
  console.log('Loop Fabric Execution Matrix is gelijk aan de bron.');return;}fs.writeFileSync(OUT,next);console.log('LOOP-FABRIC-EXECUTION-MATRIX.json geschreven.');}
if(require.main===module)main();
module.exports={build,OUT};
