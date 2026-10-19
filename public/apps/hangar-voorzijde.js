(function(){
'use strict';
/* De Hangar op het RTG Design System (TRAVELOS-MIGRATIE.md, stroom D).
   Dezelfde rechterhandkern als ervoor: /api/member/rechterhand/hangar,
   .../hangar/toestel(/weg), .../hangar/vlucht(/weg) en .../ai. Alleen de vorm
   komt nu uit /ds/: de vloot als Collectie, een toestel als Detail met zijn
   logboek als Taak, en de vluchtcoordinator als Gesprek. Datums volgen de taal
   van het lid in plaats van vaste Nederlandse maandnamen. */
const $=s=>document.querySelector(s);
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let TOKEN=null;try{TOKEN=localStorage.getItem('rtg_member_token')}catch(e){}
const BEELD='/campagne/jet.jpg';
const taal=()=>document.documentElement.lang||'nl';
function meld(t){const m=$('#melding');m.textContent=t;m.classList.add('toon');clearTimeout(m._t);m._t=setTimeout(()=>m.classList.remove('toon'),2600)}
const api=(pad,body)=>fetch('/api/member/rechterhand/'+pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify(body||{})}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'Er ging iets mis.');e.status=r.status;throw e}return d});
/* De server levert YYYY-MM-DD; het scherm kort af tot dag en maand. */
const dt=d=>{if(!d)return '';const x=new Date(d+'T12:00:00');return isNaN(x)?d:new Intl.DateTimeFormat(taal(),{day:'numeric',month:'short'}).format(x)};
const I={vliegtuig:'<path d="M3 14l7-2 4-8h2l-2 8 6 2v2l-6-1-1 5h-2l-1-5-7 1z"/>',klok:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',kalender:'<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4m8-4v4M4 10h16"/>',plek:'<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',mens:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',bericht:'<path d="M4 5h16v11H9l-5 4z"/>',stuur:'<path d="M12 19V5M6 11l6-6 6 6"/>'};
const svg=(p,k)=>'<svg class="'+(k||'ds-veld__icoon')+'" viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>';
function rij(label,waarde,icoon){return '<div class="ds-veld">'+svg(icoon)+'<span><span class="ds-veld__label">'+esc(label)+'</span><span class="ds-veld__waarde">'+waarde+'</span></span><span></span></div>'}
function veld(id,label,icoon,attr){return '<label class="ds-veld">'+svg(icoon)+'<span><span class="ds-veld__label">'+esc(label)+'</span><input class="ds-veld__invoer" id="'+id+'" '+(attr||'')+'></span><span></span></label>'}
function leeg(t){return '<p class="ds-meta">'+esc(t)+'</p>'}
let open=null,STAND=null;
/* Meenemen (shared/uitvoer.js): staat er een toestel open, dan zijn
   vluchten; anders de vloot. Datums gaan door zoals de server ze geeft. */
if(window.RTGUitvoer)RTGUitvoer.bron(function(){
  if(!STAND)return null;
  if(open){const vl=(STAND.vluchten||[]).filter(v=>v.toestelId===open);
    if(vl.length)return{naam:'vluchtlogboek',kolommen:['datum','tijd','toestel','van','naar','uren','bemanning'],rijen:vl.map(v=>[v.datum||'',v.tijd||'',v.toestel||'',v.van||'',v.naar||'',v.uren,v.bemanning||''])}}
  if(!(STAND.toestellen||[]).length)return null;
  return{naam:'vloot',kolommen:['naam','type','registratie','thuishaven','stoelen','vlieguren','positie','vluchten'],rijen:STAND.toestellen.map(t=>[t.naam||'',t.type||'',t.registratie||'',t.basis||'',t.stoelen||'',t.uren,t.positie||'',t.vluchtAantal])};
});
/* De deur bij een 403: zelfde boodschap als shared/deur.js (die een eigen
   <style> zet en hier dus niet laadt). Geen knop die toegang geeft: bij een
   pas beslist een mens. Wat er achter de deur ligt komt uit de app-gids. */
function deur(gids){
  $('#inhoud').innerHTML='<section class="ds-status ds-status--binnen" aria-label="Deze app is nog niet voor u geopend"><h2 class="ds-status__titel">'+esc(gids&&gids.wat?String(gids.wat).split(':')[0]:'Hangar')+'</h2>'
    +(gids&&gids.wat?'<p class="ds-status__tekst">'+esc(gids.wat)+'</p>':'')
    +(gids&&gids.doe&&gids.doe.length?'<p class="ds-label">Wat u hier straks doet</p><ul class="ds-lijst">'+gids.doe.slice(0,5).map(d=>'<li class="ds-meta">'+esc(d)+'</li>').join('')+'</ul>':'')
    +'<p class="ds-status__tekst">De Lifestyle Pass gaat uitsluitend op uitnodiging of na goedkeuring, en dat besluit nemen mensen bij RTG, niet deze app en niet Rahul. <a href="/apps/rtg.html">Lees de toegangsregels in Het Huis</a>. Hebt u de pas al? Dan opent deze app zodra hij op uw account staat.</p></section>';
}
function poort(){deur(null);fetch('/api/gids/app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pad:location.pathname})}).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.gids)deur(d.gids)}).catch(()=>{})}
function gesprek(){
  return '<section aria-labelledby="coKop"><div class="ds-gesprek__wie"><span class="ds-gesprek__monogram" aria-hidden="true">VC</span><span><b id="coKop">Vraag de vluchtcoördinator</b><span class="ds-meta"> Hangar</span></span></div>'
    +'<div class="ds-gesprek__stroom" id="aiA" aria-live="polite"></div>'
    +'<div class="ds-veld">'+svg(I.bericht)+'<span><label class="ds-veld__label" for="aiV">Uw vraag</label><input class="ds-veld__invoer" id="aiV" placeholder="Bijv. waar staat de jet nu?"></span><button class="ds-gesprek__stuur" type="button" id="aiK" aria-label="Vraag" data-ds-actie="Vraag de vluchtcoördinator">'+svg(I.stuur,'')+'</button></div></section>';
}
function bindAi(){
  const k=$('#aiK');if(!k)return;
  k.onclick=async()=>{const v=$('#aiV').value.trim();if(!v)return $('#aiV').focus();const stroom=$('#aiA');
    const vraag=document.createElement('p');vraag.className='ds-gesprek__bericht ds-gesprek__bericht--eigen';vraag.setAttribute('data-user-content','');vraag.textContent=v;
    const antw=document.createElement('p');antw.className='ds-gesprek__bericht';antw.textContent='Een ogenblik…';stroom.append(vraag,antw);
    try{const r=await api('ai',{app:'hangar',vraag:v});antw.textContent=r.antwoord;$('#aiV').value=''}catch(e){antw.textContent=e.message}};
  $('#aiV').addEventListener('keydown',e=>{if(e.key==='Enter')k.click()});
}
async function laad(){
  if(!TOKEN){$('#inhoud').innerHTML='<div class="ds-status ds-status--binnen"><h2 class="ds-status__titel">Log eerst in</h2><a class="ds-knop ds-knop--primair ds-status__actie" href="/apps/app.html">Naar de app</a></div>';return}
  let d;try{d=await api('hangar');
    /* Ontbreekt een veld, dan de eigen foutmelding: nooit een lege lijst (die zou beweren dat er niets is) en nooit een ruwe TypeError (LIEGRONDE.json). */
    if(!(d&&Array.isArray(d.toestellen)&&Array.isArray(d.types)))throw new Error('Het antwoord was onvolledig, dus dit kon niet worden geladen.');
  }catch(e){if(e.status===403)return poort();$('#inhoud').innerHTML='<div class="ds-status ds-status--binnen"><p class="ds-status__tekst">Kon de hangar niet laden.</p></div>';return}
  STAND=d;
  if(open){const t=d.toestellen.find(x=>x.id===open);if(t)return detail(d,t);open=null}
  document.body.dataset.dsSchermtype='collectie';
  let h='<p class="ds-label">Overzicht</p><div class="ds-velden">'+rij('Toestellen',d.toestellen.length,I.vliegtuig)+rij('Vlieguren',d.totaalUren,I.klok)+rij('Volgende vlucht',d.komend?dt(d.komend.datum):'-',I.kalender)
    +(d.komend?rij('Eerstvolgende vlucht',esc(d.komend.toestel)+': '+esc(d.komend.van)+' → '+esc(d.komend.naar)+' '+[dt(d.komend.datum),esc(d.komend.tijd)].filter(Boolean).join(' '),I.plek):'')+'</div>';
  h+='<div class="ds-collectie__kop"><p class="ds-label">Vloot</p></div>'+(d.toestellen.length?'<div class="ds-collectie__raster">'+d.toestellen.map(t=>'<button class="ds-kaart ds-kaart--beeld" type="button" data-id="'+esc(t.id)+'" aria-label="Open toestel '+esc(t.naam)+'"><img class="ds-kaart__beeld" src="'+BEELD+'" alt="" loading="lazy"><span class="ds-kaart__inhoud"><span class="ds-kaart__titel">'+esc(t.naam)+'</span><span class="ds-kaart__sub">'+[t.type,t.registratie,t.stoelen?t.stoelen+' stoelen':'',t.uren+' uur'].filter(Boolean).map(esc).join(' · ')+'</span><span class="ds-kaart__sub">'+(esc(t.positie)||'positie onbekend')+'</span></span></button>').join('')+'</div>':leeg('Nog geen toestellen.'));
  h+='<section class="ds-taak" aria-labelledby="tKop"><div class="ds-taak__kop"><h2 class="ds-kaart__titel" id="tKop">Toestel toevoegen</h2></div><div class="ds-velden">'+veld('tN','Naam of roepnaam',I.vliegtuig,'placeholder="naam/roepnaam"')
    +'<label class="ds-veld">'+svg(I.vliegtuig)+'<span><span class="ds-veld__label">Type</span><select class="ds-veld__invoer" id="tT">'+d.types.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></span><span></span></label>'
    +veld('tR','Registratie',I.vliegtuig,'placeholder="registratie"')+veld('tB','Thuishaven',I.plek,'placeholder="thuishaven"')+veld('tS','Stoelen',I.mens,'type="number" placeholder="stoelen"')
    +'</div><button class="ds-knop ds-knop--primair ds-knop--breed ds-taak__actie" type="button" id="tAdd" data-ds-actie="Toestel toevoegen">+ toestel</button></section>';
  h+=gesprek();
  $('#inhoud').innerHTML=h;bindAi();
  $('#tAdd').onclick=async()=>{const naam=$('#tN').value.trim();if(!naam)return meld('Naam?');try{await api('hangar/toestel',{naam,type:$('#tT').value,registratie:$('#tR').value,basis:$('#tB').value,stoelen:$('#tS').value});laad()}catch(e){meld(e.message)}};
  document.querySelectorAll('[data-id]').forEach(c=>c.onclick=()=>{open=c.dataset.id;laad()});
}
/* Een toestel als Detail met zijn logboek als Taak: hangar-toestel.js. */
const detail=window.RTGHangarToestel({$,esc,api,meld,dt,I,svg,veld,leeg,BEELD,herlaad:()=>laad(),sluit:()=>{open=null}});
laad();
})();
