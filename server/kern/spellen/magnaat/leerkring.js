/* Magnaat-leerkring: spelgedrag maakt RTG beter zonder productie te besturen.

   Alleen geaggregeerde keuzes, fouttellingen, scenario's en uitkomsten komen
   hierin. Geen speler, zaak, vrije tekst of payload. Een patroon wordt eerst
   een hypothese en daarna hooguit een testopdracht; uitsluitend de boardroom
   kan die status geven. Deze module schrijft nooit code of productiegegevens. */
'use strict';

const klok = require('../../../lib/klok');

module.exports=({db,save,crypto})=>{
  const nu=()=>klok.datum().toISOString();
  const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
  const rond=n=>Math.round(Number(n||0)*10)/10;
  const S=()=>db.data.magnaatLeren=db.data.magnaatLeren||{
    versie:1,runs:[],patronen:{},kandidaten:[],besluiten:[]};
  const asVoor={allergie:'horeca-uitgifte',pin:'betalingen',privacy:'toestemming',
    dubbel:'reserveringen',document:'onboarding',ziek:'rooster',regen:'capaciteit',
    koeling:'haccp',levering:'inkoop',noshow:'reserveringen'};

  function tel(s,key,gegevens){
    const p=s.patronen[key]||(s.patronen[key]={sleutel:key,aantal:0,routes:{},
      uitkomstTotaal:0,laatst:null});
    p.aantal++;p.laatst=nu();
    if(gegevens.route)p.routes[gegevens.route]=(p.routes[gegevens.route]||0)+1;
    p.uitkomstTotaal+=Number(gegevens.uitkomst)||0;
    return p;
  }
  function kandidaat(s,key,bron){
    let k=s.kandidaten.find(x=>x.sleutel===key);
    if(!k){k={id:'ML-'+hash(key).slice(0,10).toUpperCase(),sleutel:key,
      status:'kandidaat',gemaaktAt:nu(),bijgewerktAt:nu()};s.kandidaten.push(k)}
    Object.assign(k,bron,{bijgewerktAt:nu()});
    return k;
  }
  function spec(doel,signaal,verwachting){return{
    doel,gegeven:signaal,wanneer:'dezelfde route met vaste seed opnieuw wordt uitgevoerd',
    dan:verwachting,invarianten:['geen productie-write','geen persoonsgegevens','menselijk akkoord blijft verplicht']};}
  function runEenmalig(s,soort,id){
    const ref=hash(soort+':'+String(id||''));
    if(s.runs.includes(ref))return null;
    s.runs.push(ref);s.runs=s.runs.slice(-2000);return ref;
  }

  function registreerHospitality(invoer){
    const h=invoer&&invoer.simulatie;
    const s=S();if(!h||h.status!=='afgerond')return{status:409,error:'Alleen een afgeronde simulatie kan leren.'};
    if(!runEenmalig(s,'hospitality',invoer.potjeId))return{status:200,ok:true,herhaald:true,kandidaten:[]};
    const geraakt=[];
    for(const x of h.incidenten||[]){
      const keuze=String(x.keuze||'onopgelost'),key='herstel:'+x.id+':'+keuze;
      const p=tel(s,key,{route:h.route,uitkomst:h.scores&&h.scores[x.as]});
      if(keuze==='onopgelost'||p.aantal>=3){
        const doel=asVoor[x.id]||x.as||'workflow';
        geraakt.push(kandidaat(s,key,{soort:keuze==='onopgelost'?'invariant':'workflow',
          titel:keuze==='onopgelost'?'Blokkeer onafgerond risico: '+x.titel:'Beproef herstelroute: '+keuze,
          doel,prioriteit:keuze==='onopgelost'?'hoog':'normaal',bewijs:{waarnemingen:p.aantal,
            routes:Object.assign({},p.routes),gemiddeldeUitkomst:rond(p.uitkomstTotaal/p.aantal)},
          test:spec(doel,x.titel+' → '+keuze,keuze==='onopgelost'
            ?'de dienst kan niet als veilig afgerond gelden zolang dit risico openstaat'
            :'de gekozen herstelroute is herhaalbaar en verslechtert geen harde invariant')}));
      }
    }
    const laag=Object.entries(h.scores||{}).sort((a,b)=>a[1]-b[1])[0];
    if(laag&&laag[1]<76){const key='frictie:'+laag[0],p=tel(s,key,{route:h.route,uitkomst:laag[1]});
      geraakt.push(kandidaat(s,key,{soort:'frictie',titel:'Onderzoek structurele frictie in '+laag[0],
        doel:laag[0],prioriteit:laag[1]<55?'hoog':'normaal',bewijs:{waarnemingen:p.aantal,
          routes:Object.assign({},p.routes),gemiddeldeUitkomst:rond(p.uitkomstTotaal/p.aantal)},
        test:spec(laag[0],'simulaties eindigen onder 76/100','de verbeterde workflow scoort hoger zonder een andere as te verlagen')}));}
    save();return{status:200,ok:true,kandidaten:[...new Set(geraakt.map(x=>x.id))]};
  }

  function registreerCampagne(invoer){
    const s=S();if(!runEenmalig(s,'campagne',invoer&&invoer.potjeId))return{status:200,ok:true,herhaald:true,kandidaten:[]};
    const geraakt=[],acties=invoer.acties||{},fouten=invoer.fouten||{};
    for(const [actie,aantal] of Object.entries(acties)){
      const fout=Number(fouten[actie])||0,totaal=Number(aantal)||0;
      if(totaal<5||fout<3||fout/totaal<.35)continue;
      const key='bediening:'+actie,p=tel(s,key,{route:'economie',uitkomst:100-(fout/totaal*100)});
      geraakt.push(kandidaat(s,key,{soort:'bediening',titel:'Vereenvoudig de route voor '+actie,
        doel:'magnaat-'+actie,prioriteit:fout/totaal>.6?'hoog':'normaal',bewijs:{waarnemingen:p.aantal,
          pogingen:totaal,fouten:fout,foutpercentage:rond(fout/totaal*100)},
        test:spec('magnaat-'+actie,'minstens 35% van de geldige pogingen wordt geweigerd',
          'de gebruiker ziet vóór uitvoering welke voorwaarde ontbreekt en kan herstellen')}));
    }
    save();return{status:200,ok:true,kandidaten:geraakt.map(x=>x.id)};
  }

  function overzicht(){const s=S();return{ok:true,contract:{bron:'uitsluitend geaggregeerde Magnaat-tellingen',
    schrijftProductie:false,wijzigtCode:false,mensBeslist:true},runs:s.runs.length,
    patronen:Object.values(s.patronen).length,kandidaten:s.kandidaten.slice().sort((a,b)=>
      (a.status==='kandidaat'?0:1)-(b.status==='kandidaat'?0:1)||String(b.bijgewerktAt).localeCompare(a.bijgewerktAt)),
    besluiten:s.besluiten.slice(-50)};}
  function besluit(id,keuze,wie){
    const s=S(),k=s.kandidaten.find(x=>x.id===String(id||''));
    if(!k)return{status:404,error:'Verbeterkandidaat niet gevonden.'};
    if(!['naar-test','terug-naar-ontwerp','afwijzen'].includes(keuze))return{status:400,error:'Onbekend besluit.'};
    k.status=keuze==='naar-test'?'test-klaar':keuze==='afwijzen'?'afgewezen':'ontwerp';
    k.beslistAt=nu();k.beslistDoor=String(wie||'boardroom').slice(0,80);
    s.besluiten.push({id:k.id,keuze,status:k.status,at:k.beslistAt,door:k.beslistDoor});
    s.besluiten=s.besluiten.slice(-200);save();return{status:200,ok:true,kandidaat:k,
      let:'Dit besluit maakt alleen een testopdracht; code en productie zijn niet gewijzigd.'};
  }
  return{registreerHospitality,registreerCampagne,overzicht,besluit};
};
