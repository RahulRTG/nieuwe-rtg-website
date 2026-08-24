(function(){'use strict';function $(id){return document.getElementById(id)}var K=window.RTGWerk,peopleLoaded=false;var labels={projecten:'Operations Universe',kennis:'Knowledge Intelligence',klanten:'Relationship Command',service:'Service Control',bouw:'Technology Control',it:'Enterprise Assets',recht:'Contract Authority',besluit:'Authority Table',people:'Human Enterprise'};function open(id){document.querySelectorAll('[data-wk]').forEach(function(b){b.classList.toggle('actief',b.dataset.wk===id||(id==='start'&&b.dataset.wk==='start'))});$('vPeople').hidden=true;$('vStatus').hidden=true;if(id==='start')return $('tabStart').click();if(id==='people'){ $('vStart').hidden=true;$('vModules').hidden=true;$('vPeople').hidden=false;$('wkContextTab').childNodes[0].nodeValue='Human Enterprise ';if(!peopleLoaded)loadPeople();return}
/* INSTELLINGEN OPENDE DE MODULE `it`. Dat was geen instellingenscherm maar de
   apparatenlijst -- en de tenantstand (contract, levensloop, bewijs) bestond
   wel op de server en nergens op een scherm. Nu opent hij de stand zelf. */
if(id==='settings'){$('vStart').hidden=true;$('vModules').hidden=true;$('vStatus').hidden=false;$('wkContextTab').childNodes[0].nodeValue='Tenant Status ';if(window.RTGWerkStatus)window.RTGWerkStatus.laad();return}$('mKeuze').value=id;$('wkContextTab').childNodes[0].nodeValue=(labels[id]||'Operations Universe')+' ';$('tabModules').click()}function loadPeople(){if(!K.poort())return;K.api('/indienst',{}).then(function(r){if(r.body.error)return K.meld(r.body.error);peopleLoaded=true;var rows=r.body.indienst||[];$('wkPeopleCount').textContent=rows.length+' UNIVERSE'+(rows.length===1?'':'S');$('wkPerson').innerHTML=rows.map(function(x,i){return '<option value="'+i+'">'+K.esc(x.naam)+'</option>'}).join('')||'<option>Geen actieve medewerkers</option>';function draw(){var x=rows[Number($('wkPerson').value)||0];if(!x)return $('wkOnboarding').innerHTML='<p class="stil">Er is nog geen actief indienstdossier.</p>';$('wkOnboarding').innerHTML='<header><div><span>EMPLOYEE UNIVERSE</span><h2>'+K.esc(x.naam)+'</h2></div><strong>'+x.stappen.filter(function(s){return s.gedaan}).length+'<small>/ '+x.stappen.length+' bewezen</small></strong></header>'+x.stappen.map(function(s,i){return '<div class="'+(s.gedaan?'done':'')+'"><i>'+(s.gedaan?'✓':i+1)+'</i><p><b>'+K.esc(s.stap)+'</b><small>'+K.esc(s.gedaan?(s.waarom||('vastgelegd door '+s.door)):(s.waarom||'menselijk moment nog open'))+'</small></p><em>'+K.esc(s.aard)+'</em></div>'}).join('')+'<footer><span>'+x.open.length+' betekenisvolle stap(pen) open</span><b>'+(x.klaar?'GEREED':'IN OPBOUW')+'</b></footer>'}$('wkPerson').onchange=draw;draw()})}function humanTab(id){document.querySelectorAll('[data-human]').forEach(function(b){b.classList.toggle('actief',b.dataset.human===id)});document.querySelectorAll('[data-human-panel]').forEach(function(p){p.hidden=p.dataset.humanPanel!==id})}document.querySelectorAll('[data-human]').forEach(function(b){b.onclick=function(){humanTab(b.dataset.human)}});document.querySelectorAll('[data-onboard-world]').forEach(function(b){b.onclick=function(){document.querySelectorAll('[data-onboard-world]').forEach(function(x){x.classList.toggle('actief',x===b)});var t={fast:'Fast Start geeft sneller bevoegdheid, met extra menselijke controle en een hogere eerste-wekenbelasting.',balanced:'Balanced Start past bij deze rol: voldoende snelheid, zonder bevoegdheden eerder te geven dan het bewijs toelaat.',deep:'Deep Foundation beschermt complexe of risicovolle rollen met meer context en oefening vooraf.'};$('wkWorldAdvice').textContent=t[b.dataset.onboardWorld]}});$('wkSimulation').onclick=function(){$('wkRahulContext').textContent='Simulatie gestart: een leverancier valt uit. Geen echte klant, betaling of toegang wordt geraakt.'};document.querySelectorAll('[data-wk]').forEach(function(b){b.onclick=function(){open(b.dataset.wk)}});
/* DE BALK ZOEKT NU ECHT, en dat is een reparatie van een bewering.

   Hier stond: "Ik heb de juiste werkruimte geopend. Rechten en handelingen
   volgen uw rol." Het eerste klopte -- hij opende een tab op een woordmatch --
   maar het tweede was tekst zonder dekking: er werd nergens een recht gelezen.

   /api/bedrijf/zoek doet dat wel, en op de sterkst mogelijke manier: het
   register wordt per verzoek opgebouwd uit de rechten van het lid dat
   aanklopt, dus een soort waarvoor u het recht mist ZIT ER NIET IN -- hij wordt
   niet gefilterd, hij bestaat niet. Daarom kan deze balk ook eerlijk melden
   waar er is gezocht (`bereik`) in plaats van te doen alsof hij alles zag.

   Wat hij NIET doet is handelen. Zoeken en openen is samenstellen en
   klaarzetten; wie iets wil veranderen drukt zelf op de knop die daarvoor
   bestaat. Een machine die zelf handelt in een werksysteem heeft een actiebon
   en een bevestigingsmodel nodig, en die zijn er niet -- zie TAKEN.md. */
function zoek(q){
  var ctx=$('wkRahulContext');
  if(!ctx)return;
  ctx.textContent='Zoeken\u2026';
  K.api('/zoek',{q:q}).then(function(r){
    var d=r.body||{};
    if(d.error)return void(ctx.textContent=d.error);
    var bereik=(d.bereik||[]).length;
    if(!d.totaal){
      ctx.textContent=(d.let||'Niets gevonden.')+
        (bereik?' Gezocht in '+bereik+' soort(en) waar u recht op heeft.':'');
      return;
    }
    var top=[];
    (d.groepen||[]).forEach(function(g){
      (g.rijen||[]).slice(0,3).forEach(function(t){
        top.push((g.label||g.type)+': '+(t.titel||t.id));
      });
    });
    ctx.textContent=d.totaal+' gevonden in '+bereik+' soort(en) waar u recht op heeft'+
      (top.length?' \u2014 '+top.slice(0,5).join(' \u00b7 '):'')+'.';
  }).catch(function(){ctx.textContent='De zoekopdracht kwam niet aan.';});
}

/* HANDELEN VIA DE BALK, MET DE KETEN ERIN. Eerst vragen we of dit een
   HANDELING is. Levert dat een voornemen op, dan komt dat op het scherm met
   wat het gaat raken en een knop om te bevestigen -- en pas die knop voert uit.
   Begrijpt de zeef er geen handeling in, dan is het een ZOEKOPDRACHT.

   De volgorde is met opzet zo: zoeken is onschuldig en handelen niet, dus de
   dure vraag wordt eerst gesteld en het onschuldige antwoord is de terugval. */
function toonPlan(p){
  var ctx=$('wkRahulContext');
  ctx.innerHTML='<b>'+K.esc(p.samenvatting)+'</b><br><small>Raakt: '+
    K.esc((p.raakt||[]).map(function(r){return r.soort+' ('+r.wat+')'}).join(', ')||'niets')+
    ' \u00b7 recht: '+K.esc(p.recht)+'</small><br>'+
    '<small>Er is nog niets gebeurd. Bevestigen doet u.</small> '+
    '<button class="knop p" type="button" id="wkDoe">Voer uit</button>';
  $('wkDoe').onclick=function(){
    $('wkDoe').disabled=true;
    K.api('/handeling/doe',{planId:p.id,bevestiging:p.bevestiging}).then(function(r){
      var d=r.body||{};
      if(d.error)return void(ctx.textContent=d.error);
      var b=d.actiebon||{};
      ctx.textContent='Uitgevoerd: '+(b.resultaat?b.resultaat.soort+' "'+b.resultaat.titel+'"':b.samenvatting)+
        '. Vastgelegd als actiebon '+b.id+', en in het journaal.';
    });
  };
}
function probeer(q){
  var ctx=$('wkRahulContext');
  if(!ctx)return;
  ctx.textContent='Even kijken\u2026';
  K.api('/handeling/plan',{bedoeling:q}).then(function(r){
    var d=r.body||{};
    /* Een rechtenweigering is GEEN reden om te gaan zoeken: de gebruiker
       bedoelde een handeling, en dan hoort hij te horen welk recht hij mist
       in plaats van een lijst treffers. */
    if(r.status===403&&d.recht)return void(ctx.textContent=d.error);
    if(d.plan)return toonPlan(d.plan);
    zoek(q);
  }).catch(function(){zoek(q)});
}
function ask(){
  /* DE TEKST BLIJFT ZOALS DE GEBRUIKER HEM TYPTE. Hier stond .toLowerCase(),
     en dat was onschuldig zolang de balk alleen op woorden routeerde. Nu de
     tekst ook de TITEL van een taak of ticket wordt, verminkt het de invoer:
     "Dakgoot vervangen" werd "dakgoot vervangen". De kleine letters zijn alleen
     voor de woordmatch hieronder; wat naar de server gaat is `q`. */
  var q=$('wkRahulInput').value.trim();if(!q)return;$('wkRahulInput').value='';var k=q.toLowerCase();if(/onboard|indienst|persoon|medewerker|personeel|eerste 90/.test(k))open('people');else if(/klant|verkoop|relatie/.test(k))open('klanten');else if(/service|ticket|storing/.test(k))open('service');else if(/besluit|akkoord|stem/.test(k))open('besluit');else if(/contract|recht/.test(k))open('recht');else if(/release|bouw|software/.test(k))open('bouw');else if(/apparaat|licentie|it/.test(k))open('it');else if(/kennis|beleid|procedure/.test(k))open('kennis');else open('projecten');probeer(q)}$('wkRahulSend').onclick=ask;$('wkRahulInput').onkeydown=function(e){if(e.key==='Enter')ask()};$('wkMouth').onclick=function(){$('wkRahulInput').focus()}})();
