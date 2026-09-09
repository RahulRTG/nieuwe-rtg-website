/* Gedrag voor de persoonlijke Leren & Groei-voorzijde. De onderwijs-,
   dagplan-, bijles- en liveleskernen blijven de enige bronnen. */
(function(w,d){
  'use strict';
  var staat={sessie:null,pas:null,plan:null,vakken:[],onderwerp:'',beurten:[]};
  function el(id){return d.getElementById(id)}
  function antwoord(r){return r.json().catch(function(){return{}}).then(function(x){if(!r.ok)throw new Error(x.error||'Deze leeromgeving is nu niet bereikbaar.');return x})}
  function leer(url,body){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({code:staat.sessie.code,token:staat.sessie.token},body||{}))}).then(antwoord)}
  function basis(url,body){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}).then(antwoord)}
  function open(naam){
    d.querySelectorAll('[data-lg-view]').forEach(function(x){var aan=x.dataset.lgView===naam;x.hidden=!aan;x.classList.toggle('is-actief',aan)});
    d.querySelectorAll('[data-lg-tab]').forEach(function(x){var aan=x.dataset.lgTab===naam;x.classList.toggle('is-actief',aan);x.setAttribute('aria-current',aan?'page':'false')});
    w.scrollTo(0,0);w.RTGFoundationLerenBeeld.iconen()
  }
  function vakken(){
    if(!staat.pas||!staat.pas.fase)return Promise.resolve({vakken:[]});
    var id=staat.pas.fase.id||'',po=/^po-g(\d)$/.exec(id),body=po?{groep:Number(po[1])}:{fase:id};
    return leer('/api/rtf/leerling/vakken',body)
  }
  function laad(){
    return Promise.all([leer('/api/rtf/leerling/paspoort'),leer('/api/rtf/leerling/dag')]).then(function(x){staat.pas=x[0];staat.plan=x[1];return vakken()}).then(function(x){staat.vakken=x.vakken||[];w.RTGFoundationLerenBeeld.dag(staat.plan);w.RTGFoundationLerenBeeld.groei(staat.pas,staat.plan,staat.vakken);staat.onderwerp=w.RTGFoundationLerenBeeld.onderwerpen(staat.vakken,staat.onderwerp);return leer('/api/rtf/leerling/bijles/gesprek').then(function(g){staat.beurten=g.beurten||[];w.RTGFoundationLerenBeeld.gesprek(staat.beurten,false)},function(){w.RTGFoundationLerenBeeld.gesprek([],false)})}).catch(function(e){w.RTGFoundationLerenBeeld.fout('lgDag',e.message);w.RTGFoundationLerenBeeld.groei(null,null,[]);staat.onderwerp=w.RTGFoundationLerenBeeld.onderwerpen([],staat.onderwerp)})
  }
  function sluitDialogen(){d.querySelectorAll('.lg-dialog[open]').forEach(function(x){x.close()})}
  function les(soort){
    if(soort==='kies'){el('lgLesKies').showModal();return}
    el('lgLesKies').close();el(soort==='docent'?'dlgDocent':'dlgLeerling').showModal()
  }
  function startLes(){
    var knop=el('dStart');el('dFout').textContent='';knop.disabled=true;
    basis('/api/foundation/les/maak',{vak:el('dVak').value,naam:el('dNaam').value}).then(function(x){w.RTGSchoolSession.zet('rtf_docent',{code:x.code,token:x.token});location.href='bord.html?code='+encodeURIComponent(x.code)},function(e){el('dFout').textContent=e.message;knop.disabled=false})
  }
  function doeMee(){
    var knop=el('lJoin'),code=el('lCode').value.trim().toUpperCase();el('lFout').textContent='';knop.disabled=true;
    basis('/api/foundation/les/join',{code:code,naam:el('lNaam').value}).then(function(x){w.RTGSchoolSession.zet('rtf_leerling',{code:code,token:x.token,naam:x.naam});location.href='schrift.html?code='+encodeURIComponent(code)},function(e){el('lFout').textContent=e.message;knop.disabled=false})
  }
  function hulp(e){
    e.preventDefault();var tekst=el('lgVraag').value.trim(),knop=e.currentTarget.querySelector('[type="submit"]');if(!tekst)return;
    var vraag=(staat.onderwerp?'Onderwerp: '+staat.onderwerp+'. ':'')+tekst;staat.beurten.push({rol:'user',tekst:tekst});w.RTGFoundationLerenBeeld.gesprek(staat.beurten,true);knop.disabled=true;
    leer('/api/rtf/leerling/bijles/vraag',{tekst:vraag}).then(function(x){staat.beurten.push({rol:'rahul',tekst:x.text});el('lgVraag').value='';w.RTGFoundationLerenBeeld.gesprek(staat.beurten,false)},function(x){staat.beurten.push({rol:'rahul',tekst:x.message});w.RTGFoundationLerenBeeld.gesprek(staat.beurten,false)}).finally(function(){knop.disabled=false})
  }
  function start(){
    if(!w.Sessie||!w.Sessie.eisProfiel||!w.Sessie.eisProfiel())return;
    staat.sessie=w.Sessie.huidig();var naam=w.Sessie.naam()||'';el('dNaam').value=naam;el('lNaam').value=naam;
    d.addEventListener('click',function(e){
      var nav=e.target.closest('[data-lg-tab],[data-lg-open]'),onder=e.target.closest('[data-lg-onderwerp]'),live=e.target.closest('[data-lg-les]'),sluit=e.target.closest('[data-lg-sluit]'),uitleg=e.target.closest('[data-lg-route="uitleg"]');
      if(nav){open(nav.dataset.lgTab||nav.dataset.lgOpen);return}
      if(onder){staat.onderwerp=onder.dataset.lgOnderwerp;d.querySelectorAll('[data-lg-onderwerp]').forEach(function(x){var aan=x===onder;x.classList.toggle('is-actief',aan);x.setAttribute('aria-checked',String(aan))});return}
      if(live){les(live.dataset.lgLes);return}
      if(sluit){sluitDialogen();return}
      if(uitleg)el('lgVraag').focus()
    });
    el('lgGaVerder').addEventListener('click',function(){location.href='leerpaspoort.html'});el('lgHulpVorm').addEventListener('submit',hulp);el('dStart').addEventListener('click',startLes);el('lJoin').addEventListener('click',doeMee);el('lCode').addEventListener('input',function(e){e.target.value=e.target.value.toUpperCase()});
    laad();setTimeout(w.RTGFoundationLerenBeeld.iconen,250);if('serviceWorker'in navigator&&location.protocol.indexOf('http')===0)navigator.serviceWorker.register('sw.js').catch(function(){})
  }
  start();
})(window,document);
