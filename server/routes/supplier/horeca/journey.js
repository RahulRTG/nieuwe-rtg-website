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
  /* DE STAP DRAAGT GEEN PERCENTAGE MEER, en dat is een reparatie.

     Hier stond `voortgang: 12 / 30 / 48 / 64 / 78` -- vijf vaste getallen die uit
     een toestandslabel kwamen en niets maten. Op het scherm werd dat een ring
     met een percentage erin, en met zes tafels in beeld stond er zes keer 30%.
     Dat is precies wat HORECA.md grens 7 verbiedt: wat niet gemeten is, wordt
     niet als getal getoond.

     Wat er WEL te tellen valt, staat er nu naast: hoeveel van de bestelde regels
     zijn uitgegeven. Dat is een breuk die iemand kan narekenen, hij beweegt
     tijdens de avond, en bij een tafel die nog niets besteld heeft is hij
     afwezig in plaats van nul. */
  function stap(rek) {
    const regels=rek.regels||[], besteld=regels.length, uitgegeven=regels.filter(r=>r.stand==='uitgegeven').length;
    if(!besteld)return {code:'welkom',label:'Welkom & eerste aandacht',actie:'Bied water aan en begeleid de eerste keuze.'};
    if(uitgegeven===besteld)return {code:'genieten',label:'Gast geniet',actie:'Check subtiel of alles naar wens is.'};
    if(regels.some(r=>r.stand==='klaar'))return {code:'pas',label:'Gang verzamelen',actie:'Pas en bediening gereedhouden; niet vooruit uitserveren.'};
    if(regels.some(r=>r.stand==='gestart'||r.stand==='bereid'))return {code:'bereiding',label:'In bereiding',actie:'Bewaar rust aan tafel; Rahul bewaakt de synchronisatie.'};
    return {code:'besteld',label:'Bestelling ontvangen',actie:'Bevestig het ritme en geef de juiste gang vrij.'};
  }
  function conductor(h,rek){
    const groepen={};
    (rek.regels||[]).filter(r=>r.vrijAt&&r.stand!=='uitgegeven').forEach(r=>{
      const k=String(r.gang||0), norm=bereidingsMinuten(h,r);(groepen[k]=groepen[k]||[]).push({naam:r.naam,station:r.station||'warm',stand:r.stand,norm,loopt:minSinds(r.startAt||r.vrijAt),allergie:r.allergie||null});
    });
    return Object.keys(groepen).map(gang=>{
      const regels=groepen[gang], resterend=regels.map(r=>Math.max(0,r.norm-r.loopt));
      const spreiding=resterend.length?Math.max(...resterend)-Math.min(...resterend):0;
      /* SPREIDING IN MINUTEN, geen score. Hier stond `syncScore: 100 - spreiding*8`
         -- een getal dat wel uit een echte meting kwam maar via een verzonnen
         factor 8 een percentage werd. De minuten zelf zijn navertelbaar en de
         adviesregel eronder gebruikte ze allang. Eén drempel, en die staat in
         dezelfde zin: meer dan drie minuten uit elkaar. */
      return {gang:Number(gang),regels,resterend:Math.max(0,...resterend),spreiding,
        synchroon:spreiding<=3,
        advies:spreiding>3?'Laat het snelste station '+spreiding+' minuten wachten met de volgende stap.':'Stations lopen synchroon; de pas kan deze gang samenbrengen.'};
    });
  }
  app.post('/api/supplier/horeca/journey',supplierAuth,(req,res)=>{
    const h=H(req.supplier.code), verzoeken=Array.isArray(h.verzoeken)?h.verzoeken:[];
    const reizen=Object.values(h.rekeningen).filter(r=>r.status==='open').map(r=>{
      const s=stap(r), openVerzoeken=verzoeken.filter(v=>v.rekeningId===r.id&&(v.stand==='open'||v.stand==='opgepakt'));
      const gangen=conductor(h,r), allergieen=(r.regels||[]).map(x=>x.allergie).filter(Boolean);
      const besteld=(r.regels||[]).length, uitgegeven=(r.regels||[]).filter(x=>x.stand==='uitgegeven').length;
      return {rekeningId:r.id,tafel:r.tafel||r.kanaal,gasten:r.gasten,geopendMin:minSinds(r.geopendAt),stap:s,
        regels:besteld,geserveerd:{uitgegeven,besteld},
        openVerzoeken:openVerzoeken.length,oudsteVerzoek:openVerzoeken.reduce((m,v)=>Math.max(m,minSinds(v.at)),0),
        allergieen:[...new Set(allergieen)],gangen,risico:allergieen.length?'allergie':openVerzoeken.some(v=>minSinds(v.at)>7)?'aandacht':gangen.some(g=>!g.synchroon)?'timing':'rustig'};
    }).sort((a,b)=>({allergie:0,aandacht:1,timing:2,rustig:3}[a.risico]-
      {allergie:0,aandacht:1,timing:2,rustig:3}[b.risico])||b.geopendMin-a.geopendMin);
    res.json({ok:true,reizen,samenvatting:{gasten:reizen.reduce((n,r)=>n+r.gasten,0),tafels:reizen.length,aandacht:reizen.filter(r=>r.risico!=='rustig').length,
      synchroon:reizen.flatMap(r=>r.gangen).filter(g=>g.synchroon).length},
      rahul:reizen[0]?('Eerst '+reizen[0].tafel+': '+reizen[0].stap.actie):'De operatie is rustig. Rahul ziet geen open gastreis.'});
  });
};
