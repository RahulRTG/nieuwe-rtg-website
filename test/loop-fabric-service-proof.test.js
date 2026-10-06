'use strict';

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {maakZegel,controleerBericht}=require('../server/lib/zegel');
const {fixture}=require('./lib/loop-fabric-fixture');

function receipt() {
  return {receiptId:'signed-receipt-1',sourceDomain:'workos',protocolVersion:1,
    sourceObject:{domain:'workos',type:'runbook-line',id:'r',version:null},
    previousRef:{domain:'workos',type:'runbook',id:'r1',version:1},newRef:{domain:'workos',type:'runbook',id:'r2',version:2},
    changeType:'runbook.version-created',decisionRef:{domain:'workos',type:'decision',id:'d',version:'2026-10-05T10:00:00.000Z'},
    observationRef:{domain:'workos',type:'incident-observation',id:'o',version:1},
    expectation:{statement:'verwachting',successCriteria:['controle'],contextHash:'a'.repeat(64)},operationId:'signed_operation_0001',
    correlationId:'signed-receipt-1',appliedAt:'2026-10-05T10:00:00.000Z',actorRef:'user-1',
    authorityRef:{workspace:'WLOOP'},context:{workspaceCode:'WLOOP',scopeRefs:[{domain:'workos',type:'runbook',id:'r2',version:2}],
      purpose:'runbook-near-miss-improvement'},integrityRef:{auditId:'a1',hash:'b'.repeat(64)}};
}

test('kritiek receipt draagt crypto-agile service identity en gewijzigde payload faalt vóór projectie',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-loop-proof-'));
  try {
    const zegel=maakZegel({dataDir:dir}),f=fixture(undefined,{serviceProof:zegel}),value=receipt();
    value.serviceProof=zegel.tekenBericht('rtg.service.workos',value,{issuedAt:value.appliedAt});
    assert.deepEqual({algorithm:value.serviceProof.algorithm,canonicalizationVersion:value.serviceProof.canonicalizationVersion,
      schemaVersion:value.serviceProof.schemaVersion},{algorithm:'Ed25519',canonicalizationVersion:1,schemaVersion:1});
    assert.equal(value.serviceProof.keyId,zegel.sleutelId);
    const accepted=await f.fabric.ingest({id:'signed-event-1',type:'workos.change.applied',receipt:value});
    assert.equal(accepted.ok,true,JSON.stringify(accepted));
    assert.equal(f.fabric._read().changes[value.receiptId].serviceVerification,'signed');
    const tampered=JSON.parse(JSON.stringify(value)); tampered.newRef.version=3;
    const denied=await f.fabric.ingest({id:'signed-event-2',type:'workos.change.applied',receipt:tampered});
    assert.equal(denied.code,'SERVICE_PROOF_INVALID');
    assert.equal(f.fabric._read().changes[value.receiptId].receipt.newRef.version,2);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('historische verificatie gebruikt key id en oude publieke sleutel na rotatie/intrekking',()=>{
  const oldDir=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-loop-old-')),newDir=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-loop-new-'));
  try {
    const oldKey=maakZegel({dataDir:oldDir}),newKey=maakZegel({dataDir:newDir}),payload=receipt();
    const proof=oldKey.tekenBericht('rtg.service.workos',payload,{issuedAt:'2026-10-05T10:00:00.000Z'});
    assert.equal(newKey.controleerBericht(proof,payload).geldig,false,'een andere key valideert het receipt niet');
    const historical=controleerBericht(proof,payload,oldKey.publiekeSleutel(),{revokedAt:'2026-10-06T00:00:00.000Z'});
    assert.equal(historical.geldig,true); assert.equal(historical.historisch,true);
    const revoked=controleerBericht(proof,payload,oldKey.publiekeSleutel(),{revokedAt:'2026-10-05T09:00:00.000Z'});
    assert.equal(revoked.geldig,false); assert.equal(revoked.reden,'sleutel-ingetrokken');
  } finally { fs.rmSync(oldDir,{recursive:true,force:true}); fs.rmSync(newDir,{recursive:true,force:true}); }
});
