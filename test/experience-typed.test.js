'use strict';
/* Gesloten adaptercontract: dit zijn geen browserwaarnemingen. */
const test=require('node:test'),assert=require('node:assert/strict');
const typed=require('../scripts/lib/experience/typed');
const contract=structuredClone(require('../experience-architecture/coverage-contract.json'));
contract.executedProofs=contract.executedProofs.filter(b=>b.proof==='hotels-destination');
const signatures=require('../experience-architecture/signatures.json');
const proof={id:'hotels-destination',test:'test/hotels-ds.e2e.js'};

test('bestaand Hotels-contract omvat legacy-scope plus vier afzonderlijke normale profielen',()=>{
  const rows=typed.required(contract,signatures,[proof]);
  assert.equal(rows.length,5);assert.equal(rows[0].matrixCell,null);
  assert.deepEqual(rows.slice(1).map(b=>b.configuration.device),contract.devices);
  assert.ok(rows.slice(1).every(b=>b.configuration.state==='normal'&&b.configuration.network==='normal'));
  assert.equal(new Set(rows.map(b=>b.scope)).size,5);
  assert.equal(new Set(rows.map(b=>b.matrixCell)).size,5);
});
test('geen ontbrekende proef of dubbele proefidentiteit verdwijnt stil uit de vereiste groep',()=>{
  for(const proofs of [[],[{...proof,id:'other-proof'}],[proof,proof]]) {
    assert.throws(()=>typed.required(contract,signatures,proofs),/proefbindingen|mist bestaande proef/);
  }
  const c=structuredClone(contract);
  c.executedProofs.push({...c.executedProofs[0],proof:'orphan-proof'});
  assert.throws(()=>typed.required(c,signatures,[proof]),/mist bestaande proef/);
});
test('een bestaande ongetypeerde proef mag geen getypeerde binding overnemen',()=>{
  const other={id:'other-proof',test:'test/other.e2e.js'};
  assert.equal(typed.required(contract,signatures,[proof,other]).length,5);
  assert.throws(()=>typed.required(contract,signatures,[{...proof,test:other.test}]),/Onbekend getypeerd/);
});
test('een extra apparaat zonder definitie blokkeert ook de normale producer',()=>{
  const s=structuredClone(signatures);s.screens['/apps/hotels.html'].additionalDevices=['new-device'];
  assert.throws(()=>typed.required(contract,s,[proof]),/DEVICE_CONFIGURATION_UNDEFINED:new-device/);
});
test('een gedefinieerd aanvullend profiel vergroot de groep; het wordt niet weggelaten',()=>{
  const c=structuredClone(contract),s=structuredClone(signatures);
  s.screens['/apps/hotels.html'].additionalDevices=['wide-screen'];
  c.configurationCoverage['continuity:destination'].deviceConfigurations['wide-screen']={
    browser:'chromium',viewport:{width:1920,height:1080},deviceScaleFactor:1,touch:false};
  const rows=typed.required(c,s,[proof]);assert.equal(rows.length,6);
  assert.equal(rows[5].configuration.device,'wide-screen');
});
for(const [name,change] of [
  ['vreemd type',b=>{b.type='generic-log-import';}],
  ['ander netwerk',b=>{b.configuration.network='offline';}],
  ['andere toestand',b=>{b.configuration.state='empty';}],
  ['ander onderwerp',b=>{b.subjectId='screen:/apps/juridisch.html';}],
  ['kleinere apparaatgroep',b=>{b.devices=['desktop'];}],
  ['andere check',b=>{b.check='Een groene check';}]
]) test('producercontract weigert '+name,()=>{
  const c=structuredClone(contract);change(c.executedProofs[1]);
  assert.throws(()=>typed.required(c,signatures,[proof]),/Onbekend/);
});
test('dubbele declaraties zijn geen tweede bewijs',()=>{
  const c=structuredClone(contract);c.executedProofs.push(structuredClone(c.executedProofs[1]));
  assert.throws(()=>typed.required(c,signatures,[proof]),/Dubbele Experience-producercel/);
});
test('scopevergelijking vereist exacte celidentiteit en configuratie zonder zelf gezag te maken',()=>{
  const b=typed.required(contract,signatures,[proof])[1];
  const scope={...b,id:b.scope,configuration:{...b.configuration,browserVersion:'145.0.1'}};
  assert.equal(typed.covers(scope,b),true);
  for(const changed of [null,{}, {...scope,configuration:null},{...scope,subjectId:'screen:/apps/juridisch.html'},
    {...scope,configuration:{...scope.configuration,network:'offline'}},
    {...scope,configuration:{...scope.configuration,browserVersion:145.2}},
    {...scope,configuration:{...scope.configuration,viewport:{width:390,height:844}}}]) {
    assert.equal(typed.covers(changed,b),false);
  }
});
