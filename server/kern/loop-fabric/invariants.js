'use strict';

const P=require('./protocol');
const constitution=require('./constitution');
const forbiddenObservation=new Set(['text','title','sourceActorRef','actorRef','personId','email','name']);
const forbiddenReceipt=new Set(['actorRef','authorityRef','operationId']);

function projection(state) {
  for (const row of Object.values(state.observations || {})) {
    for (const key of Object.keys(row.record || {})) if (forbiddenObservation.has(key))
      P.fail('FABRIC_DOMAIN_TRUTH','De Fabric-projectie bevat broninhoud of bronidentiteit.',500);
    if (!row.record || !row.record.objectRef || !row.record.sharing)
      P.fail('FABRIC_REFERENCE_INVALID','Een Observation-indexregel mist haar minimale verwijzing.',500);
    if (row.record.objectRef.type!=='tombstone' && (!row.record.eligibility || !row.record.eligibility.eligibilityId))
      P.fail('FABRIC_ELIGIBILITY_REQUIRED','Een leerbare Observation mist source-issued eligibility.',500);
  }
  const receipts=new Set();
  for (const row of Object.values(state.changes || {})) {
    const receipt=row.receipt || {};
    constitution.assertChangeReceipt(receipt);
    for (const key of Object.keys(receipt)) if (forbiddenReceipt.has(key))
      P.fail('FABRIC_DOMAIN_TRUTH','De Fabric-projectie bevat uitvoerings- of authorityinhoud uit het brondomein.',500);
    if (!receipt.receiptId || !receipt.sourceDomain || !receipt.observationRef || !receipt.decisionRef || !receipt.newRef)
      P.fail('FABRIC_RECEIPT_INVALID','Een geprojecteerd ChangeReceipt mist een brongebonden verwijzing.',500);
    if (receipt.newRef.domain!==receipt.sourceDomain)
      P.fail('FABRIC_SOURCE_OWNERSHIP','Een ChangeReceipt probeert een wijziging voor een ander domein uit te geven.',500);
    receipts.add(receipt.receiptId);
  }
  for (const row of Object.values(state.lineage || {})) {
    P.objectRef(row.from);P.objectRef(row.to);
    if (row.causalClaim!==false) P.fail('FABRIC_CAUSALITY','Lineage mag geen impliciete causaliteit vastleggen.',500);
    if (row.relation==='confirmed_by' && !row.receiptRef)
      P.fail('FABRIC_RECEIPT_REQUIRED','Een bevestigde wijziging mist haar source-issued receipt.',500);
    if (row.receiptRef && !receipts.has(row.receiptRef))
      P.fail('FABRIC_RECEIPT_ORPHAN','Lineage verwijst naar een onbekend ChangeReceipt.',500);
  }
  return {ok:true,observations:Object.keys(state.observations || {}).length,
    changes:Object.keys(state.changes || {}).length,lineage:Object.keys(state.lineage || {}).length};
}

module.exports={projection};
