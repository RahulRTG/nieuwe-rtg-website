'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const retryVia of ['provider','klant']) for(const saveVorm of ['owner-only','legacy']) for(const onzeker of [false,true])
test('Directpay: saveherstel '+retryVia+'/'+saveVorm+'/onzeker='+onzeker+' vóór succesvolle bevestiging',async t=>{
  const oud=process.env.RTG_SQLITE_VOLLEDIG_MS;process.env.RTG_SQLITE_VOLLEDIG_MS='0';
  t.after(()=>{if(oud===undefined)delete process.env.RTG_SQLITE_VOLLEDIG_MS;else process.env.RTG_SQLITE_VOLLEDIG_MS=oud;});
  const p=require('./lib/audit-rijen-fixture')(t,{suppliers:[{code:'PROEF',name:'Synthetische partner'}],
    directBetalingen:[],directOntvangsten:{},betaalVerzoeken:[]});
  let providerCalls=0;
  const betaal={AANBIEDER:'simulatie',async maakBetaling(o){providerCalls++;return {id:'p-'+o.referentie,
    status:'open',aanbieder:'simulatie',bedrag:o.bedrag,valuta:'eur'};},
    async haalBetaling(aanbieder,id){return {id,status:'open',aanbieder};}};
  // Het domein moet zijn eigen save herstellen, zonder toevallige opslag door Truth.
  const waarheidSave=saveVorm==='owner-only'?()=>p.save.bestaande(['betaalWaarheid','betaalWaarheidMeldingen']):(...args)=>p.save(...args);
  const {betaalWaarheid}=require('../server/opzet/betaalketen')({db:p.db,save:waarheidSave,crypto,betaal,
    nu:()=>new Date().toISOString(),log:null,env:{}});
  let storingen=[],fouten=0,eigenSaves=0;
  const schijffout=new Error('DIRECTPAY_SAVE_EENMAAL');
  const directSave=()=>{eigenSaves++;const storing=storingen.shift();if(storing){fouten++;
    assert.equal(p.db.data.directBetalingen.length,1);assert.equal(p.db.data.directOntvangsten.PROEF.som,12000);
    if(storing==='na-commit'){
      p.save();assert.equal(p.lees('directBetalingen').length,1);
      assert.equal(p.lees('directOntvangsten').PROEF.som,12000);assert.equal(p.lees('directOntvangsten').PROEF.aantal,1);
    }
    throw schijffout;}return p.save();};
  let meldingen=0,activiteiten=0;
  const direct=require('../server/kern/directpay').maakDirectpay({...p,save:directSave,crypto,betaal,betaalWaarheid,
    findSupplier:code=>p.db.data.suppliers.find(s=>s.code===code),notify(){},notifySupplier(){meldingen++;},
    logActivity(){activiteiten++;},sseToSupplier(){},sseToCustomer(){},sseToOffice(){}});
  const settleFactuur=require('../server/kern/settlement').maakSettlement({db:p.db,save:directSave,
    dpRegistreerMunt:direct.dpRegistreerMunt,dpRegistreerBevestigd:direct.dpRegistreerBevestigd});
  require('../server/kern/betaalwaarheid/inkomend')({betaalWaarheid,settleFactuur});
  const opdracht={key:'k:ALFA',codename:'ALFA',supplierCode:'PROEF',bedragCenten:12000,
    omschrijving:'Saveherstelproef',bron:'app',idem:'direct-saveherstel'};
  const gestart=await direct.dpBetaalDirect(opdracht);
  assert.equal(gestart.status,402);assert.equal(gestart.pending,true);assert.ok(gestart.betalingId);
  assert.equal(providerCalls,1);assert.equal(eigenSaves,0);
  const melding={eventId:'direct-saveherstel-1',aanbieder:'simulatie',providerId:'p-'+gestart.betalingId,
    referentie:gestart.betalingId,status:'betaald',bedrag:12000,valuta:'eur'};
  storingen=onzeker?['na-commit','voor-commit']:['voor-commit'];
  await assert.rejects(betaalWaarheid.providerMelding(melding),e=>e.code==='BETAAL_AFHANDELING_MISLUKT');
  assert.equal(fouten,1);assert.equal(eigenSaves,1);assert.equal(p.db.data.directBetalingen.length,1);
  if(!onzeker&&saveVorm==='owner-only'){
    assert.equal(p.lees('directBetalingen').length,0);assert.deepEqual(p.lees('directOntvangsten'),{});
  } else {assert.equal(p.lees('directBetalingen').length,1);assert.equal(p.lees('directOntvangsten').PROEF.som,12000);}
  assert.equal(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt,undefined);
  assert.equal(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt,null);
  const ref=p.db.data.directBetalingen[0].ref;
  assert.equal((await direct.dpBetaalDirect({...opdracht,bedragCenten:12001})).status,409);assert.equal(eigenSaves,1);
  const eigenVast=()=>({betalingen:p.lees('directBetalingen').length,ref:p.lees('directBetalingen')[0]?.ref||null,
    som:p.lees('directOntvangsten').PROEF?.som||0,aantal:p.lees('directOntvangsten').PROEF?.aantal||0});
  const verwacht={betalingen:1,ref,som:12000,aantal:1};
  if(onzeker){
    if(retryVia==='klant')await assert.rejects(direct.dpBetaalDirect(opdracht),e=>e===schijffout);
    else await assert.rejects(betaalWaarheid.providerMelding(melding),e=>e.code==='BETAAL_AFHANDELING_MISLUKT');
    assert.equal(fouten,2);assert.equal(eigenSaves,2);assert.deepEqual(eigenVast(),verwacht);
    assert.equal(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt,undefined);
    assert.equal(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt,null);
  }
  if(retryVia==='klant'){
    const uit=await direct.dpBetaalDirect(opdracht);assert.equal(uit.status,200);assert.equal(uit.herhaald,true);
    assert.equal(uit.betaling.ref,ref);assert.deepEqual(eigenVast(),verwacht,'klantretry bevestigt geen louter RAM-idem');
  }
  assert.equal(await betaalWaarheid.providerMelding(melding),gestart.betalingId);
  assert.ok(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt);
  assert.ok(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt);
  assert.deepEqual(eigenVast(),verwacht,'Truth afgehandeld vereist vastgelegde Directpay-afhandeling');
  await betaalWaarheid.providerMelding(melding);
  assert.equal((await direct.dpBetaalDirect(opdracht)).betaling.ref,ref);assert.deepEqual(eigenVast(),verwacht);
  assert.equal(providerCalls,1);assert.equal(fouten,onzeker?2:1);assert.equal(meldingen,1);assert.equal(activiteiten,1);
});
