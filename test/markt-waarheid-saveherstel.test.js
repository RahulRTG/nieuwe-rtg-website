'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const aantalFouten of [1,2]) test('Markt: providerretry na '+aantalFouten+' opslagfouten bevestigt alleen vastgelegde afhandeling',async t=>{
  const koper={soort:'lid',id:'k1',naam:'Koper'},verkoper={soort:'lid',id:'v1',naam:'Verkoper'};
  const pk=p=>p&&p.soort?p.soort+'|'+p.id:'',cid='ad1:'+pk(koper);
  const p=require('./lib/audit-rijen-fixture')(t,{markt:{
    ads:[{id:'ad1',titel:'Fiets',prijs:120,status:'actief'}],chats:{[cid]:{
      adId:'ad1',adTitel:'Fiets',koper,verkoper,berichten:[],at:'2026-11-12T10:00:00.000Z',
      deal:{bedrag:120,status:'samen',samen:true,gedeeld:{},betaald:false,
        factuur:{nummer:'SAL-2026-000001',bedrag:120}}}}}});
  // Alleen een lokaal bestuurde rail. Geen brede Trust-save die de eigenaar kan redden.
  let providerCalls=0;
  const betaal={async maakBetaling(o){providerCalls++;return {id:'p-'+o.referentie,status:'open',
    aanbieder:'simulatie',bedrag:o.bedrag,valuta:'eur'};},
    async haalBetaling(aanbieder,id){return {id,status:'open',aanbieder};}};
  const {betaalWaarheid}=require('../server/opzet/betaalketen')({db:p.db,save:()=>p.save.bestaande(['betaalWaarheid','betaalWaarheidMeldingen']),crypto,betaal,
    nu:()=>new Date().toISOString(),log:null,env:{}});
  let eigenSaves=0,foutGewapend=0,fouten=0;const schijffout=new Error('MARKT_SAVE_EENMAAL');
  const marktSave=()=>{
    eigenSaves++;
    if(foutGewapend){foutGewapend--;fouten++;
      assert.equal(p.db.data.markt.chats[cid].deal.betaald,true);
      assert.equal(p.db.data.markt.ads[0].status,'verkocht');throw schijffout;}
    return p.save.bestaande(['markt']);
  };
  const markt=require('../server/kern/markt/handel/deal')({db:p.db,save:marktSave,crypto,betaal,betaalWaarheid,
    schoon:v=>String(v||''),notify(){},store:()=>p.db.data.markt,nu:()=>new Date().toISOString(),pk,
    vind:id=>p.db.data.markt.ads.find(a=>a.id===id)||null,chatId:(ad,key)=>ad+':'+key,sein(){}});
  const gestart=await markt.dealBetaal(cid,koper,'apple-pay');
  assert.equal(gestart.status,402);assert.ok(gestart.betalingId);assert.equal(providerCalls,1);
  assert.equal(eigenSaves,0);assert.equal(p.lees('markt').chats[cid].deal.betaald,false);
  assert.equal(p.lees('markt').ads[0].status,'actief');
  const melding={eventId:'markt-saveherstel-1',aanbieder:'simulatie',providerId:'p-'+gestart.betalingId,
    referentie:gestart.betalingId,status:'betaald',bedrag:12000,valuta:'eur'};
  foutGewapend=aantalFouten;
  for(let nr=1;nr<=aantalFouten;nr++) {
    await assert.rejects(betaalWaarheid.providerMelding(melding),e=>e.code==='BETAAL_AFHANDELING_MISLUKT'&&e.cause===schijffout);
    assert.equal(fouten,nr);assert.equal(eigenSaves,nr);
    assert.equal(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt,undefined);
    assert.equal(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt,null);
    assert.equal(p.lees('markt').chats[cid].deal.betaald,false);
  }
  assert.equal(await betaalWaarheid.providerMelding(melding),gestart.betalingId);
  assert.equal(providerCalls,1);assert.equal(fouten,aantalFouten);assert.equal(eigenSaves,aantalFouten+1);
  assert.ok(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt);
  assert.ok(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt);
  const vast=p.lees('markt');
  assert.equal(vast.chats[cid].deal.betaald,true,'Truth afgehandeld vereist een opgeslagen betaalde deal');
  assert.equal(vast.ads[0].status,'verkocht');
  assert.equal(vast.chats[cid].berichten.filter(b=>/Betaald via/.test(b.tekst)).length,1);
  await betaalWaarheid.providerMelding(melding);
  assert.equal(eigenSaves,aantalFouten+1,'volledig afgehandelde ontvangst doet geen nieuw domeinwerk');
  assert.deepEqual(p.lees('markt'),vast);
});
