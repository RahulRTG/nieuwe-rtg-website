'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');

function omgeving(){
  const routes=new Map(),db={data:{reserveringen:[],horeca:{},klok:{}}};
  const app={post(p,...handlers){routes.set(p,handlers)}};
  const supplier={code:'SAFE',name:'Maison Safe',settings:{},tables:[{name:'Tafel 1',seats:6,accessible:true,zone:'zaal'}]};
  const H=code=>{db.data.horeca[code]=db.data.horeca[code]||{rekeningen:{}};return db.data.horeca[code]};
  /* Hlees: kijken zonder scheppen, net als in server/kern/horeca.js. De module
     gebruikt hem sinds 2 september 2026 op de leesroutes, zodat een geweigerde
     aanroep (404 op een onbekende arrivalId) geen verse horeca-doos achterlaat.
     Deze namaak-kern moet hem dus ook hebben -- en juist met het ECHTE gedrag,
     want een stub die stilletjes op H() terugvalt zou de reparatie hier
     onzichtbaar maken. */
  const Hlees=code=>db.data.horeca[code]||{rekeningen:{}};
  const kern={app,db,crypto,supplierAuth(req,res,next){next()},accounts:{getStaffById(){return null}},save(){},schoon(v,n){return String(v||'').slice(0,n)},findSupplier(code){return code===supplier.code?supplier:null},notifySupplier(){},sseToSupplier(){},horeca:{H,Hlees,nu(){return new Date().toISOString()}}};
  require('../server/routes/supplier/horeca/invisible-arrival')(kern);
  async function roep(p,body,ip='127.0.0.1'){
    const req={body:body||{},ip,supplier,actor:{name:'Manager'}},antwoord={status:200,body:null};
    const res={status(code){antwoord.status=code;return this},json(value){antwoord.body=value;return this}};
    const handlers=routes.get(p);assert.ok(handlers,'route ontbreekt: '+p);
    let i=0;
    const next=()=>{const h=handlers[i++];if(h)return h(req,res,next)};
    await next();return antwoord;
  }
  return{roep,db};
}

const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const aanvraag={requestToken:token,supplierCode:'SAFE',datum:'2099-08-15',tijd:'20:00',personen:4,naam:'Amina',zone:'zaal'};

test('Arrival Pass bewaart alleen een hash en lekt geen gastgeheim naar de zaak',async()=>{
  const o=omgeving(),gemaakt=await o.roep('/api/arrival/request',aanvraag);
  assert.equal(gemaakt.status,200);
  assert.equal(gemaakt.body.pass.accessToken,token);
  const opgeslagen=o.db.data.horeca.SAFE.arrivals['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'];
  assert.equal(opgeslagen.passHash,crypto.createHash('sha256').update(token).digest('hex'));
  assert.equal(JSON.stringify(opgeslagen).includes(token),false);
  const zaak=await o.roep('/api/supplier/horeca/arrivals',{});
  assert.equal(JSON.stringify(zaak.body).includes(token),false);
  assert.equal(zaak.body.arrivals[0].id,opgeslagen.id);
});

test('een herhaald verzoek maakt geen dubbele reservering',async()=>{
  const o=omgeving(),eerste=await o.roep('/api/arrival/request',aanvraag),tweede=await o.roep('/api/arrival/request',aanvraag);
  assert.equal(eerste.status,200);assert.equal(tweede.status,200);
  assert.equal(tweede.body.idempotent,true);
  assert.equal(o.db.data.reserveringen.length,1);
});

test('lezen en statusdelen vereisen exact de tijdelijke bezitssleutel',async()=>{
  const o=omgeving();await o.roep('/api/arrival/request',aanvraag);
  const fout=await o.roep('/api/arrival/pass',{pass:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.cccccccc-cccc-4ccc-8ccc-cccccccccccc'});
  assert.equal(fout.status,401);
  const goed=await o.roep('/api/arrival/pulse',{pass:token,pulse:'onderweg'});
  assert.equal(goed.status,200);assert.equal(goed.body.pass.pulse,'onderweg');
});
