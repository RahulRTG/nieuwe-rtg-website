'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
function setup(t) {
  const p=require('./lib/audit-rijen-fixture')(t,{bankregie:{ledenAan:false},kantoorAudit:[]});
  const bank=require('../server/kern/bankregie').maakBankregie(p);
  const {audit}=require('../server/kern/afdelingen/bewaking')({save:p.save,d:()=>p.db.data,
    crypto:require('node:crypto'),nu:Date.now,functies:{}});
  return {...p,bank,audit};
}
test('bankbesluit wacht op auditbelofte en bewaart besluit plus echte audit',async t=>{
  const p=setup(t);let vrij,klaar=false;
  const wacht=new Promise(r=>{vrij=r;});
  const belofte=p.bank.bankLedenZet({aan:true,audit:async()=>{await wacht;return p.audit('synthetische tester','bank live');}});
  belofte.then(()=>{klaar=true;},()=>{klaar=true;});await new Promise(setImmediate);
  const teVroegKlaar=klaar,voorAudit=p.lees('bankregie').ledenAan;
  vrij();const r=await belofte;
  assert.equal(teVroegKlaar,false,'geen bevestiging vóór audit');assert.equal(voorAudit,false,'geen eigen commit vóór audit');
  assert.equal(r.ok,true);assert.equal(p.lees('bankregie').ledenAan,true);
  assert.equal(p.lees('kantoorAudit').filter(x=>x.wat==='bank live').length,1);
});
for(const async of [false,true]) test('auditfout '+(async?'async':'sync')+' wordt geen succes; noodfallback blijft actief',async t=>{
  const p=setup(t),fout=new Error('synthetische auditfout');
  await assert.rejects(p.bank.bankNoodMeld({reden:'synthetische storing',audit:()=>{
    if(!async)throw fout;const geweigerd=Promise.reject(fout);geweigerd.catch(()=>{});return geweigerd;
  }}),e=>e===fout);
  assert.equal(p.bank.bankClearing().nood,true);assert.equal(p.bank.bankClearing().eigen,false);
  assert.equal(p.bank.bankClearing().kaart,true);
  // Geen rollbackclaim: bijeen kan de reeds gemuteerde noodstand opslaan.
});
test('expliciet auditfoutantwoord wordt geen succesvol bankantwoord',async t=>{
  const p=setup(t),fout={status:503,error:'synthetisch auditbewijs ontbreekt'};
  const r=await p.bank.bankLedenZet({aan:true,audit:async()=>fout});
  assert.equal(r.status,503);assert.equal(r.error,fout.error);assert.notEqual(r.ok,true);
});
