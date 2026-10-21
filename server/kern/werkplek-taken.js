/* Eén taakbouwer voor de synchrone interne ingang en de duurzame API-opdracht. */
'use strict';
const {createHash}=require('node:crypto');
const kantoren=require('./werkplek-kantoren');
module.exports=({db,save,bewerkCollectie,crypto,nu,kent,norm,takenVan})=>{
 const tekstVan=t=>String(t||'').replace(/[<>]/g,'').trim().slice(0,200);
 const kamers=(code,rij)=>kantoren(code,(db.data.werkplekMensen||{})[code]||[],rij);
 const afdelingVan=(code,a,rij)=>kamers(code,rij).some(k=>k.id===String(a||''))?String(a):'operations';
 const voeg=(rij,tekst,afdeling)=>{const taak={id:crypto.randomBytes(4).toString('hex'),tekst,afdeling,af:false,at:nu()};rij.unshift(taak);if(rij.length>100)rij.pop();return taak;};
 const beeld=(code,rij)=>({ok:true,taken:rij.slice(0,30),kantoren:kamers(code,rij)});
 function taakMaak(code,tekst,afdeling){
  code=norm(code);if(!kent(code))return{status:404,error:'Dit bedrijf kennen we niet.'};
  tekst=tekstVan(tekst);if(!tekst)return{status:400,error:'Wat moet er gebeuren?'};
  const rij=takenVan(code);voeg(rij,tekst,afdelingVan(code,afdeling,rij));save();return beeld(code,rij);
 }
 async function taakMaakBedoeling(code,actor,b={}){
  code=norm(code);if(!kent(code))return{status:404,error:'Dit bedrijf kennen we niet.'};
  if(!actor)return{status:403,error:'Een herleidbare medewerker is vereist.'};
  if(typeof b.idem!=='string'||!b.idem.trim()||b.idem.length>200)return{status:400,error:'Een opdrachtsleutel is vereist. Herhaal dezelfde opdracht met dezelfde sleutel.'};
  const tekst=tekstVan(b.tekst);if(!tekst)return{status:400,error:'Wat moet er gebeuren?'};
  if(typeof bewerkCollectie!=='function')return{status:503,error:'Duurzame taakopslag is niet beschikbaar.'};
  const hash=s=>createHash('sha256').update(s).digest('hex');
  // De sleutel hoort bij de bewuste opdracht van deze actor, niet bij het
  // gekozen huis. Anders kan dezelfde sleutel met een ander bedrijf stil een
  // tweede taak maken. Het huis is inhoud en hoort daarom in de afdruk.
  const key=hash(JSON.stringify([String(actor),b.idem]));
  return bewerkCollectie('werkplekTaken',bron=>{
   const rij=Array.isArray(bron[code])?bron[code]:[];
   const afdeling=afdelingVan(code,b.afdeling,rij),afdruk=hash(JSON.stringify({code,tekst,afdeling}));
   const oud=(bron._ontvangsten||{})[key];
   if(oud){
    if(oud.afdruk!==afdruk)return{status:409,error:'Deze opdrachtsleutel hoort bij andere inhoud. Begin bewust een nieuwe opdracht.'};
    const taak=rij.find(t=>t.id===oud.id);
    if(!taak)return{status:410,error:'Deze opdracht is al ontvangen; de taak is gearchiveerd. Er is geen nieuwe taak aangemaakt.'};
    return{...beeld(code,rij),taak,herhaald:true};
   }
   bron[code]=rij;const taak=voeg(rij,tekst,afdeling);
   if(!bron._ontvangsten)bron._ontvangsten={};bron._ontvangsten[key]={id:taak.id,afdruk};
   return{...beeld(code,rij),taak};
  });
 }
 return{taakMaak,taakMaakBedoeling};
};
