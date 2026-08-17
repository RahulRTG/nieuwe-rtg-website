/* RTG Live Twin: een server-gestuurd beslispakket rond de Rahul-conversatie. */
(function(w){
  'use strict';
  var command=w.__rahulTabCommand;
  if(!command||!w.RTGRahulTabHelpers)return;
  var page=command.page;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function zet(sel,waarde){var el=page.querySelector(sel);if(el)el.textContent=waarde}

  page.querySelector('.rtg-command-context').insertAdjacentHTML('beforeend',
    '<section class="rtg-intent"><header><span>LIVE INTENT · ROLE-BOUND</span><em data-intent-state>DIRECT</em></header>'+
    '<div class="rtg-intent-grid"><div><small>BEDOELING</small><b data-intent-goal>Resultaat voorbereiden</b></div><div><small>GRENS</small><b>Menselijk akkoord</b></div><div><small>CONTEXT</small><b data-intent-context>Actief scherm</b></div><div><small>UITVOERING</small><b data-intent-execution>Niets gewijzigd</b></div></div>'+
    '<button type="button" data-build-plan>Maak mijn beslispakket →</button></section>');

  page.querySelector('.rtg-command-chat h1').insertAdjacentHTML('afterend',
    '<section class="rtg-twin" data-live-status="direct"><header><span>RTG LIVE TWIN · VERIFIED PRE-FLIGHT</span><em data-twin-state>CONTEXT GEREED</em></header>'+
    '<div class="rtg-twin-flow"><div class="ok"><i></i><b>Context</b><small data-flow-context>actief</small></div><div class="ok"><i></i><b>Policy</b><small>rol begrensd</small></div><div><i></i><b>Evidence</b><small data-flow-evidence>wacht</small></div><div><i></i><b>Impact</b><small data-flow-impact>niet uitgevoerd</small></div><div><i></i><b>Approval</b><small data-flow-approval>mens beslist</small></div></div>'+
    '<div class="rtg-twin-packet"><div><small>NU</small><b data-live-now>Veilige context staat klaar</b></div><div><small>STRAKS</small><b data-live-next>Stel uw vraag of doel</b></div><div><small>LET OP</small><b data-live-watch>Niets wordt stil uitgevoerd</b></div></div>'+
    '<div class="rtg-proof"><header><span>PROOF RAIL</span><b data-proof-count>2 SERVERBRONNEN</b></header><div data-proof-list><span><i>S</i><b>Bevoegdheidsgrens</b><small>Huidige rol</small></span><span><i>R</i><b>Verwerkingsroute</b><small>Wordt door server bevestigd</small></span></div></div>'+
    '<div class="rtg-twin-foot"><span data-twin-reason>App-regels bepalen bron, route en autoriteit.</span><b data-twin-id>LIVE</b></div></section>');

  page.querySelector('.rtg-automation').insertAdjacentHTML('beforebegin',
    '<section class="rtg-one"><header><span>ONE CONTROL</span><em data-decision-state>GEEN UITVOERING</em></header><h3 data-decision-title>De AI adviseert.<br>U houdt de grens.</h3>'+
    '<p data-decision-impact>Gevolgen, bronnen en uitvoering blijven apart zichtbaar.</p><dl><div><dt>Uitvoering</dt><dd data-decision-execution>niet uitgevoerd</dd></div><div><dt>Brondekking</dt><dd data-decision-sources>2 controles</dd></div><div><dt>Autoriteit</dt><dd>mens</dd></div></dl>'+
    '<button type="button" data-one-decision>Bekijk actieve grens →</button></section>');

  function context(c){
    c=c||command.context();
    zet('[data-intent-goal]',(c.deel||'Werkruimte')+' versnellen');
    zet('[data-intent-context]',c.selectie||c.deel||c.app||'Actief scherm');
    zet('[data-flow-context]',c.app||'actief');
  }

  function denkt(aan){
    var twin=page.querySelector('.rtg-twin');
    if(!twin)return;
    twin.classList.toggle('werkt',!!aan);
    if(aan){zet('[data-twin-state]','BRONNEN CONTROLEREN');zet('[data-flow-evidence]','controleren');zet('[data-live-now]','Lokale route en grenzen controleren')}
  }

  function toon(d){
    var t=d&&d.liveTwin;
    if(!t)return;
    var bronnen=Array.isArray(t.bronnen)?t.bronnen:[];
    var uitvoering=t.uitvoering||{};
    var wacht=Number(uitvoering.voorstellen||0)>0;
    page.querySelector('.rtg-twin').dataset.liveStatus=t.status||'voorbereid';
    zet('[data-twin-state]',String(t.status||'voorbereid').replace(/-/g,' ').toUpperCase());
    zet('[data-live-now]',t.ritme&&t.ritme.nu||'Route voorbereid');
    zet('[data-live-next]',t.ritme&&t.ritme.straks||'U beslist over vervolg');
    zet('[data-live-watch]',t.ritme&&t.ritme.letOp||'Geen stille uitvoering');
    zet('[data-flow-evidence]',bronnen.length+' bevestigd');
    zet('[data-flow-impact]',uitvoering.status||'niet-uitgevoerd');
    zet('[data-flow-approval]',wacht?uitvoering.voorstellen+' wachtend':'geen open grens');
    zet('[data-twin-reason]',t.reden||'App-regels bepalen bron, route en autoriteit.');
    zet('[data-twin-id]','#'+String(t.pakketId||'LIVE').toUpperCase());
    zet('[data-proof-count]',bronnen.length+' CONTROLES');
    zet('[data-intent-execution]',uitvoering.status==='bevestigd'?'Server bevestigd':'Niets gewijzigd');
    var lijst=page.querySelector('[data-proof-list]');
    lijst.innerHTML=bronnen.slice(0,4).map(function(b){return '<span><i>'+esc((b.soort||'B').slice(0,1).toUpperCase())+'</i><b>'+esc(b.label||'Bron')+'</b><small>'+esc(b.detail||b.status||'bevestigd')+'</small></span>'}).join('');
    zet('[data-decision-state]',wacht?'UW AKKOORD NODIG':uitvoering.status==='bevestigd'?'SERVER BEVESTIGD':'GEEN UITVOERING');
    page.querySelector('.rtg-one').classList.toggle('attention',wacht);
    zet('[data-decision-title]',wacht?'Eén exact voorstel wacht op u.':'De AI adviseert. U houdt de grens.');
    zet('[data-decision-impact]',t.gevolg||'Geen onomkeerbare stap uitgevoerd.');
    zet('[data-decision-execution]',uitvoering.status||'niet-uitgevoerd');
    zet('[data-decision-sources]',bronnen.length+' controles');
    zet('[data-one-decision]',wacht?'Controleer exact voorstel →':'Bekijk actieve grens →');
  }

  function bevestigd(d){
    if(!d||!d.ok)return;
    page.querySelector('.rtg-twin').dataset.liveStatus='uitgevoerd-en-gelogd';
    page.querySelector('.rtg-one').classList.remove('attention');
    zet('[data-twin-state]','SERVER BEVESTIGD');zet('[data-decision-state]','SERVER BEVESTIGD');
    zet('[data-flow-impact]','bevestigd');zet('[data-flow-approval]','akkoord verwerkt');
    zet('[data-intent-execution]','Server bevestigd');zet('[data-decision-execution]','bevestigd');
    zet('[data-decision-impact]','De exacte workflow is na uw akkoord door de server verwerkt.');
  }

  page.querySelector('[data-build-plan]').onclick=function(){
    if(command.stel)command.stel('Wat vraagt nu aandacht? Maak een veilige route met NU, STRAKS en LET OP.');
  };
  page.querySelector('[data-one-decision]').onclick=function(){
    var knop=page.querySelector('[data-approve]');
    if(knop&&!knop.hidden)return knop.click();
    command.voeg('rahul','Er wacht nu geen uitvoerbaar voorstel. Ik kan wel vergelijken, simuleren en een controleerbare route voorbereiden.');
  };
  context();
  w.RTGLiveTwin={context:context,denkt:denkt,toon:toon,bevestigd:bevestigd};
})(window);
