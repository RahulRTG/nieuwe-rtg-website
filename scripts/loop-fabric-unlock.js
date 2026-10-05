#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'LOOP-FABRIC-UNLOCK-ROADMAP.json'),
  DOC=path.join(ROOT,'RTG-LOOP-FABRIC-BLOCKER-REDUCTION.md');
const {PREREQUISITES,PROTOCOL_GATES,SCALE_DECISIONS}=require('./lib/loop-fabric-prerequisite-policy');
const {build:buildDecisions}=require('./loop-fabric-decisions');
const {build:buildFlows}=require('./loop-fabric-source-flows');
function build(){
  const coverage=require(path.join(ROOT,'LOOP-FABRIC-COVERAGE.json')),decisions=buildDecisions(),flows=buildFlows(),
    technical=coverage.capabilities.filter(x=>x.execution.readiness==='NEEDS_TECHNICAL_PREREQUISITE'),
    scale=coverage.capabilities.filter(x=>x.execution.readiness==='BLOCKED_BY_SCALE_ARCHITECTURE');
  const assigned=PREREQUISITES.flatMap(p=>p.consumers).sort(),expected=technical.map(x=>x.id).sort();
  const scaleBlockers=scale.map(row=>({capabilityId:row.id,domain:row.domain,status:'STOP',...SCALE_DECISIONS[row.domain]}));
  return {schemaVersion:1,kind:'RTG_LOOP_FABRIC_UNLOCK_ROADMAP',sourceOfTruth:false,
    warning:'Roadmap autoriseert geen runtimecode. Iedere vertical slice doorloopt opnieuw alle acceptance gates.',
    sourceFlows:{summary:flows.summary,newGo:[],implementedGo:flows.flows.filter(x=>x.status==='GO').map(x=>x.id),
      note:'De GO-flows waren al bewezen; deze fase voegt geen runtimeadapter toe.'},
    decisions:{blockedCapabilities:decisions.summary.blockedCapabilities,families:decisions.summary.decisionFamilies,
      topFive:decisions.dossiers.slice(0,5).map(x=>({id:x.id,title:x.title,unlock:x.unlockImpact.capabilities,classification:x.classification}))},
    prerequisites:{expected,assigned,complete:JSON.stringify(expected)===JSON.stringify(assigned),
      nodes:PREREQUISITES.slice().sort((a,b)=>b.unlockCount-a.unlockCount||a.id.localeCompare(b.id)),protocolGates:PROTOCOL_GATES},
    scale:{count:scaleBlockers.length,status:'STOP',blockers:scaleBlockers},
    roadmap:[
      {order:1,step:'Besluit D23_LIBRARY_EDUCATION_RELEASE',why:'begrensde, versiegebonden en goed testbare cross-domain semantiek',unlocks:['P01_VERSIONED_SOURCE_RELEASE'],nextProof:'V01 Library Edition X -> interne Academy curriculumversie'},
      {order:2,step:'Bewijs P04_VERSIONED_SERVICE_PROCEDURE op één HACCP-procedure',why:'operationele state zonder gastprofiel en hergebruik van WorkOS runbookpatroon',unlocks:['supplier-haccp'],nextProof:'V02 bottleneck -> procedureversie -> volgende service verification'},
      {order:3,step:'Besluit D15_SERVICE_IMPROVEMENT',why:'maakt grens tussen ticketinhoud en structurele procesles expliciet',unlocks:['service'],nextProof:'V03 geminimaliseerde supportles met return path'},
      {order:4,step:'Bouw P05_REVIEWED_FAILURE_ARTIFACT',why:'kleinste technische occurrence-to-learning promotie',unlocks:['dom-foutmelder'],nextProof:'V04 browserfailure -> review -> runbookchange -> verification'},
      {order:5,step:'Besluit D11_COMMUNITY_EVENTS en pas daarna één eventflow',why:'hoge productwaarde maar deelnemerprivacy moet eerst zijn besloten',unlocks:['ontmoetingen','tickets','supplier-events','dom-agenda','dom-meet','bk-tickets','fs-terrein','fs-werk','fs-gast'],nextProof:'V05 eventprocedure zonder deelnemersprofiel'},
      {order:6,step:'P02_VERSIONED_WORK_PROCESS_TARGET per objectieve procesflow',why:'grote technische leverage, maar employee-bound subflows blijven uitgesloten',unlocks:['kantoorpakket','ondernemersos','office','command-zien','command-doen','command-besturen','zaakregie','zaakregie-beheer','dom-werkplek'],nextProof:'V06 project outcome -> process version -> next-project recall'},
      {order:7,step:'P03_ASSET_INTERVENTION_LIFECYCLE na assetauthoritybesluit',why:'maakt onderhoudsgeheugen mogelijk zonder bewonersgeschiedenis',unlocks:['vastgoed','dom-thuis','dom-residentie','dom-home'],nextProof:'V07 issue -> intervention -> recurrence observation'}
    ],
    stopStatement:'De 32 scale-blocked capabilities blijven STOP; deze roadmap bouwt geen distributed architecture.'};
}
function md(data){
  const lines=['# RTG Loop Fabric Blocker Reduction','','Datum: 5 oktober 2026','',
    'Deze fase reduceert blockers. Zij geeft geen brede runtimegoedkeuring en bevat geen nieuwe learning-adapter.','',
    '## B01 source-owned flows','',`B01 bevat ${Object.values(data.sourceFlows.summary).reduce((a,b)=>a+b,0)} bronflows: ${data.sourceFlows.summary.GO} GO, ${data.sourceFlows.summary.PHASE} PHASE en ${data.sourceFlows.summary.STOP} STOP.`,
    '',`Nieuw GO: ${data.sourceFlows.newGo.length}. De GO-flows waren al geïmplementeerd en bewezen: ${data.sourceFlows.implementedGo.map(x=>'`'+x+'`').join(', ')}.`,'',
    'De volledige velden per flow staan in `LOOP-FABRIC-SOURCE-FLOWS.json`.','',
    '## Menselijke beslissingen','',`${data.decisions.blockedCapabilities} blockers zijn exact eenmaal verdeeld over ${data.decisions.families} beslisfamilies.`,'',
    '| Rang | Dossier | Unlock | Type |','|---:|---|---:|---|'];
  data.decisions.topFive.forEach((x,i)=>lines.push(`| ${i+1} | ${x.id} ${x.title} | ${x.unlock} | ${x.classification} |`));
  lines.push('','Alle opties, defaults, gevolgen en Constitution-kandidaatregels staan in `RTG-LOOP-FABRIC-DECISION-DOSSIERS.md`.','',
    '## Technische prerequisite graph','',
    'De 38 technische capabilities hebben ieder precies één primaire bronprerequisite. De protocolpoorten eronder worden hergebruikt; zij zijn geen nieuwe engines.','',
    '| Prerequisite | Consumers | Omvang | Risico |','|---|---:|---|---|');
  for(const p of data.prerequisites.nodes)lines.push(`| ${p.id} ${p.title} | ${p.unlockCount} | ${p.implementationScope} | ${p.risk} |`);
  lines.push('','### Gedeelde bestaande poorten','');
  for(const g of data.prerequisites.protocolGates)lines.push(`- **${g.id}:** ${g.rule} Hergebruik: ${g.reuse}.`);
  lines.push('','## Unlock Roadmap','');
  for(const r of data.roadmap)lines.push(`${r.order}. **${r.step}**  `,`   Waarom: ${r.why}  `,`   Ontgrendelt: ${r.unlocks.map(x=>'`'+x+'`').join(', ')}  `,`   Bewijsslice: ${r.nextProof}`,'');
  lines.push('## Schaalblok','',`Alle ${data.scale.count} capabilities blijven **STOP**.`,'',
    '| Domein | Capabilities | Fabric-blocker | Benodigde beslissing | Richting |','|---|---:|---|---|---|');
  for(const domain of [...new Set(data.scale.blockers.map(x=>x.domain))]){const rows=data.scale.blockers.filter(x=>x.domain===domain),x=rows[0];
    lines.push(`| ${domain} | ${rows.length} | ${x.component}: ${x.reason} | ${x.decision} | ${x.direction} |`);}
  lines.push('','Geen van deze schaalblockers is gebruikt om een centrale store, grotere in-memory map of distributed runtime te bouwen.','',
    '## Implementatiebesluit','',
    'Er is geen nieuwe B01-flow GO geworden. Daarom is in deze fase geen runtimecode gebouwd. De vijf GO-sourceflows waren reeds bewezen; PHASE- en STOP-flows blijven dicht.','',
    'De eerstvolgende productbeslissing met een veilige technische proof is D23 Library Education Release. Zonder dat besluit blijft ook die overdracht gesloten.','');
  return lines.join('\n')+'\n';
}
function main(){const data=build(),json=JSON.stringify(data,null,2)+'\n',doc=md(data);if(process.argv.includes('--controle')){
  if(!fs.existsSync(OUT)||fs.readFileSync(OUT,'utf8')!==json||!fs.existsSync(DOC)||fs.readFileSync(DOC,'utf8')!==doc){console.error('Loop Fabric unlock roadmap loopt achter.');process.exit(1);}
  console.log('Loop Fabric unlock roadmap is gelijk aan de bron.');return;}fs.writeFileSync(OUT,json);fs.writeFileSync(DOC,doc);console.log('Loop Fabric unlock roadmap geschreven.');}
if(require.main===module)main();module.exports={build,md,OUT,DOC};
