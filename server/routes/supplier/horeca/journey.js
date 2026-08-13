/* Hospitality Journey & Course Conductor. Geen tweede orderstaat: dit is een
   realtime projectie van de bestaande rekeningen, keukenregels en verzoeken. */
'use strict';

/* De tijd komt van de tijdmachine (server/lib/klok.js) en niet van het
   besturingssysteem. Wie rechtstreeks aan het OS vraagt hoe laat het is, doet
   niet mee aan RTG_KLOK en is dus niet te beproeven op een schrikkeldag, een
   zomertijdgrens of een verlopen mandaat -- en dan is de tijdmachine precies
   zoveel waard als het aantal modules dat meedoet (scripts/klok.js). */
const klok = require('../../../lib/klok');
module.exports = (kern) => {
  const { app, supplierAuth, horeca } = kern;
  const { H } = horeca;
  const { bereidingsMinuten } = require('../../../kern/horeca/keukenlaag');
  const minSinds = at => at ? Math.max(0, Math.round((klok.nu()-Date.parse(at))/60000)) : 0;
  function stap(rek) {
    const regels=rek.regels||[], besteld=regels.length, uitgegeven=regels.filter(r=>r.stand==='uitgegeven').length;
    if(!besteld)return {code:'welkom',label:'Welkom & eerste aandacht',actie:'Bied water aan en begeleid de eerste keuze.',voortgang:12};
    if(uitgegeven===besteld)return {code:'genieten',label:'Gast geniet',actie:'Check subtiel of alles naar wens is.',voortgang:78};
    if(regels.some(r=>r.stand==='klaar'))return {code:'pas',label:'Gang verzamelen',actie:'Pas en bediening gereedhouden; niet vooruit uitserveren.',voortgang:64};
    if(regels.some(r=>r.stand==='gestart'||r.stand==='bereid'))return {code:'bereiding',label:'In bereiding',actie:'Bewaar rust aan tafel; Rahul bewaakt de synchronisatie.',voortgang:48};
    return {code:'besteld',label:'Bestelling ontvangen',actie:'Bevestig het ritme en geef de juiste gang vrij.',voortgang:30};
  }
  function conductor(h,rek){
    const groepen={};
    (rek.regels||[]).filter(r=>r.vrijAt&&r.stand!=='uitgegeven').forEach(r=>{
      const k=String(r.gang||0), norm=bereidingsMinuten(h,r);(groepen[k]=groepen[k]||[]).push({naam:r.naam,station:r.station||'warm',stand:r.stand,norm,loopt:minSinds(r.startAt||r.vrijAt),allergie:r.allergie||null});
    });
    return Object.keys(groepen).map(gang=>{
      const regels=groepen[gang], resterend=regels.map(r=>Math.max(0,r.norm-r.loopt));
      const spreiding=resterend.length?Math.max(...resterend)-Math.min(...resterend):0;
      return {gang:Number(gang),regels,resterend:Math.max(0,...resterend),syncScore:Math.max(0,100-spreiding*8),
        advies:spreiding>3?'Laat het snelste station '+spreiding+' minuten wachten met de volgende stap.':'Stations lopen synchroon; de pas kan deze gang samenbrengen.'};
    });
  }
  app.post('/api/supplier/horeca/journey',supplierAuth,(req,res)=>{
    const h=H(req.supplier.code), verzoeken=Array.isArray(h.verzoeken)?h.verzoeken:[];
    const reizen=Object.values(h.rekeningen).filter(r=>r.status==='open').map(r=>{
      const s=stap(r), openVerzoeken=verzoeken.filter(v=>v.rekeningId===r.id&&(v.stand==='open'||v.stand==='opgepakt'));
      const gangen=conductor(h,r), allergieen=(r.regels||[]).map(x=>x.allergie).filter(Boolean);
      return {rekeningId:r.id,tafel:r.tafel||r.kanaal,gasten:r.gasten,geopendMin:minSinds(r.geopendAt),stap:s,
        regels:(r.regels||[]).length,openVerzoeken:openVerzoeken.length,oudsteVerzoek:openVerzoeken.reduce((m,v)=>Math.max(m,minSinds(v.at)),0),
        allergieen:[...new Set(allergieen)],gangen,risico:allergieen.length?'allergie':openVerzoeken.some(v=>minSinds(v.at)>7)?'aandacht':gangen.some(g=>g.syncScore<70)?'timing':'rustig'};
    }).sort((a,b)=>({allergie:0,aandacht:1,timing:2,rustig:3}[a.risico]-
      {allergie:0,aandacht:1,timing:2,rustig:3}[b.risico])||b.geopendMin-a.geopendMin);
    res.json({ok:true,reizen,samenvatting:{gasten:reizen.reduce((n,r)=>n+r.gasten,0),tafels:reizen.length,aandacht:reizen.filter(r=>r.risico!=='rustig').length,
      synchroon:reizen.flatMap(r=>r.gangen).filter(g=>g.syncScore>=85).length},
      rahul:reizen[0]?('Eerst '+reizen[0].tafel+': '+reizen[0].stap.actie):'De operatie is rustig. Rahul ziet geen open gastreis.'});
  });
};
