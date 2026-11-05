'use strict';
/* Alleen het subprocess is een stub. De echte executor bewaart en bindt bewijs. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const execution=require('../../scripts/lib/experience/execution');
const evidence=require('../../scripts/lib/experience/evidence');
const artifact=require('../../scripts/lib/experience/artifact');
const sourceContract=require('../../experience-architecture/coverage-contract.json');
const sourceSignatures=require('../../experience-architecture/signatures.json').screens;
const canonical=value=>JSON.stringify(artifact.stable(value));

function fixture(t,name='hotels') {
  assert.ok(['hotels','juridisch'].includes(name));
  const proof={id:name+'-destination',test:'test/'+name+'-ds.e2e.js'},route='/apps/'+name+'.html';
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-execution-matrix-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const put=(name,value)=>{
    const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);
  };
  const contract=structuredClone(sourceContract);
  const signatures={version:1,apps:{},screens:{[route]:structuredClone(sourceSignatures[route])}};
  put('experience-architecture/coverage-contract.json',JSON.stringify(contract));
  put('experience-architecture/signatures.json',JSON.stringify(signatures));
  put(proof.test,'// protocolfixture; geen browseruitvoering\n');

  // Onafhankelijke fixtureprojectie: geen oproep naar de typed adapter.
  const legacy=contract.executedProofs.find(row=>row.proof===proof.id && row.type===undefined);
  const group=contract.executedProofs.find(row=>row.proof===proof.id && row.type!==undefined);
  assert.ok(group);if(name==='hotels')assert.ok(legacy);
  const profiles=contract.configurationCoverage['continuity:destination'].deviceConfigurations;
  const expected=legacy?[{row:legacy,check:legacy.check,scope:legacy.scope,configuration:structuredClone(legacy.configuration),matrixCell:null}]:[];
  for(const device of contract.devices) expected.push({row:group,check:group.check+': '+device,scope:group.scope+'-'+device,
    configuration:{...structuredClone(profiles[device]),...structuredClone(group.configuration),device},
    matrixCell:JSON.stringify(['normal',device,'normal'])});
  assert.equal(expected.length,name==='hotels'?5:4);

  let phase='before',change={},candidateCalls=0;
  t.mock.method(evidence,'candidate',()=>{
    candidateCalls++;
    return {ok:!(phase==='before'?change.beforeDirty:change.dirty || change.finalDirty&&candidateCalls===3),
      commit:phase!=='before'&&change.commit?'other-candidate':'candidate'};
  });
  t.mock.method(evidence,'fingerprint',()=>phase!=='before'&&change.source?'changed-source':'matrix-source');
  const spawn=t.mock.method(cp,'spawnSync',(bin,args,options)=>{
    assert.equal(bin,process.execPath);
    assert.deepEqual(args,['--test','--test-concurrency=1','--test-reporter=tap',proof.test]);
    assert.equal(options.cwd,root);assert.equal(options.env.RTG_EXPERIENCE_COMMIT,'candidate');
    assert.match(options.env.RTG_EXPERIENCE_SOURCE,/^[a-f0-9]{64}$/);
    const configurations=expected.map(cell=>({...structuredClone(cell.configuration),browserVersion:'145.0.1.2'}));
    const observations=expected.map((cell,i)=>({version:1,instrument:proof.test,
      subjectType:cell.row.subjectType,subjectId:cell.row.subjectId,dimension:cell.row.dimension,requirement:cell.row.requirement,
      sourceHash:options.env.RTG_EXPERIENCE_SOURCE,commit:options.env.RTG_EXPERIENCE_COMMIT,
      configurationHash:evidence.sha(canonical(configurations[i])),method:cell.row.method,
      checks:[{id:cell.check,observed:structuredClone(cell.row.expected),expected:structuredClone(cell.row.expected),passed:true}],result:'passed'}));
    const batch={configurations,observations,checks:expected.map(cell=>cell.check)};
    if(change.batch)change.batch(batch);
    const count=batch.checks.length,failed=change.fail?1:0,skipped=change.skip?1:0;
    const named=batch.checks.map((name,i)=>(failed&&i===0?'not ok ':'ok ')+(i+1)+' - '+name+(skipped&&i===0?' # SKIP fixture':'')).join('\n');
    const diagnostics=batch.configurations.map(c=>'# RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(c))
      .concat(batch.observations.map(o=>'# RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(o))).join('\n');
    const stdout='TAP version 13\n'+named+'\n# tests '+count+'\n# pass '+(count-failed-skipped)+'\n# fail '+failed+
      '\n# cancelled 0\n# skipped '+skipped+'\n# todo 0\n'+diagnostics+'\n';
    phase='after';
    return {stdout,stderr:'',status:failed?1:0};
  });
  function run(options={}) {
    change=options;phase='before';candidateCalls=0;
    return execution.execute(root,proof);
  }
  const context=record=>({root,subjectType:record.subjectType,subjectId:record.subjectId,
    requirement:record.requirement,configurationHash:record.configurationHash});
  const assess=record=>artifact.assessment(record,record.sourceHash,record.commit,record.dimension,context(record));
  const read=name=>fs.readFileSync(path.join(root,name),'utf8');
  const body=record=>JSON.parse(read(record.artifact));
  return {root,contract,signatures,expected,spawn,run,assess,read,body};
}

module.exports={fixture};
