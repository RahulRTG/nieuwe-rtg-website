'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const matrix=require('../scripts/lib/experience/configurations');
const artifact=require('../scripts/lib/experience/artifact');
const coverage=require('../scripts/lib/experience/coverage');
const base=require('../experience-architecture/coverage-contract.json');
const signatures=require('../experience-architecture/signatures.json');
const route='/apps/juridisch.html',signature={status:'DECLARED',value:signatures.screens[route]};
test('samensteller toont matrixverplichtingen onder de bestaande requirement zonder nieuwe groenclaim',()=>{
  const report=coverage.build(path.join(__dirname,'..'),{contract:base,signatures,apps:[],
    screens:[{id:'screen:'+route,route,profile:'interface',world:'living'}],sourceHash:'source',commit:'candidate'});
  const continuity=report.screens[0].dimensions.find(d=>d.id==='continuity');
  assert.equal(continuity.requirementCount,base.continuityChecks.length+signature.value.interactions.length);
  assert.equal(continuity.configurationCoverage[0].requiredCellCount,132);
  assert.equal(continuity.status,'NOT_TESTED');assert.equal(continuity.provenCount,0);
  assert.equal(report.summary.screens.proven,0);assert.equal(report.status,'NOT_TESTED');
  assert.deepEqual(coverage.registryView(report).screens[0].dimensions.continuity.configurationCoverage,continuity.configurationCoverage);
  assert.equal(matrix.required(base,signature,'accessibility','tablet@focus'),null,'andere requirements krijgen geen bestemmingsoordeel');
});

test('een losse artefactstatus kan een nog niet gebonden volledige matrix niet overslaan',t=>{
  t.mock.method(artifact,'assessment',()=>({status:'PROVEN'}));
  const report=coverage.build(path.join(__dirname,'..'),{contract:base,signatures,apps:[],
    screens:[{id:'screen:'+route,route,profile:'interface',world:'living'}],sourceHash:'source',commit:'candidate'});
  const continuity=report.screens[0].dimensions.find(d=>d.id==='continuity');
  assert.equal(continuity.configurationCoverage[0].missingCellCount,132);
  assert.equal(continuity.provenCount,continuity.requirementCount-1,'destination zelf telt niet als bewezen requirement');
  assert.equal(continuity.status,'NOT_TESTED');assert.equal(report.summary.screens.proven,0);
});
