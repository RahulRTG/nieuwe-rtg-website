#!/usr/bin/env node
/* Eén ingang voor contract, echte proeven en het lokale observatorium.
   Geen productieaanpassing, telemetry of ongemeten groene vinkjes. */
'use strict';
const fs=require('node:fs'), path=require('node:path'), cp=require('node:child_process');
const {compile}=require('./lib/experience/compiler');
const {fingerprint,outcome,state,sha,candidate}=require('./lib/experience/evidence');
const {render}=require('./lib/experience/observatory');
const {execute,select}=require('./lib/experience/execution');
const typed=require('./lib/experience/typed');
const {build}=require('./lib/experience/coverage');
const root=path.resolve(__dirname,'..'), out=path.join(root,'artifacts/experience');
if (['--prove','--check','--gate'].filter(arg=>process.argv.includes(arg)).length > 1) {
  console.error('BLOCKED: kies één Experience-pilotmodus'); process.exit(2);
}
if(process.argv.some(arg=>arg.startsWith('--proof'))&&!process.argv.includes('--prove')){console.error('BLOCKED: --proof vereist --prove');process.exit(2);}
const qualifying=process.argv.includes('--prove')||process.argv.includes('--gate');
const clean=candidate(root);
if(qualifying&&!clean.ok){console.error('BLOCKED: '+clean.reason);process.exit(2);}
const constitution=require('../experience/constitution.json');
const journeys=fs.readdirSync(path.join(root,'experience')).filter(n=>n.endsWith('.json')&&n!=='constitution.json')
  .map(n=>JSON.parse(fs.readFileSync(path.join(root,'experience',n),'utf8')));
const graph=compile(root,constitution,journeys);
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({valid:graph.valid,errors:graph.errors,journeys:journeys.length,screens:graph.nodes.filter(n=>n.route).length},null,2));
  process.exit(graph.valid?0:1);
}
fs.mkdirSync(out,{recursive:true});
const contract=require('../experience-architecture/coverage-contract.json'),signatures=require('../experience-architecture/signatures.json');
const sourceHash=fingerprint(root), journeyProofs=journeys.flatMap(j=>j.proofs.map(p=>({...p,journey:j.id})));
const proofById=new Map(journeyProofs.map(proof=>[proof.id,proof]));
for(const binding of contract.executedProofs||[]) {
  const known=proofById.get(binding.proof);
  if(known&&known.test!==binding.instrument) {console.error('BLOCKED: Experience-proef heeft twee instrumenten: '+binding.proof);process.exit(2);}
  if(!known) proofById.set(binding.proof,{id:binding.proof,test:binding.instrument,journey:'experience-contract',
    layer:'EXPERIENCE',scope:'Getypeerde contractproducer; de binding bepaalt de exacte onderwerpen en grenzen.'});
}
const proofs=[...proofById.values()];
let selected;
try {selected=select(proofs,process.argv.slice(2));} catch(error) {console.error('BLOCKED: '+error.message);process.exit(2);}
let typedRequired=[];
try {typedRequired=typed.required(contract,signatures,proofs);}
catch(error){console.error('BLOCKED: '+error.message);process.exit(2);}
let commit='unknown'; try {commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();} catch(e) {}
const typedEvidence=[];
if (process.argv.includes('--prove') && graph.valid) {
  for (const p of selected) {
    console.log('Experience proof: '+p.id+' ('+p.test+')');
    const {record,coverage}=execute(root,p);
    if(coverage) typedEvidence.push(coverage);
    const passed=record.passed;
    console.log(p.id+': '+(passed?'passed':'FAILED')+' ('+record.tests+' tests)');
  }
}
const rows=proofs.map(p=>{
  let record; try {record=JSON.parse(fs.readFileSync(path.join(out,p.id+'.json'),'utf8'));} catch(e) {}
  let result=state(record,sourceHash,p.test,Date.now(),commit);
  if (record) {
    try {const log=fs.readFileSync(path.join(out,p.id+'.log'),'utf8');
      if(sha(log)!==record.logHash || result==='PROVEN'&&!outcome(record.exitCode,log)) result='BLOCKED';}
    catch(e){result='BLOCKED';}
  }
  return {...p,...record,state:result,log:record?p.id+'.log':null};
});
const combined=build(root,{evidence:{records:typedEvidence.flatMap(e=>e.records)},commit});
const {scopedProofs,configurationCoverage}=require('./lib/experience/coverage').executionProjection(combined);
const covered=binding=>scopedProofs.some(p=>typed.covers(p.scope,binding));
const typedComplete=typedRequired.every(covered);
const currentCandidate=candidate(root),current=clean.ok&&currentCandidate.ok&&currentCandidate.commit===commit&&fingerprint(root)===sourceHash;
for(const row of rows) {
  const required=typedRequired.filter(binding=>binding.proof===row.id);
  row.scopedStatus=current&&row.state==='PROVEN'&&required.length>0&&required.every(covered)?'PROVEN_IN_SCOPE':'NOT_TESTED';
}
const selectionStatus=current&&graph.valid&&selected.every(p=>rows.some(row=>row.id===p.id&&row.state==='PROVEN'))&&
  typedRequired.filter(b=>selected.some(p=>p.id===b.proof)).every(covered)?'PROVEN_IN_SCOPE':'INCOMPLETE';
const report={version:1,at:new Date().toISOString(),commit,worktreeDirty:!current,sourceHash,graph,proofs:rows,
  status:!graph.valid?'FAILED':current&&selected.length===proofs.length&&rows.every(p=>p.state==='PROVEN')&&typedComplete?'PROVEN_IN_SCOPE':'INCOMPLETE',
  selection:{proofs:selected.map(p=>p.id),status:selectionStatus},
  scopedProofs,configurationCoverage,typedEvidenceBlockers:typedEvidence.filter(e=>!e.records.length).map(e=>e.reason),
  typedProofLifecycle:'Alleen --prove bouwt uitvoeringsgezag op. Imports en --gate zijn geen nieuwe uitvoering.',
  humanReview:'NOT_TESTED',releaseApproved:false};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'index.html'),render(report));
console.log('Experience selectie: '+selectionStatus+'; geheel: '+report.status);
console.log('Experience: '+report.status+'; '+path.join(out,'index.html'));
if (qualifying) { const after=candidate(root); process.exitCode=after.ok&&after.commit===commit&&(process.argv.some(arg=>arg.startsWith('--proof='))?selectionStatus:report.status)==='PROVEN_IN_SCOPE'?0:1; }
