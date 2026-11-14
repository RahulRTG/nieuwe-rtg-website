'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const ownerFaalt of [false,true]) test('Trust-scope: intrekking blijft vast bij eigenaarfout='+ownerFaalt,t=>{
  const oud=process.env.RTG_SQLITE_VOLLEDIG_MS;process.env.RTG_SQLITE_VOLLEDIG_MS='0';
  t.after(()=>{if(oud===undefined)delete process.env.RTG_SQLITE_VOLLEDIG_MS;else process.env.RTG_SQLITE_VOLLEDIG_MS=oud;});
  const p=require('./lib/audit-rijen-fixture')(t,{connectionCommunication:{messages:[],media:[],calls:[],reports:[],consent:{}}});
  require('../server/opzet/trust-bewijs')({db:p.db,save:p.save,betaal:{},vindReservering:()=>null});
  const Consent=require('../server/kern/connection-consent');
  const Authority=require('../server/kern/bewijsvlak/v3-authority-hook');
  const binding={actor:'a',counterpart:'b',purpose:'rendezvous.communication',capability:'connection.voice',scope:'a|b',version:1};
  const key=Consent.sleutel(binding),subjectId=Authority.subject(binding).id;
  let armed=false,errors=0;
  const fout=new Error('COMMUNICATION_OWNER_SAVE_FAILED');
  const save=()=>{
    if(armed){armed=false;errors++;
      assert.equal(p.db.data.connectionCommunication.consent[key].state,'REVOKED');
      assert.equal(p.db.data.connectionCommunication.calls[0].state,'CONSENT_REVOKED');throw fout;}
    return p.save.bestaande(['connectionCommunication']);
  };
  const comm=require('../server/kern/connection-communication')({product:'rendezvous',db:p.db,save,crypto,
    media:{},schoon:(v,n)=>String(v||'').slice(0,n),ticketSecret:'trust-scope-local-test',isBlocked:()=>false,
    resolveContext:(actor,i)=>i.id==='a|b'?{counterpart:actor==='a'?'b':'a',scope:'a|b'}:null});
  const input={id:'a|b'};
  assert.equal(comm.consent('a',input,'connection.voice',true).status,200);
  assert.equal(comm.consent('b',input,'connection.voice',true).status,200);
  const call=comm.startCall('a',input,'voice','trust-scope-call-0001');assert.equal(call.status,200);
  assert.equal(comm.answer('b',call.call.id,true).status,200);
  assert.equal(p.lees('connectionCommunication').calls[0].state,'ACTIVE');
  armed=ownerFaalt;
  if(ownerFaalt)assert.throws(()=>comm.consent('a',input,'connection.voice',false),e=>e===fout);
  else {const r=comm.consent('a',input,'connection.voice',false);assert.equal(r.status,200);
    assert.equal(r.ownConsent.voice,false);assert.equal(r.consent.voice,false);}
  assert.equal(errors,Number(ownerFaalt));
  const evidence=Object.values(p.lees('trustEvidence').v3.evidence).filter(e=>e.subjectRef.id===subjectId);
  assert.equal(evidence.filter(e=>e.factType==='authority.revoked').length,1);
  assert.equal(evidence.filter(e=>e.factType==='authority.revocation.propagated').length,ownerFaalt?0:1);
  const vast=p.lees('connectionCommunication');
  assert.equal(vast.consent[key].state,'REVOKED','vast authority.revoked mag geen actieve eigenaartoestemming achterlaten');
  assert.equal(Consent.actief(vast.consent,binding),false);
  if(!ownerFaalt)assert.equal(vast.calls[0].state,'CONSENT_REVOKED');
  const restart=p.kind(`const p=require('./server/db');p.load();const C=require('./server/kern/connection-consent');process.stdout.write(JSON.stringify({active:C.actief(p.db.data.connectionCommunication.consent,${JSON.stringify(binding)})}));`);
  assert.equal(restart.status,0,restart.stderr);assert.equal(JSON.parse(restart.stdout).active,false);
});
