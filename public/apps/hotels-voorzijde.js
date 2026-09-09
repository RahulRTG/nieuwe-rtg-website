(function(){
'use strict';
const $=s=>document.querySelector(s), esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let TOKEN=null;try{TOKEN=localStorage.getItem('rtg_member_token')}catch(e){}
const START=new URLSearchParams(location.search).get('view');
let TAB=['mijn','service'].includes(START)?START:'zoeken',ALLE=[],MIJN=[],HUIS=null,KAMER=null;
const zoek={bestemming:'',aankomst:'',vertrek:'',gasten:2};
const api=(pad,body,herkans)=>fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify(body||{})}).then(async r=>{const d=await r.json().catch(()=>({}));const p=herkans?null:(window.RTGGegevensPoort&&window.RTGGegevensPoort.vang(d,r.status,()=>api(pad,body,true),api));if(p)return p;if(!r.ok)throw new Error(d.error||'Er ging iets mis.');return d});
function meld(t){const m=$('#melding');m.textContent=t;m.classList.add('toon');clearTimeout(m._t);m._t=setTimeout(()=>m.classList.remove('toon'),3200)}
function dag(n){const d=new Date(Date.now()+n*86400000);return d.toISOString().slice(0,10)}
function datum(d){if(!d)return 'Nog te bevestigen';const x=new Date(d+'T12:00:00');return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric'}).format(x)}
function huisVan(v){return ALLE.find(h=>h.code===v.supplierCode)||{}}
function actief(){return MIJN.find(v=>v.status==='ingecheckt')||MIJN.find(v=>v.status==='bevestigd')||MIJN.find(v=>v.status==='aangevraagd')||null}
function zetTab(tab){
  TAB=['zoeken','mijn','service'].includes(tab)?tab:'zoeken';document.body.dataset.verblijfTab=TAB;
  const kop={zoeken:['Verblijven','Waar wilt u thuiskomen?','Vind een verblijf dat past bij uw reis en de manier waarop u wilt leven.'],mijn:['Mijn verblijf','Alles staat voor u klaar.','Adres, kamer, aankomst en persoonlijke hulp in een rustig overzicht.'],service:['Tijdens uw verblijf','Zeg wat u nodig heeft.','TravelOS brengt uw vraag rechtstreeks naar het team van uw verblijf.']}[TAB];
  $('#verblijfEy').textContent=kop[0];$('#verblijfTitel').textContent=kop[1];$('#verblijfIntro').textContent=kop[2];
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('aan',b.dataset.t===TAB));
  document.querySelectorAll('[data-verblijf-nav]').forEach(b=>{if(b.dataset.verblijfNav===TAB)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  const u=new URL(location.href);if(TAB==='zoeken')u.searchParams.delete('view');else u.searchParams.set('view',TAB);history.replaceState(null,'',u.pathname+u.search);
  teken();
}
const MOMENTEN=window.RTGVerblijfMomenten({$,esc,api,meld,datum,huisVan,actief,zetTab,herlaad:()=>laad(),mijn:()=>MIJN});
function inlog(){return '<div class="inlog"><span>ALLEEN VOOR LEDEN</span><h2>Uw verblijf blijft persoonlijk.</h2><p>Log in via de RTG-app om te boeken, uw aankomst te zien en iets aan het team te vragen.</p><a href="/apps/app.html">Naar de app</a></div>'}
function teken(){if(!TOKEN){$('#inhoud').innerHTML=inlog();return}if(TAB==='zoeken')tekenZoeken();else if(TAB==='mijn')MOMENTEN.tekenMijn();else MOMENTEN.tekenService()}
function tekenZoeken(){
  const q=zoek.bestemming.toLowerCase();const lijst=ALLE.filter(h=>!q||[h.naam,h.stad,h.tagline].some(x=>String(x||'').toLowerCase().includes(q)));
  $('#inhoud').innerHTML='<form class="verblijf-zoek" id="zoekForm"><span>UW REIS</span><label>Bestemming<input id="zBest" value="'+esc(zoek.bestemming)+'" placeholder="Stad, eiland of verblijf"></label><label>Aankomst<input id="zAan" type="date" min="'+dag(0)+'" value="'+esc(zoek.aankomst)+'"></label><label>Vertrek<input id="zVer" type="date" min="'+dag(1)+'" value="'+esc(zoek.vertrek)+'"></label><label>Gasten<select id="zGast">'+[1,2,3,4,5,6,7,8,9,10].map(n=>'<option'+(n===zoek.gasten?' selected':'')+'>'+n+'</option>').join('')+'</select></label><button class="knop" type="submit">Vind mijn verblijf</button></form><div class="verblijf-lijstkop"><h2>Passend bij uw reis</h2><span>'+lijst.length+' adressen</span></div><div class="verblijf-lijst">'+(lijst.length?lijst.map((h,i)=>'<article class="verblijfkaart"><div class="verblijf-foto foto-'+i%3+'" role="img" aria-label="Sfeerbeeld van '+esc(h.naam)+'"></div><div><span>'+esc(h.soortLabel)+(h.stad?' in '+esc(h.stad):'')+'</span><h3>'+esc(h.naam)+'</h3><p>'+esc(h.tagline||'Een rustig vertrekpunt voor uw reis.')+'</p>'+(h.vanaf==null?'':'<small>Kamers vanaf EUR '+esc(h.vanaf)+' per nacht</small>')+'<button class="knop" type="button" data-huis="'+esc(h.code)+'">Bekijk dit verblijf</button></div></article>').join(''):'<div class="leeg">Geen passend verblijf gevonden. Probeer een ruimere bestemming.</div>')+'</div>';
  $('#zoekForm').addEventListener('submit',e=>{e.preventDefault();zoek.bestemming=$('#zBest').value.trim();zoek.aankomst=$('#zAan').value;zoek.vertrek=$('#zVer').value;zoek.gasten=Number($('#zGast').value)||2;tekenZoeken()});
  document.querySelectorAll('[data-huis]').forEach(b=>b.addEventListener('click',()=>openHuis(b.dataset.huis)));
}
function openHuis(code){
  HUIS=ALLE.find(h=>h.code===code);if(!HUIS)return;KAMER=null;$('#bladNaam').textContent=HUIS.naam;$('#bladMeta').textContent=HUIS.soortLabel+(HUIS.stad?' · '+HUIS.stad:'');$('#bladVerhaal').textContent=HUIS.tagline||'Kies de kamer en data die bij uw reis passen.';$('#kamers').innerHTML=HUIS.kamers.map(k=>'<button class="kamer" type="button" data-kamer="'+esc(k.id)+'"><b>'+esc(k.naam)+'</b><span>'+esc(k.omschrijving||'Details via het verblijf')+'</span><small>EUR '+esc(k.prijs)+' per nacht</small></button>').join('');
  const aan=zoek.aankomst||dag(1),ver=zoek.vertrek&&zoek.vertrek>aan?zoek.vertrek:dag(2);$('#rAan').min=dag(0);$('#rAan').value=aan;$('#rVer').min=dag(1);$('#rVer').value=ver;$('#rAantal').value=String(zoek.gasten);$('#rTotaal').textContent='';$('#rBoek').disabled=true;$('#rBoek').textContent='Kies eerst een kamer';$('#verblijfBlad').hidden=false;
  document.querySelectorAll('[data-kamer]').forEach(b=>b.addEventListener('click',()=>{KAMER=HUIS.kamers.find(k=>k.id===b.dataset.kamer);document.querySelectorAll('[data-kamer]').forEach(x=>x.classList.toggle('aan',x===b));herbereken()}));
}
function herbereken(){if(!KAMER)return;const n=Math.round((new Date($('#rVer').value)-new Date($('#rAan').value))/86400000);if(n<1){$('#rBoek').disabled=true;$('#rTotaal').textContent='Vertrek moet na aankomst liggen.';return}$('#rTotaal').textContent=KAMER.naam+' · '+n+' nacht'+(n===1?'':'en')+' · EUR '+(KAMER.prijs*n)+' totaal';$('#rBoek').disabled=false;$('#rBoek').textContent='Verblijf aanvragen'}
async function boek(){if(!KAMER)return;try{await api('/api/verblijf',{supplierCode:HUIS.code,roomId:KAMER.id,aankomst:$('#rAan').value,vertrek:$('#rVer').value,personen:Number($('#rAantal').value)});$('#verblijfBlad').hidden=true;meld('Aangevraagd bij '+HUIS.naam+'. Het huis bevestigt persoonlijk.');await laad();zetTab('mijn')}catch(e){meld(e.message)}}
async function laad(){try{const [h,m]=await Promise.all([api('/api/hotels'),api('/api/verblijf/mijn')]);ALLE=h.huizen||[];MIJN=m.verblijven||[];teken()}catch(e){$('#inhoud').innerHTML='<div class="leeg">'+esc(e.message)+'</div>'}}
if(window.RTGUitvoer)RTGUitvoer.bron(()=>MIJN.length?{naam:'verblijven',kolommen:['referentie','verblijf','kamer','aankomst','vertrek','status'],rijen:MIJN.map(v=>[v.ref,v.supplierName,v.roomName,v.aankomst,v.vertrek,v.status])}:{naam:'verblijfadressen',kolommen:['naam','soort','stad','vanaf'],rijen:ALLE.map(h=>[h.naam,h.soortLabel,h.stad||'',h.vanaf==null?'':h.vanaf])});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>zetTab(b.dataset.t)));document.querySelectorAll('[data-verblijf-nav]').forEach(b=>b.addEventListener('click',()=>zetTab(b.dataset.verblijfNav)));$('#bladTerug').addEventListener('click',()=>$('#verblijfBlad').hidden=true);$('#rAan').addEventListener('change',herbereken);$('#rVer').addEventListener('change',herbereken);$('#rBoek').addEventListener('click',boek);zetTab(TAB);if(TOKEN)laad();
})();
