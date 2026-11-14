/* De bestaande Experience-subprocessuitvoering, eenmaal gedeeld met de lezer.
   Geen persistent gezag: alleen deze aanroep bezit haar eigen procesresultaat.
   Een volgende --prove bouwt het opnieuw op; import kan dat niet reconstrueren. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const evidence = require('./evidence');
const typed = require('./typed');
const {randomUUID}=require('node:crypto');
const receipts = new WeakMap();
function json(root,name) { return JSON.parse(fs.readFileSync(path.join(root,name),'utf8')); }
function canonical(value) { return JSON.stringify(require('./artifact').stable(value)); }
function scoped(record,root) {
  const receipt = record && receipts.get(record);
  return receipt && receipt.root === path.resolve(root) && receipt.snapshot === canonical(record) ? structuredClone(receipt.scope) : null;
}
function execute(root,proof) {
  if (!/^[a-z][a-z0-9-]*$/.test(proof.id) || !/^test\/[\w.-]+\.js$/.test(proof.test)) throw new Error('Ongeldige Experience-proef');
  const timeoutMs=proof.timeoutMs===undefined?240000:proof.timeoutMs;
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>3600000) throw new Error('Ongeldige Experience-proeftijd');
  const before = evidence.candidate(root);
  if (!before.ok) throw new Error('Experience-uitvoering vereist een schone kandidaat');
  const source = evidence.fingerprint(root),runId=randomUUID();
  const contract = json(root,'experience-architecture/coverage-contract.json');
  const signatures=json(root,'experience-architecture/signatures.json');
  const sourceHash = require('./coverage').sourceHash(root,contract,signatures);
  const run = cp.spawnSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',proof.test],
    {cwd:root,env:{...process.env,RTG_EXPERIENCE_SOURCE:sourceHash,RTG_EXPERIENCE_COMMIT:before.commit},
      encoding:'utf8',timeout:timeoutMs,maxBuffer:64*1024*1024});
  const log = (run.stdout||'')+'\n'+(run.stderr||'')+(run.error?'\n'+run.error.message:'');
  const number = n=>Number(((run.stdout||'').match(new RegExp('^# '+n+' (\\d+)$','m'))||[])[1])||0;
  const after = evidence.candidate(root);
  const record = {version:1,runId,test:proof.test,at:new Date().toISOString(),sourceHash:source,sourceChanged:evidence.fingerprint(root)!==source,
    commit:before.commit,worktreeDirty:!after.ok||after.commit!==before.commit,exitCode:run.status,
    passed:evidence.outcome(run.status,run.stdout||''),tests:number('tests'),skipped:number('skipped'),logHash:evidence.sha(log)};
  const runPath='artifacts/experience/'+proof.id+'/'+runId;
  const out=path.join(root,runPath);fs.mkdirSync(out,{recursive:true});
  const logPath=runPath+'/run.log';
  fs.writeFileSync(path.join(root,logPath),log);
  fs.writeFileSync(path.join(out,'run.json'),JSON.stringify(record,null,2)+'\n');
  // De bestaande laatste-proefweergave blijft beschikbaar. Receipts verwijzen
  // uitsluitend naar de onveranderde bestanden van hun eigen uitvoering.
  const latest=path.join(root,'artifacts/experience',proof.id);
  fs.writeFileSync(latest+'.log',log);
  fs.writeFileSync(latest+'.json',JSON.stringify(record,null,2)+'\n');
  let coverage;
  try {
    if(!after.ok||after.commit!==before.commit||source!==evidence.fingerprint(root)||!record.passed) {
      coverage={records:[],reason:'EXECUTION_NOT_STABLE'};
    } else {
      const cells=typed.prepare(contract,signatures,proof,log,sourceHash,before.commit);
      if(cells) {
        const records=cells.map(cell=>{
          const artifactPath=runPath+'/'+evidence.sha(canonical(cell.binding))+'.coverage.json';
          const artifact={...cell.observation,at:record.at,worktreeDirty:false,configuration:cell.configuration,
            log:{path:logPath,sha256:evidence.sha(log),exitCode:run.status}};
          const bytes=JSON.stringify(artifact,null,2)+'\n';fs.writeFileSync(path.join(root,artifactPath),bytes);
          return {...cell.binding,worktreeDirty:false,status:'PROVEN',artifact:artifactPath,artifactHash:evidence.sha(bytes)};
        });
        const final=evidence.candidate(root);
        if(!final.ok||final.commit!==before.commit||source!==evidence.fingerprint(root)) throw new Error('EXECUTION_NOT_STABLE');
        // Pas na volledige batchvalidatie en bewaring krijgt iedere originele
        // recordreferentie gezag. Een mislukte schrijf levert geen halve batch.
        records.forEach((entry,i)=>receipts.set(entry,{root:path.resolve(root),snapshot:canonical(entry),scope:structuredClone({...cells[i].scope,runId})}));
        coverage={version:1,runId,records,...(cells.length===1?{configuration:structuredClone(cells[0].configuration)}:{})};
      }
    }
  } catch(error) {coverage={records:[],reason:'TYPED_EXECUTION_REJECTED: '+error.message};}
  return {record,coverage};
}
function select(proofs,args) {
  const filters=args.filter(arg=>arg.startsWith('--proof'));
  if (!filters.length) return proofs;
  if (filters.length!==1 || !args.includes('--prove') || !/^--proof=[a-z][a-z0-9-]*$/.test(filters[0])) throw new Error('--proof vereist precies één bestaande proef en --prove');
  const id=filters[0].slice('--proof='.length), selected=proofs.filter(proof=>proof.id===id);
  if(selected.length!==1) throw new Error('Onbekende of dubbele Experience-proef: '+id);
  return selected;
}
module.exports = {execute,scoped,select};
