/* Hulp & Zorg brengt twee bestaande, gescheiden bronnen rustig samen:
   RTG Care voor boekingen en intakedelingen, Foundation voor het gezin. */
(function(w,d){
  'use strict';
  var staat={boekingen:[],intakes:[],gezondheid:null,careBeschikbaar:false,soort:'hulp'};
  function el(id){return d.getElementById(id)}
  function lidToken(){try{return localStorage.getItem('rtg_member_token')||''}catch(e){return''}}
  function json(r){return r.json().catch(function(){return{}}).then(function(x){if(!r.ok)throw new Error(x.error||'Deze gegevens zijn nu niet bereikbaar.');return x})}
  function care(pad,body){return fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+lidToken()},body:JSON.stringify(body||{})}).then(json)}
  function gezin(){return w.Sessie&&w.Sessie.huidig?w.Sessie.huidig():null}
  function gezondheid(){var s=gezin();if(!s||!s.code||!s.token)return Promise.resolve(null);return fetch('/api/foundation/gezin/'+encodeURIComponent(s.code)+'/gezondheid',{headers:{Authorization:'Bearer '+s.token}}).then(json)}
  function iconen(){if(w.RTGGlyf&&w.RTGGlyf.vul)w.RTGGlyf.vul()}
  function beeld(){w.RTGFoundationHulpBeeld.afspraken(staat.boekingen,staat.gezondheid);var v=w.RTGFoundationHulpBeeld.begeleider(staat.boekingen);w.RTGFoundationHulpBeeld.stappen(v);w.RTGFoundationHulpBeeld.delen(staat.intakes,staat.careBeschikbaar);iconen()}
  function laad(){
    var taken=[];
    if(lidToken())taken.push(Promise.all([care('/api/care/mijn'),care('/api/care')]).then(function(x){staat.boekingen=x[0].boekingen||[];staat.intakes=x[1].intakes||[];staat.careBeschikbaar=true},function(){staat.careBeschikbaar=false}));
    taken.push(gezondheid().then(function(x){staat.gezondheid=x},function(){staat.gezondheid=null}));
    return Promise.all(taken).then(beeld)
  }
  function open(naam){
    d.querySelectorAll('[data-fh-view]').forEach(function(x){var aan=x.dataset.fhView===naam;x.hidden=!aan;x.classList.toggle('is-actief',aan)});
    d.querySelectorAll('[data-fh-tab]').forEach(function(x){var aan=x.dataset.fhTab===naam;x.classList.toggle('is-actief',aan);x.setAttribute('aria-current',aan?'page':'false')});
    w.scrollTo(0,0);iconen()
  }
  function boeking(ref){return staat.boekingen.find(function(x){return x.ref===ref})}
  function mutatie(pad,body,knop){knop.disabled=true;return care(pad,body).then(function(){var dlg=el('fhDetail');if(dlg.open)dlg.close();return laad()}).catch(function(e){w.alert(e.message);knop.disabled=false})}
  function vraag(e){
    e.preventDefault();var s=gezin(),tekst=el('fhHulpTekst').value.trim(),antwoord=el('fhHulpAntwoord'),knop=e.currentTarget.querySelector('[type="submit"]');
    antwoord.hidden=false;
    if(!s||!s.code||!s.token){antwoord.textContent='Kies eerst uw eigen Foundation-profiel. Dan kan de hulpwijzer rekening houden met uw gezin, zonder uw tekst te bewaren.';return}
    if(!tekst){antwoord.textContent='Vertel eerst kort wat er speelt.';return}
    knop.disabled=true;antwoord.textContent='De hulpwijzer denkt met u mee...';
    fetch('/api/foundation/hulp/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:s.code,token:s.token,kind:staat.soort,buddy:(s.profiel&&s.profiel.buddy)||'vrouw',groep:(s.profiel&&s.profiel.groep)||'',messages:[{role:'user',content:tekst}]})}).then(json).then(function(x){antwoord.textContent=x.text||'Er kwam nog geen advies terug. Probeer het zo opnieuw.'},function(x){antwoord.textContent=x.message}).finally(function(){knop.disabled=false})
  }
  d.addEventListener('click',function(e){
    var nav=e.target.closest('[data-fh-tab],[data-fh-open]'),keuze=e.target.closest('[data-fh-soort]'),detail=e.target.closest('[data-fh-detail]'),betaal=e.target.closest('[data-fh-betaal]'),annuleer=e.target.closest('[data-fh-annuleer]'),sluit=e.target.closest('[data-fh-sluit]');
    if(nav){open(nav.dataset.fhTab||nav.dataset.fhOpen);return}
    if(keuze){staat.soort=keuze.dataset.fhSoort;d.querySelectorAll('[data-fh-soort]').forEach(function(x){var aan=x===keuze;x.classList.toggle('is-actief',aan);x.setAttribute('aria-checked',String(aan))});return}
    if(detail){var b=boeking(detail.dataset.fhDetail);if(b)w.RTGFoundationHulpBeeld.detail(b);return}
    if(betaal){mutatie('/api/care/betaal',{ref:betaal.dataset.fhBetaal},betaal);return}
    if(annuleer&&w.confirm('Wilt u deze afspraak annuleren?')){mutatie('/api/care/annuleer',{ref:annuleer.dataset.fhAnnuleer},annuleer);return}
    if(sluit){el('fhDetail').close()}
  });
  el('fhHulpVorm').addEventListener('submit',vraag);
  laad();setTimeout(iconen,250);
})(window,document);
