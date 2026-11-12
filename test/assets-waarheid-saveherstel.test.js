'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const retryVia of ['provider','klant']) for(const saveVorm of ['owner-only','legacy']) for(const onzeker of [false,true])
test('Assets: saveherstel '+retryVia+'/'+saveVorm+'/onzeker='+onzeker+' bewaart tickets en poolkas eenmaal',async t=>{
  const oud=process.env.RTG_SQLITE_VOLLEDIG_MS;process.env.RTG_SQLITE_VOLLEDIG_MS='0';
  t.after(()=>{if(oud===undefined)delete process.env.RTG_SQLITE_VOLLEDIG_MS;else process.env.RTG_SQLITE_VOLLEDIG_MS=oud;});
  const assetId='asset-saveherstel';
  const p=require('./lib/audit-rijen-fixture')(t,{sharedAssets:[{id:assetId,naam:'Proefvilla',soort:'villa',
    entiteit:'Proefpool B.V.',waarde:6000000}],assetTickets:[],assetGebruik:[],assetWachtlijst:[],
    assetTerugkoop:[],assetKas:{},assetAanvragen:[]});
  let providerCalls=0;
  const betaal={async maakBetaling(o){providerCalls++;return {id:'p-'+o.referentie,status:'open',
    aanbieder:'simulatie',bedrag:o.bedrag,valuta:'eur'};},async haalBetaling(aanbieder,id){return {id,status:'open',aanbieder};}};
  // Het domein moet zijn eigen save herstellen, zonder toevallige opslag door Truth.
  const waarheidSave=saveVorm==='owner-only'?()=>p.save.bestaande(['betaalWaarheid','betaalWaarheidMeldingen']):(...args)=>p.save(...args);
  const {betaalWaarheid}=require('../server/opzet/betaalketen')({db:p.db,save:waarheidSave,crypto,betaal,
    nu:()=>new Date().toISOString(),log:null,env:{}});
  let eigenSaves=0,storingen=[],fouten=0,aanvraagId;
  const schijffout=new Error('ASSETS_SAVE_EENMAAL');
  const assetsSave=()=>{
    eigenSaves++;
    const storing=storingen.shift();
    if(storing){fouten++;
      const x=p.db.data.assetAanvragen.find(a=>a.id===aanvraagId);
      assert.equal(x.status,'betaald');assert.equal(x.ticketIds.length,2);
      assert.equal(p.db.data.assetTickets.length,2);assert.equal(p.db.data.assetKas[assetId],600000);
      if(storing==='na-commit'){
        p.save.bestaande(['assetAanvragen','assetTickets','assetKas']);
        assert.equal(p.lees('assetAanvragen')[0].status,'betaald');
        assert.equal(p.lees('assetTickets').length,2);assert.equal(p.lees('assetKas')[assetId],600000);
      }
      throw schijffout;}
    return p.save.bestaande(['assetAanvragen','assetTickets','assetKas']);
  };
  const meldingen=[];
  const assets=require('../server/kern/assets')({db:p.db,save:assetsSave,crypto,
    schoon:(v,n)=>String(v||'').slice(0,n),notify:(key,melding)=>meldingen.push({key,melding}),pay:null,betaalWaarheid});
  const lid={key:'assets-koper',tier:'rtg'};
  const aanvraag=assets.assetKoop(lid,'ASSET-KOPER',assetId,'asset',2,true,'assets-aanvraag-saveherstel');
  assert.equal(aanvraag.ok,true);aanvraagId=aanvraag.aanvraag.id;
  assert.equal(assets.assetAanvraagBeslis({id:aanvraagId,besluit:'goedgekeurd',reden:'Gecontroleerde proef',
    doorKey:'assets-beoordelaar'}).ok,true);
  const gestart=await assets.assetAanvraagBetaal(lid,aanvraagId,'betaling-1');
  assert.equal(gestart.status,402);assert.equal(gestart.pending,true);assert.ok(gestart.betalingId);
  assert.equal(providerCalls,1);assert.equal(p.lees('assetAanvragen')[0].status,'betaling-loopt');
  assert.deepEqual(p.lees('assetTickets'),[]);assert.deepEqual(p.lees('assetKas'),{});
  const eigenSavesVoor=eigenSaves,meldingenVoor=meldingen.length;
  const melding={eventId:'assets-saveherstel-1',aanbieder:'simulatie',providerId:'p-'+gestart.betalingId,
    referentie:gestart.betalingId,status:'betaald',bedrag:4600000,valuta:'eur'};
  assert.equal(betaalWaarheid.van(gestart.betalingId).centen,melding.bedrag);
  storingen=onzeker?['na-commit','voor-commit']:['voor-commit'];
  await assert.rejects(betaalWaarheid.providerMelding(melding),e=>e.code==='BETAAL_AFHANDELING_MISLUKT'&&e.cause===schijffout);
  assert.equal(fouten,1);assert.equal(eigenSaves,eigenSavesVoor+1);
  assert.equal(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt,undefined);
  assert.equal(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt,null);
  const ids=p.db.data.assetTickets.map(x=>x.id).sort();assert.equal(new Set(ids).size,2);
  if(onzeker){
    if(retryVia==='klant')await assert.rejects(assets.assetAanvraagBetaal(lid,aanvraagId,'betaling-1'),e=>e===schijffout);
    else await assert.rejects(betaalWaarheid.providerMelding(melding),e=>e.code==='BETAAL_AFHANDELING_MISLUKT'&&e.cause===schijffout);
    assert.equal(fouten,2);assert.equal(eigenSaves,eigenSavesVoor+2);
    assert.equal(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt,undefined);
    assert.equal(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt,null);
    assert.deepEqual(p.lees('assetTickets').map(x=>x.id).sort(),ids);
    assert.equal(p.lees('assetKas')[assetId],600000);
  }
  if(retryVia==='klant'){
    assert.equal((await assets.assetAanvraagBetaal(lid,aanvraagId,'betaling-1')).herhaald,true);
    assert.equal(p.lees('assetAanvragen')[0].status,'betaald','klantretry bevestigt geen louter RAM-resultaat');
    assert.equal(p.lees('assetTickets').length,2);
  }
  assert.equal(await betaalWaarheid.providerMelding(melding),gestart.betalingId);
  assert.equal(providerCalls,1);assert.equal(fouten,onzeker?2:1);
  assert.ok(p.lees('betaalWaarheid')[gestart.betalingId].afgehandeldAt);
  assert.ok(p.lees('betaalWaarheidMeldingen')[melding.eventId].verwerktAt);
  const vast=p.lees('assetAanvragen').find(x=>x.id===aanvraagId),tickets=p.lees('assetTickets');
  assert.equal(vast.status,'betaald','Truth afgehandeld vereist opgeslagen betaalde aanvraag');
  assert.equal(vast.betalingId,gestart.betalingId);assert.ok(vast.betaaldAt);
  assert.deepEqual([...vast.ticketIds].sort(),ids);assert.equal(tickets.length,2);
  assert.deepEqual(tickets.map(x=>x.id).sort(),ids);
  assert.ok(tickets.every(x=>x.aanvraagId===aanvraagId&&x.betalingId===gestart.betalingId&&x.key===lid.key&&x.assetId===assetId&&x.status==='actief'));
  assert.equal(p.lees('assetKas')[assetId],600000);assert.equal(meldingen.length,meldingenVoor);
  const voor={aanvragen:p.lees('assetAanvragen'),tickets,kas:p.lees('assetKas')};
  assert.equal(await betaalWaarheid.providerMelding(melding),gestart.betalingId);assert.equal(providerCalls,1);
  assert.deepEqual({aanvragen:p.lees('assetAanvragen'),tickets:p.lees('assetTickets'),kas:p.lees('assetKas')},voor);
});
