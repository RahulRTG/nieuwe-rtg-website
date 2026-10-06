'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,driver}=require('./lib/library-fixture');
const makeFabric=require('../server/kern/loop-fabric');

test('Library feedback sluit via source-issued eligibility, Edition 2, recall en niet-causale verification',async()=>{
  const f=fixture(),d=driver(f.raw,f.query),setup=await d.setup(),e1=await d.edition();
  await d.consent(d.A,e1);await d.consent(d.B,e1);await d.release(e1);
  const empty={deliver:async()=>({deliveredThrough:0}),protocolEvents:()=>[],authorization:()=>({ok:false}),
    resolveObservation:()=>({ok:false}),artifact:()=>({ok:false})};
  const fabric=makeFabric({db:f.db,bewerkCollectie:f.transaction,livingWorld:empty,workSource:empty,
    librarySource:f.library.loopSource,now:()=> '2026-10-03T10:00:00.000Z'});

  const made=await d.command(d.B,'feedback.create',{editionId:e1,nodeId:setup.nodeId,kind:'correction',
    message:'De datum vraagt een controle.',evidenceRefs:['interview:2026-10-02']});
  await fabric.syncSource('library',setup.workId);
  const inbox=fabric.inboxFor(d.A,{domain:'library',id:setup.workId});
  assert.equal(inbox.ok,true);assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].purpose,'library-content-improvement');
  assert.equal(inbox.items[0].provenance.basis,'voluntary-content-feedback');

  await d.command(d.A,'feedback.decide',{feedbackId:made.result.id,decision:'accepted',reason:'Bron gecontroleerd.'});
  const revision=await d.command(d.A,'revision.add',{nodeId:setup.nodeId,kind:'chapter',title:'De haven',
    content:'De datum is met de bron gecorrigeerd.',changeSummary:'Correctie uit feedback.'});
  await d.command(d.A,'feedback.resolve',{feedbackId:made.result.id,revisionId:revision.result.id,summary:'Datum gecorrigeerd.'});
  const e2=await d.edition(e1);await d.consent(d.A,e2);await d.consent(d.B,e2);await d.release(e2);
  await fabric.syncSource('library',setup.workId);
  const scope={domain:'library',type:'work',id:setup.workId,version:null};
  const candidates=fabric.candidates(d.A,{consumer:{domain:'library',id:setup.workId},scopeRefs:[scope],
    action:'edition.review',purpose:'library-content-improvement'});
  assert.equal(candidates.ok,true);assert.equal(candidates.items.length,1);assert.equal(candidates.items[0].status,'current');
  const changeReceiptId=candidates.items[0].source.changeReceiptId;
  assert.equal(fabric._read().lineage&&Object.values(fabric._read().lineage).every(x=>x.causalClaim===false),true);

  const verification={domain:'library',type:'change-receipt',id:changeReceiptId,version:1};
  await d.command(d.B,'feedback.create',{editionId:e2,nodeId:setup.nodeId,kind:'other',
    message:'De gecorrigeerde datum is nu helder.',evidenceRefs:[],verificationOf:verification,assessment:'improved'});
  await fabric.syncSource('library',setup.workId);
  const relation=Object.values(fabric._read().lineage).find(x=>x.relation==='observed_after_change'&&x.from.id===changeReceiptId);
  assert.ok(relation);assert.equal(relation.causalClaim,false);
});

test('Library weigert verification zonder eigen bekende receipt en Reader-state wordt nooit Observation',async()=>{
  const f=fixture(),d=driver(f.raw,f.query),setup=await d.setup(),e1=await d.edition();
  await d.consent(d.A,e1);await d.consent(d.B,e1);await d.release(e1);
  const denied=await f.raw(d.B,'feedback.create',await d.input('feedback.create',{editionId:e1,nodeId:setup.nodeId,
    kind:'other',message:'Niet echt geverifieerd.',evidenceRefs:[],verificationOf:{domain:'library',type:'change-receipt',
      id:'fabricated',version:1},assessment:'improved'}));
  assert.equal(denied.code,'CHANGE_RECEIPT_REQUIRED');
  assert.equal(f.library.loopSource.protocolEvents(setup.workId).some(x=>x.type.includes('reader')),false);
});
