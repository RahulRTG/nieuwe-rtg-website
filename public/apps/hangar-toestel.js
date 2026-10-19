(function(w){
'use strict';
/* Een toestel van de Hangar (hangar.html) op het RTG Design System: Detail
   (groot beeld, naam, positie en vlieguren) en Taak (een vlucht loggen), met
   het vluchtlogboek als rustige lijst. Dezelfde aanroepen als ervoor:
   .../hangar/toestel/weg, .../hangar/vlucht en .../hangar/vlucht/weg. */
w.RTGHangarToestel=function(c){
const {$,esc,api,meld,dt,I,svg,veld,leeg,BEELD,herlaad,sluit}=c;
function detail(d,t){
  document.body.dataset.dsSchermtype='detail';
  const vl=d.vluchten.filter(v=>v.toestelId===t.id);
  let h='<article class="ds-detail" data-toestel="'+esc(t.id)+'"><img class="ds-detail__beeld" src="'+BEELD+'" alt="Sfeerbeeld van een privétoestel"><div class="ds-detail__inhoud"><div><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" id="terug">← alle toestellen</button></div>'
    +'<h2 class="ds-titel ds-titel--scherm">'+esc(t.naam)+'</h2><p class="ds-meta">'+[t.type,t.registratie,t.basis?'basis '+t.basis:''].filter(Boolean).map(esc).join(' · ')+'</p>'
    +'<p class="ds-detail__status">'+(esc(t.positie)||'positie onbekend')+' · '+esc(t.uren)+' vlieguren</p>'
    +'<button class="ds-knop ds-knop--stil ds-knop--klein" type="button" id="tWeg">Verwijderen</button></div></article>';
  h+='<section class="ds-taak" aria-labelledby="vKop"><div class="ds-taak__kop"><h2 class="ds-kaart__titel" id="vKop">Vlucht loggen</h2></div><div class="ds-velden">'+veld('vV','Van',I.plek,'placeholder="van"')+veld('vN','Naar',I.plek,'placeholder="naar"')+veld('vD','Datum',I.kalender,'type="date"')+veld('vT','Tijd',I.klok,'type="time"')+veld('vU','Uren',I.klok,'type="number" step="0.1" placeholder="uren"')+veld('vB','Bemanning',I.mens,'placeholder="bemanning"')
    +'</div><button class="ds-knop ds-knop--primair ds-knop--breed ds-taak__actie" type="button" id="vAdd" data-ds-actie="Vlucht loggen">+ vlucht</button>';
  h+='<h2 class="ds-kaart__titel">Vluchtlogboek</h2>'+(vl.length?'<ul class="ds-lijst" id="logboek">'+vl.map(v=>'<li class="ds-lijst__rij">'+svg(I.vliegtuig,'ds-lijst__icoon')+'<span><span class="ds-lijst__titel">'+esc(v.van)+' → '+esc(v.naar)+'</span><span class="ds-lijst__tekst">'+[dt(v.datum),esc(v.tijd),v.uren?v.uren+' uur':'',esc(v.bemanning)].filter(Boolean).join(' · ')+'</span></span><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-vl="'+esc(v.id)+'" aria-label="Vlucht verwijderen">×</button></li>').join('')+'</ul>':leeg('Nog geen vluchten.'))+'</section>';
  $('#inhoud').innerHTML=h;window.scrollTo(0,0);
  $('#terug').onclick=()=>{sluit();herlaad()};
  $('#tWeg').onclick=async()=>{if(!confirm('Dit toestel en het logboek verwijderen?'))return;try{await api('hangar/toestel/weg',{id:t.id});sluit();herlaad()}catch(x){meld(x.message)}};
  $('#vAdd').onclick=async()=>{const van=$('#vV').value.trim();if(!van)return meld('Van waar?');try{await api('hangar/vlucht',{toestelId:t.id,van,naar:$('#vN').value,datum:$('#vD').value,tijd:$('#vT').value,uren:$('#vU').value,bemanning:$('#vB').value});herlaad()}catch(x){meld(x.message)}};
  document.querySelectorAll('[data-vl]').forEach(b=>b.onclick=async()=>{try{await api('hangar/vlucht/weg',{id:b.dataset.vl});herlaad()}catch(x){meld(x.message)}});
}
return detail;
};
})(window);
