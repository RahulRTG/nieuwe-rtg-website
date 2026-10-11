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
  /* HET EERSTVOLGENDE MOMENT komt uit RTG Move en wordt nergens verzonnen.
     Move geeft de eerste komende overgang met een bekende plek en tijd, of
     null met de reden -- en die reden staat er dan ook. Navigeren krijgt de
     OPGELOSTE plek mee (dezelfde overdracht als /apps/move.html), zodat er niets
     opnieuw geraden wordt. */
  async function volgende(el){var vak=el.querySelector('[data-volgende]');if(!vak)return;
    if(!token()){vak.innerHTML='<div class="rv-lijn gedimd"><time>&ndash;</time><div><b>Log in om uw reis te zien</b></div></div>';return}
    try{var d=await api('/api/move/volgende'),v=d.volgende;
      if(!v){vak.innerHTML='<div class="rv-lijn gedimd"><time>&ndash;</time><div><b>Geen komend onderdeel met een bekende plek</b><small>'+esc(d.waarom||'')+'</small><a href="/apps/move.html">Haal ik het? &rarr;</a></div></div>';return}
      var t=new Date(v.nodigAt),tijd=isNaN(t)?'':t.toLocaleString(taal,{weekday:'short',hour:'2-digit',minute:'2-digit'}),p=v.plek||{};
      var q=new URLSearchParams({naar:p.lat+','+p.lng,label:p.label||v.titel||''});
      vak.innerHTML='<div class="rv-lijn"><time>'+esc(tijd)+'</time><div><b>'+esc(v.titel||'Uw volgende onderdeel')+'</b><small>'+esc(p.label||'')+'</small><button data-navigeer="'+esc('/apps/navigatie.html?'+q.toString())+'">Navigeer erheen &rarr;</button><a href="/apps/move.html">Haal ik het? &rarr;</a></div></div>';
      vak.querySelector('[data-navigeer]').onclick=function(){open('navigatie',innerWidth>760,this.getAttribute('data-navigeer'))};
    }catch(e){vak.innerHTML='<div class="rv-lijn gedimd"><time>&ndash;</time><div><b>Uw volgende moment is nu niet op te halen</b><small>'+esc(e.message)+'</small></div></div>'}}
  function groet(el){var h=el.querySelector('[data-groet]');if(!h)return;var u=new Date().getHours();h.textContent=u<6?'Goedenacht.':u<12?'Goedemorgen.':u<18?'Goedemiddag.':'Goedenavond.'}
  /* HET AANBOD komt uit dezelfde catalogus als het Reisbureau; een kaart opent
     die reis daar. De prijs is de nettoprijs per persoon zoals de catalogus
     hem geeft, en een reis zonder prijs krijgt geen bedrag. */
  async function aanbod(el){var vak=el.querySelector('[data-reisaanbod]');if(!vak)return;
    var wf=el.querySelector('[data-wens]');if(wf)wf.onsubmit=function(e){e.preventDefault();var w=String(new FormData(wf).get('wens')||'').trim();open('reisbureau',innerWidth>760,'/apps/reisbureau.html'+(w?'?wens='+encodeURIComponent(w):''))};
    if(!token()){vak.innerHTML='<p class="rv-sub">Log in om het aanbod van het Reisbureau te zien.</p>';return}
    try{var d=await api('/api/reisbureau'),rs=(d.reizen||[]).slice(0,3);
      if(!rs.length){vak.innerHTML='<p class="rv-sub">Het Reisbureau heeft op dit moment geen samengestelde reizen.</p>';return}
      vak.innerHTML=rs.map(function(r){return '<section class="rv-reiskaart"><span>'+esc([r.bestemming,r.dates].filter(Boolean).join(' · ').toUpperCase())+'</span><h2>'+esc(r.titel)+'</h2>'+(r.omschrijving?'<p>'+esc(r.omschrijving)+'</p>':'')+(r.prijs>0?'<em>Vanaf € '+esc(r.prijs.toLocaleString(taal))+' per persoon</em>':'')+'<button data-reis="'+esc(r.id)+'">Bekijk in het Reisbureau &rarr;</button></section>'}).join('');
      vak.querySelectorAll('[data-reis]').forEach(function(b){b.onclick=function(){open('reisbureau',innerWidth>760,'/apps/reisbureau.html?reis='+encodeURIComponent(b.dataset.reis))}});
    }catch(e){vak.innerHTML='<p class="rv-sub">Het aanbod is nu niet op te halen: '+esc(e.message)+'</p>'}}
  return {volgende:volgende,aanbod:aanbod,groet:groet};
  }
  window.RTGReisVeiligReis={maak:maak};
})();
