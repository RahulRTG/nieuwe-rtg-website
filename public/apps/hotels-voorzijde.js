(function(){
'use strict';
/* RTG Verblijven op het RTG Design System (TRAVELOS-MIGRATIE.md, batch 3).
   Dezelfde verblijfskern als ervoor: /api/hotels, /api/verblijf/mijn en
   /api/verblijf. Alleen de vorm komt nu uit /ds/ (Collectie, Detail, Taak),
   en datum en bedrag volgen de taal van het lid in plaats van vast nl-NL. */
const $=s=>document.querySelector(s), esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let TOKEN=null;try{TOKEN=localStorage.getItem('rtg_member_token')}catch(e){}
const START=new URLSearchParams(location.search).get('view');
let TAB=['mijn','service'].includes(START)?START:'zoeken',ALLE=[],MIJN=[],HUIS=null,KAMER=null;
const zoek={bestemming:'',soort:'',aankomst:'',vertrek:'',gasten:2};
const BEELD=['/campagne/palacio.jpg','/campagne/riad.jpg','/campagne/kyoto-suite.jpg','/campagne/onsen.jpg'];
const taal=()=>document.documentElement.lang||'nl';
const api=(pad,body,herkans)=>fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify(body||{})}).then(async r=>{const d=await r.json().catch(()=>({}));const p=herkans?null:(window.RTGGegevensPoort&&window.RTGGegevensPoort.vang(d,r.status,()=>api(pad,body,true),api));if(p)return p;if(!r.ok)throw new Error(d.error||'Er ging iets mis.');return d});
function meld(t){const m=$('#melding');m.textContent=t;m.classList.add('toon');clearTimeout(m._t);m._t=setTimeout(()=>m.classList.remove('toon'),3200)}
function dag(n){const d=new Date(Date.now()+n*86400000);return d.toISOString().slice(0,10)}
function datum(d){if(!d)return 'Nog te bevestigen';const x=new Date(d+'T12:00:00');return new Intl.DateTimeFormat(taal(),{day:'numeric',month:'short',year:'numeric'}).format(x)}
function euro(n){return new Intl.NumberFormat(taal(),{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n)}
function huisVan(v){return ALLE.find(h=>h.code===v.supplierCode)||{}}
function actief(){return MIJN.find(v=>v.status==='ingecheckt')||MIJN.find(v=>v.status==='bevestigd')||MIJN.find(v=>v.status==='aangevraagd')||null}
function leeg(titel,tekst,knop){return '<div class="ds-status ds-status--binnen"><h2 class="ds-status__titel">'+esc(titel)+'</h2><p class="ds-status__tekst">'+esc(tekst)+'</p>'+(knop?'<button class="ds-knop ds-knop--primair ds-status__actie" type="button" data-zoek data-ds-actie="'+esc(knop)+'">'+esc(knop)+'</button>':'')+'</div>'}
function zetTab(tab){
  TAB=['zoeken','mijn','service'].includes(tab)?tab:'zoeken';document.body.dataset.verblijfTab=TAB;
  const kop={zoeken:['Verblijven','Waar wilt u thuiskomen?','Vind een verblijf dat past bij uw reis en de manier waarop u wilt leven.'],mijn:['Mijn verblijf','Alles staat voor u klaar.','Adres, kamer, aankomst en persoonlijke hulp in een rustig overzicht.'],service:['Tijdens uw verblijf','Zeg wat u nodig heeft.','TravelOS brengt uw vraag rechtstreeks naar het team van uw verblijf.']}[TAB];
  $('#verblijfEy').textContent=kop[0];$('#verblijfTitel').textContent=kop[1];$('#verblijfIntro').textContent=kop[2];
  document.querySelectorAll('[data-t]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.t===TAB)));
  const u=new URL(location.href);if(TAB==='zoeken')u.searchParams.delete('view');else u.searchParams.set('view',TAB);history.replaceState(null,'',u.pathname+u.search);
  teken();
}
const MOMENTEN=window.RTGVerblijfMomenten({$,esc,api,meld,datum,leeg,huisVan,actief,zetTab,herlaad:()=>laad(),mijn:()=>MIJN});
function inlog(){return '<div class="ds-status ds-status--binnen"><p class="ds-label">Alleen voor leden</p><h2 class="ds-status__titel">Uw verblijf blijft persoonlijk.</h2><p class="ds-status__tekst">Log in via de RTG-app om te boeken, uw aankomst te zien en iets aan het team te vragen.</p><a class="ds-knop ds-knop--primair ds-status__actie" href="/apps/app.html">Naar de app</a></div>'}
function teken(){if(!TOKEN){$('#inhoud').innerHTML=inlog();return}if(TAB==='zoeken')tekenZoeken();else if(TAB==='mijn')MOMENTEN.tekenMijn();else MOMENTEN.tekenService()}
function tekenZoeken(){
  const q=zoek.bestemming.toLowerCase(),soorten=[...new Set(ALLE.map(h=>h.soort))];
  const lijst=ALLE.filter(h=>(!zoek.soort||h.soort===zoek.soort)&&(!q||[h.naam,h.stad,h.tagline].some(x=>String(x||'').toLowerCase().includes(q))));
  $('#inhoud').innerHTML='<form id="zoekForm" role="search" aria-label="Uw reis"><input class="ds-invoer" id="zBest" type="search" value="'+esc(zoek.bestemming)+'" placeholder="Stad, eiland of verblijf" aria-label="Bestemming"></form>'
    +'<div class="ds-chips" role="group" aria-label="Soort verblijf"><button class="ds-chip" type="button" data-soort="" aria-pressed="'+!zoek.soort+'">Alle</button>'+soorten.map(x=>'<button class="ds-chip" type="button" data-soort="'+esc(x)+'" aria-pressed="'+(zoek.soort===x)+'">'+esc((ALLE.find(h=>h.soort===x)||{}).soortLabel||x)+'</button>').join('')+'</div>'
    +(lijst.length?'<div class="ds-collectie__raster">'+lijst.map(h=>'<button class="ds-kaart ds-kaart--beeld" type="button" data-huis="'+esc(h.code)+'" aria-label="Bekijk dit verblijf: '+esc(h.naam)+'"><img class="ds-kaart__beeld" src="'+BEELD[ALLE.indexOf(h)%BEELD.length]+'" alt="" loading="lazy"><span class="ds-kaart__inhoud"><span class="ds-kaart__titel">'+esc(h.naam)+'</span><span class="ds-kaart__sub">'+esc(h.soortLabel)+(h.stad?' · '+esc(h.stad):'')+(h.vanaf==null?'':' · vanaf '+euro(h.vanaf))+'</span></span></button>').join('')+'</div>':leeg('Geen passend verblijf gevonden.','Probeer een ruimere bestemming.'));
  $('#zoekForm').addEventListener('submit',e=>{e.preventDefault();zoek.bestemming=$('#zBest').value.trim();tekenZoeken()});
  document.querySelectorAll('[data-soort]').forEach(b=>b.addEventListener('click',()=>{zoek.soort=b.dataset.soort;tekenZoeken()}));
  document.querySelectorAll('[data-huis]').forEach(b=>b.addEventListener('click',()=>openHuis(b.dataset.huis)));
}
function openHuis(code){
  HUIS=ALLE.find(h=>h.code===code);if(!HUIS)return;KAMER=null;$('#bladBeeld').src=BEELD[Math.max(0,ALLE.indexOf(HUIS))%BEELD.length];$('#bladBeeld').alt='Sfeerbeeld van '+HUIS.naam;$('#bladNaam').textContent=HUIS.naam;$('#bladMeta').textContent=HUIS.soortLabel+(HUIS.stad?' · '+HUIS.stad:'');$('#bladVerhaal').textContent=HUIS.tagline||'Kies de kamer en data die bij uw reis passen.';$('#kamers').innerHTML=HUIS.kamers.map(k=>'<button class="ds-keuze" type="button" aria-pressed="false" data-kamer="'+esc(k.id)+'"><b>'+esc(k.naam)+'</b><span class="ds-meta">'+esc(k.omschrijving||'Details via het verblijf')+' · '+euro(k.prijs)+' per nacht</span></button>').join('');
  const aan=zoek.aankomst||dag(1),ver=zoek.vertrek&&zoek.vertrek>aan?zoek.vertrek:dag(2);$('#rAan').min=dag(0);$('#rAan').value=aan;$('#rVer').min=dag(1);$('#rVer').value=ver;$('#rAantal').value=String(zoek.gasten);$('#rTotaal').textContent='';$('#rBoek').disabled=true;$('#rBoek').textContent='Kies eerst een kamer';
  document.body.dataset.dsSchermtype='detail';$('#verblijfBlad').showModal();
  document.querySelectorAll('[data-kamer]').forEach(b=>b.addEventListener('click',()=>{KAMER=HUIS.kamers.find(k=>k.id===b.dataset.kamer);document.querySelectorAll('[data-kamer]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));herbereken()}));
}
function sluitBlad(){if($('#verblijfBlad').open)$('#verblijfBlad').close()}
function herbereken(){if(!KAMER)return;const n=Math.round((new Date($('#rVer').value)-new Date($('#rAan').value))/86400000);if(n<1){$('#rBoek').disabled=true;$('#rTotaal').textContent='Vertrek moet na aankomst liggen.';return}$('#rTotaal').textContent=KAMER.naam+' · '+n+' nacht'+(n===1?'':'en')+' · '+euro(KAMER.prijs*n)+' totaal';$('#rBoek').disabled=false;$('#rBoek').textContent='Verblijf aanvragen'}
async function boek(){if(!KAMER)return;try{await api('/api/verblijf',{supplierCode:HUIS.code,roomId:KAMER.id,aankomst:$('#rAan').value,vertrek:$('#rVer').value,personen:Number($('#rAantal').value)});sluitBlad();meld('Aangevraagd bij '+HUIS.naam+'. Het huis bevestigt persoonlijk.');await laad();zetTab('mijn')}catch(e){meld(e.message)}}
async function laad(){try{const [h,m]=await Promise.all([api('/api/hotels'),api('/api/verblijf/mijn')]);ALLE=h.huizen||[];MIJN=m.verblijven||[];teken()}catch(e){$('#inhoud').innerHTML=leeg('Verblijven zijn even niet bereikbaar.',e.message)}}
if(window.RTGUitvoer)RTGUitvoer.bron(()=>MIJN.length?{naam:'verblijven',kolommen:['referentie','verblijf','kamer','aankomst','vertrek','status'],rijen:MIJN.map(v=>[v.ref,v.supplierName,v.roomName,v.aankomst,v.vertrek,v.status])}:{naam:'verblijfadressen',kolommen:['naam','soort','stad','vanaf'],rijen:ALLE.map(h=>[h.naam,h.soortLabel,h.stad||'',h.vanaf==null?'':h.vanaf])});
document.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>zetTab(b.dataset.t)));
$('#inhoud').addEventListener('click',e=>{if(e.target.closest('[data-zoek]'))zetTab('zoeken')});
$('#bladTerug').addEventListener('click',sluitBlad);$('#verblijfBlad').addEventListener('close',()=>{document.body.dataset.dsSchermtype='collectie'});
$('#rAan').addEventListener('change',herbereken);$('#rVer').addEventListener('change',herbereken);$('#rBoek').addEventListener('click',boek);zetTab(TAB);if(TOKEN)laad();
})();
