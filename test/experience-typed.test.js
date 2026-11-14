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

test('de signatureproducer bindt alle 114 apps en 316 schermen afzonderlijk',()=>{
  const c=structuredClone(require('../experience-architecture/coverage-contract.json'));
  c.executedProofs=c.executedProofs.filter(b=>b.proof==='experience-signatures');
  const proof={id:'experience-signatures',test:'test/experience-signatures.proof.test.js'};
  const rows=typed.required(c,signatures,[proof]);
  assert.equal(rows.length,430);
  assert.equal(rows.filter(row=>row.subjectType==='app').length,114);
  assert.equal(rows.filter(row=>row.subjectType==='screen').length,316);
  assert.ok(rows.every(row=>row.dimension==='identity'&&row.requirement==='signature'&&row.method==='contract'));
  assert.equal(new Set(rows.map(row=>row.scope)).size,430);
  const first=rows[0],scope={...first,id:first.scope,configuration:structuredClone(first.configuration)};
  assert.equal(typed.covers(scope,first),true);
  scope.configuration.subjectId='app:verzonnen';
  assert.equal(typed.covers(scope,first),false);
});

test('de signatureproducer weigert een smaller of anders genoemd contract',()=>{
  const basis=require('../experience-architecture/coverage-contract.json');
  for(const wijzig of [
    row=>{row.scope='alleen-apps';},row=>{row.method='browser';},row=>{row.check='Groene signatures';},
    row=>{row.extra='stil veld';},row=>{row.instrument='test/experience-coverage.test.js';}
  ]) {
    const c=structuredClone(basis);
    c.executedProofs=c.executedProofs.filter(b=>b.proof==='experience-signatures');
    wijzig(c.executedProofs[0]);
    assert.throws(()=>typed.required(c,signatures,[{id:'experience-signatures',test:c.executedProofs[0].instrument}]),/signatureproducercontract/);
  }
});

test('de a11yproducer bindt contrast, premium aanraakdoelen en toepasselijke layouts per scherm',()=>{
  const c=structuredClone(require('../experience-architecture/coverage-contract.json'));
  c.executedProofs=c.executedProofs.filter(b=>b.proof==='screen-accessibility');
  const proof={id:'screen-accessibility',test:'test/experience-a11y.proof.test.js',timeoutMs:3600000};
  const rows=typed.required(c,signatures,[proof]);
  assert.equal(rows.length,1540);
  assert.ok(rows.every(row=>row.subjectType==='screen'&&row.method==='browser'));
  assert.deepEqual([...new Set(rows.map(row=>row.requirement))].sort(),
    ['desktop@contrast','mobile-large@normal','mobile-large@touch-targets','tablet@normal','tablet@touch-targets']);
  assert.equal(rows.filter(row=>row.dimension==='adaptability').length,592);
  assert.equal(new Set(rows.map(row=>row.configuration.subjectId)).size,316);
  const row=rows[0],scope={...row,id:row.scope,configuration:{...row.configuration,browserVersion:'145.0.1'}};
  assert.equal(typed.covers(scope,row),true);
  scope.configuration.subjectId='screen:/apps/verzonnen.html';
  assert.equal(typed.covers(scope,row),false);
});

test('de a11yproducer weigert een kleinere scope of kortere uitvoering',()=>{
  const basis=require('../experience-architecture/coverage-contract.json');
  for(const wijzig of [row=>{row.scope='enkele-schermen';},row=>{row.timeoutMs=240000;},row=>{row.method='contract';}]) {
    const c=structuredClone(basis);c.executedProofs=c.executedProofs.filter(b=>b.proof==='screen-accessibility');
    wijzig(c.executedProofs[0]);
    assert.throws(()=>typed.required(c,signatures,[{id:'screen-accessibility',test:'test/experience-a11y.proof.test.js'}]),/a11yproducercontract/);
  }
});
