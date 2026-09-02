/* INVISIBLE ARRIVAL, DE ZAAKKANT: wat de HORECAMEDEWERKER ziet en bevestigt.

   Afgesplitst van ./invisible-arrival.js op 2 september 2026, en de naad is
   echt: dat bestand draagt de GASTkant (interpreteren, aanvragen, de tijdelijke
   pass, de vrijwillige aankomstpuls) met zijn eigen poort `arrivalPassAuth`;
   dit draagt de twee routes achter `supplierAuth`. Twee kanten, twee poorten,
   twee lezers.

   DE AANLEIDING was de omvangregel, en dat is hier geen formaliteit. Het
   moederbestand stond op 10222 van de 10240 bytes -- ACHTTIEN bytes speling --
   en liep over zodra er een reparatie in moest die de opslag niet meer aanraakt
   bij een geweigerde aanroep. Precies de val die TAKEN.md 7.21 beschrijft: een
   bestand dat vlak onder de grens staat, heeft geen marge om gerepareerd te
   worden. Opknippen op de naad die er toch al lag is dan goedkoper dan de
   uitleg wegsnijden.

   `lees()` komt van de gastkant mee en niet opnieuw: kijken zonder scheppen
   gebeurt op een plek (zie Hlees in kern/horeca.js). */
'use strict';
const klok = require('../../../lib/klok');
module.exports = ({ app, supplierAuth, db, save, schoon, sseToSupplier, nu, lees, publiek }) => {
  app.post('/api/supplier/horeca/arrivals',supplierAuth,(req,res)=>{const arr=Object.values(lees(req.supplier.code)).filter(a=>Date.parse(a.vervaltAt)>klok.nu()).sort((a,b)=>(a.datum+a.tijd).localeCompare(b.datum+b.tijd));res.json({ok:true,arrivals:arr.map(a=>Object.assign(publiek(a),{wensen:a.wensen,capacity:a.capacity})),openBeloften:arr.reduce((n,a)=>n+a.beloften.filter(p=>/wacht|voorgesteld/.test(p.status)).length,0)})});
  app.post('/api/supplier/horeca/arrival/promise',supplierAuth,(req,res)=>{const a=lees(req.supplier.code)[String(req.body.arrivalId||'')];if(!a)return res.status(404).json({error:'Arrival Pass niet gevonden.'});const p=a.beloften.find(x=>x.id===String(req.body.id||''));if(!p)return res.status(404).json({error:'Belofte niet gevonden.'});p.status=req.body.akkoord===false?'niet-mogelijk':'persoonlijk-bevestigd';p.bewijs=schoon(req.body.bewijs,180)||(p.status==='niet-mogelijk'?'Door zaak afgewezen':'Persoonlijk gecontroleerd door '+req.actor.name);p.door=req.actor.name;p.at=nu();if(a.beloften.every(x=>['persoonlijk-bevestigd','berekend'].includes(x.status))){a.status='bevestigd';a.servicelijn[2].status='klaar';a.servicelijn[3].status='actief';const r=(db.data.reserveringen||[]).find(x=>x.id===a.reserveringId);if(r)r.status='bevestigd'}save();sseToSupplier(req.supplier.code,'sync',{scope:'arrival'});res.json({ok:true,pass:publiek(a)})});
};
