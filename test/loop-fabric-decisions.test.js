'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {build,markdown,OUT,DOC}=require('../scripts/loop-fabric-decisions');

test('144 oorspronkelijke blockers blijven traceerbaar na 60 productbesluiten',()=>{
  const d=build();assert.equal(d.summary.originalBlockedCapabilities,144);assert.equal(d.summary.blockedCapabilities,84);
  assert.equal(d.summary.resolvedCapabilities,60);assert.equal(d.summary.decisionFamilies,22);
  assert.equal(d.coverage.complete,true);assert.equal(new Set(d.coverage.assigned).size,144);
  assert.deepEqual(JSON.parse(fs.readFileSync(OUT,'utf8')),d);assert.equal(fs.readFileSync(DOC,'utf8'),markdown(d));
  for(const row of d.dossiers){assert.ok(row.question);assert.ok(row.why);assert.ok(row.safeDefault);assert.ok(row.recommendation);
    assert.ok(['PRODUCT_POLICY','PRIVACY_POLICY','GOVERNANCE','LEGAL_VALIDATION_REQUIRED','ETHICAL/SAFETY','MIXED'].includes(row.classification));
    assert.ok(row.options.length>=2);for(const option of row.options)for(const key of ['product','privacy','learning','ai','crossDomain','retention','userControl','implementation'])assert.ok(option.consequences[key]);}
});

test('juridische onzekerheid en productkeuze blijven gescheiden en fail-closed',()=>{
  const d=build(),byId=Object.fromEntries(d.dossiers.map(x=>[x.id,x]));
  assert.equal(byId.D13_DISCOVERY_COMMONS.classification,'PRODUCT_POLICY');
  assert.equal(byId.D13_DISCOVERY_COMMONS.decisionStatus,'RESOLVED_PRODUCT_POLICY');
  assert.equal(byId.D03_HEALTH_CONTEXT.classification,'LEGAL_VALIDATION_REQUIRED');
  assert.equal(byId.D03_HEALTH_CONTEXT.decisionStatus,'LEGAL_VALIDATION_REQUIRED');
  assert.match(byId.D08_FOUNDATION_ASSISTANCE.safeDefault,/primaire dienst blijft werken/);
  assert.match(d.educationDossier.safeDefault,/Geen Library-naar-Academy/);
  assert.equal(d.educationDossier.decisionStatus,'RESOLVED_PRODUCT_POLICY');
});

test('Constitutionregels noemen blocker, tegenvoorbeeld, enforcement en tests',()=>{
  for(const row of build().constitutionCandidates){assert.ok(row.resolves.length);assert.ok(row.domains.length);
    assert.ok(row.counterexample);assert.ok(row.exceptions);assert.ok(row.runtime);assert.ok(row.tests.length);}
});
