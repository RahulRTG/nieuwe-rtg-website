// Initialiseert de gedeelde Rahul-tab voor contextuele ondersteuning.
(function(){
  'use strict';
  if(window.__rahulTabStandaard)return;
  window.__rahulTabStandaard=true;

  function laadStijl(src){var script=document.createElement('script');script.src=src;script.async=false;document.head.appendChild(script)}
  laadStijl('/shared/rahul-tab/style-base.js');
  laadStijl('/shared/edge/taakbeeld.js');
  laadStijl('/shared/edge/conceptwerk.js');
  laadStijl('/shared/rahul-tab/session.js');
  laadStijl('/shared/rahul-tab/approval.js');
  laadStijl('/shared/rahul-tab/helpers.js');

  var selectors='.wk-tabs,.rv-tabs>div,.lo-tabs,.pn-tabs,.pn-top>div,.po-tabs,.ir-tabs,.ir-shell>main>header>div,.cmd-tabs,[data-tabs],[role="tablist"],main>header>div,.topbar,.appbar,body>header,.wd-page>header'.split(','),host=null;
  for(var i=0;i<selectors.length&&!host;i++)host=document.querySelector(selectors[i]);
  if(!host||document.getElementById('wkRahulTab')||host.querySelector('.rtg-rahul-tab'))return;

  var tab=document.createElement('button');tab.type='button';tab.className='rtg-rahul-tab ds-rahul-tab';tab.innerHTML='Rahul<small>KOMPAS</small>';host.appendChild(tab);
  if(document.querySelector('html[data-ds]')){
    /* De DS-Edge vervangt alleen de zichtbare ingang. Deze gedragshaak blijft
       eigenaar van context, historie en uitvoering en declareert daarom
       expliciet dat hij ook verborgen in de universele actielijst hoort. */
    tab.dataset.dsActie='Rahul openen';tab.setAttribute('data-rtg-edge-bar','');
  }
  var page=document.createElement('section');page.className='rtg-rahul-page ds-rahul';page.hidden=true;page.setAttribute('aria-label','Rahul Command Workspace');
  page.innerHTML='<header class="rtg-command-head"><button class="rtg-mouth" type="button" aria-label="Praat met Rahul">◡</button><span><b>Rahul</b><small>RTG KOMPAS · LOCAL-FIRST</small></span><span class="rtg-command-state" data-ai-state><i></i>Nog geen actuele route gecontroleerd</span><button class="rtg-command-close" type="button" aria-label="Terug naar werkblad">↙</button></header><div class="rtg-command-grid"><section class="rtg-command-context"><span class="rtg-command-ey">LIVE CONTEXT</span><h2 data-greeting>Uw werkruimte is begrepen.</h2><p class="rtg-command-lead" data-context></p><div class="rtg-command-fact"><span>ACTIEVE OMGEVING</span><b data-app></b><small data-selection>Geen selectie gemeten</small></div><div class="rtg-command-rule"><i></i><span>Rahul bereidt voor. Geld, publicatie, toegang en definitieve toezegging vragen menselijk akkoord.</span></div></section><section class="rtg-command-chat"><span class="rtg-command-ey">COMMAND CONVERSATION</span><h1>Van bedoeling<br>naar resultaat.</h1><div class="rtg-command-suggest"></div><div class="rtg-command-log" role="log" aria-live="polite"></div><form class="rtg-command-form"><input aria-label="Vraag Rahul" placeholder="Beschrijf het resultaat dat u wilt…" maxlength="500"><button type="submit" aria-label="Verstuur naar Rahul">→</button></form></section><section class="rtg-command-decisions"><span class="rtg-command-ey">DECISION INBOX</span><h2>Alleen wat u nodig heeft.</h2><div class="rtg-decision"><i>✓</i><p><b>Automatisch uitgevoerd</b><small data-done>Geen uitvoering in deze sessie</small></p><em>LOGBOEK</em></div><div class="rtg-decision"><i>→</i><p><b>Ter controle</b><small>Context en voorstel worden eerst zichtbaar</small></p><em>VEILIG</em></div><div class="rtg-decision"><i>!</i><p><b>Uw beslissing</b><small data-approval>Geen open voorstel</small><button type="button" data-approve hidden>Controleer en bevestig</button></p><em>MENS</em></div><div class="rtg-automation"><header><span>AUTONOMOUS OPERATIONS</span><em>VOORBEREIDEN</em></header><p>Rahul mag binnen uw rol zoeken, vergelijken en voorbereiden. Onomkeerbare stappen blijven geblokkeerd.</p><button type="button" data-policy>Bekijk grenzen</button></div></section></div>';
  document.body.appendChild(page);
  window.__rahulTabDialoog={tab:tab,page:page};
  laadStijl('/shared/rahul-tab/dialog.js');
  laadStijl('/shared/rahul-tab/inkt.js');


  var input=page.querySelector('input'),log=page.querySelector('.rtg-command-log'),suggest=page.querySelector('.rtg-command-suggest');
  var vorige=null, bezig=false, historie=[],sessieStore=null,sessieOwner='',approval=null;
  function tekst(s){return window.RTGRahulTabHelpers.tekst(s)}
  function context(){return window.RTGRahulTabHelpers.context()}
  function voorstellen(c){var s=window.RTGRahulTabHelpers.suggesties(c);suggest.innerHTML=s.map(function(x){return'<button type="button">'+tekst(x)+'</button>'}).join('');suggest.querySelectorAll('button').forEach(function(b){b.onclick=function(){input.value=b.textContent;vraag()}})}
  function render(bewaar){log.innerHTML=historie.map(window.RTGRahulTabHelpers.bericht).join('');log.scrollTop=log.scrollHeight;if(bewaar!==false&&sessieStore&&sessieOwner)sessieStore.write(sessieOwner,historie)}
  function voeg(rol,waarde,noot){historie.push({rol:rol,tekst:waarde,noot:noot||void 0});historie=historie.slice(-12);render()}
  function beslissingen(){return approval||(approval=RTGRahulApproval.create({win:window,page:page,sync:synchroniseer,owner:function(){return sessieOwner},add:voeg}))}
  async function synchroniseer(){if(!window.RTGRahulSession)return false;if(!sessieStore)sessieStore=RTGRahulSession.create(window);var s=await sessieStore.read();if(s.owner!==sessieOwner){if(sessieOwner)RTGRahulTabHelpers.wis(page);sessieOwner=s.owner;historie=s.history;if(approval)approval.clear();render(false)}return!!s.owner}
