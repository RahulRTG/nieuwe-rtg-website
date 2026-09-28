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
  /* De pass zelf komt uit kern/arrivalpas.js, met de echte collectietransactie
     van de JSON-opslag -- geen namaak, want juist daar zit de bewering. */
  db.writable=true;
  const bewerkCollectie=require('../server/db/collectie-bewerken')({store:'json',db,save(){}});
  const arrivalpas=require('../server/kern/arrivalpas')({db,bewerkCollectie,crypto});
  const kern={app,db,crypto,arrivalpas,supplierAuth(req,res,next){next()},accounts:{getStaffById(){return null}},save(){},schoon(v,n){return String(v||'').slice(0,n)},findSupplier(code){return code===supplier.code?supplier:null},notifySupplier(){},sseToSupplier(){},horeca:{H,Hlees,nu(){return new Date().toISOString()}}};
  require('../server/routes/supplier/horeca/invisible-arrival')(kern);
  async function roep(p,body,ip='127.0.0.1'){
    const req={body:body||{},ip,supplier,actor:{name:'Manager'}},antwoord={status:200,body:null};
    const res={set(){return this},status(code){antwoord.status=code;return this},json(value){antwoord.body=value;return this}};
    const handlers=routes.get(p);assert.ok(handlers,'route ontbreekt: '+p);
    let i=0;
    const next=()=>{const h=handlers[i++];if(h)return h(req,res,next)};
    await next();return antwoord;
  }
  return{roep,db};
}

const token='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const morgen=new Date(Date.now()+86400000).toISOString().slice(0,10);
const aanvraag={requestToken:token,supplierCode:'SAFE',datum:morgen,tijd:'20:00',personen:4,naam:'Amina',zone:'zaal'};

test('Arrival Pass bewaart alleen een hash en lekt geen gastgeheim naar de zaak',async()=>{
  const o=omgeving(),gemaakt=await o.roep('/api/arrival/request',aanvraag);
  assert.equal(gemaakt.status,200);
  const pas=gemaakt.body.pass.accessToken;
  assert.match(pas,/^AR\.[0-9A-F]{32}$/,'de server maakt de pass; de aanvraagcode is hem niet');
  assert.notEqual(pas,token);
  const opgeslagen=o.db.data.horeca.SAFE.arrivals[gemaakt.body.pass.id];
  assert.equal('passHash' in opgeslagen,false,'de projectie draagt geen hash meer');
  const rij=o.db.data.arrivalToegang[gemaakt.body.pass.id];
  assert.match(rij.toegang.code_hash,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(o.db.data).includes(pas.slice(3)),false,'het geheim staat nergens');
  assert.equal(JSON.stringify(o.db.data).includes(token),false,'de aanvraagcode ook niet');
  const zaak=await o.roep('/api/supplier/horeca/arrivals',{});
  assert.equal(JSON.stringify(zaak.body).includes(pas),false);
  assert.equal(zaak.body.arrivals[0].id,opgeslagen.id);
});

test('een herhaald verzoek maakt geen dubbele reservering en toont de eerste pass niet opnieuw',async()=>{
  const o=omgeving(),eerste=await o.roep('/api/arrival/request',aanvraag),tweede=await o.roep('/api/arrival/request',aanvraag);
  assert.equal(eerste.status,200);assert.equal(tweede.status,200);
  assert.equal(tweede.body.idempotent,true);
  assert.notEqual(tweede.body.pass.accessToken,eerste.body.pass.accessToken,'een herhaling roteert');
  assert.equal(o.db.data.reserveringen.length,1);
});

test('lezen en statusdelen vereisen exact de tijdelijke bezitssleutel',async()=>{
  const o=omgeving(),gemaakt=await o.roep('/api/arrival/request',aanvraag),pas=gemaakt.body.pass.accessToken;
  const fout=await o.roep('/api/arrival/pass',{pass:'AR.'+'C'.repeat(32)});
  assert.equal(fout.status,401);
  assert.equal((await o.roep('/api/arrival/pass',{pass:token})).status,401,'de aanvraagcode is geen pass');
  const goed=await o.roep('/api/arrival/pulse',{pass:pas,pulse:'onderweg'});
  assert.equal(goed.status,200);assert.equal(goed.body.pass.pulse,'onderweg');
});
