(function(){
  'use strict';
  if(window.__rahulTabStandaard)return;
  window.__rahulTabStandaard=true;

  function laadStijl(src){var script=document.createElement('script');script.src=src;script.defer=true;document.head.appendChild(script)}
  laadStijl('/shared/rahul-tab/style-base.js');
  laadStijl('/shared/rahul-tab/style-twin.js');
  laadStijl('/shared/rahul-tab/helpers.js');

  /* De fallback is een echte app-bovenbalk, nooit een generieke `.kop`.
     `.kop` is in veel werkapps een inhoudskop (bij Klankwerk zelfs een
     expliciete deelmarkering); daar een globale tab in plakken vervormt zowel
     de inhoud als de navigatie. */
  var selectors='.wk-tabs,.rv-tabs>div,.lo-tabs,.pn-tabs,.pn-top>div,.po-tabs,.ir-tabs,.ir-shell>main>header>div,.cmd-tabs,[data-tabs],[role="tablist"],main>header>div,.topbar,.appbar,body>header'.split(','),host=null;
  for(var i=0;i<selectors.length&&!host;i++)host=document.querySelector(selectors[i]);
  if(!host||document.getElementById('wkRahulTab')||host.querySelector('.rtg-rahul-tab'))return;

  var tab=document.createElement('button');tab.type='button';tab.className='rtg-rahul-tab';tab.innerHTML='Rahul<small>COMMAND</small>';host.appendChild(tab);
  var page=document.createElement('section');page.className='rtg-rahul-page';page.hidden=true;page.setAttribute('aria-label','Rahul Command Workspace');
  page.innerHTML='<header class="rtg-command-head"><button class="rtg-mouth" type="button" aria-label="Praat met Rahul">◡</button><span><b>Rahul</b><small>ENTERPRISE COMMAND</small></span><span class="rtg-command-state" data-ai-state><i></i>Werkmodus actief · AI optioneel</span><button class="rtg-command-close" type="button" aria-label="Terug naar werkblad">↙</button></header><main class="rtg-command-grid"><section class="rtg-command-context"><span class="rtg-command-ey">LIVE CONTEXT</span><h2 data-greeting>Uw werkruimte is begrepen.</h2><p class="rtg-command-lead" data-context></p><div class="rtg-command-fact"><span>ACTIEVE OMGEVING</span><b data-app></b><small data-selection>Geen selectie gemeten</small></div><div class="rtg-command-rule"><i></i><span>Rahul bereidt voor. Geld, publicatie, toegang en definitieve toezegging vragen menselijk akkoord.</span></div></section><section class="rtg-command-chat"><span class="rtg-command-ey">COMMAND CONVERSATION</span><h1>Van bedoeling<br>naar resultaat.</h1><div class="rtg-command-suggest"></div><div class="rtg-command-log" role="log" aria-live="polite"></div><form class="rtg-command-form"><input aria-label="Vraag Rahul" placeholder="Beschrijf het resultaat dat u wilt…" maxlength="500"><button type="submit" aria-label="Verstuur naar Rahul">→</button></form></section><section class="rtg-command-decisions"><span class="rtg-command-ey">DECISION INBOX</span><h2>Alleen wat u nodig heeft.</h2><div class="rtg-decision"><i>✓</i><p><b>Automatisch uitgevoerd</b><small data-done>Geen uitvoering in deze sessie</small></p><em>LOGBOEK</em></div><div class="rtg-decision"><i>→</i><p><b>Ter controle</b><small>Context en voorstel worden eerst zichtbaar</small></p><em>VEILIG</em></div><div class="rtg-decision"><i>!</i><p><b>Uw beslissing</b><small>Niet gemeten totdat een workflow dit vraagt</small></p><em>MENS</em></div><div class="rtg-automation"><header><span>AUTONOMOUS OPERATIONS</span><em>VOORBEREIDEN</em></header><p>Rahul mag binnen uw rol zoeken, vergelijken en voorbereiden. Onomkeerbare stappen blijven geblokkeerd.</p><button type="button" data-policy>Bekijk grenzen</button></div></section></main>';
  document.body.appendChild(page);
  window.__rahulTabDialoog={tab:tab,page:page};
  laadStijl('/shared/rahul-tab/dialog.js');


  var input=page.querySelector('input'),log=page.querySelector('.rtg-command-log'),suggest=page.querySelector('.rtg-command-suggest');
  var vorige=null, bezig=false, historie=[];
  try{historie=JSON.parse(sessionStorage.getItem('rtg_rahul_command')||'[]').slice(-12)}catch(e){}
  function tekst(s){return window.RTGRahulTabHelpers.tekst(s)}
  function context(){return window.RTGRahulTabHelpers.context()}
  function voorstellen(c){var s=window.RTGRahulTabHelpers.suggesties(c);suggest.innerHTML=s.map(function(x){return'<button type="button">'+tekst(x)+'</button>'}).join('');suggest.querySelectorAll('button').forEach(function(b){b.onclick=function(){input.value=b.textContent;vraag()}})}
  function render(){log.innerHTML=historie.map(function(m){return'<div class="rtg-command-msg '+(m.rol==='user'?'user':'')+'"><b>'+(m.rol==='user'?'U':'RAHUL')+'</b>'+tekst(m.tekst)+'</div>'}).join('');log.scrollTop=log.scrollHeight;try{sessionStorage.setItem('rtg_rahul_command',JSON.stringify(historie.slice(-12)))}catch(e){}}
  function voeg(rol,waarde){historie.push({rol:rol,tekst:waarde});historie=historie.slice(-12);render()}
  function open(ja){page.hidden=!ja;tab.classList.toggle('actief',ja);if(ja){page.scrollTop=0;vorige=document.querySelector('.rtg-rahul-tab~.actief,.wk-tabs>.actief,.lo-tabs>.actief,.po-tabs>.actief')||vorige;var c=context();page.querySelector('[data-app]').textContent=c.app;page.querySelector('[data-selection]').textContent=c.selectie||c.deel||'Geen selectie gemeten';page.querySelector('[data-context]').textContent='Ik zie '+c.deel+' in '+c.app+'. Ik combineer alleen gegevens waarvoor uw huidige rol toegang heeft.';page.querySelector('[data-greeting]').textContent=c.deel+' staat klaar.';voorstellen(c);if(!historie.length)voeg('rahul','Vertel het gewenste resultaat; ik toon de stappen, uitzonderingen en beslissingen.');setTimeout(function(){try{input.focus({preventScroll:true})}catch(e){input.focus()}page.scrollTop=0},120)}else if(vorige)vorige.classList.add('actief')}
  async function vraag(){var q=input.value.trim();if(!q||bezig)return;input.value='';voeg('user',q);bezig=true;voeg('rahul','Context en grenzen controleren…');var token='',supplier='';try{token=localStorage.getItem('rtg_member_token')||'';supplier=localStorage.getItem('rtg_sup_token')||''}catch(e){}var pad=token?'/api/fluister':'/api/supplier/ai',auth=token||supplier;try{if(!auth)throw new Error('geen sessie');var c=context();var r=await fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify({q:q+'\n\nActieve context: '+c.app+' · '+c.deel+(c.selectie?' · '+c.selectie:'')})});var d=await r.json();historie.pop();var st=page.querySelector('[data-ai-state]');if(st&&d&&d.aiBeschikbaar===false)st.innerHTML='<i></i>Handmatige werkmodus · alles blijft bruikbaar';else if(st&&d&&d.modus==='lokaal')st.innerHTML=d.verwerking==='eigen-netwerk'?'<i></i>Lokale intelligentie · eigen omgeving':'<i></i>Lokale intelligentie · privé op dit apparaat';else if(st&&d&&d.modus==='hybride')st.innerHTML='<i></i>Lokaal eerst · externe uitwijk zichtbaar';else if(st&&d&&d.aiBeschikbaar===true)st.innerHTML='<i></i>AI ondersteund · menselijke autoriteit';voeg('rahul',(d&&(d.antwoord||d.reply||d.error))||'Ik kon dit nog niet afronden.');if(d&&d.gedaan)page.querySelector('[data-done]').textContent='Laatste opdracht uitgevoerd en vastgelegd'}catch(e){historie.pop();voeg('rahul','Vrije hulp is nu niet bereikbaar. Uw werkblad, navigatie en alle handmatige functies blijven gewoon beschikbaar.')}finally{bezig=false}}
  tab.onclick=function(){if(window.RTGRahulTabHelpers)open(true)};page.querySelector('.rtg-command-close').onclick=function(){open(false)};page.querySelector('.rtg-mouth').onclick=function(){try{input.focus({preventScroll:true})}catch(e){input.focus()}};page.querySelector('form').onsubmit=function(e){e.preventDefault();vraag()};page.querySelector('[data-policy]').onclick=function(){voeg('rahul','Actieve grens: ik mag binnen uw rol lezen, vergelijken en voorbereiden. Betalen, publiceren, toegang wijzigen en definitief toezeggen vereisen afzonderlijk menselijk akkoord.')};
  window.RTGMetgezel=window.RTGMetgezel||{};window.RTGMetgezel.rahul=function(q){if(!window.RTGRahulTabHelpers)return;open(true);if(q){input.value=q;vraag()}};
  window.__rahulTabCommand={page:page,context:context,voeg:voeg};
  laadStijl('/shared/rahul-tab/workspace.js');
})();
