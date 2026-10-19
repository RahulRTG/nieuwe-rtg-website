(function(w){
'use strict';
/* Mijn verblijf en Ter plaatse, op het RTG Design System: Detail (het
   verblijf, de sleutel) en Gesprek (een vraag aan het team). De sleutel en de
   service verschijnen alleen in een echte verblijfstoestand van de server. */
w.RTGVerblijfMomenten=function(c){
  const {$,esc,api,meld,datum,leeg,huisVan,actief,zetTab,herlaad,mijn}=c;
  let SERVICE='ontbijt';
  function status(v){return({aangevraagd:'Aangevraagd',bevestigd:'Klaar voor aankomst',ingecheckt:'U bent thuis',geweigerd:'Niet bevestigd',geannuleerd:'Geannuleerd',uitgecheckt:'Afgerond'})[v.status]||v.status}
  function rij(label,waarde){return '<li class="ds-veld"><span></span><span><span class="ds-veld__label">'+esc(label)+'</span><span class="ds-veld__waarde">'+waarde+'</span></span><span></span></li>'}
  function kaart(v,uitgebreid){
    const h=huisVan(v),plek=v.plaats||h.stad||'Adres volgt via het verblijf';
    return '<article class="ds-kaart"><div class="ds-kaart__inhoud"><p class="ds-label">Mijn verblijf</p><p class="ds-detail__status">'+esc(status(v))+'</p><h2 class="ds-kaart__titel">'+esc(v.supplierName)+'</h2><p class="ds-meta">'+esc(v.roomName)+' · '+datum(v.aankomst)+' tot '+datum(v.vertrek)+'</p><ul class="ds-detail__gegevens">'+rij('Aankomst',datum(v.aankomst))+rij('Vertrek',datum(v.vertrek))+rij('Adres',esc(plek))+rij('Wifi','Via uw gastheer')+rij('Referentie',esc(v.ref))+'</ul>'
      +(uitgebreid?'<nav class="ds-chips" aria-label="Aankomst"><a class="ds-chip" href="/apps/navigatie.html">Route</a><a class="ds-chip" href="/apps/rit.html">Transfer</a><button class="ds-chip" type="button" data-naar-service>Gastheer</button></nav>'+(v.status==='ingecheckt'?'<div class="ds-taak__kop"><button class="ds-knop ds-knop--primair" type="button" data-deur="kamer" data-code="'+esc(v.supplierCode)+'" data-ds-actie="Open mijn sleutel">Open mijn sleutel</button><button class="ds-knop ds-knop--stil" type="button" data-deur="entree" data-code="'+esc(v.supplierCode)+'">Open entree</button><p class="ds-meta">De sleutel werkt alleen tijdens uw ingecheckte verblijf.</p></div>':'<p class="ds-meta">De digitale sleutel verschijnt zodra de receptie u heeft ingecheckt.</p>'):'')
      +(['aangevraagd','bevestigd'].includes(v.status)?'<button class="ds-knop ds-knop--stil" type="button" data-annuleer="'+esc(v.id)+'">Aanvraag annuleren</button>':'')+'</div></article>';
  }
  function tekenMijn(){
    const open=mijn().filter(v=>!['geannuleerd','geweigerd'].includes(v.status)),a=actief();
    $('#inhoud').innerHTML=open.length?'<div class="ds-collectie__kop"><h2 class="ds-kaart__titel">Uw verblijf</h2><p class="ds-meta">'+open.length+' in uw reis</p></div><div class="ds-collectie__raster">'+open.map(v=>kaart(v,v===a)).join('')+'</div>':leeg('Nog geen verblijf.','Zoek een plek waar alles voor uw aankomst kan worden klaargezet.','Vind een verblijf');
    document.querySelectorAll('[data-naar-service]').forEach(b=>b.addEventListener('click',()=>zetTab('service')));
    document.querySelectorAll('[data-deur]').forEach(b=>b.addEventListener('click',async()=>{try{const d=await api('/api/verblijf/deur',{supplierCode:b.dataset.code,welke:b.dataset.deur});meld(d.door.name+' is open en sluit over '+d.door.relockSec+' seconden.')}catch(e){meld(e.message)}}));
    document.querySelectorAll('[data-annuleer]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Wilt u deze verblijfsaanvraag annuleren?'))return;try{await api('/api/verblijf/annuleer',{id:b.dataset.annuleer});meld('Verblijf geannuleerd.');await herlaad()}catch(e){meld(e.message)}}));
  }
  const DIENSTEN={ontbijt:{naam:'Ontbijt',tekst:'Ik wil graag ontbijt bespreken.',dept:'Roomservice'},housekeeping:{naam:'Housekeeping',tekst:'Ik wil graag housekeeping aanvragen.',dept:'Housekeeping'},roomservice:{naam:'Roomservice',tekst:'Ik wil graag roomservice aanvragen.',dept:'Roomservice'},laat:{naam:'Late check-out',tekst:'Ik wil graag een late check-out bespreken.',dept:'Receptie'}};
  function tekenService(){
    const v=mijn().find(x=>x.status==='ingecheckt')||mijn().find(x=>x.status==='bevestigd');if(!v){$('#inhoud').innerHTML=leeg('Nog niets om te regelen.','Ter plaatse wordt actief zodra het huis uw verblijf heeft bevestigd.','Vind een verblijf');return}
    const d=DIENSTEN[SERVICE];$('#inhoud').innerHTML='<section class="ds-taak"><div class="ds-taak__kop"><p class="ds-label">Tijdens uw verblijf</p><h2 class="ds-kaart__titel">Zeg wat u nodig heeft.</h2><p class="ds-meta">Uw vraag gaat rechtstreeks naar het team van '+esc(v.supplierName)+'.</p></div><div class="ds-veldgroep" role="group" aria-label="Dienst">'+Object.entries(DIENSTEN).map(([k,x])=>'<button class="ds-keuze" type="button" aria-pressed="'+(k===SERVICE)+'" data-service="'+k+'"><b>'+esc(x.naam)+'</b><span class="ds-meta">Vraag persoonlijk aan</span></button>').join('')+'</div><p class="ds-label">Uw gastheer</p><h3 class="ds-kaart__titel">'+esc(d.naam)+'</h3><p class="ds-meta">Voeg eventueel toe wat het team moet weten. Er wordt niets automatisch toegezegd of besteld.</p><label class="ds-veldlabel">Toelichting<textarea class="ds-invoer ds-invoer--tekst" id="serviceNotitie" maxlength="140" placeholder="Bijvoorbeeld een gewenst tijdstip"></textarea></label><button class="ds-knop ds-knop--primair ds-taak__actie" type="button" id="serviceStuur" data-ds-actie="Vraag iets aan">Vraag iets aan</button><p class="ds-meta">U houdt altijd zelf de controle. Een medewerker reageert persoonlijk.</p><div class="ds-gesprek__stroom" id="serviceReactie" aria-live="polite"></div></section>';
    document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>{SERVICE=b.dataset.service;tekenService()}));$('#serviceStuur').addEventListener('click',()=>stuur(v));
  }
  async function stuur(v){
    const d=DIENSTEN[SERVICE],h=huisVan(v),dept=h.soort==='hotel'?d.dept:'Beheer',note=$('#serviceNotitie').value.trim(),tekst=d.tekst+(note?' '+note:'');
    try{const r=await api('/api/partner/chat/send',{supplierCode:v.supplierCode,dept,text:tekst});meld('Uw vraag is naar '+dept+' verstuurd.');const laatste=(r.messages||[]).slice(-3);$('#serviceReactie').innerHTML='<h4 class="ds-label">Gesprek met '+esc(dept)+'</h4>'+laatste.map(m=>'<p class="ds-gesprek__bericht'+(m.from==='guest'?' ds-gesprek__bericht--eigen':'')+'" data-user-content><b>'+esc(m.from==='guest'?'U':m.who||v.supplierName)+'</b> '+esc(m.text)+'</p>').join('')}catch(e){meld(e.message)}
  }
  return{tekenMijn,tekenService};
};
})(window);
