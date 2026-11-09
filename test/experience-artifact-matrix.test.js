'use strict';
/* Protocolproeven met lokale artefacten; geen browseruitvoering of ontvangstbewijs. */
const test = require('node:test'), assert = require('node:assert/strict');
const {integrity,assessment,stable} = require('../scripts/lib/experience/artifact');
const {sha} = require('../scripts/lib/experience/evidence');
const {fixture} = require('./lib/experience-artifact-fixture');

function matrix(t) {
  const first = fixture(t);
  const configuration = {browser:'chromium',viewport:{width:1440,height:900}};
  const configurationHash = sha(JSON.stringify(stable(configuration)));
  const body = {...structuredClone(first.body),configuration,configurationHash};
  const record = {...first.record,configurationHash,artifact:'artifacts/experience/desktop.json'};
  const context = {...first.context,configurationHash};
  const diagnostic = {...structuredClone(first.diagnostic),configurationHash};
  function save() {
    const text = JSON.stringify(body);
    first.write(record.artifact,text);
    record.artifactHash = sha(text);
  }
  const second = {body,record,context,diagnostic,save,
    check:()=>integrity(record,'source','candidate','identity',context)};
  function log(observations) {
    const text = first.tap + observations.map(value=>'# RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(value)+'\n').join('');
    first.write(first.body.log.path,text);
    for (const cell of [first,second]) {
      cell.body.log.sha256 = sha(text);
      cell.save();
    }
  }
  log([first.diagnostic,second.diagnostic]);
  return {first,second,log};
}

test('twee configuraties delen één log zonder integriteitsconflict of uitvoeringsgezag',t=>{
  const m = matrix(t);
  assert.notEqual(m.first.record.configurationHash,m.second.record.configurationHash);
  for (const order of [[m.first,m.second],[m.second,m.first]]) {
    m.log(order.map(cell=>cell.diagnostic));
    for (const cell of [m.first,m.second]) {
      assert.equal(cell.check(),'VALID');
      const result = assessment(cell.record,'source','candidate','identity',cell.context);
      assert.equal(result.status,'BLOCKED');
      assert.equal(result.scopedStatus,undefined);
      assert.equal(result.reason,'AUTHORITATIVE_EXECUTION_AND_TYPED_REQUIREMENT_BINDING_MISSING');
    }
  }
});

test('de andere configuratie vervangt geen ontbrekende exacte cel',t=>{
  const m = matrix(t);
  for (const [missing,present] of [[m.first,m.second],[m.second,m.first]]) {
    m.log([present.diagnostic]);
    assert.equal(missing.check(),'BLOCKED');
    assert.equal(present.check(),'VALID');
  }
});

test('een waarneming zonder configuratiehash kan de exacte cel niet leveren',t=>{
  const m = matrix(t), unbound = {...m.first.diagnostic};
  delete unbound.configurationHash;
  m.log([unbound,m.second.diagnostic]);
  assert.equal(m.first.check(),'BLOCKED');
  assert.equal(m.second.check(),'VALID');
});

test('verkeerde context of configuratie-inhoud blijft geblokkeerd bij een gedeeld log',t=>{
  const m = matrix(t);
  assert.equal(integrity(m.first.record,'source','candidate','identity',m.second.context),'BLOCKED');
  m.first.body.configuration.viewport.width = 820;
  m.first.save();
  assert.equal(m.first.check(),'BLOCKED');
  assert.equal(m.second.check(),'VALID');
});

test('identieke dubbele waarnemingen blokkeren alleen hun eigen configuratie',t=>{
  const m = matrix(t);
  for (const order of [
    [m.first.diagnostic,m.first.diagnostic,m.second.diagnostic],
    [m.second.diagnostic,m.first.diagnostic,m.first.diagnostic]
  ]) {
    m.log(order);
    assert.equal(m.first.check(),'BLOCKED');
    assert.equal(m.second.check(),'VALID');
  }
});

for (const [field,value] of [
  ['sourceHash','other-source'],['commit','other-candidate'],['instrument','test/other.js'],
  ['method','visual'],['checks',[{id:'visible',observed:false,expected:true,passed:true}]]
]) test('een conflicterende '+field+' binnen dezelfde configuratie wordt niet weggefilterd',t=>{
  const m = matrix(t), conflict = {...m.first.diagnostic,[field]:value};
  for (const order of [
    [m.first.diagnostic,conflict,m.second.diagnostic],
    [m.second.diagnostic,conflict,m.first.diagnostic]
  ]) {
    m.log(order);
    assert.equal(m.first.check(),'BLOCKED');
    assert.equal(m.second.check(),'VALID');
  }
});
