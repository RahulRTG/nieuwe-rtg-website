/* Een bewerkbaar programma in de bestaande uitnodigingscollectie. De gastlink
   is alleen lezen, herhaald te openen en verleent nooit een account of pas. */
'use strict';
const {vorm,datum}=require('./programma-vorm');
const SCOPE=['reis.programma.lezen'];
module.exports=({transactie,bearer,crypto,nu,vasteAppBasis,publiek,DOEL})=>{
  const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
  function bewaarProgramma(actor,b){
    let programma;try{programma=vorm(b.programma,b.publiceer===true);}catch(e){return {status:400,error:e.message};}
    const app=vasteAppBasis();if(b.publiceer===true&&!app.ok)return {status:503,error:app.error};
    if(!String(b.idem||'').trim())return {status:400,error:'Een herhaalsleutel is vereist.'};
    const idem=hash('programma|'+actor+'|'+String(b.idem).slice(0,200));
    const vinger=hash(JSON.stringify({id:b.id||null,versie:b.versie||0,programma,publiceer:b.publiceer===true,geldigTot:b.geldigTot||null}));
    return transactie(bron=>{
      const herhaald=Object.values(bron).find(u=>u.programmaSleutels&&u.programmaSleutels[idem]);
      if(herhaald)return {status:409,error:herhaald.programmaSleutels[idem]===vinger?'Dit programma is al opgeslagen. Open het bewaarde concept; een uitgegeven link wordt niet opnieuw getoond.':'Deze herhaalsleutel hoort bij andere inhoud.',uitnodiging:publiek(herhaald),herhaald:true};
      let u=b.id&&bron[b.id];
      if(b.id&&(!u||u.door!=='kantoor'||!u.programma))return {status:404,error:'Dit reisprogramma bestaat niet.'};
      if(u&&b.versie!==u.versie)return {status:409,error:'Een collega heeft dit programma gewijzigd. Bewaar uw invoer en open de nieuwste versie.'};
      // Ook updates van een gepubliceerde reis moeten aan publicatie-eisen voldoen.
      if(u&&u.toegang&&!bearer.reden(u.toegang,{doel:DOEL,scope:SCOPE})){
        try{programma=vorm(b.programma,true);}catch(e){return {status:400,error:e.message};}
      }
      let gemaakt=null;
      if(b.publiceer===true){
        if(!datum(b.geldigTot))return {status:400,error:'Kies een geldige einddatum voor de gastlink.'};
        const duur=Date.parse(b.geldigTot+'T23:59:59.999Z')-Date.parse(nu());
        if(duur<=0||duur>366*86400000)return {status:400,error:'De gastlink moet in de komende 366 dagen verlopen.'};
        gemaakt=bearer.maak({prefix:'REIS',issuer:actor,doel:DOEL,scope:SCOPE,
          onderwerp:{soort:'reisuitnodiging',id:u?u.id:''},geldigMs:duur,maxGebruik:1});
      }
      if(!u){const id='U-'+crypto.randomBytes(8).toString('hex');u={id,soort:'klaargezet',door:'kantoor',doorWie:actor,at:nu(),toegang:null,claim:null,opgeeist:null,code_historie:[]};bron[id]=u;}
      if(gemaakt){if(u.toegang){u.code_historie.push({code_hash:u.toegang.code_hash,ingetrokken_at:nu(),rotatie:u.toegang.rotatie});gemaakt.toegang.rotatie=(u.toegang.rotatie||1)+1;}gemaakt.toegang.onderwerp.id=u.id;u.toegang=gemaakt.toegang;}
      u.programma=programma;u.versie=(u.versie||0)+1;u.gewijzigd=nu();u.gewijzigdDoor=actor;
      u.programmaSleutels=u.programmaSleutels||{};u.programmaSleutels[idem]=vinger;
      u.bestemming=programma.bestemming;u.onderdelen=[];
      const dagen=programma.onderdelen.flatMap(o=>[o.datum,o.eindDatum]).filter(Boolean).sort();
      u.venster={van:dagen[0]||'',tot:dagen.at(-1)||''};
      return {ok:true,uitnodiging:{...publiek(u),programma:u.programma},...(gemaakt?{link:app.basis+'/apps/reisuitnodiging.html#code='+gemaakt.code}:{})};
    });
  }
  return {bewaarProgramma};
};
module.exports.SCOPE=SCOPE;
