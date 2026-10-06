#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'LOOP-FABRIC-UNLOCK-ROADMAP.json'),
  DOC=path.join(ROOT,'RTG-LOOP-FABRIC-BLOCKER-REDUCTION.md');
const {PREREQUISITES,REJECTED_PREREQUISITES,PROTOCOL_GATES,SCALE_DECISIONS}=require('./lib/loop-fabric-prerequisite-policy');
const {build:buildDecisions}=require('./loop-fabric-decisions');
const {build:buildFlows}=require('./loop-fabric-source-flows');
function build(){
  const coverage=require(path.join(ROOT,'LOOP-FABRIC-COVERAGE.json')),decisions=buildDecisions(),flows=buildFlows(),
    technical=coverage.capabilities.filter(x=>x.execution.readiness==='NEEDS_TECHNICAL_PREREQUISITE'),
    scale=coverage.capabilities.filter(x=>x.execution.readiness==='BLOCKED_BY_SCALE_ARCHITECTURE');
  const assigned=PREREQUISITES.flatMap(p=>p.consumers).sort(),expected=technical.map(x=>x.id).sort();
  const scaleBlockers=scale.map(row=>({capabilityId:row.id,domain:row.domain,status:'STOP',...SCALE_DECISIONS[row.domain]}));
  const proofStatus={
    P01_VERSIONED_SOURCE_RELEASE:{status:'PROVEN_BOUNDED',proof:['library-edition-to-academy'],next:'Nieuwe source owners blijven PHASE tot hun eigen versioned release en withdrawal zijn bewezen.'},
    P02_VERSIONED_WORK_PROCESS_TARGET:{status:'PHASE',proof:['workos.accessibility-procedure','workos.near-miss-runbook'],next:'Kies per capability eerst een concreet, niet-persoonsgebonden procesobject.'},
    P03_ASSET_INTERVENTION_LIFECYCLE:{status:'PHASE',proof:[],next:'Asset authority, intervention versioning, retention en source receipt ontbreken; dom-doos is hier correct ondergebracht.'},
    P04_VERSIONED_SERVICE_PROCEDURE:{status:'PROVEN_BOUNDED',proof:['service.process-improvement'],next:'Hospitality- en leveranciersprocedures blijven source-specifiek PHASE.'},
    P05_REVIEWED_FAILURE_ARTIFACT:{status:'PHASE',proof:[],next:'Technische reviewauthority, allowlist, tijdretentie, versioned change target en source outbox ontbreken.'},
    P07_WORKFORCE_PROCESS_SEPARATION:{status:'PHASE',proof:[],next:'Decomposeer eerst processtate en menselijke context; LC07 blokkeert persoonsgerichte organizational memory.'},
    P08_PERSONAL_STRUCTURAL_RELEASE:{status:'PROVEN_BOUNDED',proof:['experience.living-world-contribution','service.process-improvement'],next:'Iedere nieuwe bron vereist eigen vrijwilligheid, minimization en unlinkingbewijs.'},
    P09_TRAVEL_STRUCTURAL_LESSON:{status:'PHASE',proof:[],next:'Nog geen begrensde vrijwillige tripbron met locatie-minimization en toekomstig recallcontract.'},
    P10_FOUNDATION_VOLUNTARY_LESSON:{status:'PHASE',proof:[],next:'Nog geen source-flow die no-disadvantage, withdrawal en organizational decision gezamenlijk bewijst.'},
    P11_EVENT_FEEDBACK_RELEASE:{status:'PROVEN_BOUNDED',proof:['experience.living-world-contribution','workos.accessibility-procedure'],next:'Andere event owners blijven PHASE tot hun eigen source version en no-disadvantage pad bestaan.'},
    P12_VERSION_BOUND_COMMONS_RELEASE:{status:'PROVEN_ONE_SOURCE',proof:['experience.living-world-commons-release'],next:'Geen generiek platformcontract zonder tweede semantisch gelijkwaardige source owner.'},
    P13_AI_PURPOSE_SCOPE:{status:'PHASE',proof:[],next:'Training blijft constitutioneel deny; adapters wachten op concrete source-owned AI-use contracts.'}
  };
  const nodes=PREREQUISITES.slice().sort((a,b)=>b.unlockCount-a.unlockCount||a.id.localeCompare(b.id))
    .map(p=>({...p,proofStatus:proofStatus[p.id]}));
  return {schemaVersion:1,kind:'RTG_LOOP_FABRIC_UNLOCK_ROADMAP',sourceOfTruth:false,
    warning:'Roadmap autoriseert geen runtimecode. Iedere vertical slice doorloopt opnieuw alle acceptance gates.',
    sourceFlows:{summary:flows.summary,newGo:['library-edition-to-academy','experience.living-world-commons-release','service.process-improvement'],implementedGo:flows.flows.filter(x=>x.status==='GO').map(x=>x.id),
      note:'D23, één source-local D13 Commons-release en D15 service process learning zijn bewezen; brede capabilityfamilies blijven flowgewijs gefaseerd.'},
    decisions:{blockedCapabilities:decisions.summary.blockedCapabilities,families:decisions.summary.decisionFamilies,
      resolvedCapabilities:decisions.summary.resolvedCapabilities,
      topFive:decisions.dossiers.filter(x=>x.decisionStatus==='RESOLVED_PRODUCT_POLICY').slice(0,5)
        .map(x=>({id:x.id,title:x.title,unlock:x.unlockImpact.capabilities,classification:x.classification}))},
    prerequisites:{expected,assigned,complete:JSON.stringify(expected)===JSON.stringify(assigned),rejectedHypotheses:REJECTED_PREREQUISITES,
      nodes,protocolGates:PROTOCOL_GATES},
    scale:{count:scaleBlockers.length,status:'STOP',blockers:scaleBlockers},
    roadmap:nodes.map((p,index)=>({order:index+1,step:p.id,status:p.proofStatus.status,why:p.sharedSemantics,
      unlocks:p.consumers,nextProof:p.proofStatus.next,proof:p.proofStatus.proof})),
    fixedPoint:{reached:true,implementedGo:flows.summary.GO,remainingPhase:flows.summary.PHASE,remainingStop:flows.summary.STOP,
      reason:'Alle acht source-flows die zelfstandig alle stoppoorten halen zijn geïmplementeerd. Iedere resterende flow mist source-specifieke authority, retention, versioning/receipt/recovery, een menselijke of juridische beslissing, of bewezen schaalarchitectuur.',
      safeTechnicalWorkWithoutNewDecision:false},
    stopStatement:'De 32 scale-blocked capabilities blijven STOP; deze roadmap bouwt geen distributed architecture.'};
}
function md(data){
  const lines=['# RTG Loop Fabric Blocker Reduction','','Datum: 6 oktober 2026','',
    'Deze fase reduceert blockers. Zij geeft geen brede runtimegoedkeuring en bevat geen nieuwe learning-adapter.','',
    '## Source-owned flows','',`Het flowregister bevat ${Object.values(data.sourceFlows.summary).reduce((a,b)=>a+b,0)} bronflows: ${data.sourceFlows.summary.GO} GO, ${data.sourceFlows.summary.PHASE} PHASE en ${data.sourceFlows.summary.STOP} STOP.`,
    '',`Nieuw GO: ${data.sourceFlows.newGo.length}. Geïmplementeerde en bewezen GO-flows: ${data.sourceFlows.implementedGo.map(x=>'`'+x+'`').join(', ')}.`,'',
    'De volledige velden per flow staan in `LOOP-FABRIC-SOURCE-FLOWS.json`.','',
    '## Menselijke beslissingen','',`${data.decisions.blockedCapabilities} blockers zijn exact eenmaal verdeeld over ${data.decisions.families} beslisfamilies.`,'',
    '| Rang | Dossier | Unlock | Type |','|---:|---|---:|---|'];
  data.decisions.topFive.forEach((x,i)=>lines.push(`| ${i+1} | ${x.id} ${x.title} | ${x.unlock} | ${x.classification} |`));
  lines.push('','Alle opties, defaults, gevolgen en Constitution-kandidaatregels staan in `RTG-LOOP-FABRIC-DECISION-DOSSIERS.md`.','',
    '## Technische prerequisite graph','',
    `De ${data.prerequisites.expected.length} technische capabilities hebben ieder precies één primaire bronprerequisite. De protocolpoorten eronder worden hergebruikt; zij zijn geen nieuwe engines.`,'',
    '| Prerequisite | Consumers | Omvang | Risico |','|---|---:|---|---|');
  for(const p of data.prerequisites.nodes)lines.push(`| ${p.id} ${p.title} | ${p.unlockCount} | ${p.implementationScope}; ${p.proofStatus.status} | ${p.risk} |`);
  lines.push('','### Verworpen prerequisite-hypothese','');
  for(const p of data.prerequisites.rejectedHypotheses)lines.push(`- **${p.id}:** ${p.reason} Correctie: ${p.correctedTo}.`);
  lines.push('','### Gedeelde bestaande poorten','');
  for(const g of data.prerequisites.protocolGates)lines.push(`- **${g.id}:** ${g.rule} Hergebruik: ${g.reuse}.`);
  lines.push('','## Unlock Roadmap','');
  for(const r of data.roadmap)lines.push(`${r.order}. **${r.step} — ${r.status}**`,`   Semantiek: ${r.why}`,`   Capabilities: ${r.unlocks.map(x=>'`'+x+'`').join(', ')}`,`   Bewijs: ${r.proof.length?r.proof.map(x=>'`'+x+'`').join(', '):'geen volledige source-slice'}`,`   Volgende grens: ${r.nextProof}`,'');
  lines.push('## Technisch fixed point','',`**Bereikt: ${data.fixedPoint.reached?'ja':'nee'}.** ${data.fixedPoint.reason}`,'',
    `Veilig uitvoerbaar technisch werk zonder nieuwe beslissing: **${data.fixedPoint.safeTechnicalWorkWithoutNewDecision?'ja':'nee'}**.`,'');
  lines.push('## Schaalblok','',`Alle ${data.scale.count} capabilities blijven **STOP**.`,'',
    '| Domein | Capabilities | Fabric-blocker | Benodigde beslissing | Richting |','|---|---:|---|---|---|');
  for(const domain of [...new Set(data.scale.blockers.map(x=>x.domain))]){const rows=data.scale.blockers.filter(x=>x.domain===domain),x=rows[0];
    lines.push(`| ${domain} | ${rows.length} | ${x.component}: ${x.reason} | ${x.decision} | ${x.direction} |`);}
  lines.push('','Geen van deze schaalblockers is gebruikt om een centrale store, grotere in-memory map of distributed runtime te bouwen.','',
    '## Implementatiebesluit','',
    'De productbesluiten verplaatsen capabilities naar technische prerequisites, niet rechtstreeks naar GO. Iedere flow blijft dicht totdat zijn broncontract en verticale bewijsslice groen zijn.','',
    'De begrensde proofs voor D23, D15, D11, D13 en D01 zijn uitgevoerd. Brede capabilityfamilies worden daardoor niet automatisch GO: iedere nieuwe source owner moet dezelfde stoppoorten zelfstandig bewijzen.','');
  return lines.join('\n')+'\n';
}
function main(){const data=build(),json=JSON.stringify(data,null,2)+'\n',doc=md(data);if(process.argv.includes('--controle')){
  if(!fs.existsSync(OUT)||fs.readFileSync(OUT,'utf8')!==json||!fs.existsSync(DOC)||fs.readFileSync(DOC,'utf8')!==doc){console.error('Loop Fabric unlock roadmap loopt achter.');process.exit(1);}
  console.log('Loop Fabric unlock roadmap is gelijk aan de bron.');return;}fs.writeFileSync(OUT,json);fs.writeFileSync(DOC,doc);console.log('Loop Fabric unlock roadmap geschreven.');}
if(require.main===module)main();module.exports={build,md,OUT,DOC};
