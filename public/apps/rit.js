/* RTG Aankomst & Chauffeur.
   Dit scherm leest uitsluitend de ledensessie. Zonder die sessie is het geen
   leeg overzicht maar een gesloten deur. Ook een onbekende ritreferentie
   verraadt niets: of hij niet bestaat of van een ander is, welke van de twee
   zegt dit scherm bewust niet.

   Chauffeur, vervoerder en voertuig worden nooit aangevuld met voorbeelddata.
   "Nog niet toegewezen" is een echte ritstand en geen ontbrekend gegeven. */
(function(){
'use strict';
const $=s=>document.querySelector(s), esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TOKEN=(()=>{try{return localStorage.getItem('rtg_member_token')}catch(e){return null}})();
const PARAMS=new URLSearchParams(location.search);let GEVRAAGD=PARAMS.get('rit')||'';
let TAB=['chauffeur','aankomst'].includes(PARAMS.get('view'))?PARAMS.get('view'):(GEVRAAGD?'chauffeur':'aanvragen');
let RITTEN=[],ACTIEF=null,VERBLIJVEN=[],AANBOD=[],ZOEKTIJD=null,POLL=null;
const GEKOZEN={van:null,naar:null,categorie:'taxi'};
const api=(pad,body,herkans)=>fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify(body||{})}).then(async r=>{const d=await r.json().catch(()=>({}));const p=herkans?null:(window.RTGGegevensPoort&&window.RTGGegevensPoort.vang(d,r.status,()=>api(pad,body,true),api));if(p)return p;if(!r.ok)throw new Error(d.error||'Dit lukt nu niet.');return d});
function meld(t){const m=$('#melding');m.textContent=t;m.classList.add('zien');clearTimeout(m._t);m._t=setTimeout(()=>m.classList.remove('zien'),3800)}
function plaats(o){return o&&typeof o==='object'?(o.label||'Onbekende plek'):(o||'Onbekende plek')}
function actieveRit(){return ACTIEF||RITTEN.find(r=>!['afgerekend','geannuleerd','voltooid'].includes(r.status))||RITTEN[0]||null}
function actiefVerblijf(){return VERBLIJVEN.find(v=>v.status==='ingecheckt')||VERBLIJVEN.find(v=>v.status==='bevestigd')||VERBLIJVEN.find(v=>v.status==='aangevraagd')||null}
function openRit(ref){ACTIEF=RITTEN.find(r=>r.ref===ref)||null;if(!ACTIEF)return;GEVRAAGD=ACTIEF.ref;const u=new URL(location.href);u.searchParams.set('rit',ACTIEF.ref);u.searchParams.set('view','chauffeur');history.replaceState(null,'',u.pathname+u.search);zetTab('chauffeur',false)}
function zetKop(){
  const k={aanvragen:['Uw transfer','Van aankomst\nnaar bestemming.','Uw rit sluit aan op uw reis. U kiest; een chauffeur bevestigt persoonlijk.'],chauffeur:['Uw chauffeur',ACTIEF&&['ingestapt','rijdt'].includes(ACTIEF.status)?'Samen onderweg.':ACTIEF&&['voltooid','afgerekend'].includes(ACTIEF.status)?'U bent aangekomen.':ACTIEF&&ACTIEF.status==='aangekomen'?'Ik sta voor u klaar.':'Uw rit blijft in beeld.','Chauffeur, ontmoetingspunt en voortgang staan bij dezelfde reis.'],aankomst:['Bijna thuis','Uw verblijf\nneemt het over.','Van de laatste kilometers naar uw sleutel en gastheer, zonder opnieuw te beginnen.']}[TAB];
  $('#ritEy').textContent=k[0];$('#ritTitel').innerHTML=esc(k[1]).replace('\n','<br>');$('#ritIntro').textContent=k[2];
}
function zetTab(tab,schrijf){
  TAB=['aanvragen','chauffeur','aankomst'].includes(tab)?tab:'aanvragen';document.body.dataset.ritTab=TAB;zetKop();
  document.querySelectorAll('[data-t]').forEach(b=>{if(b.dataset.t===TAB)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  document.querySelectorAll('[data-rit-nav]').forEach(b=>{if(b.dataset.ritNav===TAB)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(schrijf){const u=new URL(location.href);if(TAB==='aanvragen')u.searchParams.delete('view');else u.searchParams.set('view',TAB);history.replaceState(null,'',u.pathname+u.search)}
  teken();
}
function inlog(){return '<div class="rit-leeg"><span>ALLEEN VOOR LEDEN</span><h2>Uw aankomst blijft persoonlijk.</h2><p>Log in via de RTG-app om een rit aan te vragen en alleen uw eigen chauffeur te zien.</p><a href="/apps/app.html">Naar de app</a></div>'}
function teken(){
  if(!TOKEN){$('#inhoud').innerHTML=inlog();return}
  const ctx={$,esc,meld,plaats,ritten:()=>RITTEN,rit:actieveRit,verblijf:actiefVerblijf,aanbod:()=>AANBOD,gekozen:GEKOZEN,zoekPlek,vraagRit,ververs:laad,zetTab,openRit};
  if(TAB==='aanvragen')window.RTGRitMomenten.aanvragen(ctx);else if(TAB==='chauffeur')window.RTGRitMomenten.chauffeur(ctx);else window.RTGRitMomenten.aankomst(ctx);
}
function plekSpec(p){if(!p)return null;if(p.soort==='zaak')return{zaak:p.code};if(p.soort==='halte')return{halte:p.code};if(p.soort==='favoriet')return{favoriet:p.code};if(Number.isFinite(p.lat)&&Number.isFinite(p.lng))return{lat:p.lat,lng:p.lng,label:p.naam||p.label};return null}
function zoekPlek(soort,q,doel){
  clearTimeout(ZOEKTIJD);GEKOZEN[soort]=null;if(q.trim().length<2){doel.hidden=true;doel.textContent='';return}
  ZOEKTIJD=setTimeout(async()=>{try{const d=await api('/api/mob/plekken',{zoek:q.trim(),limiet:10});const lijst=d.plekken||[];doel.innerHTML=lijst.length?lijst.map((p,i)=>'<button type="button" data-plek="'+i+'"><span>'+esc(p.naam)+'</span><small>'+esc([p.genre,p.stad,p.lijn].filter(Boolean).join(' · ')||'RTG-bestemming')+'</small></button>').join(''):'<button type="button" disabled>Geen bekende plek gevonden</button>';doel.hidden=false;doel.querySelectorAll('[data-plek]').forEach(b=>b.addEventListener('click',()=>{const p=lijst[Number(b.dataset.plek)];GEKOZEN[soort]=p;document.querySelector('#'+soort+'Veld').value=p.naam;doel.hidden=true}))}catch(e){doel.hidden=true;meld(e.message)}},180);
}
async function vraagRit(form){
  if(!GEKOZEN.van){meld('Kies een vertrekpunt uit de voorstellen.');$('#vanVeld').focus();return}
  if(!GEKOZEN.naar){meld('Kies een bestemming uit de voorstellen.');$('#naarVeld').focus();return}
  const datum=$('#ritDatum').value,tijd=$('#ritTijd').value;if(!datum||!tijd){meld('Kies de datum en tijd waarop u wilt worden opgehaald.');return}
  const knop=form.querySelector('[type=submit]');knop.disabled=true;knop.textContent='Uw rit veilig aanvragen…';
  try{
    const d=await api('/api/mob/vraag',{ritsoort:'luchthaven',categorie:GEKOZEN.categorie,van:plekSpec(GEKOZEN.van),naar:plekSpec(GEKOZEN.naar),reizigers:Number($('#ritReizigers').value)||1,bagage:Number($('#ritBagage').value)||0,stad:GEKOZEN.naar.stad||null,vertrek:datum+'T'+tijd});
    ACTIEF=d.opdracht;GEVRAAGD=ACTIEF.ref;RITTEN.unshift(ACTIEF);const u=new URL(location.href);u.searchParams.set('rit',ACTIEF.ref);u.searchParams.set('view','chauffeur');history.replaceState(null,'',u.pathname+u.search);meld('Uw rit is aangevraagd. Uw chauffeur wordt persoonlijk bevestigd.');zetTab('chauffeur',false);
  }catch(e){meld(e.message);knop.disabled=false;knop.textContent='Vraag uw rit aan'}
}
async function laad(){
  if(!TOKEN){teken();return}
  try{
    const uit=await Promise.all([api('/api/mob/mijn',{}),api('/api/mob/aanbod',{}),api('/api/verblijf/mijn',{}).catch(()=>({verblijven:[]}))]);
    const m=uit[0];RITTEN=(m.ritten||[]).slice();if(m.lopend&&!RITTEN.some(r=>r.ref===m.lopend.ref))RITTEN.unshift(m.lopend);AANBOD=uit[1].direct||[];VERBLIJVEN=uit[2].verblijven||[];
    ACTIEF=GEVRAAGD?RITTEN.find(r=>r.ref===GEVRAAGD)||null:m.lopend||RITTEN[0]||null;
    if(GEVRAAGD&&!ACTIEF){$('#inhoud').innerHTML='<div class="rit-leeg"><span>UW RIT</span><h2>Deze rit is niet zichtbaar.</h2><p>De referentie staat niet bij uw ritten. Of hij niet bestaat of niet van u is, welke van de twee zegt dit scherm bewust niet.</p><button type="button" data-terug-ritten>Naar mijn ritten</button></div>';document.querySelector('[data-terug-ritten]').addEventListener('click',()=>{GEVRAAGD='';ACTIEF=RITTEN[0]||null;const u=new URL(location.href);u.searchParams.delete('rit');history.replaceState(null,'',u.pathname+u.search);zetTab('chauffeur',true)});return}
    teken();zetKop();startPoll();
  }catch(e){if(/niet ingelogd/i.test(e.message)){$('#inhoud').innerHTML=inlog();return}$('#inhoud').innerHTML='<div class="rit-leeg"><span>UW AANKOMST</span><h2>Dit lukt nu niet.</h2><p>'+esc(e.message)+'</p><button type="button" data-opnieuw>Probeer opnieuw</button></div>';document.querySelector('[data-opnieuw]').addEventListener('click',laad)}
}
function startPoll(){clearInterval(POLL);const r=actieveRit();if(!r||['afgerekend','geannuleerd','voltooid'].includes(r.status))return;POLL=setInterval(async()=>{if(document.hidden)return;try{const d=await api('/api/mob/volg',{ref:r.ref});ACTIEF=d.opdracht;if(TAB!=='aanvragen')teken();zetKop()}catch(e){}},12000)}
document.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>zetTab(b.dataset.t,true)));document.querySelectorAll('[data-rit-nav]').forEach(b=>b.addEventListener('click',()=>zetTab(b.dataset.ritNav,true)));window.addEventListener('beforeunload',()=>clearInterval(POLL));zetTab(TAB,false);laad();
})();
