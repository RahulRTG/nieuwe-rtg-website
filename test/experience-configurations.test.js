'use strict';
/* Protocolfixtures, geen apparaatnorm, browserwaarneming of kwalificatie. */
const test=require('node:test'),assert=require('node:assert/strict');
const matrix=require('../scripts/lib/experience/configurations');
const base=require('../experience-architecture/coverage-contract.json');
const signatures=require('../experience-architecture/signatures.json');
const route='/apps/juridisch.html',signature={status:'DECLARED',value:signatures.screens[route]};
const policy=contract=>contract.configurationCoverage['continuity:destination'];
const plan=(contract=base,sig=signature)=>matrix.required(contract,sig,'continuity','destination');
function configured() {
  const contract=structuredClone(base),profiles=policy(contract).deviceConfigurations;
  contract.devices.forEach((name,i)=>{profiles[name]={browser:'chromium',viewport:{width:[390,430,820,1440][i],height:900},deviceScaleFactor:1,touch:i<2};});
  return contract;
}
const configuration=(p,cell)=>({...structuredClone(p.deviceConfigurations[cell.device]),...cell,browserVersion:'145.0.1.2',locale:'nl-NL',reducedMotion:true,serviceWorkers:'block'});
const all=p=>p.cells.map(cell=>configuration(p,cell));

test('bestaande Juridisch-signature verplicht 11 × 4 × 3 met expliciete CSSviewportprofielen',()=>{
  const p=plan();
  assert.equal(p.cells.length,132);
  assert.deepEqual(p.states,[...base.states,...signature.value.additionalStates]);
  assert.deepEqual(p.devices,base.devices);assert.deepEqual(p.networks,base.networks);
  assert.equal(p.status,'NOT_TESTED');assert.deepEqual(p.blockers,[]);
  assert.deepEqual(p.devices.map(d=>p.deviceConfigurations[d].viewport),[
    {width:320,height:568},{width:430,height:932},{width:820,height:1180},{width:1440,height:900}]);
  assert.ok(p.devices.every(d=>p.deviceConfigurations[d].deviceScaleFactor===1&&p.deviceConfigurations[d].touch===false));
  const summary=matrix.inspect(p);
  assert.equal(summary.requiredCellCount,132);assert.equal(summary.mappedCellCount,0);assert.equal(summary.missingCellCount,132);
  assert.equal(summary.status,'NOT_TESTED');
});
test('normal-only of ontbrekende policy krimpt de bekende noemer nooit',()=>{
  for(const axis of ['states','devices','networks','version','missing']) {
    const c=configured();
    if(axis==='missing')delete c.configurationCoverage;
    else policy(c)[axis]=axis==='version'?2:'normal';
    const p=plan(c);assert.equal(p.cells.length,132);assert.equal(p.status,'BLOCKED');
    assert.ok(p.blockers.includes('CONFIGURATION_POLICY_UNDEFINED'));
  }
});
test('verwijderde producerbindings veranderen de afgeleide matrix niet',()=>{
  const c=configured(),before=plan(c);c.executedProofs=[];
  assert.deepEqual(plan(c),before);
  c.executedProofs=[{configuration:{state:'normal',device:'desktop',network:'normal'}}];
  assert.deepEqual(plan(c),before);
});
test('signature kan basisassen niet verkleinen en extra staten/apparaten vergroten de noemer',()=>{
  const c=configured(),sig=structuredClone(signature);
  sig.value.states=['normal'];sig.value.devices=['desktop'];
  assert.equal(plan(c,sig).cells.length,132);
  sig.value.additionalStates.push('new-result');sig.value.additionalDevices=['new-device'];
  const p=plan(c,sig);assert.equal(p.cells.length,180);assert.equal(p.status,'BLOCKED');
  assert.ok(p.blockers.includes('DEVICE_CONFIGURATION_UNDEFINED:new-device'));
  assert.ok(p.cells.some(cell=>cell.state==='new-result'&&cell.device==='new-device'&&cell.network==='offline'));
});
test('lege of ongeldige as en ongedefinieerde extra toestand blijven geblokkeerd',()=>{
  for(const axis of ['states','devices','networks']) {
    const c=configured();c[axis]=[];const p=plan(c);
    assert.equal(p.status,'BLOCKED');assert.ok(p.blockers.includes('INVALID_CONFIGURATION_AXIS:'+axis));
    assert.equal(matrix.inspect(p,[]).status,'BLOCKED','nul cellen is geen volledige matrix');
  }
  for(const additionalStates of [null,[''],[' normal'],[undefined]]) {
    const sig=structuredClone(signature);sig.value.additionalStates=additionalStates;
    assert.ok(plan(configured(),sig).blockers.includes('INVALID_CONFIGURATION_AXIS:additionalStates'));
  }
});
test('een ongeldig aslid blokkeert zonder geldige bestaande verplichtingen te laten verdwijnen',()=>{
  for(const axis of ['states','devices','networks']) {
    const c=configured();c[axis].push(null);const p=plan(c);
    assert.equal(p.cells.length,132);assert.equal(p.status,'BLOCKED');
  }
  const sig=structuredClone(signature);sig.value.additionalStates.push(null);
  assert.equal(plan(configured(),sig).cells.length,132);assert.equal(plan(configured(),sig).status,'BLOCKED');
});
test('een configuratie kan de verwachte viewport of matrix niet achteraf wijzigen',()=>{
  const c=configured(),p=plan(c),shared={...p.deviceConfigurations['mobile-small']};
  for(const mutate of [()=>{shared.viewport.width=777;},()=>p.states.pop(),()=>p.cells.pop(),()=>{p.cells[0].state='normal';}]) assert.throws(mutate,TypeError);
  policy(c).deviceConfigurations['mobile-small'].viewport.width=777;
  assert.equal(p.deviceConfigurations['mobile-small'].viewport.width,390);
  const actual=configuration(p,p.cells[0]);actual.viewport.width=777;
  assert.equal(matrix.match(p,actual).reason,'DEVICE_CONFIGURATION_MISMATCH');
});
test('bekende metadata kan een cel aanwijzen maar krijgt geen uitvoeringsgezag',()=>{
  const p=plan(configured()),result=matrix.match(p,configuration(p,p.cells[0]));
  assert.equal(result.status,'NOT_TESTED');assert.equal(result.reason,'EXECUTION_MATRIX_BINDING_MISSING');
  assert.match(result.configurationHash,/^[a-f0-9]{64}$/);
  assert.equal(result.cell,JSON.stringify([p.cells[0].state,p.cells[0].device,p.cells[0].network]));
});
for(const [field,value,reason] of [['state',undefined,'STATE'],['state','undeclared-state','STATE'],
  ['device',undefined,'DEVICE'],['device','phone','DEVICE'],['network',undefined,'NETWORK'],['network','local-test-server','NETWORK']]) {
  test('configuratie weigert '+field+'='+value,()=>{
    const p=plan(configured()),c=configuration(p,p.cells[0]);c[field]=value;
    assert.equal(matrix.match(p,c).reason,'UNKNOWN_CONFIGURATION_'+reason);
    assert.equal(matrix.inspect(p,[c]).mappedCellCount,0);
  });
}
test('werkelijke viewport en overige apparaatvelden moeten met de definitie overeenkomen',()=>{
  const p=plan(configured());
  for(const [field,value] of [['viewport',{width:1440,height:900}],['browser','webkit'],['touch',false],['deviceScaleFactor',2]]) {
    const c=configuration(p,p.cells[0]);c[field]=value;
    assert.equal(matrix.match(p,c).reason,'DEVICE_CONFIGURATION_MISMATCH');
  }
});
test('ontbrekende browserversie of onbekende configuratievelden krijgen geen celbinding',()=>{
  const p=plan(configured());
  for(const change of [c=>{delete c.browserVersion;},c=>{c.browserVersion='unknown';},c=>{c.extra='invented';},
    c=>{c.locale='';},c=>{c.reducedMotion='true';},c=>{c.serviceWorkers='unknown';}]) {
    const c=configuration(p,p.cells[0]);change(c);
    assert.equal(matrix.match(p,c).reason,'CONFIGURATION_SHAPE_INVALID');
  }
});
test('dezelfde viewport onder andere labels is een geblokkeerd contract, ook met andere keyvolgorde',()=>{
  const c=configured(),profiles=policy(c).deviceConfigurations;
  profiles.tablet.viewport={height:900,width:390};
  const p=plan(c);assert.equal(p.cells.length,132);assert.equal(p.status,'BLOCKED');
  assert.ok(p.blockers.includes('DEVICE_VIEWPORT_ALIAS:mobile-small:tablet'));
});
test('onbekende of incomplete apparaatdefinitie kan geen bruikbaar profiel suggereren',()=>{
  for(const change of [p=>{delete p.viewport;},p=>{p.browser='invented';},p=>{p.viewport.width=0;},p=>{p.touch='true';},p=>{p.deviceScaleFactor=NaN;}]) {
    const c=configured();change(policy(c).deviceConfigurations.tablet);
    assert.ok(plan(c).blockers.includes('DEVICE_CONFIGURATION_UNDEFINED:tablet'));
  }
});
for(const [axis,value,missing] of [['state','normal',12],['device','tablet',33],['network','offline',44]]) {
  test('ontbrekende '+axis+' laat alle bijbehorende cellen open',()=>{
    const p=plan(configured()),summary=matrix.inspect(p,all(p).filter(c=>c[axis]!==value));
    assert.equal(summary.requiredCellCount,132);assert.equal(summary.missingCellCount,missing);
    assert.equal(summary.mappedCellCount,132-missing);assert.equal(summary.status,'NOT_TESTED');
  });
}
test('offline-toestand en offline-netwerk blijven onafhankelijke assen',()=>{
  const p=plan(configured());
  for(const [state,network] of [['offline','normal'],['normal','offline'],['offline','offline']]) {
    assert.ok(p.cells.some(c=>c.state===state&&c.network===network&&c.device==='tablet'));
  }
});
test('dubbele of conflicterende configuraties worden niet als extra cel geteld',()=>{
  const p=plan(configured()),first=configuration(p,p.cells[0]);
  for(const [second,prefix] of [[structuredClone(first),'DUPLICATE'],[{...first,locale:'en-GB'},'CONFLICTING']]) {
    for(const records of [[first,second],[second,first]]) {
      const summary=matrix.inspect(p,records);assert.equal(summary.status,'BLOCKED');
      assert.equal(summary.mappedCellCount,1);assert.ok(summary.blockers.some(e=>e.startsWith(prefix+'_CONFIGURATION_CELL:')));
    }
  }
});
test('volledige metadata en JSON-import zijn geen bewijs van werkelijke toestanden',()=>{
  const p=plan(configured());
  for(const entries of [all(p),JSON.parse(JSON.stringify(all(p)))]) {
    const summary=matrix.inspect(p,entries);assert.equal(summary.missingCellCount,0);assert.equal(summary.mappedCellCount,132);
    assert.equal(summary.status,'NOT_TESTED');assert.equal(summary.reason,'EXECUTION_MATRIX_BINDING_MISSING');
  }
});
