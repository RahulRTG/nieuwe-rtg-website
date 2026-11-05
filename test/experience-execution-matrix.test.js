'use strict';
/* Subprocessprotocol: geen browserbewijs, nieuwe producer of volledige kwalificatie. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const execution=require('../scripts/lib/experience/execution');
const coverage=require('../scripts/lib/experience/coverage');
const {fixture}=require('./lib/experience-execution-matrix-fixture');

function qualified(f,run) {
  assert.equal(run.record.passed,true);
  assert.equal(run.coverage.records.length,5);
  assert.equal(run.coverage.runId,run.record.runId);
  assert.equal(new Set(run.coverage.records.map(record=>record.artifact)).size,5);
  for(const [index,record] of run.coverage.records.entries()) {
    const result=f.assess(record),scope=execution.scoped(record,f.root),expected=f.expected[index];
    assert.equal(result.integrity,'VALID');assert.equal(result.status,'BLOCKED');
    assert.equal(result.scopedStatus,'PROVEN_IN_SCOPE');
    assert.equal(scope.runId,run.record.runId);assert.equal(scope.proof,'hotels-destination');
    assert.equal(scope.id,expected.scope);assert.equal(scope.check,expected.check);
    assert.equal(scope.matrixCell,expected.matrixCell);
    assert.deepEqual(scope.configuration,{...expected.configuration,browserVersion:'145.0.1.2'});
    const body=f.body(record);
    assert.deepEqual(body.configuration,scope.configuration);
    assert.equal(body.checks[0].id,expected.check);
    assert.ok(record.artifact.includes('/'+run.record.runId+'/'));
    assert.ok(body.log.path.includes('/'+run.record.runId+'/'));
  }
}
function snapshot(f,run) {
  const files=new Map();
  for(const record of run.coverage.records) {
    files.set(record.artifact,f.read(record.artifact));
    const log=f.body(record).log.path;files.set(log,f.read(log));
  }
  return files;
}

test('twee echte executor-aanroepen houden vijf eigen receipts en afzonderlijke artefacten geldig',t=>{
  const f=fixture(t),first=f.run();qualified(f,first);
  const before=snapshot(f,first),second=f.run();
  assert.equal(f.spawn.mock.callCount(),2);assert.notEqual(first.record.runId,second.record.runId);
  qualified(f,first);qualified(f,second);
  assert.equal(new Set([...first.coverage.records,...second.coverage.records].map(r=>r.artifact)).size,10);
  assert.notEqual(f.body(first.coverage.records[0]).log.path,f.body(second.coverage.records[0]).log.path);
  for(const [name,bytes] of before)assert.equal(f.read(name),bytes,name+' blijft ongewijzigd');
});

test('configuratie- en observatievolgorde bepalen geen celbinding',t=>{
  const f=fixture(t),run=f.run({batch:b=>{b.configurations.reverse();b.observations.reverse();}});
  qualified(f,run);
});

for(const [name,batch] of [
  ['ontbrekende configuratie',b=>{b.configurations.pop();}],
  ['dubbele configuratie',b=>{b.configurations.push(structuredClone(b.configurations[1]));}],
  ['onbekende extra configuratie',b=>{b.configurations.push({...b.configurations[1],device:'unknown'});}],
  ['ontbrekende cel',b=>{b.observations.pop();}],
  ['dubbele cel in plaats van een andere',b=>{b.observations[4]=structuredClone(b.observations[1]);}],
  ['onbekende cel',b=>{b.observations[2].requirement='back-forward';}],
  ['andere viewport onder hetzelfde apparaatlabel',b=>{b.configurations[1].viewport={width:777,height:900};}],
  ['ontbrekende browserversie',b=>{delete b.configurations[1].browserVersion;}],
  ['verkeerde TAP-check',b=>{b.checks[1]='Een andere groene controle';}],
  ['tweede waarneming met onjuiste online-status',b=>{b.observations[1].checks[0].observed.networkOnline=false;}],
  ['laatste waarneming met onjuiste eigenaarstatus',b=>{b.observations[4].checks[0].observed.ownerStatus=401;}],
  ['verkeerde waarnemingsbron',b=>{b.observations[2].sourceHash='other-source';}],
  ['verkeerde configuratiehash in waarneming',b=>{b.observations[2].configurationHash=b.observations[1].configurationHash;}]
]) test('de volledige batch weigert '+name,t=>{
  const f=fixture(t),run=f.run({batch});
  assert.equal(run.record.passed,true,'het proces op zichzelf is groen');
  assert.deepEqual(run.coverage.records,[],'geen gedeeltelijk gekwalificeerde batch');
  assert.match(run.coverage.reason,/^TYPED_EXECUTION_REJECTED:/);
});

for(const [name,change] of [
  ['procesfailure',{fail:true}],['skip',{skipped:true}],['gewijzigde bron',{source:true}],
  ['andere commit',{commit:true}],['vuile kandidaat na proces',{dirty:true}],['vuile kandidaat vóór receiptuitgifte',{finalDirty:true}]
]) test('vijf geldige diagnostics krijgen geen receipts bij '+name,t=>{
  const f=fixture(t),run=f.run(change);
  assert.deepEqual(run.coverage.records,[]);
  assert.match(run.coverage.reason,/EXECUTION_NOT_STABLE/);
});

test('een vuile kandidaat start geen matrixproces',t=>{
  const f=fixture(t);
  assert.throws(()=>f.run({beforeDirty:true}),/schone kandidaat/);
  assert.equal(f.spawn.mock.callCount(),0);
});

test('een mislukte tweede batch beschadigt of vervangt het eerste ontvangstbewijs niet',t=>{
  const f=fixture(t),first=f.run(),before=snapshot(f,first);
  const second=f.run({batch:b=>{b.observations[1].checks[0].observed.documentStatus=503;}});
  assert.deepEqual(second.coverage.records,[]);assert.notEqual(first.record.runId,second.record.runId);
  qualified(f,first);
  for(const [name,bytes] of before)assert.equal(f.read(name),bytes);
});

test('import en kopieën reconstrueren voor geen van de vijf cellen een procesreceipt',t=>{
  const f=fixture(t),run=f.run();
  for(const record of run.coverage.records) {
    for(const copy of [{...record},structuredClone(record),JSON.parse(JSON.stringify(record))]) {
      const result=f.assess(copy);
      assert.equal(result.integrity,'VALID');assert.equal(result.status,'BLOCKED');
      assert.equal(result.scopedStatus,undefined);assert.equal(execution.scoped(copy,f.root),null);
      assert.equal(result.reason,'AUTHORITATIVE_EXECUTION_AND_TYPED_REQUIREMENT_BINDING_MISSING');
    }
    assert.equal(execution.scoped(record,path.join(f.root,'other')),null);
  }
});

test('recordmutatie wist gezag en een gewijzigde scopekopie kan de echte receipt niet veranderen',t=>{
  const f=fixture(t),run=f.run();
  for(const record of run.coverage.records) {
    const original=execution.scoped(record,f.root),copy=execution.scoped(record,f.root);
    copy.runId='forged';copy.configuration.viewport.width=777;copy.matrixCell='forged';
    assert.deepEqual(execution.scoped(record,f.root),original);
    record.configurationHash='f'.repeat(64);
    assert.equal(execution.scoped(record,f.root),null);
    assert.equal(f.assess(record).scopedStatus,undefined);
  }
});

function consume(f,records) {
  const report=coverage.build(f.root,{apps:[],
    screens:[{id:'screen:/apps/hotels.html',route:'/apps/hotels.html',profile:'interface',world:'travel'}],
    contract:f.contract,signatures:f.signatures,evidence:{records},
    sourceHash:records[0].sourceHash,commit:records[0].commit});
  assert.equal(report.screens[0].signature.status,'DECLARED');
  const continuity=report.screens[0].dimensions.find(d=>d.id==='continuity');
  const matrix=continuity.configurationCoverage.find(m=>m.requirement==='destination');
  assert.equal(continuity.provenCount,0);
  assert.notEqual(continuity.status,'PROVEN');
  assert.equal(report.summary.screens.proven,0);assert.equal(report.status,'NOT_TESTED');
  return {continuity,matrix};
}

test('de echte consumer houdt vijf scopes en precies vier van de 180 matrixcellen zichtbaar',t=>{
  const f=fixture(t),run=f.run(),{continuity,matrix}=consume(f,run.coverage.records);
  assert.equal(continuity.scopedProofs.length,5);
  assert.equal(continuity.scopedProofs.filter(p=>p.scope.matrixCell).length,4,'de legacy-scope is geen matrixcel');
  assert.equal(matrix.status,'NOT_TESTED');assert.equal(matrix.requiredCellCount,180);
  assert.equal(matrix.mappedCellCount,4);assert.equal(matrix.missingCellCount,176);
  assert.equal(matrix.observedCellCount,4);assert.equal(matrix.runs.length,1);
  assert.equal(matrix.runs[0].runId,run.record.runId);
  assert.equal(matrix.runs[0].observedCellCount,4);
});

test('de consumer bewaart twee uitvoeringen afzonderlijk en maakt geen unie van hun cellen',t=>{
  const f=fixture(t),first=f.run(),second=f.run();
  const {continuity,matrix}=consume(f,[...first.coverage.records,...second.coverage.records]);
  assert.equal(continuity.scopedProofs.length,10);
  assert.equal(matrix.status,'BLOCKED');assert.equal(matrix.reason,'MULTIPLE_EXECUTIONS_NOT_AGGREGATED');
  assert.ok(matrix.blockers.includes('MULTIPLE_EXECUTIONS_NOT_AGGREGATED'));
  assert.equal(matrix.requiredCellCount,180);assert.equal(matrix.mappedCellCount,0);assert.equal(matrix.missingCellCount,180);
  assert.equal(matrix.runs.length,2);
  assert.deepEqual(new Set(matrix.runs.map(run=>run.runId)),new Set([first.record.runId,second.record.runId]));
  for(const run of matrix.runs) {
    assert.equal(run.requiredCellCount,180);assert.equal(run.mappedCellCount,4);
    assert.equal(run.observedCellCount,4);assert.equal(run.missingCellCount,176);
  }
});

test('de consumer telt gekopieerde of geïmporteerde records niet als waargenomen matrixcellen',t=>{
  const f=fixture(t),run=f.run();
  for(const records of [run.coverage.records.map(record=>({...record})),
    structuredClone(run.coverage.records),JSON.parse(JSON.stringify(run.coverage.records))]) {
    const {continuity,matrix}=consume(f,records);
    assert.equal((continuity.scopedProofs||[]).length,0);
    assert.equal(matrix.requiredCellCount,180);assert.equal(matrix.mappedCellCount,0);assert.equal(matrix.missingCellCount,180);
    assert.equal((matrix.runs||[]).length,0);assert.equal(matrix.status,'NOT_TESTED');
  }
});
