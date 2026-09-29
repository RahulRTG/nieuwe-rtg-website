#!/usr/bin/env node
/* Eén ingang voor contract, echte proeven en het lokale observatorium.
   Geen productieaanpassing, telemetry of ongemeten groene vinkjes. */
'use strict';
const fs=require('node:fs'), path=require('node:path'), cp=require('node:child_process');
const {compile}=require('./lib/experience/compiler');
const {fingerprint,outcome,state,sha}=require('./lib/experience/evidence');
const {render}=require('./lib/experience/observatory');
const root=path.resolve(__dirname,'..'), out=path.join(root,'artifacts/experience');
const constitution=require('../experience/constitution.json');
const journeys=fs.readdirSync(path.join(root,'experience')).filter(n=>n.endsWith('.json')&&n!=='constitution.json')
  .map(n=>JSON.parse(fs.readFileSync(path.join(root,'experience',n),'utf8')));
const graph=compile(root,constitution,journeys);
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({valid:graph.valid,errors:graph.errors,journeys:journeys.length,screens:graph.nodes.filter(n=>n.route).length},null,2));
  process.exit(graph.valid?0:1);
}
fs.mkdirSync(out,{recursive:true});
const sourceHash=fingerprint(root), proofs=journeys.flatMap(j=>j.proofs.map(p=>({...p,journey:j.id})));
let dirty=true; try {dirty=!!cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();} catch(e) {}
let commit='unknown'; try {commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();} catch(e) {}
if (process.argv.includes('--prove') && graph.valid) {
  for (const p of proofs) {
    console.log('Experience proof: '+p.id+' ('+p.test+')');
    const run=cp.spawnSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',p.test],
      {cwd:root,env:process.env,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
    const log=(run.stdout||'')+'\n'+(run.stderr||'')+(run.error?'\n'+run.error.message:'');
    const passed=outcome(run.status,run.stdout||''), number=n=>Number(((run.stdout||'').match(new RegExp('^# '+n+' (\\d+)$','m'))||[])[1])||0;
    const record={version:1,test:p.test,at:new Date().toISOString(),sourceHash,sourceChanged:fingerprint(root)!==sourceHash,
      commit,worktreeDirty:dirty,exitCode:run.status,passed,tests:number('tests'),skipped:number('skipped'),logHash:sha(log)};
    fs.writeFileSync(path.join(out,p.id+'.log'),log);
    fs.writeFileSync(path.join(out,p.id+'.json'),JSON.stringify(record,null,2)+'\n');
    console.log(p.id+': '+(passed?'passed':'FAILED')+' ('+record.tests+' tests)');
  }
}
const rows=proofs.map(p=>{
  let record; try {record=JSON.parse(fs.readFileSync(path.join(out,p.id+'.json'),'utf8'));} catch(e) {}
  let result=state(record,sourceHash,p.test);
  if (record) {
    try {const log=fs.readFileSync(path.join(out,p.id+'.log'),'utf8');
      if(sha(log)!==record.logHash || result==='PROVEN'&&!outcome(record.exitCode,log)) result='BLOCKED';}
    catch(e){result='BLOCKED';}
  }
  return {...p,...record,state:result,log:record?p.id+'.log':null};
});
const report={version:1,at:new Date().toISOString(),commit,worktreeDirty:dirty,sourceHash,graph,proofs:rows,
  status:!graph.valid?'FAILED':rows.every(p=>p.state==='PROVEN')?'PROVEN_IN_SCOPE':'INCOMPLETE',
  humanReview:'NOT_TESTED',releaseApproved:false};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'index.html'),render(report));
console.log('Experience: '+report.status+'; '+path.join(out,'index.html'));
if (process.argv.includes('--prove')||process.argv.includes('--gate')) process.exitCode=report.status==='PROVEN_IN_SCOPE'?0:1;
