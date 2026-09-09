(function(w){
'use strict';
w.RTGVerblijfMomenten=function(c){
  const {$,esc,api,meld,datum,huisVan,actief,zetTab,herlaad,mijn}=c;
  let SERVICE='ontbijt';
  function status(v){return({aangevraagd:'Aangevraagd',bevestigd:'Klaar voor aankomst',ingecheckt:'U bent thuis',geweigerd:'Niet bevestigd',geannuleerd:'Geannuleerd',uitgecheckt:'Afgerond'})[v.status]||v.status}
  function kaart(v,uitgebreid){
    const h=huisVan(v),plek=v.plaats||h.stad||'Adres volgt via het verblijf';
    return '<article class="mijn-verblijf'+(uitgebreid?' hoofd':'')+'"><div class="mijn-status"><span>MIJN VERBLIJF</span><b>'+esc(status(v))+'</b></div><h2>'+esc(v.supplierName)+'</h2><p class="kamernaam">'+esc(v.roomName)+' · '+datum(v.aankomst)+' tot '+datum(v.vertrek)+'</p><div class="verblijf-details"><div><span>Aankomst</span><b>'+datum(v.aankomst)+'</b></div><div><span>Vertrek</span><b>'+datum(v.vertrek)+'</b></div><div><span>Adres</span><b>'+esc(plek)+'</b></div><div><span>Wifi</span><b>Via uw gastheer</b></div><div><span>Referentie</span><b>'+esc(v.ref)+'</b></div></div>'+(uitgebreid?'<div class="aankomst-acties"><a href="/apps/navigatie.html">Route</a><a href="/apps/rit.html">Transfer</a><button type="button" data-naar-service>Gastheer</button></div>'+(v.status==='ingecheckt'?'<div class="sleutelblok"><button class="knop" type="button" data-deur="kamer" data-code="'+esc(v.supplierCode)+'">Open mijn sleutel</button><button type="button" data-deur="entree" data-code="'+esc(v.supplierCode)+'">Open entree</button><small>De sleutel werkt alleen tijdens uw ingecheckte verblijf.</small></div>':'<p class="wachtregel">De digitale sleutel verschijnt zodra de receptie u heeft ingecheckt.</p>'):'')+(['aangevraagd','bevestigd'].includes(v.status)?'<button class="annuleer" type="button" data-annuleer="'+esc(v.id)+'">Aanvraag annuleren</button>':'')+'</article>';
  }
  function tekenMijn(){
    const open=mijn().filter(v=>!['geannuleerd','geweigerd'].includes(v.status)),a=actief();
    $('#inhoud').innerHTML=open.length?'<div class="mijn-intro"><h2>Uw verblijf</h2><span>'+open.length+' in uw reis</span></div>'+open.map(v=>kaart(v,v===a)).join(''):'<div class="leeg ruim"><h2>Nog geen verblijf.</h2><p>Zoek een plek waar alles voor uw aankomst kan worden klaargezet.</p><button class="knop" type="button" data-zoek>Vind een verblijf</button></div>';
    document.querySelectorAll('[data-naar-service]').forEach(b=>b.addEventListener('click',()=>zetTab('service')));document.querySelectorAll('[data-zoek]').forEach(b=>b.addEventListener('click',()=>zetTab('zoeken')));
    document.querySelectorAll('[data-deur]').forEach(b=>b.addEventListener('click',async()=>{try{const d=await api('/api/verblijf/deur',{supplierCode:b.dataset.code,welke:b.dataset.deur});meld(d.door.name+' is open en sluit over '+d.door.relockSec+' seconden.')}catch(e){meld(e.message)}}));
    document.querySelectorAll('[data-annuleer]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Wilt u deze verblijfsaanvraag annuleren?'))return;try{await api('/api/verblijf/annuleer',{id:b.dataset.annuleer});meld('Verblijf geannuleerd.');await herlaad()}catch(e){meld(e.message)}}));
  }
  const DIENSTEN={ontbijt:{naam:'Ontbijt',tekst:'Ik wil graag ontbijt bespreken.',dept:'Roomservice'},housekeeping:{naam:'Housekeeping',tekst:'Ik wil graag housekeeping aanvragen.',dept:'Housekeeping'},roomservice:{naam:'Roomservice',tekst:'Ik wil graag roomservice aanvragen.',dept:'Roomservice'},laat:{naam:'Late check-out',tekst:'Ik wil graag een late check-out bespreken.',dept:'Receptie'}};
  function tekenService(){
    const v=mijn().find(x=>x.status==='ingecheckt')||mijn().find(x=>x.status==='bevestigd');if(!v){$('#inhoud').innerHTML='<div class="leeg ruim"><h2>Nog niets om te regelen.</h2><p>Ter plaatse wordt actief zodra het huis uw verblijf heeft bevestigd.</p><button class="knop" type="button" data-zoek>Vind een verblijf</button></div>';document.querySelector('[data-zoek]').addEventListener('click',()=>zetTab('zoeken'));return}
    const d=DIENSTEN[SERVICE];$('#inhoud').innerHTML='<section class="service-hero"><div><span>TIJDENS UW VERBLIJF</span><h2>Zeg wat u nodig heeft.</h2><p>Uw vraag gaat rechtstreeks naar het team van '+esc(v.supplierName)+'.</p></div></section><div class="service-rooster">'+Object.entries(DIENSTEN).map(([k,x])=>'<button type="button" data-service="'+k+'"'+(k===SERVICE?' class="aan"':'')+'><b>'+esc(x.naam)+'</b><span>Vraag persoonlijk aan</span></button>').join('')+'</div><section class="service-vraag"><span>UW GASTHEER</span><h3>'+esc(d.naam)+'</h3><p>Voeg eventueel toe wat het team moet weten. Er wordt niets automatisch toegezegd of besteld.</p><textarea id="serviceNotitie" maxlength="140" placeholder="Bijvoorbeeld een gewenst tijdstip"></textarea><button class="knop" type="button" id="serviceStuur">Vraag iets aan</button><small>U houdt altijd zelf de controle. Een medewerker reageert persoonlijk.</small><div id="serviceReactie"></div></section>';
    document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>{SERVICE=b.dataset.service;tekenService()}));$('#serviceStuur').addEventListener('click',()=>stuur(v));
  }
  async function stuur(v){
    const d=DIENSTEN[SERVICE],h=huisVan(v),dept=h.soort==='hotel'?d.dept:'Beheer',note=$('#serviceNotitie').value.trim(),tekst=d.tekst+(note?' '+note:'');
    try{const r=await api('/api/partner/chat/send',{supplierCode:v.supplierCode,dept,text:tekst});meld('Uw vraag is naar '+dept+' verstuurd.');const laatste=(r.messages||[]).slice(-3);$('#serviceReactie').innerHTML='<h4>Gesprek met '+esc(dept)+'</h4>'+laatste.map(m=>'<p class="'+(m.from==='guest'?'van-mij':'van-huis')+'"><b>'+esc(m.from==='guest'?'U':m.who||v.supplierName)+'</b>'+esc(m.text)+'</p>').join('')}catch(e){meld(e.message)}
  }
  return{tekenMijn,tekenService};
};
})(window);
