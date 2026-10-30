'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {status,integrity,assessment,stable} = require('../scripts/lib/experience/artifact');
const {fingerprint,sha,state,candidate} = require('../scripts/lib/experience/evidence');
const coverage = require('../scripts/lib/experience/coverage');
const contract = require('../experience-architecture/coverage-contract.json');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'rtg-experience-proof-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write = (name,body) => { fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true}); fs.writeFileSync(path.join(root,name),body); };
  write('test/sample.js','// fixture test source\n');
  const tap = 'ok 1 - visible\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  const configuration = {browser:'chromium',viewport:{width:390,height:844}};
  const binding = {subjectType:'app',subjectId:'app:test',dimension:'identity',requirement:'signature',
    sourceHash:'source',commit:'candidate',configurationHash:sha(JSON.stringify(stable(configuration))),method:'browser'};
  const body = {version:1,worktreeDirty:false,...binding,configuration,at:new Date().toISOString(),instrument:'test/sample.js',
    checks:[{id:'visible',observed:true,expected:true,passed:true}],result:'passed'};
  const diagnostic = {version:1,instrument:body.instrument,...binding,checks:body.checks,result:body.result};
  const log = tap + '# RTG_EXPERIENCE_OBSERVATION ' + JSON.stringify(diagnostic) + '\n';
  write('artifacts/experience/run.tap',log);
  body.log = {path:'artifacts/experience/run.tap',sha256:sha(log),exitCode:0};
  const record = {...binding,worktreeDirty:false,status:'PROVEN',artifact:'artifacts/experience/proof.json'};
  function save() {const text=JSON.stringify(body);write(record.artifact,text);record.artifactHash=sha(text);}
  save();
  const context = {root,subjectType:binding.subjectType,subjectId:binding.subjectId,requirement:binding.requirement,configurationHash:binding.configurationHash};
  return {root,write,body,record,context,configuration,diagnostic,tap,save,check:()=>integrity(record,'source','candidate','identity',context)};
}
test('integere artefacten zijn geen releasebewijs',t=>{
  const f=fixture(t); assert.equal(f.check(),'VALID');
  const result=assessment(f.record,'source','candidate','identity',f.context);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'AUTHORITATIVE_EXECUTION_AND_TYPED_REQUIREMENT_BINDING_MISSING');
  assert.equal(status({...f.record,artifactHash:undefined},'source','candidate','identity',f.context),'BLOCKED');
  assert.equal(status(f.record,'source','candidate','identity'),'BLOCKED');
  fs.unlinkSync(path.join(f.root,f.record.artifact)); assert.equal(f.check(),'BLOCKED');
});
for(const field of ['subjectId','subjectType','dimension','requirement','sourceHash','commit','configurationHash','method']) {
  test('artefact van andere '+field+' kan geen geldige metadata erven',t=>{
    const f=fixture(t); f.body[field]='other';f.save();assert.equal(f.check(),'BLOCKED');
  });
}
test('gewijzigd, leeg of onleesbaar artefact en ontbrekend log blokkeren',t=>{
  const f=fixture(t);f.write(f.record.artifact,'{}');assert.equal(f.check(),'BLOCKED');
  f.record.artifactHash=sha('{}');assert.equal(f.check(),'BLOCKED');
  f.save();fs.unlinkSync(path.join(f.root,'artifacts/experience/run.tap'));assert.equal(f.check(),'BLOCKED');
});
test('gehashte maar falende of overgeslagen proef blijft afgekeurd',t=>{
  const f=fixture(t), bad='# tests 1\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n';
  f.write(f.body.log.path,bad);f.body.log.sha256=sha(bad);f.save();assert.equal(f.check(),'FAILED');
});
test('andere configuratie, ontbrekende waarneming en verlopen bewijs worden geweigerd',t=>{
  const f=fixture(t);f.body.configuration.viewport.width=1440;f.save();assert.equal(f.check(),'BLOCKED');
  f.body.configuration.viewport.width=390;f.body.checks=[];f.save();assert.equal(f.check(),'BLOCKED');
  f.body.checks=[{id:'visible',observed:true,expected:true,passed:true}];
  f.body.at=new Date(Date.now()-86400001).toISOString();f.save();assert.equal(f.check(),'STALE');
});
test('een groen proces bewijst geen benoemde controle die niet in het log slaagde',t=>{
  const f=fixture(t);f.body.checks[0].id='not-executed';f.save();assert.equal(f.check(),'BLOCKED');
});
for (const field of ['instrument','subjectId','requirement','sourceHash','commit','configurationHash','method','checks']) {
  test('groen log met andere waarneming voor '+field+' blijft geblokkeerd',t=>{
    const f=fixture(t), diagnostic={...f.diagnostic,[field]:field==='checks'?[]:'other'};
    const log=f.tap+'# RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(diagnostic)+'\n';
    f.write(f.body.log.path,log);f.body.log.sha256=sha(log);f.save();assert.equal(f.check(),'BLOCKED');
  });
}
test('onverwante of dubbele logs blokkeren',t=>{
  const f=fixture(t);
  for(const log of [f.tap,f.tap+('# RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(f.diagnostic)+'\n').repeat(2)]) {
    f.write(f.body.log.path,log);f.body.log.sha256=sha(log);f.save();assert.equal(f.check(),'BLOCKED');
  }
});
test('zelfverklaarde menselijke reviewer en buiten-root symlink krijgen geen groen',t=>{
  const f=fixture(t);
  assert.equal(status({...f.record,method:'human-user-test',reviewer:{type:'human',id:'persoon'}},'source','candidate','human-quality',f.context),'BLOCKED');
  fs.symlinkSync(__filename,path.join(f.root,'outside.json'));
  f.record.artifact='outside.json';f.record.artifactHash=sha(fs.readFileSync(__filename));assert.equal(f.check(),'BLOCKED');
});
test('conflicterende dubbele records blokkeren ongeacht volgorde',t=>{
  const f=fixture(t), app={id:'app:test',destination:'/apps/test.html'}, screen={id:'screen:/apps/test.html',route:'/apps/test.html',profile:'interface'};
  const sig={identity:'test',purpose:'task',composition:'calm',motion:'none',interactionDensity:'quiet',interactions:[{id:'save',label:'Opslaan'}],humanTasks:['Bewaar']};
  for(const records of [[f.record,{...f.record,status:'FAILED'}],[{...f.record,status:'FAILED'},f.record]]) {
    const report=coverage.build(f.root,{apps:[app],screens:[screen],contract,signatures:{apps:{'app:test':sig},screens:{}},sourceHash:'source',commit:'candidate',evidence:{configuration:f.configuration,records}});
    assert.equal(report.logicalApps[0].dimensions.find(d=>d.id==='identity').status,'BLOCKED');
  }
});
test('bronhash omvat assets en runtime, zonder outputcyclus',t=>{
  const f=fixture(t);
  for(const name of ['public/ds/a.css','public/shared/edge.js','public/apps/app.js','public/images/a.jpg','public/icon.svg','public/fonts/a.woff2','public/manifest.webmanifest','experience-architecture/signatures.json','.nvmrc','package-lock.json','APPWERKT.json']) {
    const before=fingerprint(f.root);f.write(name,'first');const added=fingerprint(f.root);assert.notEqual(added,before,name+' toevoeging');
    f.write(name,'changed');assert.notEqual(fingerprint(f.root),added,name+' wijziging');fs.unlinkSync(path.join(f.root,name));
    const deleted=fingerprint(f.root);f.write(name,'changed');assert.notEqual(fingerprint(f.root),deleted,name+' verwijdering');
  }
  const before=fingerprint(f.root);f.write('EXPERIENCEWERKT.json','generated');f.write('artifacts/experience/new.json','generated');
  assert.equal(fingerprint(f.root),before);
});
test('pilotbewijs van andere commit is niet actueel kandidaatbewijs',()=>{
  const now=Date.now(), record={version:1,test:'test/a.js',at:new Date(now).toISOString(),sourceHash:'src',logHash:'log',tests:1,skipped:0,passed:true,exitCode:0,worktreeDirty:false,commit:'old'};
  assert.equal(state(record,'src','test/a.js',now,'new'),'STALE');
  assert.equal(state({...record,worktreeDirty:true},'src','test/a.js',now,'old'),'BLOCKED');
  assert.equal(state({...record,worktreeDirty:undefined},'src','test/a.js',now,'old'),'BLOCKED');
});
test('vuile bronmetadata blokkeert ook een verder integer lokaal artefact',t=>{
  const f=fixture(t); f.record.worktreeDirty=true;assert.equal(f.check(),'BLOCKED');
  f.record.worktreeDirty=false;f.body.worktreeDirty=true;f.save();assert.equal(f.check(),'BLOCKED');
});
test('kandidaatpoort vereist schone invoer zonder override',t=>{
  const f=fixture(t), cp=require('node:child_process');
  const git=(args)=>cp.execFileSync('git',args,{cwd:f.root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.equal(candidate(f.root).ok,false,'zonder git geen kandidaat');
  git(['init','--quiet']);git(['add','.']);git(['-c','user.name=RTG Test','-c','user.email=test@rtg.invalid','commit','--quiet','-m','fixture']);
  assert.equal(candidate(f.root).ok,true);
  f.write('test/sample.js','// gewijzigde code\n');assert.equal(candidate(f.root).ok,false);
  git(['restore','test/sample.js']);f.write('experience-architecture/signatures.json','{}');assert.equal(candidate(f.root).ok,false);
  fs.unlinkSync(path.join(f.root,'experience-architecture/signatures.json'));
  f.write('APPWERKT.json','{}');assert.equal(candidate(f.root).ok,false,'inventaris is invoer');
  fs.unlinkSync(path.join(f.root,'APPWERKT.json'));
  f.write('EXPERIENCEWERKT.json','{}');assert.equal(candidate(f.root).ok,true,'gegenereerde uitvoer is geen bron');
});
test('CLI blokkeert vuile kandidaten vóór meten',()=>{
  const cp=require('node:child_process'), root=path.join(__dirname,'..');
  for(const [script,flag] of [['scripts/experience.js','--prove'],['scripts/experience.js','--gate'],['scripts/experience-coverage.js','--gate']]) {
    const source="require('./scripts/lib/experience/evidence').candidate=()=>({ok:false,reason:'fixture-dirty'});process.argv=[process.execPath,"+JSON.stringify(script)+","+JSON.stringify(flag)+"];require("+JSON.stringify('./'+script)+");";
    const run=cp.spawnSync(process.execPath,['-e',source],{cwd:root,encoding:'utf8'});
    assert.equal(run.status,2,script+' '+flag);assert.match(run.stderr,/BLOCKED: fixture-dirty/);
    assert.equal(run.stdout,'','geen proeven of outputs vóór de blokkade');
  }
});
