(function(){
  'use strict';
  if(window.__rahulTabStandaard)return;
  window.__rahulTabStandaard=true;

  function laadStijl(src){var script=document.createElement('script');script.src=src;script.async=false;document.head.appendChild(script)}
  laadStijl('/shared/rahul-tab/style-base.js');
  laadStijl('/shared/rahul-tab/style-twin.js');
  laadStijl('/shared/rahul-tab/helpers.js');

  /* Alleen echte app-bovenbalken zijn geldige gastheren voor deze globale tab. */
  var selectors='.wk-tabs,.rv-tabs>div,.lo-tabs,.pn-tabs,.pn-top>div,.po-tabs,.ir-tabs,.ir-shell>main>header>div,.cmd-tabs,[data-tabs],[role="tablist"],main>header>div,.topbar,.appbar,body>header'.split(','),host=null;
  for(var i=0;i<selectors.length&&!host;i++)host=document.querySelector(selectors[i]);
  if(!host||document.getElementById('wkRahulTab')||host.querySelector('.rtg-rahul-tab'))return;

  var tab=document.createElement('button');tab.type='button';tab.className='rtg-rahul-tab';tab.innerHTML='Rahul<small>KOMPAS</small>';host.appendChild(tab);

  /* DE INKT VAN DE TAB HANGT AF VAN DE BALK WAAR HIJ IN HANGT, en dat kan CSS
     hier niet weten. style-base.js zette twee vaste grijzen (#99918a voor het
     woord, #746d67 voor KOMPAS) en die zijn gekozen voor een donkere balk. De
     a11y-scan mat wat dat oplevert:

       bestellen.html  balk #F7F5F1 (licht)   #99918a  ->  2,85:1
       wereld.html     balk #0C0C0B (donker)  #746d67  ->  3,78:1

     Allebei te weinig, en in tegengestelde richting -- op een lichte balk is het
     grijs te licht, op een donkere is de KOMPAS-regel te donker. Een derde vast
     grijs lost dat niet op: er bestaat geen middengrijs dat op #F7F5F1 EN op
     #0C0C0B 4,5:1 haalt. Dus meten we de grond en kiezen we de inkt, hetzelfde
     patroon als de dagkleur-inkt in shared/dagkleur.css.

     De gekozen waarden, doorgerekend: op donker #F2EEE8 (ruim) en #8A8680
     (5,41:1, de --grey-soft uit CLAUDE.md); op licht #3A3733 (10,9:1) en
     #5A5651 (6,18:1). !important omdat style-base.js dat ook gebruikt. */
  (function inkt(){
    function grondVan(el){
      for(var n=el;n&&n!==document.documentElement;n=n.parentElement){
        var m=/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(n).backgroundColor||'');
        if(m&&(m[4]===undefined||Number(m[4])>0.5))return[+m[1],+m[2],+m[3]];
      }
      var b=/^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor||'');
      return b?[+b[1],+b[2],+b[3]]:[12,12,11];   // zonder grond: de huiskleur, donker
    }
    function helderheid(rgb){
      var k=rgb.map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
      return 0.2126*k[0]+0.7152*k[1]+0.0722*k[2];
    }
    var licht=helderheid(grondVan(host))>0.35;
    tab.style.setProperty('color',licht?'#3A3733':'#F2EEE8','important');
    var sub=tab.querySelector('small');
    if(sub)sub.style.setProperty('color',licht?'#5A5651':'#8A8680','important');
  })();
  var page=document.createElement('section');page.className='rtg-rahul-page';page.hidden=true;page.setAttribute('aria-label','Rahul Command Workspace');
  page.innerHTML='<header class="rtg-command-head"><button class="rtg-mouth" type="button" aria-label="Praat met Rahul">◡</button><span><b>Rahul</b><small>RTG KOMPAS · LOCAL-FIRST</small></span><span class="rtg-command-state" data-ai-state><i></i>Kompas controleert de veilige route</span><button class="rtg-command-close" type="button" aria-label="Terug naar werkblad">↙</button></header><main class="rtg-command-grid"><section class="rtg-command-context"><span class="rtg-command-ey">LIVE CONTEXT</span><h2 data-greeting>Uw werkruimte is begrepen.</h2><p class="rtg-command-lead" data-context></p><div class="rtg-command-fact"><span>ACTIEVE OMGEVING</span><b data-app></b><small data-selection>Geen selectie gemeten</small></div><div class="rtg-command-rule"><i></i><span>Rahul bereidt voor. Geld, publicatie, toegang en definitieve toezegging vragen menselijk akkoord.</span></div></section><section class="rtg-command-chat"><span class="rtg-command-ey">COMMAND CONVERSATION</span><h1>Van bedoeling<br>naar resultaat.</h1><div class="rtg-command-suggest"></div><div class="rtg-command-log" role="log" aria-live="polite"></div><form class="rtg-command-form"><input aria-label="Vraag Rahul" placeholder="Beschrijf het resultaat dat u wilt…" maxlength="500"><button type="submit" aria-label="Verstuur naar Rahul">→</button></form></section><section class="rtg-command-decisions"><span class="rtg-command-ey">DECISION INBOX</span><h2>Alleen wat u nodig heeft.</h2><div class="rtg-decision"><i>✓</i><p><b>Automatisch uitgevoerd</b><small data-done>Geen uitvoering in deze sessie</small></p><em>LOGBOEK</em></div><div class="rtg-decision"><i>→</i><p><b>Ter controle</b><small>Context en voorstel worden eerst zichtbaar</small></p><em>VEILIG</em></div><div class="rtg-decision"><i>!</i><p><b>Uw beslissing</b><small data-approval>Geen open voorstel</small><button type="button" data-approve hidden>Controleer en bevestig</button></p><em>MENS</em></div><div class="rtg-automation"><header><span>AUTONOMOUS OPERATIONS</span><em>VOORBEREIDEN</em></header><p>Rahul mag binnen uw rol zoeken, vergelijken en voorbereiden. Onomkeerbare stappen blijven geblokkeerd.</p><button type="button" data-policy>Bekijk grenzen</button></div></section></main>';
  document.body.appendChild(page);
  window.__rahulTabDialoog={tab:tab,page:page};
  laadStijl('/shared/rahul-tab/dialog.js');


  var input=page.querySelector('input'),log=page.querySelector('.rtg-command-log'),suggest=page.querySelector('.rtg-command-suggest');
  var vorige=null, bezig=false, historie=[],openGoedkeuringen=[],goedkeuringAuth='',goedkeuringPad='';
  try{historie=JSON.parse(sessionStorage.getItem('rtg_rahul_command')||'[]').slice(-12)}catch(e){}
  function tekst(s){return window.RTGRahulTabHelpers.tekst(s)}
  function context(){return window.RTGRahulTabHelpers.context()}
  function voorstellen(c){var s=window.RTGRahulTabHelpers.suggesties(c);suggest.innerHTML=s.map(function(x){return'<button type="button">'+tekst(x)+'</button>'}).join('');suggest.querySelectorAll('button').forEach(function(b){b.onclick=function(){input.value=b.textContent;vraag()}})}
  function render(){log.innerHTML=historie.map(function(m){return'<div class="rtg-command-msg '+(m.rol==='user'?'user':'')+'"><b>'+(m.rol==='user'?'U':'RAHUL')+'</b>'+tekst(m.tekst)+'</div>'}).join('');log.scrollTop=log.scrollHeight;try{sessionStorage.setItem('rtg_rahul_command',JSON.stringify(historie.slice(-12)))}catch(e){}}
  function voeg(rol,waarde){historie.push({rol:rol,tekst:waarde});historie=historie.slice(-12);render()}
  function toonGoedkeuring(d,auth,isLid){openGoedkeuringen=(d&&d.goedkeuringen)||[];goedkeuringAuth=auth;var w=isLid?'member':(d&&d.goedkeuringWereld==='staff'?'staff':'supplier');goedkeuringPad='/api/'+w+'/doe/bevestig';var klein=page.querySelector('[data-approval]'),knop=page.querySelector('[data-approve]'),v=openGoedkeuringen[0];if(!v){klein.textContent='Geen open voorstel';knop.hidden=true;return}klein.textContent=v.samenvatting||v.pad||'Voorstel klaar';knop.hidden=false}
  async function bevestigVoorstel(){var v=openGoedkeuringen[0],knop=page.querySelector('[data-approve]');if(!v||!goedkeuringAuth)return;if(!window.confirm('Controleer deze exacte actie:\n\n'+(v.samenvatting||v.pad)+'\n\nWilt u dit eenmalige voorstel uitvoeren?'))return;knop.disabled=true;try{var r=await fetch(goedkeuringPad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+goedkeuringAuth},body:JSON.stringify({goedkeuringId:v.id,akkoord:true})});var d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'Bevestiging mislukt.');if(window.RTGLiveTwin)RTGLiveTwin.bevestigd(d);voeg('rahul','U heeft het exacte voorstel bevestigd en de server heeft het '+(d.ok?'uitgevoerd.':'geweigerd.'));openGoedkeuringen.shift();var w=goedkeuringPad.indexOf('/staff/')>=0?'staff':goedkeuringPad.indexOf('/member/')>=0?'member':'supplier';toonGoedkeuring({goedkeuringen:openGoedkeuringen,goedkeuringWereld:w},goedkeuringAuth,w==='member')}catch(e){voeg('rahul',e.message||'Het voorstel is niet uitgevoerd.')}finally{knop.disabled=false}}
  function open(ja){page.hidden=!ja;tab.classList.toggle('actief',ja);if(ja){page.scrollTop=0;vorige=document.querySelector('.rtg-rahul-tab~.actief,.wk-tabs>.actief,.lo-tabs>.actief,.po-tabs>.actief')||vorige;var c=context();page.querySelector('[data-app]').textContent=c.app;page.querySelector('[data-selection]').textContent=c.selectie||c.deel||'Geen selectie gemeten';page.querySelector('[data-context]').textContent='Ik zie '+c.deel+' in '+c.app+'. Ik combineer alleen gegevens waarvoor uw huidige rol toegang heeft.';page.querySelector('[data-greeting]').textContent=c.deel+' staat klaar.';voorstellen(c);if(window.RTGLiveTwin)RTGLiveTwin.context(c);if(!historie.length)voeg('rahul','Vertel het gewenste resultaat; ik toon de stappen, uitzonderingen en beslissingen.');setTimeout(function(){try{input.focus({preventScroll:true})}catch(e){input.focus()}page.scrollTop=0},120)}else if(vorige)vorige.classList.add('actief')}
  async function vraag(){var q=input.value.trim();if(!q||bezig)return;input.value='';voeg('user',q);bezig=true;if(window.RTGKompas)RTGKompas.denkt(true);if(window.RTGLiveTwin)RTGLiveTwin.denkt(true);voeg('rahul','Context en grenzen controleren…');var token='',supplier='';try{token=localStorage.getItem('rtg_member_token')||'';supplier=localStorage.getItem('rtg_sup_token')||''}catch(e){}var pad=token?'/api/fluister':'/api/supplier/ai',auth=token||supplier;try{if(!auth)throw new Error('geen sessie');var c=context();var r=await fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify({q:q+'\n\nActieve context: '+c.app+' · '+c.deel+(c.selectie?' · '+c.selectie:''),context:c})});var d=await r.json();historie.pop();if(window.RTGKompas)RTGKompas.toon(d);if(window.RTGLiveTwin)RTGLiveTwin.toon(d);var st=page.querySelector('[data-ai-state]');if(st&&d&&d.aiBeschikbaar===false)st.innerHTML='<i></i>Handmatige werkmodus · alles blijft bruikbaar';else if(st&&d&&d.modus==='lokaal')st.innerHTML=d.verwerking==='eigen-netwerk'?'<i></i>RTG Kompas · lokaal in eigen omgeving':'<i></i>RTG Kompas · privé op deze Mac';else if(st&&d&&d.modus==='hybride')st.innerHTML='<i></i>RTG Kompas · externe uitwijk zichtbaar';else if(st&&d&&d.aiBeschikbaar===true)st.innerHTML='<i></i>AI ondersteund · menselijke autoriteit';voeg('rahul',(d&&(d.antwoord||d.reply||d.error))||'Ik kon dit nog niet afronden.');toonGoedkeuring(d,auth,!!token);if(d&&d.gedaan)page.querySelector('[data-done]').textContent='Laatste opdracht uitgevoerd en vastgelegd'}catch(e){historie.pop();voeg('rahul','Vrije hulp is nu niet bereikbaar. Uw werkblad, navigatie en alle handmatige functies blijven gewoon beschikbaar.')}finally{if(window.RTGKompas)RTGKompas.denkt(false);if(window.RTGLiveTwin)RTGLiveTwin.denkt(false);bezig=false}}
  tab.onclick=function(){if(window.RTGRahulTabHelpers)open(true)};page.querySelector('.rtg-command-close').onclick=function(){open(false)};page.querySelector('.rtg-mouth').onclick=function(){try{input.focus({preventScroll:true})}catch(e){input.focus()}};page.querySelector('form').onsubmit=function(e){e.preventDefault();vraag()};page.querySelector('[data-approve]').onclick=bevestigVoorstel;page.querySelector('[data-policy]').onclick=function(){voeg('rahul','Actieve grens: ik mag binnen uw rol lezen, vergelijken en voorbereiden. Betalen, publiceren, toegang wijzigen en definitief toezeggen vereisen afzonderlijk menselijk akkoord.')};
  window.RTGMetgezel=window.RTGMetgezel||{};window.RTGMetgezel.rahul=function(q){if(!window.RTGRahulTabHelpers)return;open(true);if(q){input.value=q;vraag()}};
  window.__rahulTabCommand={page:page,context:context,voeg:voeg,stel:function(q){input.value=q;vraag()}};
  laadStijl('/shared/rahul-tab/kompas.js');
  laadStijl('/shared/rahul-tab/workspace.js');
})();
