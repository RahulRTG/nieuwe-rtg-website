/* RTG Live Twin: een server-gestuurd beslispakket rond de Rahul-conversatie. */
(function(w){
  'use strict';
  var command=w.__rahulTabCommand;
  if(!command||!w.RTGRahulTabHelpers)return;
  var page=command.page, actueelAntwoord=false, contextSleutel=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function zet(naam,waarde){var el=page.querySelector('[data-'+naam+']');if(el)el.textContent=waarde}

  page.querySelector('.rtg-command-context').insertAdjacentHTML('beforeend',
    '<section class="rtg-intent"><header><span>LIVE INTENT · ROLE-BOUND</span><em data-intent-state>DIRECT</em></header>'+
    '<div class="rtg-intent-grid"><div><small>BEDOELING</small><b data-intent-goal>Resultaat voorbereiden</b></div><div><small>GRENS</small><b>Menselijk akkoord</b></div><div><small>CONTEXT</small><b data-intent-context>Actief scherm</b></div><div><small>UITVOERING</small><b data-intent-execution>Niets gewijzigd</b></div></div>'+
    '<button type="button" data-build-plan>Maak mijn beslispakket →</button></section>');

  page.querySelector('.rtg-command-chat h1').insertAdjacentHTML('afterend',
    '<section class="rtg-twin" data-live-status="direct"><header><span>RTG LIVE TWIN · CONTROLE NOG NODIG</span><em data-twin-state>LOKALE CONTEXT</em></header>'+
    '<div class="rtg-twin-flow"><div><i></i><b>Context</b><small data-flow-context>actief</small></div><div><i></i><b>Policy</b><small>nog te controleren</small></div><div><i></i><b>Evidence</b><small data-flow-evidence>wacht</small></div><div><i></i><b>Impact</b><small data-flow-impact>niet uitgevoerd</small></div><div><i></i><b>Approval</b><small data-flow-approval>mens beslist</small></div></div>'+
    '<div class="rtg-twin-packet"><div><small>NU</small><b data-live-now>Schermcontext beschikbaar</b></div><div><small>STRAKS</small><b data-live-next>Stel uw vraag of doel</b></div><div><small>LET OP</small><b data-live-watch>Niets wordt stil uitgevoerd</b></div></div>'+
    '<div class="rtg-proof"><header><span>PROOF RAIL</span><b data-proof-count>GEEN SERVERRESULTAAT</b></header><div data-proof-list><span><i>S</i><b>Bevoegdheidsgrens</b><small>Nog te controleren</small></span><span><i>R</i><b>Verwerkingsroute</b><small>Wordt door server bevestigd</small></span></div></div>'+
    '<div class="rtg-twin-foot"><span data-twin-reason>App-regels bepalen bron, route en autoriteit.</span><b data-twin-id>LIVE</b></div></section>');

  page.querySelector('.rtg-automation').insertAdjacentHTML('beforebegin',
    '<section class="rtg-one"><header><span>ONE CONTROL</span><em data-decision-state>GEEN UITVOERING</em></header><h3 data-decision-title>De AI adviseert.<br>U houdt de grens.</h3>'+
    '<p data-decision-impact>Gevolgen, bronnen en uitvoering blijven apart zichtbaar.</p><dl><div><dt>Uitvoering</dt><dd data-decision-execution>niet uitgevoerd</dd></div><div><dt>Brondekking</dt><dd data-decision-sources>nog niet gecontroleerd</dd></div><div><dt>Autoriteit</dt><dd>mens</dd></div></dl>'+
    '<button type="button" data-one-decision>Bekijk actieve grens →</button></section>');

  function identiteit(c){
    function waarde(v){return typeof v==='string'||typeof v==='number'?String(v):''}
    var ruimte=c.werkruimte||{}, refs=Array.isArray(c.verwijzingen)?c.verwijzingen:[];
    // Verwijzingsvolgorde bepaalt prioriteit; tijdstempels zijn geen identiteit.
    return JSON.stringify([waarde(c.app),waarde(c.deel),waarde(c.selectie),waarde(c.wereld),
      waarde(ruimte.id),waarde(ruimte.module),waarde(ruimte.modus),refs.map(function(ref){
        return [waarde(ref&&ref.soort),waarde(ref&&ref.id)];
      })]);
  }

  function pastBij(c){return !!c&&identiteit(c)===identiteit(command.context())}

  function context(c){
    c=c||command.context();
    var sleutel=identiteit(c);
    if(contextSleutel!==null&&contextSleutel!==sleutel)onbevestigd();
    contextSleutel=sleutel;
    zet('intent-goal',(c.deel||'Werkruimte')+' versnellen');
    zet('intent-context',c.selectie||c.deel||c.app||'Actief scherm');
    zet('flow-context',c.app||'actief');
  }

  function onbevestigd(){
    actueelAntwoord=false;
    page.querySelector('.rtg-twin').dataset.liveStatus='onbevestigd';
    zet('twin-state','GEEN ACTUEEL SERVERRESULTAAT');
    zet('flow-evidence','niet bevestigd');
    zet('proof-count','GEEN SERVERRESULTAAT');
    page.querySelector('[data-proof-list]').textContent='Bronnen en bevoegdheid zijn nog niet gecontroleerd.';
    zet('decision-sources','nog niet gecontroleerd');
    zet('flow-impact','niet bevestigd');
    zet('intent-execution','Geen actuele bevestiging');
    zet('decision-execution','niet bevestigd');
    zet('decision-state','UITKOMST NIET BEVESTIGD');
    zet('live-now','Wacht op een actueel serverresultaat');
    zet('live-next','Controleer de actuele vraag en context');
    zet('live-watch','Uitvoering en gevolgen zijn niet bevestigd');
    zet('flow-approval','opnieuw te controleren');
    zet('twin-id','GEEN ACTUEEL PAKKET');
    zet('twin-reason','Een actueel serverresultaat is nodig voor bron, gevolg en akkoordgrens.');
    zet('decision-title','De actuele uitkomst is nog niet bevestigd.');
    zet('decision-impact','Uitkomst en gevolgen zijn niet bevestigd.');
    zet('one-decision','Bekijk actieve grens →');
    page.querySelector('.rtg-one').classList.remove('attention');
  }

  function clear(){
    onbevestigd();
    contextSleutel=null;
    page.querySelector('.rtg-twin').classList.remove('werkt');
    zet('intent-goal','Nog geen actuele bedoeling');
    zet('intent-context','Nog geen actuele context');
    zet('flow-context','niet bevestigd');
  }

  function denkt(aan){
    var twin=page.querySelector('.rtg-twin');
    if(!twin)return;
    twin.classList.toggle('werkt',!!aan);
    if(aan)onbevestigd();
    if(!aan&&!actueelAntwoord)onbevestigd();
    if(aan){zet('twin-state','BRONNEN CONTROLEREN');zet('flow-evidence','controleren');zet('live-now','Lokale route en grenzen controleren')}
  }

  function toon(d,bronContext){
    if(arguments.length>1&&!pastBij(bronContext)){clear();return false;}
    var t=d&&d.liveTwin;
    if(!t||typeof t!=='object'||Array.isArray(t)||d.error||d.ok===false){onbevestigd();return false;}
    actueelAntwoord=false;
    var bronnen=Array.isArray(t.bronnen)?t.bronnen.filter(function(b){return b&&typeof b==='object'&&!Array.isArray(b)}):[];
    var uitvoering=t.uitvoering||{};
    var wacht=Number(uitvoering.voorstellen||0)>0;
    page.querySelector('.rtg-twin').dataset.liveStatus=t.status||'onbekend';
    zet('twin-state',String(t.status||'onbekend').replace(/-/g,' ').toUpperCase());
    zet('live-now',t.ritme&&t.ritme.nu||'Route voorbereid');
    zet('live-next',t.ritme&&t.ritme.straks||'U beslist over vervolg');
    zet('live-watch',t.ritme&&t.ritme.letOp||'Geen stille uitvoering');
    zet('flow-evidence',bronnen.length+' ontvangen bronvermeldingen');
    zet('flow-impact',uitvoering.status||'niet bevestigd');
    zet('flow-approval',wacht?uitvoering.voorstellen+' wachtend':'geen open grens');
    zet('twin-reason',t.reden||'App-regels bepalen bron, route en autoriteit.');
    zet('twin-id','#'+String(t.pakketId||'LIVE').toUpperCase());
    zet('proof-count',bronnen.length+' BRONVERMELDINGEN');
    zet('intent-execution',uitvoering.status==='bevestigd'?'Server bevestigd':uitvoering.status||'Geen actuele bevestiging');
    var lijst=page.querySelector('[data-proof-list]');
    lijst.innerHTML=bronnen.slice(0,4).map(function(b){return '<span><i>'+esc(String(b.soort||'B').slice(0,1).toUpperCase())+'</i><b>'+esc(b.label||'Bron')+'</b><small>'+esc(b.detail||b.status||'status niet opgegeven')+'</small></span>'}).join('');
    zet('decision-state',wacht?'UW AKKOORD NODIG':uitvoering.status==='bevestigd'?'SERVER BEVESTIGD':'UITKOMST: '+(uitvoering.status||'NIET BEVESTIGD'));
    page.querySelector('.rtg-one').classList.toggle('attention',wacht);
    zet('decision-title',wacht?'Eén exact voorstel wacht op u.':'De AI adviseert. U houdt de grens.');
    zet('decision-impact',t.gevolg||'Geen gevolgstatus ontvangen.');
    zet('decision-execution',uitvoering.status||'niet bevestigd');
    zet('decision-sources',bronnen.length+' bronvermeldingen');
    zet('one-decision',wacht?'Controleer exact voorstel →':'Bekijk actieve grens →');
    actueelAntwoord=true;
    return true;
  }

  function bevestigd(d){
    if(!d||d.ok!==true||d.error){onbevestigd();return;}
    actueelAntwoord=true;
    page.querySelector('.rtg-twin').dataset.liveStatus='uitgevoerd-en-gelogd';
    page.querySelector('.rtg-one').classList.remove('attention');
    zet('twin-state','SERVER BEVESTIGD');zet('decision-state','SERVER BEVESTIGD');
    zet('flow-impact','bevestigd');zet('flow-approval','akkoord verwerkt');
    zet('intent-execution','Server bevestigd');zet('decision-execution','bevestigd');
    zet('decision-impact','De exacte workflow is na uw akkoord door de server verwerkt.');
  }

  page.querySelector('[data-build-plan]').onclick=function(){
    var c=command.context();
    context(c);
    zet('twin-state','PREFLIGHT GESTART');
    zet('flow-evidence','serverronde');
    zet('live-now','Context en grenzen direct voorbereid');
    zet('live-next','Serverbronnen bevestigen');
    zet('live-watch','0 acties uitgevoerd');
    zet('twin-reason','De applicatie bereidt direct voor; de server bevestigt bron, gevolg en akkoordgrens.');
    if(command.stel)command.stel('Wat vraagt nu aandacht? Maak een veilige route met NU, STRAKS en LET OP.');
  };
  page.querySelector('[data-one-decision]').onclick=function(){
    var knop=page.querySelector('[data-approve]');
    if(knop&&!knop.hidden)return knop.click();
    command.voeg('rahul','Er wacht nu geen uitvoerbaar voorstel. Ik kan wel vergelijken, simuleren en een controleerbare route voorbereiden.');
  };
  context();
  w.RTGLiveTwin={context:context,pastBij:pastBij,denkt:denkt,toon:toon,bevestigd:bevestigd,clear:clear};
})(window);
