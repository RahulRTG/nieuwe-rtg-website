'use strict';
/* Alleen protocol-unitproeven met een subprocessstub. Dit bestand produceert
   geen Hotels-browserbewijs, neemt geen register op en opent geen browser. */
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), cp=require('node:child_process');
const execution=require('../scripts/lib/experience/execution');
const evidence=require('../scripts/lib/experience/evidence');
const artifact=require('../scripts/lib/experience/artifact');
const coverage=require('../scripts/lib/experience/coverage');
const contract=require('../experience-architecture/coverage-contract.json');
const vm=require('node:vm');
const canonical=value=>JSON.stringify(artifact.stable(value));
function fixture(t,change={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-execution-unit-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const put=(name,body)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
  const local=structuredClone(contract),binding=local.executedProofs[0];
  local.executedProofs=[binding]; // deze protocollen bewaken uitsluitend het bestaande 390×844-type
  if(change.binding)change.binding(binding);
  put('experience-architecture/coverage-contract.json',JSON.stringify(local));
  put('experience-architecture/signatures.json',JSON.stringify({version:1,apps:{},screens:change.signature?{'/apps/hotels.html':change.signature}:{}}));
  put('test/hotels-ds.e2e.js','// protocolfixture; geen browserproef\n');
  let post=false;
  t.mock.method(evidence,'candidate',()=>({ok:!(post&&change.dirty),commit:post&&change.commit?'other':'candidate'}));
  t.mock.method(evidence,'fingerprint',()=>post&&change.source?'changed':'source');
  let configuration;
  const spawn=t.mock.method(cp,'spawnSync',(bin,args,options)=>{
    assert.equal(bin,process.execPath);assert.deepEqual(args,['--test','--test-concurrency=1','--test-reporter=tap','test/hotels-ds.e2e.js']);
    assert.equal(options.cwd,root);
    configuration={...binding.configuration,browserVersion:'145.0.1.2'};
    if(change.configuration)change.configuration(configuration);
    const observation={version:1,instrument:binding.instrument,subjectType:binding.subjectType,subjectId:binding.subjectId,
      dimension:binding.dimension,requirement:binding.requirement,sourceHash:options.env.RTG_EXPERIENCE_SOURCE,
      commit:options.env.RTG_EXPERIENCE_COMMIT,configurationHash:evidence.sha(canonical(configuration)),method:binding.method,
      checks:[{id:binding.check,observed:binding.expected,expected:binding.expected,passed:true}],result:'passed'};
    if(change.observation)change.observation(observation);
    const config='# RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(configuration)+'\n';
    const diagnostic='# RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(observation)+'\n';
    const stdout='TAP version 13\nok 1 - '+binding.check+'\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped '+(change.skipped?1:0)+'\n# todo 0\n'+config+(change.missing?'':diagnostic)+(change.duplicate?diagnostic:'');
    post=true;return {stdout,stderr:'',status:change.exit?1:0};
  });
  const run=()=>execution.execute(root,{id:'hotels-destination',test:'test/hotels-ds.e2e.js'});
  const assess=record=>artifact.assessment(record,record.sourceHash,record.commit,record.dimension,{root,subjectType:record.subjectType,
    subjectId:record.subjectId,requirement:record.requirement,configurationHash:record.configurationHash});
  return {root,run,assess,spawn,get configuration(){return configuration;}};
}
test('uitvoerder bezit alleen haar eigen exacte deelbewijs; import verkrijgt nooit gezag',t=>{
  const f=fixture(t),r=f.run(); assert.equal(f.spawn.mock.callCount(),1);
  const record=r.coverage.records[0];assert.ok(record);
  assert.equal(f.assess(record).scopedStatus,'PROVEN_IN_SCOPE');
  assert.equal(f.assess(record).status,'BLOCKED');
  assert.equal(f.assess(record).reason,'REQUIRED_CONFIGURATION_COVERAGE_INCOMPLETE');
  const imported=JSON.parse(JSON.stringify(record));
  assert.equal(f.assess(imported).integrity,'VALID');assert.equal(f.assess(imported).scopedStatus,undefined);
  assert.equal(f.assess(imported).reason,'AUTHORITATIVE_EXECUTION_AND_TYPED_REQUIREMENT_BINDING_MISSING');
  record.method='visual';assert.equal(f.assess(record).scopedStatus,undefined);
});
test('coverage neemt de deelcel met geldige signature op zonder requirement, dimensie of scherm groen te maken',t=>{
  const signature=require('../experience-architecture/signatures.json').screens['/apps/hotels.html'];
  const f=fixture(t,{signature}),r=f.run(),record=r.coverage.records[0];
  const report=coverage.build(f.root,{apps:[],screens:[{id:'screen:/apps/hotels.html',route:'/apps/hotels.html',profile:'interface',world:'travel'}],
    evidence:r.coverage,sourceHash:record.sourceHash,commit:record.commit});
  const continuity=report.screens[0].dimensions.find(d=>d.id==='continuity');
  assert.equal(report.screens[0].signature.status,'DECLARED');
  assert.equal(continuity.configurationCoverage[0].requiredCellCount,180);
  assert.equal(continuity.configurationCoverage[0].mappedCellCount,0,'normal-deelcel is nog geen gebonden matrixcel');
  assert.equal(continuity.scopedProofs.length,1);assert.equal(continuity.scopedProofs[0].status,'PROVEN_IN_SCOPE');
  assert.equal(continuity.provenCount,0);assert.notEqual(continuity.status,'PROVEN');
  assert.equal(report.summary.screens.proven,0);assert.notEqual(report.status,'PROVEN');
});
for(const [name,change] of [
  ['geen diagnostic',{missing:true}],['dubbele diagnostic',{duplicate:true}],['failure',{exit:true}],['skip',{skipped:true}],
  ['vuile kandidaat na proef',{dirty:true}],['gewijzigde commit',{commit:true}],['gewijzigde bron',{source:true}],
  ['verkeerde viewport',{configuration:c=>{c.viewport={width:1440,height:900};}}],
  ['geen gemeten browserversie',{configuration:c=>{delete c.browserVersion;}}],
  ['verkeerde requirement',{observation:o=>{o.requirement='back-forward';}}],
  ['ander scherm',{observation:o=>{o.subjectId='screen:/apps/reizen.html';}}],
  ['verkeerde bron',{observation:o=>{o.sourceHash='wrong';}}],
  ['verkeerde methode',{observation:o=>{o.method='accessibility';}}],
  ['zelfverklaarde waarneming die niet klopt',{observation:o=>{o.checks[0].observed={...o.checks[0].observed,ownerAuthenticated:false};}}],
  ['ander testinstrument',{binding:b=>{b.instrument='test/unrelated.test.js';}}],
  ['menselijke bewijsclaim',{binding:b=>{b.dimension='human-quality';}}],
  ['niet-ondersteund type',{binding:b=>{b.scope='all-devices';}}]
]) test('deelbewijs weigert '+name,t=>{const f=fixture(t,change);assert.equal(f.run().coverage.records.length,0);});
test('vuile kandidaat vóór uitvoering start geen proef',t=>{
  const f=fixture(t);t.mock.method(evidence,'candidate',()=>({ok:false,commit:'candidate'}));
  assert.throws(f.run,/schone kandidaat/);assert.equal(f.spawn.mock.callCount(),0);
});
test('bestaand geldig log zonder execute-object kan geen ontvangstbewijs reconstrueren',t=>{
  const f=fixture(t),r=f.run(),record=r.coverage.records[0];
  assert.equal(execution.scoped(JSON.parse(JSON.stringify(record)),f.root),null);
  assert.equal(execution.scoped(record,path.join(f.root,'other')),null);
});

test('selectie is exact, vereist --prove en weigert onbekend, dubbel of leeg',()=>{
  const proofs=[{id:'hotels-destination'},{id:'travel-domain'}];
  assert.deepEqual(execution.select(proofs,['--prove']),proofs);
  assert.deepEqual(execution.select(proofs,['--prove','--proof=hotels-destination']),[proofs[0]]);
  for(const args of [['--proof=hotels-destination'],['--prove','--proof=unknown'],['--prove','--proof='],
    ['--prove','--proof=hotels-destination','--proof=travel-domain']]) assert.throws(()=>execution.select(proofs,args));
});
test('Hotels-schermbewijs erft niet naar residentie of een andere logische app',t=>{
  const f=fixture(t),r=f.run(),record=r.coverage.records[0];
  const report=coverage.build(f.root,{apps:[{id:'app:travel:residentie',destination:'/apps/hotels.html'}],
    screens:[{id:'screen:/apps/hotels.html',route:'/apps/hotels.html',profile:'interface',world:'travel'}],
    evidence:r.coverage,sourceHash:record.sourceHash,commit:record.commit});
  assert.equal(report.logicalApps.length,1);assert.equal(report.logicalApps[0].id,'app:travel:residentie');
  assert.equal(report.logicalApps[0].dimensions.some(d=>d.scopedProofs?.length),false);
  assert.equal(report.summary.logicalApps.proven,0);
  assert.equal(report.screens[0].dimensions.find(d=>d.id==='continuity').scopedProofs.length,1);
});

test('de configuratie van een ontvangstbewijs kan niet achteraf worden veranderd',t=>{
  const f=fixture(t),run=f.run(),record=run.coverage.records[0];
  const first=f.assess(record);first.scope.configuration.viewport.width=999;
  first.scope.configuration.browser='forged';
  run.coverage.configuration.viewport.width=777;
  const second=f.assess(record);
  assert.equal(second.scopedStatus,'PROVEN_IN_SCOPE');
  assert.equal(second.scope.configuration.viewport.width,390);
  assert.equal(second.scope.configuration.browser,'chromium');
  assert.notEqual(first.scope,second.scope);
});

// Protocol van de echte CLI, zonder subprocess of bewijsstatus te fabriceren
// voor de repository. De echte ontvangstverificatie wordt hierboven getoetst.
function cli(args,options={}) {
  const proof={id:'protocol-proof',test:'test/protocol.test.js'}, writes=[], runs=[], calls=[];
  const run={record:{passed:!options.failed,tests:1},coverage:{records:[{proof:proof.id}]}};
  const proofs=options.multiple?[proof,{id:'untyped-proof',test:'test/untyped.test.js'}]:[proof];
  const processStub={argv:['node','experience.js',...args],exitCode:0,
    exit(code){this.exitCode=code;throw stop;}};
  const stop={}, root=path.resolve(__dirname,'..');
  const modules={
    'node:fs':{mkdirSync(){writes.push('mkdir');},readdirSync(){return ['journey.json'];},
      readFileSync(file){return file.endsWith('journey.json')?JSON.stringify({proofs}):
        file.endsWith('.log')?'log':JSON.stringify({...run.record,logHash:'hash'});},
      writeFileSync(file,body){writes.push({file,body});}},
    'node:path':path,'node:child_process':{execFileSync(){return 'candidate';}},
    './lib/experience/compiler':{compile(){return {valid:true,nodes:[]};}},
    './lib/experience/evidence':{fingerprint(){return options.changedSource&&calls.length?'changed':'source';},outcome(){return !options.failed;},
      state(){return options.failed?'FAILED':'PROVEN';},sha(){return 'hash';},
      candidate(){return {ok:!options.dirty,commit:options.changedCommit&&calls.length?'changed':'candidate',reason:'DIRTY_WORKTREE'};}},
    './lib/experience/observatory':{render(){return '<html></html>';}},
    './lib/experience/execution':{select:execution.select,execute(){
      const result=runs.length?{record:{passed:true,tests:1}}:run;
      runs.push(result);return result;}},
    './lib/experience/typed':{required(){return [];},covers(){return false;}},
    './lib/experience/coverage':{build(){return {};},executionProjection(){return {scopedProofs:[],configurationCoverage:[]};}},
    './lib/experience/qualification-gates':{assess(receivedRoot,received){calls.push({root:receivedRoot,options:received});
      return {gate:received.gate,status:options.gateStatus||'BLOCKED',releaseAuthorized:false};}},
    '../experience/constitution.json':{},'../experience-architecture/coverage-contract.json':{executedProofs:[]},
    '../experience-architecture/signatures.json':{}
  };
  try {vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/experience.js'),'utf8'),{
    __dirname:path.join(root,'scripts'),process:processStub,console:{log(){},error(){}},
    require(name){assert.ok(Object.hasOwn(modules,name),'onverwachte CLI-afhankelijkheid '+name);return modules[name];}
  });} catch(error){if(error!==stop)throw error;}
  const report=writes.find(w=>w.file?.endsWith('report.json'));
  return {code:processStub.exitCode,runs,run,calls,writes,report:report&&JSON.parse(report.body)};
}

test('NEXT-CLI geeft originele volledige execute-objecten aan dezelfde procesbeoordelaar',()=>{
  const r=cli(['--prove','--proof=protocol-proof','--next-gate=G1']);
  assert.equal(r.calls.length,1);
  assert.equal(r.calls[0].options.gate,'G1');
  assert.equal(r.calls[0].options.executions[0],r.run);
  assert.equal(r.calls[0].options.executions[0].coverage.records[0],r.run.coverage.records[0]);
  assert.equal(r.report.nextGate.snapshotOnly,true);
  assert.equal(r.report.nextGate.reusableEvidence,false);
  assert.equal(r.report.releaseApproved,false);
  assert.equal(r.code,1,'geslaagde proef heft geblokkeerde poort niet op');
});

test('NEXT-CLI valideert poortopties vóór uitvoering of schrijfactie',()=>{
  for(const args of [ ['--next-gate=G1'],['--gate','--next-gate=G1'],['--check','--next-gate=G1'],
    ['--prove','--next-gate'],['--prove','--next-gate='],['--prove','--next-gate=G5'],
    ['--prove','--next-gate=g1'],['--prove','--next-gate=G1','--next-gate=G2'] ]) {
    const r=cli(args);assert.equal(r.code,2,args.join(' '));
    assert.equal(r.runs.length,0);assert.equal(r.calls.length,0);assert.equal(r.writes.length,0);
  }
});

test('NEXT-CLI vereist proefsucces én poortsucces; bestaande modus verandert niet',()=>{
  for(const gate of ['G1','G2','G3','G4']) {
    const goed=cli(['--prove','--next-gate='+gate],{gateStatus:'PROVEN'});
    assert.equal(goed.code,0);assert.equal(goed.calls[0].options.gate,gate);
    const fout=cli(['--prove','--next-gate='+gate],{gateStatus:'PROVEN',failed:true});
    assert.equal(fout.code,1);assert.equal(fout.calls[0].options.executions[0],fout.run);
  }
  const oud=cli(['--prove']);assert.equal(oud.code,0);assert.equal(oud.calls.length,0);
  assert.equal(Object.hasOwn(oud.report,'nextGate'),false);
  const vuil=cli(['--prove','--next-gate=G1'],{dirty:true});
  assert.equal(vuil.code,2);assert.equal(vuil.runs.length,0);assert.equal(vuil.writes.length,0);
});

test('NEXT-CLI bewaart ook uitvoeringen zonder getypeerde coverage en weigert verandering tijdens beoordeling',()=>{
  const r=cli(['--prove','--next-gate=G1'],{multiple:true});
  assert.equal(r.runs.length,2);
  assert.equal(r.calls[0].options.executions[0],r.runs[0]);
  assert.equal(r.calls[0].options.executions[1],r.runs[1]);
  assert.equal(Object.hasOwn(r.runs[1],'coverage'),false);
  for(const option of ['changedCommit','changedSource']) {
    const veranderd=cli(['--prove','--next-gate=G1'],{gateStatus:'PROVEN',[option]:true});
    assert.equal(veranderd.calls.length,1);
    assert.equal(veranderd.code,1,option+' mag niet groen eindigen');
  }
});
