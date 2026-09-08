/* Gedrag en databronnen van de rustige FoundationOS-voorzijde. Bestaande
   sessies en rechten blijven de enige toegangspoort. */
(function(w,d){
  'use strict';
  var gestart=false,info=null,toonScherm=null;
  function el(id){return d.getElementById(id)}
  function post(pad,body){var s=w.Sessie.huidig()||{};return fetch(pad,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({code:s.code,token:s.token},body||{}))}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||'Niet beschikbaar.');return j})})}
  function iso(datum){return datum.toISOString().slice(0,10)}
  function agenda(){var van=new Date(),tot=new Date();tot.setDate(tot.getDate()+7);return w.Sessie.api('/gezin/agenda/bereik',{code:w.Sessie.huidig().code,token:w.Sessie.huidig().token,van:iso(van),tot:iso(tot)}).then(function(x){w.RTGFoundationVoorzijdeBeeld.dag(info,x.items||[])},function(){w.RTGFoundationVoorzijdeBeeld.dag(info,[])})}
  function ontwikkeling(){var p=info.profiel||{};if(p.rol!=='kind'){w.RTGFoundationVoorzijdeBeeld.groei(info,null,null);return Promise.resolve()}return Promise.all([post('/api/rtf/leerling/paspoort'),post('/api/rtf/leerling/dag')]).then(function(x){w.RTGFoundationVoorzijdeBeeld.groei(info,x[0],x[1])},function(){w.RTGFoundationVoorzijdeBeeld.groei(info,null,null)})}
  function kring(){if(w.Sessie.isGast()){w.RTGFoundationVoorzijdeBeeld.kring(info,null);return Promise.resolve()}return post('/api/rtf/leven/kring').then(function(x){w.RTGFoundationVoorzijdeBeeld.kring(info,x)},function(){w.RTGFoundationVoorzijdeBeeld.kring(info,null)})}
  function tab(naam){d.querySelectorAll('[data-rtf-paneel]').forEach(function(x){var aan=x.dataset.rtfPaneel===naam;x.hidden=!aan;x.classList.toggle('is-actief',aan)});d.querySelectorAll('[data-rtf-tab]').forEach(function(x){x.classList.toggle('is-actief',x.dataset.rtfTab===naam);x.setAttribute('aria-current',x.dataset.rtfTab===naam?'page':'false')});w.scrollTo(0,0);if(naam==='groei')ontwikkeling();if(naam==='kring')kring();if(w.RTGGlyf&&w.RTGGlyf.vul)w.RTGGlyf.vul()}
  function bind(){if(gestart)return;gestart=true;d.querySelectorAll('[data-rtf-tab]').forEach(function(b){b.addEventListener('click',function(){tab(b.dataset.rtfTab)})});var meer=d.querySelector('[data-rtf-meer]');if(meer)meer.addEventListener('click',function(){d.documentElement.removeAttribute('data-rtf-foundation-voor');toonScherm('vHub');w.scrollTo(0,0)});var terug=el('rtfRustigTerug');if(terug)terug.addEventListener('click',function(){d.documentElement.setAttribute('data-rtf-foundation-voor','1');toonScherm('vVoorzijde');tab('vandaag')})}
  function start(data,toon){info=data||{};toonScherm=toon;d.documentElement.setAttribute('data-rtf-foundation-voor','1');bind();w.RTGFoundationVoorzijdeBeeld.dag(info,[]);w.RTGFoundationVoorzijdeBeeld.groei(info,null,null);w.RTGFoundationVoorzijdeBeeld.kring(info,null);agenda();if(w.RTGGlyf&&w.RTGGlyf.vul)w.RTGGlyf.vul()}
  w.RTGFoundationVoorzijde={start:start};
})(window,document);
