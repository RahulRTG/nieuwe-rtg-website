(function(w){
'use strict';
/* De drie momenten van een aankomst op het RTG Design System: Taak (een rit
   aanvragen), Detail (uw chauffeur, groot beeld en icoonrijen) en Status (de
   overdracht aan uw verblijf). De gegevens komen uit de mobiliteits- en
   verblijfskern; chauffeur, voertuig en sleutel worden nooit aangevuld. */
const statusNaam=s=>({aangevraagd:'Aangevraagd',geaccepteerd:'Bevestigd',onderweg:'Onderweg naar u',aangekomen:'Aangekomen',ingestapt:'Ingestapt',rijdt:'Samen onderweg',voltooid:'Aangekomen',afgerekend:'Afgerond',geannuleerd:'Geannuleerd'})[s]||s||'Onbekend';
const rang=s=>({aangevraagd:0,geaccepteerd:1,onderweg:2,aangekomen:3,ingestapt:4,rijdt:5,voltooid:6,afgerekend:7})[s]??0;
const initialen=n=>String(n||'RTG').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const BEELD='/images/worlds/heritage/travel-heritage-v2.jpg';
const P={plek:'<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',auto:'<path d="M4 16v-4l2-5h12l2 5v4M4 16h16M7 16v2m10-2v2M4 12h16"/>',vlag:'<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',dag:'<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4m8-4v4M4 10h16"/>',klok:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',mens:'<path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M3 20c0-4 2-6 5-6s5 2 5 6m1-6c4 0 6 2 6 6"/>',koffer:'<rect x="5" y="7" width="14" height="13" rx="1"/><path d="M9 7V4h6v3"/>',sleutel:'<circle cx="8" cy="14" r="4"/><path d="m11 11 9-9m-4 4 3 3"/>',vink:'<path d="m5 12 5 5 9-10"/>',open:'<circle cx="12" cy="12" r="7"/>'};
const ico=(n,k)=>'<svg class="'+(k||'ds-veld__icoon')+'" viewBox="0 0 24 24" aria-hidden="true">'+P[n]+'</svg>';
const gegeven=(n,t)=>'<li class="ds-detail__gegeven"><svg viewBox="0 0 24 24" aria-hidden="true">'+P[n]+'</svg><span>'+t+'</span></li>';
function leeg(ctx,titel,tekst,actie){ctx.$('#inhoud').innerHTML='<div class="ds-status ds-status--binnen"><p class="ds-label">Uw aankomst</p><h2 class="ds-status__titel">'+ctx.esc(titel)+'</h2><p class="ds-status__tekst">'+ctx.esc(tekst)+'</p>'+(actie||'')+'</div>'}
function veld(icoon,label,binnen){return '<label class="ds-veld">'+ico(icoon)+'<span><span class="ds-veld__label">'+label+'</span>'+binnen+'</span><span></span></label>'}
function aanvragen(c){
  const direct=new Set(c.aanbod().map(x=>x.categorie)),keuzes=[['taxi','Comfort'],['limousine','Business'],['taxibus','Ruim']];if(!direct.has(c.gekozen.categorie)){const e=keuzes.find(k=>direct.has(k[0]));if(e)c.gekozen.categorie=e[0]}
  const getal=(id,max)=>'<select class="ds-veld__invoer" id="'+id+'">'+Array.from({length:max+1},(x,n)=>n).filter(n=>id==='ritBagage'||n>0).map(n=>'<option'+(n===2?' selected':'')+'>'+n+'</option>').join('')+'</select>';
  c.$('#inhoud').innerHTML='<form class="ds-taak__kop" id="transferForm" novalidate><p class="ds-label">Uw reis</p><div class="ds-velden">'
    +veld('plek','Ophaalpunt','<input class="ds-veld__invoer" id="vanVeld" autocomplete="off" placeholder="Zoek luchthaven, hotel of plek" aria-expanded="false">')+'<div id="vanLijst" hidden></div>'
    +veld('vlag','Bestemming','<input class="ds-veld__invoer" id="naarVeld" autocomplete="off" placeholder="Waar wilt u naartoe?" aria-expanded="false">')+'<div id="naarLijst" hidden></div>'
    +veld('dag','Datum','<input class="ds-veld__invoer" id="ritDatum" type="date" required>')+veld('klok','Tijd','<input class="ds-veld__invoer" id="ritTijd" type="time" required>')
    +veld('mens','Reizigers',getal('ritReizigers',8))+veld('koffer','Bagage',getal('ritBagage',8))
    +'</div><div class="ds-veldgroep" role="group" aria-label="Kies uw voertuig">'+keuzes.map(k=>'<button class="ds-keuze" type="button" data-categorie="'+k[0]+'" aria-pressed="'+(c.gekozen.categorie===k[0])+'"'+(direct.has(k[0])?'':' disabled title="Niet beschikbaar op deze plek"')+'><b>'+k[1]+'</b><span class="ds-meta">'+(direct.has(k[0])?'Beschikbaar':'Niet beschikbaar op deze plek')+'</span></button>').join('')+'</div>'
    +'<button class="ds-knop ds-knop--primair ds-knop--breed ds-taak__actie" type="submit" data-ds-actie="Vraag uw rit aan">Vraag uw rit aan</button><p class="ds-meta">Uw chauffeur wordt persoonlijk bevestigd.</p></form>';
  const morgen=new Date(Date.now()+86400000);c.$('#ritDatum').min=new Date().toISOString().slice(0,10);c.$('#ritDatum').value=morgen.toISOString().slice(0,10);c.$('#ritTijd').value='12:00';
  [['van','#vanVeld','#vanLijst'],['naar','#naarVeld','#naarLijst']].forEach(x=>{const invoer=c.$(x[1]),lijst=c.$(x[2]);invoer.addEventListener('input',()=>{invoer.setAttribute('aria-expanded','true');c.zoekPlek(x[0],invoer.value,lijst)});invoer.addEventListener('keydown',e=>{if(e.key==='Escape'){lijst.hidden=true;invoer.setAttribute('aria-expanded','false')}})});
  document.querySelectorAll('[data-categorie]').forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;c.gekozen.categorie=b.dataset.categorie;document.querySelectorAll('[data-categorie]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}));c.$('#transferForm').addEventListener('submit',e=>{e.preventDefault();c.vraagRit(e.currentTarget)});
  const ritten=c.ritten().slice(0,3);if(ritten.length)c.$('#inhoud').insertAdjacentHTML('beforeend','<section class="ds-taak__kop"><p class="ds-label">Mijn ritten</p><h2 class="ds-kaart__titel">Verder waar u was.</h2><div class="ds-velden">'+ritten.map(r=>'<button class="ds-keuze" type="button" data-open-rit="'+c.esc(r.ref)+'"><b>'+c.esc(c.plaats(r.van))+' → '+c.esc(c.plaats(r.naar))+'</b><span class="ds-meta">'+c.esc(r.ref)+' · '+c.esc(statusNaam(r.status))+'</span></button>').join('')+'</div></section>');document.querySelectorAll('[data-open-rit]').forEach(b=>b.addEventListener('click',()=>c.openRit(b.dataset.openRit)))
}
function chauffeur(c){
  const r=c.rit();if(!r){leeg(c,'Nog geen chauffeur.','Vraag eerst een rit aan. Daarna verschijnen chauffeur, voertuig en ontmoetingspunt vanzelf.','<button class="ds-knop ds-knop--primair ds-status__actie" type="button" data-aanvragen>Vraag een rit aan</button>');c.$('[data-aanvragen]').addEventListener('click',()=>c.zetTab('aanvragen',true));return}
  const n=r.chauffeur||'Nog niet toegewezen',v=r.voertuig||'Voertuig volgt na bevestiging',vervoerder=r.vervoerder||'Vervoerder wordt gezocht',x=rang(r.status),titel=x>=6?'U bent aangekomen.':x>=4?'U bent samen onderweg.':x>=3?'Ik sta voor u klaar.':x>=2?'Ik kom naar u toe.':x>=1?'Uw chauffeur is bevestigd.':'Uw chauffeur wordt gezocht.';
  const stap=(klaar,t)=>gegeven(klaar?'vink':'open',c.esc(t)+(klaar?'':' · nog niet'));
  c.$('#inhoud').innerHTML='<article class="ds-kaart" data-chauffeurkaart><img class="ds-detail__beeld" src="'+BEELD+'" alt=""><div class="ds-detail__inhoud" data-ritinhoud><h2 class="ds-titel">'+c.esc(titel)+'</h2><p class="ds-detail__status">'+c.esc(statusNaam(r.status))+'</p>'
    +'<ul class="ds-lijst"><li class="ds-lijst__rij"><span class="ds-gesprek__monogram" aria-hidden="true">'+c.esc(initialen(r.chauffeur))+'</span><span><h3 class="ds-lijst__titel" data-chauffeurnaam>'+c.esc(n)+'</h3><span class="ds-lijst__tekst">'+c.esc(vervoerder)+'</span></span><span></span></li></ul>'
    +'<ul class="ds-detail__gegevens">'+gegeven('plek',c.esc(c.plaats(r.van)))+gegeven('auto',c.esc(v))+gegeven('vlag',c.esc(c.plaats(r.naar)))+'</ul>'
    +'<nav class="ds-chips" aria-label="Uw rit"><a class="ds-chip" href="/apps/comm.html">Bericht</a><a class="ds-chip" href="/apps/navigatie.html">Ontmoetingspunt</a><button class="ds-chip" type="button" data-ververs>Ververs status</button></nav>'
    +'<ul class="ds-detail__gegevens" aria-label="Voortgang">'+stap(x>=1,'Chauffeur bevestigd')+stap(x>=3,'Aangekomen bij ophaalpunt')+stap(x>=4,'Samen onderweg')+'</ul>'
    +'<button class="ds-knop ds-knop--primair ds-knop--breed" type="button" data-naar-aankomst data-ds-actie="Naar aankomst">'+(x>=4?'Bekijk uw aankomst':'Naar aankomst & verblijf')+'</button><p class="ds-meta">Uw locatie wordt alleen gebruikt voor deze rit.</p></div></article>';
  c.$('[data-ververs]').addEventListener('click',async()=>{await c.ververs();c.meld('Uw ritstatus is bijgewerkt.')});c.$('[data-naar-aankomst]').addEventListener('click',()=>c.zetTab('aankomst',true));
  if(w.RTGRitOntvangst)w.RTGRitOntvangst.voegToe(c,r);
}
function aankomst(c){
  const r=c.rit(),v=c.verblijf();if(!r&&!v){leeg(c,'Nog geen aankomst gepland.','Uw rit en bevestigde verblijf komen hier samen zodra ze onderdeel zijn van uw reis.','<button class="ds-knop ds-knop--primair ds-status__actie" type="button" data-aanvragen>Plan mijn aankomst</button>');c.$('[data-aanvragen]').addEventListener('click',()=>c.zetTab('aanvragen',true));return}
  const bestemming=r?c.plaats(r.naar):(v.supplierName||'Uw verblijf'),status=r?statusNaam(r.status):(v.status==='ingecheckt'?'Aangekomen':'Voorbereid'),sleutel=v?(v.status==='ingecheckt'?'Beschikbaar':'Na check-in'):'Via uw verblijf',gastheer=v?'Bereikbaar':'Nog niet gekoppeld',bagage=r?String(r.bagage||0)+' koffer'+((r.bagage||0)===1?'':'s'):'Niet gekoppeld';
  const rij=(i,l,t)=>'<div class="ds-veld">'+ico(i)+'<span><span class="ds-veld__label">'+l+'</span><span class="ds-veld__waarde">'+c.esc(t)+'</span></span><span></span></div>';
  c.$('#inhoud').innerHTML='<section class="ds-taak__kop" data-aankomstkaart><p class="ds-meta">'+c.esc(r?c.plaats(r.van):'Uw reis')+' → '+c.esc(bestemming)+'</p><p class="ds-detail__status">'+c.esc(status)+'</p>'
    +'<div class="ds-velden">'+rij('koffer','Bagage',bagage)+rij('mens','Gastheer',gastheer)+rij('sleutel','Digitale sleutel',sleutel)+'</div>'
    +'<nav class="ds-chips" aria-label="Aankomst"><a class="ds-chip" href="/apps/comm.html">Gastheer berichten</a><a class="ds-chip" href="/apps/navigatie.html">Bekijk aankomst</a></nav>'
    +'<a class="ds-knop ds-knop--primair ds-knop--breed ds-taak__actie" href="/apps/hotels.html?view=mijn" data-ds-actie="Naar mijn verblijf">Naar mijn verblijf</a><p class="ds-meta">TravelOS houdt vlucht, rit en verblijf bij elkaar.</p></section>';
}
w.RTGRitMomenten={aanvragen,chauffeur,aankomst,statusNaam};
})(window);
