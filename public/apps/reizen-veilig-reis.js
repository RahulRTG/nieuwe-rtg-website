/* Reizen & Veilig: wat uit de DATA komt -- het eerstvolgende moment uit RTG
   Move en het aanbod uit de catalogus van het Reisbureau. Afgesplitst uit
   reizen-veilig.js; de werkruimte geeft api, esc, open en token mee, zodat er
   geen tweede fetch-laag ontstaat. Getoetst in test/reizen-veilig.e2e.js. */
(function(){
  'use strict';
  function maak(c){
  var api=c.api,esc=c.esc,open=c.open,token=c.token;
  /* De taal van de pagina, niet een vaste: zonder lang beslist de browser. */
  var taal=document.documentElement.lang||undefined;
  /* Een regel is een rustige rij: titel, onderschrift, en de knoppen rechts. */
  function lijn(t,sub,knoppen){return '<div class="ds-veld" data-lijn><span></span><span><span class="ds-veld__label">'+t+'</span><span class="ds-veld__waarde">'+sub+'</span></span><span class="ds-chips">'+(knoppen||'')+'</span></div>'}
  var MOVE='<button class="ds-chip" type="button" data-move>Haal ik het? &rarr;</button>';
  var BEELD=['/campagne/riad.jpg','/campagne/kyoto-suite.jpg','/campagne/palacio.jpg'];
  /* HET EERSTVOLGENDE MOMENT komt uit RTG Move en wordt nergens verzonnen.
     Move geeft de eerste komende overgang met een bekende plek en tijd, of
     null met de reden -- en die reden staat er dan ook. Navigeren krijgt de
     OPGELOSTE plek mee (dezelfde overdracht als /apps/move.html), zodat er niets
     opnieuw geraden wordt. */
  function haakMove(vak){vak.querySelectorAll('[data-move]').forEach(function(b){b.onclick=function(){open('move',innerWidth>760)}})}
  async function volgende(el){var vak=el.querySelector('[data-volgende]');if(!vak)return;
    if(!token()){vak.innerHTML=lijn('Log in om uw reis te zien','');return}
    try{var d=await api('/api/move/volgende'),v=d.volgende;
      /* Zonder echt punt geen navigeerknop: Move levert alleen een moment met een
         plek, maar het scherm leunt daar niet op. */
      var p0=v&&v.plek;if(v&&(!p0||!Number.isFinite(p0.lat)||!Number.isFinite(p0.lng)))v=null;
      if(!v){vak.innerHTML=lijn('Geen komend onderdeel met een bekende plek',esc(d.waarom||''),MOVE);haakMove(vak);return}
      var t=new Date(v.nodigAt),tijd=isNaN(t)?'':t.toLocaleString(taal,{weekday:'short',hour:'2-digit',minute:'2-digit'}),p=v.plek||{};
      var q=new URLSearchParams({naar:p.lat+','+p.lng,label:p.label||v.titel||''});
      vak.innerHTML=lijn(esc(v.titel||'Uw volgende onderdeel'),'<time>'+esc(tijd)+'</time>'+(p.label?' · '+esc(p.label):''),'<button class="ds-chip" type="button" data-navigeer="'+esc('/apps/navigatie.html?'+q.toString())+'">Navigeer erheen &rarr;</button>'+MOVE);
      haakMove(vak);
      vak.querySelector('[data-navigeer]').onclick=function(){open('navigatie',innerWidth>760,this.getAttribute('data-navigeer'))};
    }catch(e){vak.innerHTML=lijn('Uw volgende moment is nu niet op te halen',esc(e.message))}}
  function groet(el){var h=el.querySelector('[data-groet]');if(!h)return;var u=new Date().getHours();h.textContent=u<6?'Goedenacht.':u<12?'Goedemorgen.':u<18?'Goedemiddag.':'Goedenavond.'}
  /* HET AANBOD komt uit dezelfde catalogus als het Reisbureau; een kaart opent
     die reis daar. De prijs is de nettoprijs per persoon zoals de catalogus
     hem geeft, en een reis zonder prijs krijgt geen bedrag. */
  async function aanbod(el){var vak=el.querySelector('[data-reisaanbod]');if(!vak)return;
    var wf=el.querySelector('[data-wens]');if(wf)wf.onsubmit=function(e){e.preventDefault();var w=String(new FormData(wf).get('wens')||'').trim();open('reisbureau',innerWidth>760,'/apps/reisbureau.html'+(w?'?wens='+encodeURIComponent(w):''))};
    if(!token()){vak.innerHTML='<p class="ds-meta">Log in om het aanbod van het Reisbureau te zien.</p>';return}
    try{var d=await api('/api/reisbureau'),rs=(d.reizen||[]).slice(0,3);
      if(!rs.length){vak.innerHTML='<p class="ds-meta">Het Reisbureau heeft op dit moment geen samengestelde reizen.</p>';return}
      /* Een beeldkaart per reis, de naam op de foto. Het beeld is sfeer uit eigen
       huis (public/campagne/) en geen foto van die bestemming. */
      vak.innerHTML=rs.map(function(r,i){return '<button class="ds-kaart ds-kaart--beeld" type="button" data-reis="'+esc(r.id)+'" aria-label="Bekijk in het Reisbureau: '+esc(r.titel)+'"><img class="ds-kaart__beeld" src="'+BEELD[i%BEELD.length]+'" alt="" loading="lazy"><span class="ds-kaart__inhoud"><span class="ds-kaart__sub">'+esc([r.bestemming,r.dates].filter(Boolean).join(' · '))+'</span><span class="ds-kaart__titel">'+esc(r.titel)+'</span>'+(r.omschrijving?'<span class="ds-kaart__sub">'+esc(r.omschrijving)+'</span>':'')+(r.prijs>0?'<span class="ds-kaart__sub" data-prijs>Vanaf '+esc(new Intl.NumberFormat(taal,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(r.prijs))+' per persoon</span>':'')+'</span></button>'}).join('');
      vak.querySelectorAll('[data-reis]').forEach(function(b){b.onclick=function(){open('reisbureau',innerWidth>760,'/apps/reisbureau.html?reis='+encodeURIComponent(b.dataset.reis))}});
    }catch(e){vak.innerHTML='<p class="ds-meta">Het aanbod is nu niet op te halen: '+esc(e.message)+'</p>'}}
  return {volgende:volgende,aanbod:aanbod,groet:groet};
  }
  window.RTGReisVeiligReis={maak:maak};
})();
