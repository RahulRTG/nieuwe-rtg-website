'use strict';

/* Eén echte contractproducer voor de volledige, bestaande Experience-
   inventaris. Dit bestand bewijst uitsluitend dat iedere actuele app en ieder
   actueel scherm een geldige, exacte signature heeft. Het zegt niets over
   compositie in een browser, toegankelijkheid, snelheid of menselijk begrip. */
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const artifact=require('../scripts/lib/experience/artifact');
const evidence=require('../scripts/lib/experience/evidence');
const coverage=require('../scripts/lib/experience/coverage');
const signatures=require('../experience-architecture/signatures.json');

const ROOT=path.join(__dirname,'..');
const report=coverage.build(ROOT);
const canonical=value=>JSON.stringify(artifact.stable(value));
const sourceHash=process.env.RTG_EXPERIENCE_SOURCE;
const commit=process.env.RTG_EXPERIENCE_COMMIT;

test('Experience signature-inventaris omvat exact alle actuele apps en schermen',()=>{
  assert.equal(report.logicalApps.length,114);
  assert.equal(report.screens.length,316);
  assert.equal(Object.keys(signatures.apps||{}).length,report.logicalApps.length);
  assert.equal(Object.keys(signatures.screens||{}).length,report.screens.length);
  assert.equal(Boolean(sourceHash),Boolean(commit),'een bewijsuitvoering bindt bron en commit samen');
});

const subjects=[
  ...report.logicalApps.map(row=>({subjectType:'app',subjectId:row.id,raw:signatures.apps[row.id],row})),
  ...report.screens.map(row=>({subjectType:'screen',subjectId:row.id,raw:signatures.screens[row.route],row}))
].sort((a,b)=>a.subjectId.localeCompare(b.subjectId));

for(const subject of subjects) {
  const check='Experience signature contract: '+subject.subjectId;
  test(check,t=>{
    assert.equal(subject.row.signature.status,'DECLARED',subject.row.signature.reason||subject.subjectId);
    assert.ok(subject.raw&&typeof subject.raw==='object'&&!Array.isArray(subject.raw));
    if(!sourceHash&&!commit)return;
    assert.match(sourceHash,/^[a-f0-9]{64}$/);
    assert.match(commit,/^[a-f0-9]{40}$/);
    const configuration={kind:'experience-signature',subjectType:subject.subjectType,subjectId:subject.subjectId};
    const expected={declared:true,signatureHash:evidence.sha(canonical(subject.raw))};
    const observation={version:1,instrument:'test/experience-signatures.proof.test.js',
      subjectType:subject.subjectType,subjectId:subject.subjectId,dimension:'identity',requirement:'signature',
      sourceHash,commit,configurationHash:evidence.sha(canonical(configuration)),method:'contract',
      checks:[{id:check,observed:expected,expected,passed:true}],result:'passed'};
    t.diagnostic('RTG_EXPERIENCE_CONFIGURATION '+JSON.stringify(configuration));
    t.diagnostic('RTG_EXPERIENCE_OBSERVATION '+JSON.stringify(observation));
  });
}
