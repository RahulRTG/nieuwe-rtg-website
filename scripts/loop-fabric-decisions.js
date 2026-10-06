#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'LOOP-FABRIC-DECISION-DOSSIERS.json'),
  DOC=path.join(ROOT,'RTG-LOOP-FABRIC-DECISION-DOSSIERS.md');
const {DOSSIERS,EDUCATION_DOSSIER}=require('./lib/loop-fabric-decision-policy');
const {RULES}=require('./lib/loop-fabric-constitution-policy');
const constitution=require('../server/kern/loop-fabric/constitution');
function build(){
  const coverage=require(path.join(ROOT,'LOOP-FABRIC-COVERAGE.json')),
    blocked=coverage.capabilities.filter(x=>x.execution.readiness==='NEEDS_HUMAN_DECISION'),ids=blocked.map(x=>x.id).sort(),
    assigned=DOSSIERS.flatMap(d=>d.capabilityIds).sort(),resolved=DOSSIERS.filter(d=>constitution.RESOLVED_DECISIONS.includes(d.id)),
    dossiers=DOSSIERS.map(d=>({...d,decisionStatus:constitution.RESOLVED_DECISIONS.includes(d.id)?'RESOLVED_PRODUCT_POLICY':
      constitution.GENERIC_LEARNING_CLOSED.includes(d.id)?'LEGAL_VALIDATION_REQUIRED':'OPEN'})),allIds=coverage.capabilities.map(x=>x.id);
  return {schemaVersion:1,kind:'RTG_LOOP_FABRIC_DECISION_DOSSIERS',sourceOfTruth:false,
    warning:'Technisch/productadvies, geen juridisch advies. LEGAL_VALIDATION_REQUIRED blijft geblokkeerd tot bevoegde validatie.',
    summary:{originalBlockedCapabilities:assigned.length,blockedCapabilities:ids.length,resolvedCapabilities:resolved.flatMap(d=>d.capabilityIds).length,
      decisionFamilies:DOSSIERS.length,resolvedFamilies:resolved.length,reduction:assigned.length-DOSSIERS.length,
      classifications:Object.fromEntries([...new Set(DOSSIERS.map(d=>d.classification))].sort().map(k=>[k,DOSSIERS.filter(d=>d.classification===k).length]))},
    coverage:{expectedOriginal:assigned,remainingHuman:ids,assigned,complete:assigned.every(id=>allIds.includes(id))&&ids.every(id=>assigned.includes(id))},
    dossiers:dossiers.sort((a,b)=>b.unlockImpact.capabilities-a.unlockImpact.capabilities||a.id.localeCompare(b.id)),
    educationDossier:{...EDUCATION_DOSSIER,decisionStatus:'RESOLVED_PRODUCT_POLICY'},constitutionCandidates:RULES};
}
const esc=x=>String(x).replace(/\\/g,'\\\\').replace(/\|/g,'\\|');
function markdown(data){
  const lines=['# RTG Loop Fabric Decision Dossiers','','Datum: 5 oktober 2026','',
    'Dit is technisch en productmatig architectuuradvies, geen juridisch advies. Dossiers met `LEGAL_VALIDATION_REQUIRED` blijven fail-closed tot bevoegde validatie.','',
    `De oorspronkelijke ${data.summary.originalBlockedCapabilities} capabilityblockers zijn teruggebracht tot ${data.summary.decisionFamilies} semantisch verschillende beslissingen. ${data.summary.resolvedCapabilities} capabilities hebben nu een productbesluit; ${data.summary.blockedCapabilities} blijven menselijk of juridisch geblokkeerd.`,
    '','## Leverage','','| Dossier | Type | Capabilities | Veilige default |','|---|---|---:|---|'];
  for(const d of data.dossiers)lines.push(`| ${d.id} ${esc(d.title)} | ${d.classification} / ${d.decisionStatus} | ${d.capabilityIds.length} | ${esc(d.safeDefault)} |`);
  lines.push('','## Dossiers','');
  for(const d of data.dossiers){lines.push(`### ${d.id} - ${d.title}`,'',`**Vraag:** ${d.question}`,'',`**Waarom code dit niet kan bepalen:** ${d.why}`,'',
    `**Type:** \`${d.classification}\``,'',`**Capabilities (${d.capabilityIds.length}):** ${d.capabilityIds.map(x=>'`'+x+'`').join(', ')}`,'',
    `**Domeinen:** ${d.domains.map(x=>'`'+x+'`').join(', ')}`,'');
    for(const o of d.options){lines.push(`**Optie ${o.id} - ${o.title}:** ${o.description}`,'',
      `Product: ${o.consequences.product} Privacy: ${o.consequences.privacy} Learning: ${o.consequences.learning} AI: ${o.consequences.ai} Cross-domain: ${o.consequences.crossDomain} Retention: ${o.consequences.retention} Gebruikerscontrole: ${o.consequences.userControl} Implementatie: ${o.consequences.implementation}`,'');}
    lines.push(`**Veiligste default:** ${d.safeDefault}`,'',`**Aanbevolen productrichting:** ${d.recommendation}`,'',
      `**Unlock impact:** ${d.unlockImpact.capabilities} capabilities kunnen na een besluit naar \`${d.unlockImpact.to}\`; geen wordt zonder technische bewijsslice direct READY.`,'');}
  const e=data.educationDossier;lines.push('## Afzonderlijk onderwijsdossier','',`### ${e.id} - ${e.title}`,'',`**Vraag:** ${e.question}`,'',
    `**Waarom:** ${e.why}`,'',`**Veiligste default:** ${e.safeDefault}`,'',`**Aanbeveling:** ${e.recommendation}`,'',
    `**Capabilities:** ${e.capabilityIds.map(x=>'`'+x+'`').join(', ')}`,'','De vereiste deelbesluiten staan machineleesbaar in `educationDossier.decisions` van `LOOP-FABRIC-DECISION-DOSSIERS.json`.','',
    '## Kandidaat Learning Constitution','');
  for(const r of data.constitutionCandidates)lines.push(`### ${r.id}`,'',r.rule,'',`Lost blockers op uit: ${r.resolves.map(x=>'`'+x+'`').join(', ')}.`,'',
    `Domeinen: ${r.domains.map(x=>'`'+x+'`').join(', ')}.`,'',`Tegenvoorbeeld: ${r.counterexample}`,'',`Uitzonderingen: ${r.exceptions}`,'',
    `Runtime enforcement: ${r.runtime}`,'',`Benodigde tests: ${r.tests.join('; ')}.`,'');
  return lines.join('\n').replace(/\n+$/,'')+'\n';
}
function main(){const data=build(),json=JSON.stringify(data,null,2)+'\n',md=markdown(data);if(process.argv.includes('--controle')){
  if(!fs.existsSync(OUT)||fs.readFileSync(OUT,'utf8')!==json||!fs.existsSync(DOC)||fs.readFileSync(DOC,'utf8')!==md){console.error('Loop Fabric decision dossiers lopen achter.');process.exit(1);}
  console.log('Loop Fabric decision dossiers zijn gelijk aan de bron.');return;}fs.writeFileSync(OUT,json);fs.writeFileSync(DOC,md);console.log('Loop Fabric decision dossiers geschreven.');}
if(require.main===module)main();module.exports={build,markdown,OUT,DOC};
