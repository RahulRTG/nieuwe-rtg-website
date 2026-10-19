(function(w){
'use strict';
/* De momenten van het Reisboek op het Design System: Vandaag (Detail),
   Documenten en Wijzigingen (rustige rijen), leeg, inlog en de deur. */
const BEELD='/images/worlds/heritage/travel-heritage-v2.jpg';
function leeg(c,label,titel,tekst,actie){c.$('#inhoud').innerHTML='<div class="ds-status ds-status--binnen"><p class="ds-label">'+c.esc(label)+'</p><h2 class="ds-status__titel">'+c.esc(titel)+'</h2><p class="ds-status__tekst">'+c.esc(tekst)+'</p>'+(actie||'')+'</div>'}
const knop=(tekst,attr,soort)=>'<button class="ds-knop ds-knop--'+(soort||'primair')+' ds-status__actie" type="button" '+attr+'>'+tekst+'</button>';
function inlog(c){leeg(c,'Alleen voor leden','Uw reisboek blijft persoonlijk.','Log in via de RTG-app om uw eigen reisboek te openen.','<a class="ds-knop ds-knop--primair ds-status__actie" href="/apps/app.html">Naar de app</a>')}
/* De deur (zoals shared/deur.js, die zelf stijl zet en hier dus niet laadt):
   wat er achter ligt komt uit de app-gids; de weg naar binnen is een besluit
   van mensen bij RTG. Er zit geen knop op die zelf iets verleent. */
function deur(c){
  const teken=g=>{c.$('#main').innerHTML='<section class="ds-status ds-status--binnen" aria-label="Deze app is nog niet voor u geopend"><h2 class="ds-status__titel">'+c.esc((g&&g.wat?String(g.wat).split(':')[0]:'')||'Reisboek')+'</h2>'+(g&&g.wat?'<p class="ds-status__tekst">'+c.esc(g.wat)+'</p>':'')+(g&&g.doe&&g.doe.length?'<p class="ds-label">Wat u hier straks doet</p><ul class="ds-lijst">'+g.doe.slice(0,5).map(d=>''+lijstrij(ICOON,'',c.esc(d))+'').join('')+'</ul>':'')+'<p class="ds-status__tekst">De Lifestyle Pass gaat uitsluitend op uitnodiging of na goedkeuring, en dat besluit nemen mensen bij RTG -- niet deze app en niet Rahul. Hebt u de pas al? Dan opent deze app zodra hij op uw account staat.</p><a class="ds-knop ds-knop--stil ds-status__actie" href="/apps/rtg.html">Lees de toegangsregels in Het Huis</a></section>'};
  teken(null);
  fetch('/api/gids/app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pad:location.pathname})}).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.gids)teken(d.gids)}).catch(()=>{});
}
const ICOON='<svg class="ds-lijst__icoon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 3h7l4 4v14H7zM14 3v4h4"/></svg>';
/* Een rij; met een adres is de hele rij de link (ds-lijst__rij als <a>). */
function lijstrij(tijd,titel,tekst,eind,attr,link){const binnen='<span class="ds-lijst__tijd">'+tijd+'</span><span><span class="ds-lijst__titel">'+titel+'</span><span class="ds-lijst__tekst">'+tekst+'</span></span><span class="ds-lijst__tijd">'+(eind||'')+'</span>';return link?'<li'+(attr||'')+'><a class="ds-lijst__rij" href="'+link+'">'+binnen+'</a></li>':'<li class="ds-lijst__rij"'+(attr||'')+'>'+binnen+'</li>'}
function vandaag(c){
  const reis=c.actieveReis(),boekreis=c.actieveBoekreis(),lijn=c.tijdlijn(reis,boekreis),volgende=c.volgende(lijn);
  if(!reis&&!boekreis){leeg(c,'Uw reisboek','Begin met de reis die voor u ligt.','Zet een reis in uw eigen boek. Daarna krijgen planning en documenten samen een rustige plek.',knop('Voeg een reis toe','data-beheer data-ds-actie="Voeg een reis toe"'));c.bindBeheer();return}
  const bestemming=(reis&&reis.bestemming)||(boekreis&&boekreis.bestemming)||(boekreis&&boekreis.naam)||'Uw reis';
  const periode=c.periode(reis?reis.venster:{van:boekreis&&boekreis.van,tot:boekreis&&boekreis.tot});
  const momenten=lijn.length?'<ol class="ds-lijst">'+lijn.map(x=>lijstrij(c.esc(x.tijd||c.korteDatum(x.datum)||'-'),c.esc(x.titel),c.esc(x.sub||''),'',volgende===x?' aria-current="step"':'',x.link?c.esc(x.link):'')).join('')+'</ol>':'<p class="ds-meta">Voor deze reis staan nog geen momenten met een datum in het boek.</p>';
  const nu=volgende?'<p class="ds-detail__status">Volgende: '+c.esc(volgende.titel)+(volgende.tijd?' om '+c.esc(volgende.tijd):'')+'</p>':'';
  const actie=volgende&&volgende.link?'<a class="ds-knop ds-knop--primair ds-knop--breed" href="'+c.esc(volgende.link)+'" data-ds-actie="Open '+c.esc(volgende.actie||'dit reismoment')+'">Open '+c.esc(volgende.actie||'dit reismoment')+'</a>':'<button class="ds-knop ds-knop--primair ds-knop--breed" type="button" data-beheer data-ds-actie="Werk mijn reis bij">Werk mijn reis bij</button>';
  const boeken=(c.boek().reizen||[]).map(r=>'<button class="ds-veld" type="button" data-open-reis="'+c.esc(r.id)+'"><span></span><span><span class="ds-veld__label">'+c.esc(r.naam)+'</span><span class="ds-veld__waarde">'+c.esc([r.bestemming,c.periode(r)].filter(Boolean).join(' · ')||'Open het draaiboek')+'</span></span><svg class="ds-veld__pijl" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>').join('');
  c.$('#inhoud').innerHTML='<div class="ds-collectie__raster"><article class="ds-kaart"><img class="ds-detail__beeld" src="'+BEELD+'" alt=""><div class="ds-detail__inhoud"><p class="ds-label">Uw reis</p><h2 class="ds-titel">'+c.esc(bestemming)+'</h2><p class="ds-meta">'+c.esc(periode||'De periode is nog niet ingevuld')+'</p><div><a class="ds-chip" href="/apps/reizen.html">Alles bekijken</a></div>'+nu+momenten+actie+'</div></article>'+
    '<section class="ds-kaart"><div class="ds-kaart__inhoud"><p class="ds-label">Uw eigen draaiboek</p><h2 class="ds-kaart__titel">Alles blijft bij elkaar.</h2><p class="ds-meta">Ook wat u zelf toevoegt, reist mee in hetzelfde boek.</p><div class="ds-velden">'+(boeken||'<p class="ds-meta">Nog geen eigen reis toegevoegd.</p>')+'</div><div><button class="ds-knop ds-knop--stil" type="button" data-beheer>Reis toevoegen of beheren</button></div></div></section></div>';
  c.bindBeheer();
}
/* Alleen soort, reis en geldigheid; nummers en bewijsstukken nooit. */
function documentStatus(d){if(!d.geldigTot)return{status:'Geldigheid niet ingevuld',klasse:'aandacht'};const dagen=Math.floor((Date.parse(d.geldigTot+'T00:00:00Z')-Date.now())/86400000);if(dagen<0)return{status:'Verlopen',klasse:'fout'};if(dagen<=90)return{status:'Vraagt aandacht',klasse:'aandacht'};return{status:'Opgenomen in uw reisboek',klasse:''}}
function lijstDocumenten(c){
  const uit=[];
  for(const r of (c.boek().reizen||[]))for(const d of (r.documenten||[])){const s=documentStatus(d);uit.push({naam:d.soort,status:s.status,klasse:s.klasse,reis:r.naam})}
  for(const o of ((c.actieveReis()&&c.actieveReis().onderdelen)||[])){const s=String(o.soort||'').toLowerCase(),klasse=o.sig==='incident'?'fout':o.sig==='aandacht'?'aandacht':'';if(s==='vlucht')uit.push({naam:'Instapkaart',status:o.status?'Bij uw vlucht · '+o.status:'Bekijk bij uw vlucht',klasse,reis:o.titel||o.bestemming});if(s==='verblijf')uit.push({naam:'Verblijfsbevestiging',status:o.status||'Bij uw verblijf',klasse,reis:o.titel||o.bestemming})}
  const gezien=new Set();return uit.filter(x=>{const k=(x.naam+'|'+x.reis).toLowerCase();if(gezien.has(k))return false;gezien.add(k);return true})
}
function documenten(c){
  const docs=lijstDocumenten(c),aandacht=docs.filter(x=>x.klasse==='fout'||x.klasse==='aandacht').length;
  if(!docs.length){leeg(c,'Uw documenten','Nog niets opgenomen.','Voeg alleen de documentsoort en geldigheid toe. Gevoelige nummers horen hier niet in beeld.',knop('Voeg een document toe','data-beheer data-ds-actie="Voeg een document toe"'));c.bindBeheer();return}
  c.$('#inhoud').innerHTML='<section class="ds-taak"><p class="ds-meta">'+(aandacht?aandacht+' document'+(aandacht===1?' vraagt':'en vragen')+' uw aandacht.':'Uw opgenomen documenten staan rustig bij de juiste reis.')+'</p><ul class="ds-lijst">'+docs.map(d=>lijstrij(ICOON,c.esc(d.naam),c.esc(d.reis||'TravelOS'),c.esc(d.status),d.klasse?' data-aandacht="'+c.esc(d.klasse)+'"':'')).join('')+'</ul><p class="ds-meta">Uw documenten blijven van u. Nummers en bewijsstukken worden hier niet getoond.</p><button class="ds-knop ds-knop--primair ds-knop--breed" type="button" data-beheer data-ds-actie="Bekijk mijn documenten">Bekijk mijn documenten</button></section>';
  c.bindBeheer();
}
function wijzigingen(c){
  const wacht=c.wacht(),reizen=(wacht.reizen||[]).filter(r=>(r.signalen||[]).length),stil=(wacht.stil||[]),bronnen=(wacht.bronnen||[]);
  const inhoud=reizen.length?reizen.map(r=>'<article class="ds-kaart"><div class="ds-kaart__inhoud"><h3 class="ds-kaart__titel">'+c.esc(r.bestemming)+'</h3><p class="ds-meta">'+c.esc(c.periode(r.venster))+'</p><p class="ds-meta" aria-label="Wat een wijziging kan raken">Vlucht → Vervoer → Aankomst → Verblijf</p><ul class="ds-lijst">'+r.signalen.map(s=>lijstrij(s.ernst==='incident'?'!':'△',c.esc(s.tekst),'Bron: '+c.esc(s.bron)+' · '+c.esc(s.grond))).join('')+'</ul><div><button class="ds-knop ds-knop--stil" type="button" data-los="'+c.esc(r.id)+'">Bekijk wat mogelijk is</button></div><div data-losuit="'+c.esc(r.id)+'"></div></div></article>').join('')
    :'<div class="ds-status ds-status--binnen"><p class="ds-label">De gemeten bronnen</p><h2 class="ds-status__titel">Geen aandachtspunt gevonden.</h2><p class="ds-status__tekst">Dit is een momentopname van de bronnen die RTG nu kon meten. Het is geen achtergrondbewaking.</p>'+knop('Meet opnieuw','data-ververs','stil')+'</div>';
  const bronregels=bronnen.map(b=>'<p class="ds-meta"><b>'+c.esc(b.naam)+'</b> · '+c.esc(b.stand)+(b.stand==='gemeten'?'':' - '+c.esc(b.uitleg||''))+'</p>').join('');
  c.$('#inhoud').innerHTML='<section class="ds-taak"><p class="ds-meta">TravelOS laat zien wat er speelt en wat u kunt doen. Het past niets zelfstandig aan.</p>'+inhoud+(stil.length?'<p class="ds-meta">Dit beeld is onvolledig: '+c.esc(stil.join(', '))+' deed niet mee.</p>':'')+'<a class="ds-knop ds-knop--stil" href="/apps/comm.html">Praat met TravelOS</a><p class="ds-meta">Niets wordt aangepast zonder uw akkoord.</p><details><summary class="ds-meta">Welke bronnen zijn gemeten?</summary>'+bronregels+'<p class="ds-meta">'+c.esc(wacht.uitleg||'')+'</p></details></section>';
  c.$$('#inhoud [data-los]').forEach(b=>b.addEventListener('click',()=>c.losOp(b)));const v=c.$('[data-ververs]');if(v)v.addEventListener('click',()=>c.herlaadWacht(v));
}
w.RTGReisboekMomenten={vandaag,documenten,wijzigingen,leeg,inlog,deur};
})(window);
