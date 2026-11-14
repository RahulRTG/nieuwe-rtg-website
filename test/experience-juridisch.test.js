'use strict';
/* Getypeerd uitvoeringsprotocol; de browserproef moet afzonderlijk echt draaien. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./lib/experience-execution-matrix-fixture');
const {build}=require('../scripts/lib/experience/coverage');
const typed=require('../scripts/lib/experience/typed');
const {compile}=require('../scripts/lib/experience/compiler');
const contract=require('../experience-architecture/coverage-contract.json');
const signatures=require('../experience-architecture/signatures.json');
const journey=require('../experience/legal-documents.json');
const root=path.resolve(__dirname,'..'),route='/apps/juridisch.html';

test('juridische reis hergebruikt de publieke Living-eigenaar en bestaande proofauthority',()=>{
  const journeys=fs.readdirSync(path.join(root,'experience')).filter(n=>n.endsWith('.json')&&n!=='constitution.json')
    .map(n=>JSON.parse(fs.readFileSync(path.join(root,'experience',n),'utf8')));
  const graph=compile(root,require('../experience/constitution.json'),journeys);
  assert.deepEqual(graph.errors,[]);
  const proofs=journeys.flatMap(j=>j.proofs);
  for(const binding of contract.executedProofs) if(!proofs.some(proof=>proof.id===binding.proof)) {
    proofs.push({id:binding.proof,test:binding.instrument,timeoutMs:binding.timeoutMs});
  }
  const bindings=typed.required(contract,signatures,proofs);
  assert.equal(bindings.filter(b=>b.proof==='hotels-destination').length,5);
  const legal=bindings.filter(b=>b.proof==='juridisch-destination');assert.equal(legal.length,4);
  assert.equal(journey.audience,'public');assert.equal(journey.steps[0].capability,'site.juridisch');
  assert.equal(journey.steps[0].world,'living');assert.equal(journey.steps[0].screen,route);
  assert.equal(journey.steps[0].destination,route);assert.equal(journey.humanReview.status,'NOT_TESTED');
  assert.ok(legal.every(b=>b.configuration.persona==='anonymous'&&b.configuration.state==='normal'&&b.configuration.network==='normal'));
  assert.ok(legal.every(b=>!('ownerAuthenticated' in b.expected)&&!('ownerStatus' in b.expected)));
  assert.throws(()=>typed.required(contract,signatures,proofs.filter(p=>p.id!=='juridisch-destination')),/mist bestaande proef/);
});
test('vier normale anonieme Juridisch-cellen behouden de volledige noemer van 132',t=>{
  const f=fixture(t,'juridisch'),run=f.run();assert.equal(run.record.passed,true);
  assert.equal(run.coverage.records.length,4);
  for(const record of run.coverage.records) {
    const assessed=f.assess(record);assert.equal(assessed.scopedStatus,'PROVEN_IN_SCOPE');
    assert.equal(assessed.status,'BLOCKED');assert.equal(assessed.scope.configuration.persona,'anonymous');
    assert.equal(assessed.scope.subjectId,'screen:'+route);
  }
  const first=run.coverage.records[0],report=build(f.root,{contract:f.contract,signatures:f.signatures,apps:[],
    screens:[{id:'screen:'+route,route,world:'living',profile:'interface'}],evidence:run.coverage,
    sourceHash:first.sourceHash,commit:first.commit});
  const continuity=report.screens[0].dimensions.find(d=>d.id==='continuity'),matrix=continuity.configurationCoverage[0];
  assert.equal(continuity.scopedProofs.length,4);assert.equal(continuity.provenCount,0);
  assert.equal(matrix.requiredCellCount,132);assert.equal(matrix.mappedCellCount,4);
  assert.equal(matrix.observedCellCount,4);assert.equal(matrix.missingCellCount,128);
  assert.equal(matrix.status,'NOT_TESTED');assert.equal(report.summary.screens.proven,0);
});
for(const [name,change] of [
  ['Hotels-identiteit',b=>{b.observations[0].subjectId='screen:/apps/hotels.html';}],
  ['ingelogde persona',b=>{b.configurations[0].persona='rtg-member';}],
  ['verzonnen lege toestand',b=>{b.configurations[0].state='empty';}],
  ['eerste bezoek als normaal',b=>{b.observations[0].checks[0].observed.cookieNoticePresent=true;}],
  ['ontbrekend document',b=>{b.observations[1].checks[0].observed.documentLinks.pop();}],
  ['verkeerde documentbestemming',b=>{b.observations[1].checks[0].observed.documentLinks[0].url='/apps/app.html';}],
  ['onbereikbare documentlink',b=>{b.observations[2].checks[0].observed.linksReachable=false;}],
  ['netwerk offline',b=>{b.observations[3].checks[0].observed.networkOnline=false;}],
  ['ontbrekend vierde formaat',b=>{b.observations.pop();b.configurations.pop();}]
]) test('Juridisch weigert de gehele batch bij '+name,t=>{
  const f=fixture(t,'juridisch'),run=f.run({batch:change});
  assert.equal(run.record.passed,true);assert.deepEqual(run.coverage.records,[]);
  assert.match(run.coverage.reason,/^TYPED_EXECUTION_REJECTED:/);
});
