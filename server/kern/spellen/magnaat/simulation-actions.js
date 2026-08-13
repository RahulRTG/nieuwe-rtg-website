/* De Magnaat-acties die dezelfde Hospitality Universe en Human Reality als
   het echte Horeca OS gebruiken. Alleen voorstellen mogen terug naar live. */
'use strict';

module.exports=({db,hospitality,director,human})=>({
  'hospitality-start':(p,h,z)=>hospitality.start(p.staat.hospitality,String(z.route||'')),
  'hospitality-stap':p=>hospitality.stap(p.staat.hospitality),
  'hospitality-chaos':(p,h,z)=>{const x=hospitality.INCIDENTEN.find(i=>i.id===String(z.incident||''));return hospitality.injecteer(p.staat.hospitality,x)},
  'hospitality-besluit':(p,h,z)=>hospitality.besluit(p.staat.hospitality,String(z.incident||''),String(z.keuze||'')),
  'hospitality-koppel':(p,h,z)=>{const code=String(z.code||'').toUpperCase(),brug=db&&db.data&&db.data.magnaatBrug&&db.data.magnaatBrug[code];if(!brug||brug.vervaltAt<Date.now())return{status:404,error:'Deze simulatiecode bestaat niet of is verlopen.'};if(brug.gebruikt)return{status:409,error:'Deze simulatiecode is al gebruikt.'};brug.gebruikt=true;brug.potjeId=p.id;p.staat.hospitality=hospitality.nieuw(brug.bron);p.staat.hospitality.brugCode=code;return{status:200,ok:true}},
  'hospitality-delen':p=>{const s=p.staat.hospitality,code=s.brugCode,brug=code&&db&&db.data&&db.data.magnaatBrug&&db.data.magnaatBrug[code];if(!brug)return{status:404,error:'Deze wereld is niet met een zaak verbonden.'};if(s.status!=='afgerond')return{status:409,error:'Rond de simulatie eerst af.'};brug.voorstellen=s.voorstellen.map(x=>Object.assign({},x,{simulatie:p.id,route:s.route,scores:s.scores}));return{status:200,ok:true,let:'Alleen voorstellen zijn teruggestuurd; de live zaak is niet gewijzigd.'}},
  'universe-briefing':(p,h,z)=>{p.staat.universe.briefing=director.briefing(p.staat.universe.wereld,z.vraag);return p.staat.universe.briefing.error?{status:400,error:p.staat.universe.briefing.error}:{status:200,ok:true}},
  'universe-vergelijk':(p,h,z)=>{p.staat.universe.vergelijking=director.vergelijk(p.staat.universe.wereld,String(z.locatieId||''),Array.isArray(z.varianten)?z.varianten.slice(0,4):[]);return p.staat.universe.vergelijking.error?{status:400,error:p.staat.universe.vergelijking.error}:{status:200,ok:true}},
  'universe-evidence':p=>{const s=p.staat.hospitality;p.staat.universe.evidence=director.bewijs(p.staat.universe.wereld,{rtgVersie:'magnaat',runs:Math.max(1,s.tick),scenariofamilies:[s.route||'nog-niet-gestart'],injecties:Object.fromEntries(s.incidenten.map(x=>[x.id,s.incidenten.filter(y=>y.id===x.id).length])),overtredingen:s.incidenten.filter(x=>x.status==='open').map(x=>x.id)});return{status:200,ok:true}},
  'human-open':(p,h,z)=>human.open(p.staat.universe.wereld.human,String(z.type||''),String(z.zone||'lobby'),{omstanders:z.omstanders,spanning:z.spanning,tick:p.staat.hospitality.tick,echteDetails:z.echteDetails}),
  'human-ontwikkel':(p,h,z)=>human.ontwikkel(p.staat.universe.wereld.human,String(z.id||''),z.omstanders,z.spanning),
  'human-besluit':(p,h,z)=>human.besluit(p.staat.universe.wereld.human,String(z.id||''),String(z.keuze||''),{mens:true,rol:'manager',tick:p.staat.hospitality.tick}),
  'human-afronden':(p,h,z)=>human.afronden(p.staat.universe.wereld.human,String(z.id||''),{betrokkenenGesproken:Boolean(z.betrokkenenGesproken)},{mens:true,rol:'manager',tick:p.staat.hospitality.tick})
});
