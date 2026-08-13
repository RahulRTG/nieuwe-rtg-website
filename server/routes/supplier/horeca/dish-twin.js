/* Digital Dish Twin & Station Autopilot. De twin verrijkt het bestaande menu
   en recept; hij vervangt geen van beide. Concepten worden pas na expliciete
   chefgoedkeuring gepubliceerd en iedere versie blijft in het spoor. */
'use strict';
module.exports = kern => {
  const { app, supplierAuth, managerOnly, schoon, save, horeca, keuken, sseToSupplier } = kern;
  const { H, nu, id } = horeca;
  function doos(code){const h=H(code);h.dishTwins=h.dishTwins||{};return h.dishTwins;}
  function recept(s,itemId){return ((keuken.overzicht(s).recepten||[]).find(r=>String(r.id)===String(itemId)))||{regels:[],kostprijs:0,marge:0};}
  function beeld(s,m){const t=doos(s.code)[m.id]||{}, r=recept(s,m.id), pub=t.publicatie||{};return {id:m.id,naam:m.name,omschrijving:m.desc||'',categorie:m.cat||'Overig',station:m.station||'keuken',sectie:m.sectie||'warm',prepMin:m.prepMin||12,prijs:m.price,allergenen:m.allergens||[],uitverkocht:!!m.uitverkocht,recept:r.regels,kostprijs:r.kostprijs,marge:r.marge,versie:t.versie||0,status:t.concept?'concept':t.publicatie?'gepubliceerd':'basis',concept:t.concept||null,publicatie:pub,geschiedenis:(t.geschiedenis||[]).slice(0,8)};}
  app.post('/api/supplier/horeca/dish-twins',supplierAuth,(req,res)=>{
    const menu=Array.isArray(req.supplier.menu)?req.supplier.menu:[];res.json({ok:true,twins:menu.map(m=>beeld(req.supplier,m)),manager:!!req.actor.manager});
  });
  app.post('/api/supplier/horeca/dish-twin/concept',supplierAuth,(req,res)=>{
    if(!managerOnly(req,res))return;const m=(req.supplier.menu||[]).find(x=>String(x.id)===String(req.body.id||''));if(!m)return res.status(404).json({error:'Dit gerecht staat niet op de kaart.'});
    const t=doos(req.supplier.code)[m.id]=doos(req.supplier.code)[m.id]||{versie:0,geschiedenis:[]};
    const b=req.body||{};t.concept={bereiding:schoon(b.bereiding,1800),presentatie:schoon(b.presentatie,600),service:schoon(b.service,600),pairing:schoon(b.pairing,400),kruisbesmetting:schoon(b.kruisbesmetting,600),apparatuur:(Array.isArray(b.apparatuur)?b.apparatuur:[]).slice(0,12).map(x=>schoon(x,50)).filter(Boolean),vaardigheid:['basis','ervaren','chef'].includes(b.vaardigheid)?b.vaardigheid:'ervaren',miseReserve:Math.max(0,Math.min(200,Number(b.miseReserve)||0)),gemaaktDoor:req.actor.name,at:nu()};save();res.json({ok:true,twin:beeld(req.supplier,m)});
  });
  app.post('/api/supplier/horeca/dish-twin/publiceer',supplierAuth,(req,res)=>{
    if(!managerOnly(req,res))return;const m=(req.supplier.menu||[]).find(x=>String(x.id)===String(req.body.id||'')),t=m&&doos(req.supplier.code)[m.id];if(!m||!t||!t.concept)return res.status(404).json({error:'Er staat geen concept klaar voor dit gerecht.'});
    t.versie=(t.versie||0)+1;t.publicatie=Object.assign({},t.concept,{versie:t.versie,goedgekeurdDoor:req.actor.name,goedgekeurdAt:nu()});t.geschiedenis=(t.geschiedenis||[]);t.geschiedenis.unshift(t.publicatie);t.geschiedenis=t.geschiedenis.slice(0,30);delete t.concept;save();sseToSupplier(req.supplier.code,'sync',{scope:'dish-twin'});res.json({ok:true,twin:beeld(req.supplier,m)});
  });
  app.post('/api/supplier/horeca/autopilot',supplierAuth,(req,res)=>{
    const h=H(req.supplier.code), menu=req.supplier.menu||[], open=Object.values(h.rekeningen||{}).filter(r=>r.status==='open'), regels=open.flatMap(r=>r.regels||[]), ov=keuken.overzicht(req.supplier), voorraad=new Map((ov.artikelen||[]).map(a=>[String(a.id),a]));
    const stations={};regels.filter(r=>r.vrijAt&&r.stand!=='uitgegeven').forEach(r=>{const s=r.station||'warm';stations[s]=stations[s]||{station:s,nu:0,hierna:0,minuten:0};if(r.stand==='gestart'||r.stand==='bereid')stations[s].nu++;else stations[s].hierna++;stations[s].minuten+=Math.max(1,Number(r.prepMin)||12)});
    const mise=[];for(const m of menu){const tw=doos(req.supplier.code)[m.id]||{},reserve=Number((tw.publicatie||{}).miseReserve)||0, besteld=regels.filter(r=>String(r.naam).toLowerCase()===String(m.name).toLowerCase()&&r.stand!=='uitgegeven').reduce((n,r)=>n+(r.aantal||1),0),nodig=Math.max(0,reserve+besteld);if(!nodig)continue;const rec=recept(req.supplier,m.id),tekorten=rec.regels.map(rr=>{const a=voorraad.get(String(rr.artikelId));const behoefte=rr.hoeveelheid*nodig;return a&&a.aantal<behoefte?{artikel:a.naam,tekort:Math.round((behoefte-a.aantal)*1000)/1000,eenheid:a.eenheid}:null}).filter(Boolean);mise.push({gerecht:m.name,station:m.sectie||m.station||'keuken',nodig,besteld,reserve,tekorten,actie:tekorten.length?'Voorraad eerst controleren; niet automatisch vrijgeven.':'Bereid '+nodig+' porties inclusief reserve.'});}
    const stationLijst=Object.values(stations).sort((a,b)=>b.nu-a.nu||b.hierna-a.hierna);res.json({ok:true,stations:stationLijst,mise,drukste:stationLijst[0]||null,rahul:stationLijst[0]?'Focus op '+stationLijst[0].station+': '+stationLijst[0].nu+' nu en '+stationLijst[0].hierna+' hierna.':'Geen vrijgegeven keukenwerk; geschikt moment voor gecontroleerde mise-en-place.',bron:'Werkelijke open rekeningen, gepubliceerde twins, recepten en actuele voorraad.'});
  });
};
