/* Derde bewijsslice: Leerhuis gebruikt een eigen append-only bronspoor,
   governance en kennisversies. De Fabric vervoert alleen refs en receipts. */
'use strict';

const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./lib/loop-fabric-fixture');
const P=require('../server/kern/loop-fabric/protocol');

const ORG='ACADEMY-LOOP',OWNER='lid:1',LEARNER='lid:2',AUTHOR='lid:3',APPROVER='lid:4';

function act(f,action,input,actor,key) {
  const result=f.academy.doe(ORG,action,input,actor,{sleutel:key});
  assert.equal(result.ok,true,action+': '+JSON.stringify(result)); return result;
}

function setup(f) {
  act(f,'orgOpen',{id:ORG,soort:'RTG',naam:'Academy Loop',eigenaar:OWNER},OWNER,'academy-open-0001');
  for (const actor of [LEARNER,AUTHOR,APPROVER])
    act(f,'relatieZet',{persoon:actor,soort:'EMPLOYEE'},OWNER,'academy-rel-'+actor.replace(':','-'));
  act(f,'bestuurZet',{persoon:AUTHOR,rol:'KNOWLEDGE_OWNER'},OWNER,'academy-author-role');
  act(f,'bestuurZet',{persoon:APPROVER,rol:'KNOWLEDGE_OWNER'},OWNER,'academy-approver-role');
  act(f,'kennisSchrijf',{id:'incident-check',domein:'operations',titel:'Incidentcontrole',
    tekst:'Leg alleen de uitkomst vast.',bron:'bestaande werkinstructie'},AUTHOR,'academy-k1-write');
  act(f,'kennisStand',{id:'incident-check',versie:1,naar:'REVIEW'},AUTHOR,'academy-k1-review');
  act(f,'kennisStand',{id:'incident-check',versie:1,naar:'ACTIVE'},APPROVER,'academy-k1-active');
}

test('Leerhuis praktijkclaim sluit via dezelfde receipts, lineage, recall en niet-causale verification',async()=>{
  const f=fixture(); setup(f);
  const proposal=act(f,'voorstelIndienen',{id:'practice-1',kennis:'incident-check',
    probleem:'De instructie bewaart niet welke controle tot de uitkomst leidde.',huidigeRegel:'Alleen uitkomst vastleggen.',
    voorstel:'Leg controlepad en uitkomst vast.',reden:'In de praktijk kon een collega de beoordeling niet reconstrueren.',
    verwachting:'Een expliciet controlepad maakt de volgende beoordeling reproduceerbaar.',
    succescriteria:['Een tweede behandelaar kan de gevolgde controle reconstrueren.'],purpose:'academy-practice-improvement'},
    LEARNER,'academy-proposal-0001');
  assert.equal(proposal.id,'practice-1');
  await f.fabric.syncSource('leerhuis',ORG);
  const inbox=f.fabric.inboxFor(APPROVER,{domain:'leerhuis',id:ORG});
  assert.equal(inbox.ok,true,JSON.stringify(inbox)); assert.equal(inbox.items.length,1);
  assert.equal(inbox.items[0].sourceActorRef,null,'de kenniseigenaar krijgt geen verborgen indienersprofiel');

  for (const stand of ['TRIAGED','REVIEW','APPROVED'])
    act(f,'voorstelStand',{id:'practice-1',naar:stand,notitie:stand==='APPROVED'?'Wijziging gecontroleerd uitvoeren.':''},
      APPROVER,'academy-proposal-'+stand.toLowerCase());
  act(f,'kennisSchrijf',{id:'incident-check',domein:'operations',titel:'Incidentcontrole',
    tekst:'Leg controlepad én uitkomst vast.',bron:'goedgekeurd praktijkvoorstel',voorstel:'practice-1',reden:'Praktijkfeedback.'},
    AUTHOR,'academy-k2-write');
  act(f,'kennisStand',{id:'incident-check',versie:2,naar:'REVIEW'},AUTHOR,'academy-k2-review');
  act(f,'kennisStand',{id:'incident-check',versie:2,naar:'ACTIVE',impactKlasse:'LEARNING_UPDATE'},
    APPROVER,'academy-k2-active');
  act(f,'voorstelStand',{id:'practice-1',naar:'IMPLEMENTED'},APPROVER,'academy-proposal-implemented');
  const st=f.academy.stand(ORG),receipt=Object.values(st.loopReceipts)[0];
  assert.ok(receipt); assert.equal(receipt.sourceDomain,'leerhuis');
  assert.equal(receipt.previousRef.version,1); assert.equal(receipt.newRef.version,2);
  assert.equal(f.academy.verifieer(ORG).ok,true,'het source-issued receipt staat in de Leerhuis-hashketen');
  await f.fabric.syncSource('leerhuis',ORG);

  const recall=await f.fabric.present(APPROVER,{operationId:'academy_recall_present_0001',context:{
    consumer:{domain:'leerhuis',id:ORG},scopeRefs:[receipt.newRef],action:'knowledge.review',
    purpose:'academy-practice-improvement'}});
  assert.equal(recall.ok,true,JSON.stringify(recall)); assert.equal(recall.recall.candidates.length,1);
  assert.equal(recall.recall.candidates[0].source.changeReceiptId,receipt.receiptId);
  assert.equal(recall.recall.candidates[0].policy.decision,'allow');

  act(f,'voorstelIndienen',{id:'practice-2',kennis:'incident-check',probleem:'Nieuwe uitvoering gecontroleerd.',
    voorstel:'Behoud de nieuwe instructie.',reden:'Een tweede behandelaar kon het controlepad reconstrueren.',
    verwachting:'De nieuwe uitvoering blijft navolgbaar.',succescriteria:['Controlepad is reproduceerbaar.'],
    purpose:'academy-practice-improvement',verificationOf:{domain:'leerhuis',type:'change-receipt',id:receipt.receiptId,version:1},
    assessment:'improved'},LEARNER,'academy-verification-0001');
  await f.fabric.syncSource('leerhuis',ORG);
  const relation=Object.values(f.fabric._read().lineage).find(row=>row.relation==='observed_after_change' && row.to.id==='practice-2');
  assert.ok(relation); assert.equal(relation.causalClaim,false);
  assert.equal(relation.provenance.note,'temporal-verification-not-causality');
  assert.equal(P.refKey(relation.from),P.refKey({domain:'leerhuis',type:'change-receipt',id:receipt.receiptId,version:1}));
  assert.equal(JSON.stringify(f.db.data.loopFabric).includes('collega de beoordeling niet reconstrueren'),false,
    'de Fabric kopieert geen praktijkinhoud uit het Leerhuis');
  const proof=f.fabric.proofFor(APPROVER,{domain:'leerhuis',id:ORG});
  assert.equal(proof.ok,true); assert.equal(proof.changes.length,1); assert.equal(proof.integrity,true);
  f.db.data.loopFabric.consumed={}; f.db.data.loopFabric.observations={}; f.db.data.loopFabric.changes={}; f.db.data.loopFabric.lineage={};
  const rebuilt=await f.fabric.rebuild([],{leerhuis:[ORG]});
  assert.equal(rebuilt.ok,true); assert.equal(rebuilt.changes,1); assert.equal(rebuilt.observations,2);
  assert.ok(rebuilt.lineage>=6,'de herbouw gebruikt uitsluitend het Leerhuis-bronspoor');
});

test('Leerhuis weigert verzonnen verification receipts en actuele authority wordt bij recall herbeoordeeld',async()=>{
  const f=fixture(); setup(f);
  const fake=f.academy.doe(ORG,'voorstelIndienen',{id:'fake-verification',kennis:'incident-check',probleem:'x',voorstel:'y',reden:'z',
    verificationOf:{domain:'leerhuis',type:'change-receipt',id:'missing',version:1},assessment:'improved'},LEARNER,
    {sleutel:'academy-fake-verification'});
  assert.equal(fake.ok,false); assert.equal(fake.status,404);
  act(f,'bestuurZet',{persoon:APPROVER,rol:'KNOWLEDGE_OWNER',aan:false},OWNER,'academy-revoke-approver');
  const denied=f.fabric.inboxFor(APPROVER,{domain:'leerhuis',id:ORG});
  assert.equal(denied.code,'AUTHORITY_REVOKED');
});
