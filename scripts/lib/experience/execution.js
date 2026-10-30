/* De bestaande Experience-subprocessuitvoering, eenmaal gedeeld met de lezer.
   Geen persistent gezag: alleen deze aanroep bezit haar eigen procesresultaat.
   Een volgende --prove bouwt het opnieuw op; import kan dat niet reconstrueren. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const evidence = require('./evidence');
const receipts = new WeakMap();
const PREFIX = '# RTG_EXPERIENCE_OBSERVATION ';
function json(root,name) { return JSON.parse(fs.readFileSync(path.join(root,name),'utf8')); }
function canonical(value) { return JSON.stringify(require('./artifact').stable(value)); }
function scoped(record,root) {
  const receipt = record && receipts.get(record);
  return receipt && receipt.root === path.resolve(root) && receipt.snapshot === canonical(record) ? structuredClone(receipt.scope) : null;
}
function typed(root,proof,run,log,before,after,source) {
  const contract = json(root,'experience-architecture/coverage-contract.json');
  const bindings = (contract.executedProofs || []).filter(binding => binding.proof === proof.id);
  if (!bindings.length) return null;
  if (bindings.length !== 1) throw new Error('Dubbele Experience-producer');
  const b = bindings[0];
  // Dit pakket kan precies één type uitvoeren; een contract mag niet via een
  // willekeurig method/config-veld nieuw uitvoeringsgezag toekennen.
  if (b.instrument !== 'test/hotels-ds.e2e.js' || b.instrument !== proof.test || b.subjectType !== 'screen' || b.subjectId !== 'screen:/apps/hotels.html' ||
      b.dimension !== 'continuity' || b.requirement !== 'destination' || b.method !== 'browser' ||
      b.scope !== 'hotels-member-normal-chromium-390x844' || !contract.continuityChecks.includes(b.requirement)) {
    throw new Error('Onbekend getypeerd Experience-contract');
  }
  if (!before.ok || !after.ok || before.commit !== after.commit || source !== evidence.fingerprint(root) ||
      !evidence.outcome(run.status,run.stdout || '')) return {configuration:null,records:[],reason:'EXECUTION_NOT_STABLE'};
  const configs = log.split(/\r?\n/).filter(line=>line.startsWith('# RTG_EXPERIENCE_CONFIGURATION '))
    .map(line=>JSON.parse(line.slice('# RTG_EXPERIENCE_CONFIGURATION '.length)));
  const observations = log.split(/\r?\n/).filter(line=>line.startsWith(PREFIX)).map(line=>JSON.parse(line.slice(PREFIX.length)));
  if (configs.length !== 1 || observations.length !== 1) return {records:[],reason:'EXACT_OBSERVATION_MISSING'};
  const configuration = configs[0], observation = observations[0];
  const {browserVersion,...fixed} = configuration;
  if (typeof browserVersion !== 'string' || !/^\d+(\.\d+)+$/.test(browserVersion) || canonical(fixed) !== canonical(b.configuration)) {
    return {records:[],reason:'TYPED_CONFIGURATION_MISMATCH'};
  }
  const sourceHash = require('./coverage').sourceHash(root,contract,json(root,'experience-architecture/signatures.json'));
  const configurationHash = evidence.sha(canonical(configuration));
  const binding = {subjectType:b.subjectType,subjectId:b.subjectId,dimension:b.dimension,requirement:b.requirement,
    sourceHash,commit:before.commit,configurationHash,method:b.method};
  const expected = {version:1,instrument:proof.test,...binding,checks:[{id:b.check,observed:b.expected,expected:b.expected,passed:true}],result:'passed'};
  if (canonical(observation) !== canonical(expected)) return {records:[],reason:'TYPED_OBSERVATION_MISMATCH'};
  const artifactPath = 'artifacts/experience/'+proof.id+'.coverage.json';
  const artifact = {...observation,at:new Date().toISOString(),worktreeDirty:false,configuration,
    log:{path:'artifacts/experience/'+proof.id+'.log',sha256:evidence.sha(log),exitCode:run.status}};
  const bytes = JSON.stringify(artifact,null,2)+'\n';
  fs.writeFileSync(path.join(root,artifactPath),bytes);
  const record = {...binding,worktreeDirty:false,status:'PROVEN',artifact:artifactPath,artifactHash:evidence.sha(bytes)};
  receipts.set(record,{root:path.resolve(root),snapshot:canonical(record),scope:structuredClone({id:b.scope,configuration,
    instrument:proof.test,check:b.check,requirement:b.requirement,subjectId:b.subjectId})});
  return {configuration,records:[record]};
}
function execute(root,proof) {
  if (!/^[a-z][a-z0-9-]*$/.test(proof.id) || !/^test\/[\w.-]+\.js$/.test(proof.test)) throw new Error('Ongeldige Experience-proef');
  const before = evidence.candidate(root);
  if (!before.ok) throw new Error('Experience-uitvoering vereist een schone kandidaat');
  const source = evidence.fingerprint(root);
  const contract = json(root,'experience-architecture/coverage-contract.json');
  const sourceHash = require('./coverage').sourceHash(root,contract,json(root,'experience-architecture/signatures.json'));
  const run = cp.spawnSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',proof.test],
    {cwd:root,env:{...process.env,RTG_EXPERIENCE_SOURCE:sourceHash,RTG_EXPERIENCE_COMMIT:before.commit},
      encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
  const log = (run.stdout||'')+'\n'+(run.stderr||'')+(run.error?'\n'+run.error.message:'');
  const number = n=>Number(((run.stdout||'').match(new RegExp('^# '+n+' (\\d+)$','m'))||[])[1])||0;
  const after = evidence.candidate(root);
  const record = {version:1,test:proof.test,at:new Date().toISOString(),sourceHash:source,sourceChanged:evidence.fingerprint(root)!==source,
    commit:before.commit,worktreeDirty:!after.ok||after.commit!==before.commit,exitCode:run.status,
    passed:evidence.outcome(run.status,run.stdout||''),tests:number('tests'),skipped:number('skipped'),logHash:evidence.sha(log)};
  const out = path.join(root,'artifacts/experience'); fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,proof.id+'.log'),log);
  fs.writeFileSync(path.join(out,proof.id+'.json'),JSON.stringify(record,null,2)+'\n');
  let coverage;
  try { coverage = typed(root,proof,run,log,before,after,source); }
  catch (error) { coverage = {records:[],reason:'TYPED_EXECUTION_REJECTED: '+error.message}; }
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
