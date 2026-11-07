'use strict';
/* De echte renderer met protocolreceipts; geen browser- of releasekwalificatie. */
const test=require('node:test'),assert=require('node:assert/strict');
const {render}=require('../scripts/lib/experience/observatory');
const {build}=require('../scripts/lib/experience/coverage');
const {fixture}=require('./lib/experience-execution-matrix-fixture');

function report(t) {
  const f=fixture(t),run=f.run(),first=run.coverage.records[0];
  const result=build(f.root,{contract:f.contract,signatures:f.signatures,apps:[],
    screens:[{id:'screen:/apps/hotels.html',route:'/apps/hotels.html',world:'travel',profile:'interface'}],
    evidence:run.coverage,sourceHash:first.sourceHash,commit:first.commit});
  const scopedProofs=result.screens.flatMap(s=>s.dimensions.flatMap(d=>d.scopedProofs||[]));
  assert.equal(scopedProofs.length,5);
  return {version:1,at:run.record.at,commit:run.record.commit,sourceHash:run.record.sourceHash,worktreeDirty:false,
    status:'INCOMPLETE',humanReview:'NOT_TESTED',releaseApproved:false,scopedProofs,
    proofs:[{...run.record,id:'hotels-destination',layer:'experience',scope:'Vijf gemeten deelcellen',
      state:'PROVEN',scopedStatus:'PROVEN_IN_SCOPE',log:'proof.log'}],
    graph:{valid:true,errors:[],nodes:[{route:'/apps/hotels.html',world:'travel',coverage:'MODELED'}],
      journeys:[{id:'hotels',humanIntent:'Een verblijf bekijken',owner:'Travel',domainObject:'Verblijf',
        proofs:[{id:'hotels-destination'}],steps:[],humanReview:{status:'NOT_TESTED'},effortBudget:{}}]}};
}
function journeyStatus(value) {
  const html=render(value),article=html.match(/<article id="journey-hotels">([\s\S]*?)<\/article>/)?.[1];
  assert.ok(article,'de echte renderer toont de reis');
  return article.match(/Automatisch bewijs voor deze reis: <strong>([^<]+)<\/strong>/)?.[1];
}

test('renderer toont uitsluitend de geldige getypeerde scope op dezelfde schone kandidaat',t=>{
  const value=report(t);
  assert.equal(journeyStatus(value),'PROVEN_IN_SCOPE');
  assert.match(render(value),/Automatische bewijslaag: <strong>INCOMPLETE<\/strong>/);
  assert.equal(value.releaseApproved,false,'de positieve deelclaim wijzigt geen vrijgave');
});
for(const [name,change] of [
  ['alleen generieke processtatus',r=>{delete r.proofs[0].scopedStatus;}],
  ['onvolledige getypeerde groep',r=>{r.proofs[0].scopedStatus='NOT_TESTED';r.scopedProofs.pop();}],
  ['ingekorte scopes bij ongewijzigde groene projectie',r=>{r.scopedProofs.pop();}],
  ['één scope dubbel in plaats van een andere',r=>{r.scopedProofs[4]=structuredClone(r.scopedProofs[1]);}],
  ['extra scope bij een complete groep',r=>{r.scopedProofs.push(structuredClone(r.scopedProofs[1]));}],
  ['verkeerd formaat in een verder complete groep',r=>{r.scopedProofs[1].scope.configuration.viewport.width=777;}],
  ['ontbrekende browserversie',r=>{delete r.scopedProofs[1].scope.configuration.browserVersion;}],
  ['geen geldige typed scopes',r=>{r.scopedProofs=[];}],
  ['scope uit andere uitvoering',r=>{r.proofs[0].runId='old-run';}],
  ['scope voor andere proef',r=>{r.scopedProofs.forEach(s=>{s.scope.proof='other-proof';});}],
  ['niet gekwalificeerde scoped status',r=>{r.scopedProofs.forEach(s=>{s.status='NOT_TESTED';});}],
  ['vuile huidige kandidaat',r=>{r.worktreeDirty=true;}],
  ['onbekende kandidaat',r=>{delete r.commit;}],
  ['andere kandidaatcommit',r=>{r.commit='new-candidate';}],
  ['andere huidige bron',r=>{r.sourceHash='new-source';}],
  ['onbekende bron',r=>{delete r.sourceHash;}],
  ['vuile proef',r=>{r.proofs[0].worktreeDirty=true;}],
  ['bron veranderd tijdens proces',r=>{r.proofs[0].sourceChanged=true;}],
  ['verouderde proef',r=>{r.proofs[0].state='STALE';}],
  ['dubbele proefidentiteit',r=>{r.proofs.push({...r.proofs[0]});}],
  ['onbewezen proofRef',r=>{r.graph.journeys[0].proofRefs=['missing-proof'];}],
  ['reis zonder proeven',r=>{r.graph.journeys[0].proofs=[];}]
]) test('renderer maakt geen groene reis bij '+name,t=>{
  const value=report(t);change(value);assert.equal(journeyStatus(value),'INCOMPLETE');
});
test('ongeldig contract blijft zichtbaar afgekeurd ondanks geldige deelscopes',t=>{
  const value=report(t);value.graph.valid=false;
  assert.equal(journeyStatus(value),'CONTRACT_INVALID');
});
test('actuele apparaatdefinitie controleert een oude verder complete rapportprojectie opnieuw',t=>{
  const value=report(t),contract=require('../experience-architecture/coverage-contract.json');
  const profile=contract.configurationCoverage['continuity:destination'].deviceConfigurations['mobile-small'];
  const width=profile.viewport.width;t.after(()=>{profile.viewport.width=width;});
  profile.viewport.width=321;
  assert.equal(journeyStatus(value),'INCOMPLETE');
});
