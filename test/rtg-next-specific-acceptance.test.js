'use strict';
// Brongebonden protocolproeven: tijdelijke bestanden worden echt gelezen en
// gewijzigd. Geen zelf ingevulde acceptatieuitslag en geen productkwalificatie.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const coverage=require('../scripts/lib/experience/coverage');
const planning=require('../scripts/lib/experience/qualification-planning');
const ROOT=path.resolve(__dirname,'..');

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-acceptance-binding-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file='docs/rtg-next/living-werkpakketten.json';
  const write=(name,data)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(data));};
  const entries=['link:alpha','link:beta'].map(id=>({function:id,acceptance:[
    {scenario:'Geautoriseerd voltooien',expected:'De eigen bron bevestigt precies één effect.',evidence:'Trace plus readback.'},
    {scenario:'Onderbreken en hervatten',expected:'Geen stil gegevensverlies of dubbel effect.',evidence:'Onderbroken echte uitvoeringsproef.'}
  ]}));
  write('docs/rtg-next/programma.json',{workPackageFiles:[file]});
  const save=()=>write(file,{entries});save();
  const owner={capability:'fixture',rol:'eigenaar',afbouw:{workPackages:['P0','P1','P4','P6','P7'],
    workFunctions:['link:alpha','link:beta'],sceneFamily:'Ledger',riskClass:'critical',scenarioFamilies:['transaction']}};
  const screen={id:'screen:/apps/fixture.html',route:'/apps/fixture.html',world:'living',profile:'interface',owner};
  const apps=entries.map(entry=>({id:'app:'+entry.function,function:entry.function,destination:screen.route}));
  const signature={identity:'Protocol',purpose:'Voer de fixturetaak uit.',composition:'Rustig',motion:'Geen',
    interactionDensity:'quiet',interactions:[{id:'confirm',label:'Bevestig'}],humanTasks:['Bevestig de fixturetaak.']};
  const signatures={apps:Object.fromEntries(apps.map(app=>[app.id,signature])),screens:{[screen.route]:signature}};
  const contract=structuredClone(require('../experience-architecture/coverage-contract.json'));
  contract.inventoryBaselines={logicalApps:2,screens:1};
  const build=extra=>coverage.build(root,{apps,screens:[screen],contract,signatures,commit:'fixture-candidate',...extra});
  const validate=report=>coverage.validate(root,report,contract,signatures);
  return {root,file,entries,save,build,validate,contract,signatures,apps,screen};
}

test('alle 228 bestaande capabilitycriteria worden uit hun bronbestanden in requirements opgenomen',()=>{
  const report=coverage.build(ROOT),source=planning.acceptanceSource(ROOT);
  assert.equal(source.status,'CONTRACT_DEFINED');
  assert.equal(source.entries.length,114);
  assert.equal(source.entries.reduce((sum,entry)=>sum+entry.acceptance.length,0),228);
  const ids=new Set();
  for(const app of report.logicalApps) {
    const expected=planning.acceptanceRequirements(source.entries,[app.function]);
    assert.equal(expected.missing.length,0);
    assert.equal(expected.ids.length,2);
    assert.deepEqual(app.acceptanceRequirements,expected.ids);
    const requirements=coverage.requirements(require('../experience-architecture/coverage-contract.json'),'interface','continuity',app.signature,app);
    expected.ids.forEach(id=>{assert.ok(requirements.includes(id));ids.add(id);});
  }
  assert.equal(ids.size,228);
  assert.equal(report.summary.logicalApps.proven,0);
});

test('apps krijgen eigen specifieke criteria; hun gedeelde scherm krijgt de toepasselijke unie',t=>{
  const f=fixture(t),report=f.build();
  assert.deepEqual(f.validate(report),[]);
  assert.equal(report.logicalApps[0].acceptanceRequirements.length,2);
  assert.equal(report.logicalApps[1].acceptanceRequirements.length,2);
  assert.equal(report.screens[0].acceptanceRequirements.length,4);
  for(const app of report.logicalApps) {
    assert.ok(app.acceptanceRequirements.every(id=>id.startsWith('acceptance:'+app.function+':')));
    assert.deepEqual(app.qualificationPlan.acceptanceRequirements,app.acceptanceRequirements);
  }
  for(const subject of report.logicalApps.concat(report.screens)) {
    const all=coverage.requirements(f.contract,'interface','continuity',subject.signature,subject);
    assert.ok(subject.acceptanceRequirements.every(id=>all.includes(id)));
    assert.equal(subject.dimensions.find(row=>row.id==='continuity').requirementCount,all.length);
    assert.equal(subject.dimensions.find(row=>row.id==='continuity').provenCount,0);
  }
});

test('ieder werkpakketbestand wordt eenmaal geparseerd per coveragebouw',t=>{
  const f=fixture(t),read=fs.readFileSync;let reads=0;
  t.mock.method(fs,'readFileSync',(name,...args)=>{if(String(name)===path.join(f.root,f.file))reads++;return read(name,...args);});
  f.build({sourceHash:'unit-only-no-fingerprint'});
  assert.equal(reads,1);
});

test('herordenen behoudt criterion-IDs; gewijzigde verwachting of bewijsbelofte vervangt de ID',t=>{
  const f=fixture(t),first=f.build();
  f.entries[0].acceptance.reverse();f.save();const reordered=f.build();
  assert.deepEqual([...first.logicalApps[0].acceptanceRequirements].sort(),[...reordered.logicalApps[0].acceptanceRequirements].sort());
  for(const field of ['expected','evidence','scenario']) {
    const before=f.build();f.entries[0].acceptance[0][field]+=' Gewijzigde belofte.';f.save();const after=f.build();
    assert.notEqual(after.sourceHash,before.sourceHash);
    assert.notDeepEqual(after.logicalApps[0].acceptanceRequirements,before.logicalApps[0].acceptanceRequirements);
    assert.ok(f.validate(before).includes('SPECIFIC_ACCEPTANCE_SOURCE_CHANGED'));
    assert.ok(f.validate(before).includes('SPECIFIC_ACCEPTANCE_BINDING_MISMATCH:'+f.apps[0].id));
  }
});

test('verwijderd broncriterium verkleint nooit stil de opgeslagen noemer',t=>{
  const f=fixture(t),before=f.build();f.entries[0].acceptance.pop();f.save();
  const errors=f.validate(before);
  assert.ok(errors.includes('SPECIFIC_ACCEPTANCE_SOURCE_CHANGED'));
  assert.ok(errors.includes('SPECIFIC_ACCEPTANCE_BINDING_MISMATCH:'+f.apps[0].id));
  assert.ok(errors.includes('QUALIFICATION_REQUIREMENT_COUNT_MISMATCH:'+f.apps[0].id+':continuity'));
});

test('ontbrekende of dubbele werkpakketbron en lege criteria blijven blokkerend',t=>{
  const f=fixture(t);
  f.entries[0].acceptance=[];f.save();let report=f.build();
  assert.equal(report.acceptanceSources.status,'BLOCKED');
  assert.ok(f.validate(report).some(error=>error.startsWith('SPECIFIC_ACCEPTANCE_SOURCE_MISSING:')));
  assert.equal(report.summary.logicalApps.proven,0);
  f.entries[0].acceptance=[{scenario:'S',expected:'E',evidence:'B'}];f.entries.push({...f.entries[0]});f.save();
  report=f.build();assert.match(report.acceptanceSources.reason,/DUPLICATE_WORK_FUNCTION/);
  fs.unlinkSync(path.join(f.root,f.file));report=f.build();
  assert.equal(report.acceptanceSources.status,'BLOCKED');
});

test('verwijderde projectiecriteria worden tegen echte bronnen herberekend, ook bij aangepaste telling',t=>{
  const f=fixture(t),report=f.build(),app=report.logicalApps[0];
  app.acceptanceRequirements=[];app.qualificationPlan.acceptanceRequirements=[];
  app.dimensions.find(row=>row.id==='continuity').requirementCount-=2;
  const errors=f.validate(report);
  assert.ok(errors.includes('SPECIFIC_ACCEPTANCE_BINDING_MISMATCH:'+app.id));
  assert.ok(errors.includes('QUALIFICATION_BINDING_MISMATCH:'+app.id));
  assert.ok(errors.includes('QUALIFICATION_REQUIREMENT_COUNT_MISMATCH:'+app.id+':continuity'));
});
