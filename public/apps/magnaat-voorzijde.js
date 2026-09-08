(function(){
'use strict';
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const veilig=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=c=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format((Number(c)||0)/100);
const VOORZIJDE=q('#magnaatVoorzijde'),DIEP=q('.app'),SCENARIOS=window.RTGMagnaatVoorzijdeScenarios;
let BRON=null,MISSIE_INDEX=0,KEUZE=null;

function huidigeDossiers(){return BRON&&BRON.speler&&BRON.speler.dienst&&Array.isArray(BRON.speler.dienst.dossiers)?BRON.speler.dienst.dossiers:[]}
function huidigDossier(){const lijst=huidigeDossiers();return lijst[MISSIE_INDEX%Math.max(1,lijst.length)]||null}
function actieveTaak(){return BRON&&BRON.speler&&BRON.speler.actieveTaak||null}
function catalogusVoor(dossier){if(!BRON||!Array.isArray(BRON.catalogus))return null;const id=dossier&&dossier.functieId;return BRON.catalogus.find(x=>x.id===id)||BRON.catalogus[MISSIE_INDEX%Math.max(1,BRON.catalogus.length)]||null}
function scenario(){const d=huidigDossier(),c=catalogusVoor(d),soort=(c&&c.spelvorm)||(BRON&&BRON.wereld&&BRON.wereld.gebeurtenis&&BRON.wereld.gebeurtenis.spelvorm)||'operatie';return SCENARIOS[soort]||SCENARIOS.operatie}

function toon(naam){
  qa('[data-mv-paneel]').forEach(p=>{p.hidden=p.dataset.mvPaneel!==naam});
  document.body.dataset.mvScherm=naam;
  qa('[data-mv-nav]').forEach(b=>{if((naam==='wereld'&&b.dataset.mvNav==='wereld')||(naam!=='wereld'&&b.dataset.mvNav==='missie'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  window.scrollTo({top:0,behavior:'smooth'});
}
function openVoorzijde(){
  document.body.classList.add('magnaat-voorzijde-actief');
  VOORZIJDE.hidden=false;VOORZIJDE.removeAttribute('aria-hidden');
  DIEP.setAttribute('aria-hidden','true');
  toon('wereld');renderBron();
}
function openDiep(scherm,anker){
  document.body.classList.remove('magnaat-voorzijde-actief');
  VOORZIJDE.hidden=true;VOORZIJDE.setAttribute('aria-hidden','true');
  DIEP.removeAttribute('aria-hidden');
  if(typeof go==='function')go(scherm||'werkplek');
  if(anker)setTimeout(()=>{const doel=q(anker);if(doel)doel.scrollIntoView({behavior:'smooth',block:'start'})},120);
}
function missieNaam(d,c){return d&&d.naam||c&&c.naam||'Uw werkvloer vraagt een keuze'}
function renderBron(){
  const p=BRON&&BRON.speler||{},d=huidigDossier(),c=catalogusVoor(d),taak=actieveTaak(),event=BRON&&BRON.wereld&&BRON.wereld.gebeurtenis;
  q('#mvMissieTitel').textContent=taak?taak.titel:missieNaam(d,c);
  q('#mvMissieMeta').textContent=[c&&c.categorie,c&&c.spelvorm,event&&event.stad].filter(Boolean).join(' · ')||'Magnaat Test · veilige praktijkmissie';
  const pct=taak&&taak.stappen?Math.round((taak.stap/taak.stappen)*100):d&&d.status==='klaar'?100:40;
  q('#mvVoortgang').style.width=pct+'%';
  q('#mvVoortgangTekst').textContent=taak?'Stap '+Math.min(taak.stap+1,taak.stappen)+' van '+taak.stappen:d&&d.status==='klaar'?'Afgerond':'Klaar om te beginnen';
  q('#mvGaVerder').firstChild.nodeValue=taak?'Hervat missie ':'Ga verder ';
  q('#mvReputatie').textContent=Number.isFinite(p.reputatie)?p.reputatie:'-';
  q('#mvNiveau').textContent=Number.isFinite(p.niveau)?p.niveau:'-';
  q('#mvBalans').textContent=Number.isFinite(p.virtueelBudget)?euro(p.virtueelBudget):'-';
  const bron=huidigeDossiers().length?huidigeDossiers():(BRON&&BRON.catalogus||[]).slice(0,3).map(x=>({naam:x.naam,functieId:x.id,software:x.software,status:'open'}));
  qa('[data-mv-uitdaging]').forEach((b,i)=>{const x=bron[i];if(!x)return;b.hidden=false;b.querySelector('b').textContent=x.naam||'Nieuwe uitdaging';b.querySelector('small').textContent=[x.software&&x.software.naam,x.status==='klaar'?'Afgerond':'veilige missie'].filter(Boolean).join(' · ');b.querySelector('em').textContent=x.status==='klaar'?'Voltooid':i?'Uitdagend':'Vandaag'});
}
function renderMissie(){
  KEUZE=null;q('#mvVoerKeuzeUit').disabled=true;
  const s=scenario(),d=huidigDossier(),c=catalogusVoor(d),event=BRON&&BRON.wereld&&BRON.wereld.gebeurtenis;
  q('#mvBedrijf').textContent=c&&c.software&&c.software.naam||'Magnaat Test';
  q('#mvMissieStap').textContent='Korte oefening · '+(c&&c.spelvorm||'operatie');
  q('#mvVraag').textContent=s.vraag;q('#mvSituatie').textContent=event&&event.beschrijving||s.situatie;
  q('#mvAfzender').textContent=event&&event.stad?event.stad+' operatie':'Nora Bakker';q('#mvRol').textContent=missieNaam(d,c);
  q('#mvKeuzes').innerHTML=s.keuzes.map((x,i)=>'<button class="mv-keuze" type="button" aria-pressed="false" data-mv-keuze="'+i+'"><span><b>'+veilig(x.titel)+'</b><small>'+veilig(x.sub)+'</small></span><i aria-hidden="true">›</i></button>').join('');
  qa('[data-mv-keuze]').forEach(b=>b.addEventListener('click',()=>{KEUZE=Number(b.dataset.mvKeuze);qa('[data-mv-keuze]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));q('#mvVoerKeuzeUit').disabled=false}));
}
function renderResultaat(){
  const x=scenario().keuzes[KEUZE==null?0:KEUZE];
  q('#mvScore').textContent=x.score;q('#mvScoreTitel').textContent=x.score>=85?'Sterke beslissing':x.score>=70?'Goede basis':'Nog ruimte om te leren';
  q('#mvResultaatTitel').textContent=x.score>=85?'Uw keuze bracht rust op de vloer.':x.score>=70?'Uw keuze gaf richting.':'Uw keuze maakt het leermoment zichtbaar.';
  q('#mvImpactKlant').textContent=x.klant;q('#mvImpactTeam').textContent=x.team;q('#mvImpactKosten').textContent=x.kosten;q('#mvWaarom').textContent=x.waarom;
}
function startVolledig(){
  const taak=actieveTaak(),d=huidigDossier(),c=catalogusVoor(d),id=d&&d.functieId||c&&c.id;
  openDiep('werkplek');
  if(taak&&typeof openTask==='function'){TASK=taak;openTask();return}
  if(id&&typeof startTask==='function'){startTask(id);return}
  if(typeof go==='function')go('speelhal');
}

q('#mvGaVerder').addEventListener('click',()=>{if(actieveTaak()){startVolledig();return}renderMissie();toon('missie')});
q('#mvVoerKeuzeUit').addEventListener('click',()=>{if(KEUZE==null)return;renderResultaat();toon('resultaat')});
q('#mvStartVolledig').addEventListener('click',startVolledig);
q('#mvVolgende').addEventListener('click',()=>{const n=Math.max(1,huidigeDossiers().length||(BRON&&BRON.catalogus&&BRON.catalogus.length)||1);MISSIE_INDEX=(MISSIE_INDEX+1)%n;renderBron();renderMissie();toon('missie')});
qa('[data-mv-uitdaging]').forEach(b=>b.addEventListener('click',()=>{MISSIE_INDEX=Number(b.dataset.mvUitdaging)||0;renderBron();renderMissie();toon('missie')}));
qa('[data-mv-naar]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.mvNaar==='missie')renderMissie();toon(b.dataset.mvNaar)}));
qa('[data-mv-nav]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.mvNav==='missie')renderMissie();toon(b.dataset.mvNav)}));
qa('[data-mv-diep]').forEach(b=>b.addEventListener('click',()=>openDiep(b.dataset.mvDiep,b.textContent.trim()==='Team'?'#teamRooms':null)));
const terug=q('[data-magnaat-voorzijde-open]');if(terug)terug.addEventListener('click',openVoorzijde);

window.RTGMagnaatVoorzijde={ontvang(data){BRON=data;renderBron()},open:openVoorzijde};
renderBron();
})();
