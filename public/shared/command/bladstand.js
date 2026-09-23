/* Wat de werktafel naar BUITEN laat zien van zijn bladen: de terugknop van de
   telefoon en het wereldlabel in de kop.

   Deze laag LEEST de werktafel (#rtgCommand, de .cmd-pane-bladen) en schrijft
   er niets in; bladen sluiten gaat via RTGCommand.sluitAlles, dezelfde deur als
   de rest van de schil. Een eigen bestand en geen regels in werktafel.js, omdat
   dat bestand tegen de 10 KB van scripts/check.js regel 13 aan zit en dit een
   eigen onderwerp is. */
(function(w,d){
  'use strict';
  if(w.RTGCommandBladstand)return;
  var WERELDEN=['living','travel','work','foundation'];
  function root(){return d.getElementById('rtgCommand')}
  function bladen(r){return r?r.querySelectorAll('.cmd-pane'):[]}
  function open(r){return !!r&&r.dataset.stand!=='gesloten'&&bladen(r).length>0}

  /* DE TERUGKNOP. Een blad is een iframe, en het EERSTE laden van een iframe
     zet geen stap in de geschiedenis: wie vanaf het beginscherm een wereld
     opende en terugveegde, stond buiten de app in plaats van op de werktafel.
     Daarom een wachtpost, in de vorm van ../adaptief/lagen.js: zodra er een
     blad staat, een eigen stap. Terug binnen een blad loopt eerst door de
     geschiedenis van dat frame (die vuurt hier geen popstate); pas wie daar
     voorbij is, komt op de post uit en sluit de bladen -- terug op de lege
     tafel, niet uit de app. */
  function wachtpost(r){if(!open(r)||!w.history||!w.history.pushState)return;
    try{if(w.history.state&&w.history.state.rtgWerktafel)return;w.history.pushState({rtgWerktafel:1},'')}catch(e){}}
  w.addEventListener('popstate',function(e){var st=e.state||{};
    if(st.rtgWerktafel||st.rtgLaag||!open(root())||!w.RTGCommand)return;w.RTGCommand.sluitAlles()});

  /* HET WERELDLABEL IN DE KOP. De schil zelf draagt vast data-rtg-world
     "living" (app.html hoort bij LivingOS), dus stond er "LIVINGOS" boven
     TravelOS, WorkOS en het beginscherm waar je nog een wereld KIEST. Het label
     volgt daarom het actieve blad, in een eigen attribuut: de huisstijl van de
     schil schuift niet mee (173 regels CSS kijken naar data-rtg-world). Geen
     blad, of een blad zonder wereld: geen label. rtg-edge-smart-menu leest
     hetzelfde attribuut voor "Dit scherm". */
  function kopwereld(r){
    if(!r){d.body.removeAttribute('data-rtg-blad-wereld');return}
    var blad=r.querySelector('.cmd-pane.actief iframe'),id=w.RTGWorldIdentity,wereld=null;
    /* De ECHTE plek van het blad, niet het src-attribuut: bladhaak.js werkt bij
       navigatie binnen het frame alleen p.url bij, dus src bleef de eerste
       pagina en het label bleef LivingOS zeggen na een link naar TravelOS. */
    var pad=null;if(blad){try{pad=blad.contentWindow.location.pathname}catch(e){pad=null}
      if(!pad||pad==='blank')pad=blad.getAttribute('src')}
    if(pad&&id&&typeof id.classify==='function'){try{wereld=id.classify(pad)}catch(e){wereld=null}}
    if(WERELDEN.indexOf(wereld)<0)wereld='geen';
    if(d.body.getAttribute('data-rtg-blad-wereld')!==wereld)d.body.setAttribute('data-rtg-blad-wereld',wereld)}

  /* Een navigatie BINNEN een blad verandert de DOM van de schil niet; zijn
     load-event is het enige teken. */
  function bij(){var r=root();wachtpost(r);kopwereld(r);
    if(r)r.querySelectorAll('.cmd-pane iframe').forEach(function(f){if(!f.rtgBlikLoad){f.rtgBlikLoad=1;f.addEventListener('load',bij)}})}
  /* De werktafel wordt bij elke standwissel opnieuw OPGEBOUWD (werktafel.js,
     zet), dus de waarnemer hangt aan body en kijkt alleen naar #rtgCommand. */
  var gehaakt=null,binnen=null;
  function haak(){var r=root();
    if(r!==gehaakt){if(binnen)binnen.disconnect();binnen=null;gehaakt=r;
      if(r){binnen=new MutationObserver(bij);binnen.observe(r,{childList:true,subtree:true,attributes:true,attributeFilter:['class','src','data-stand']})}}
    bij()}
  function start(){if(!d.body||!w.MutationObserver)return;
    new MutationObserver(haak).observe(d.body,{childList:true});haak()}
  w.RTGCommandBladstand={bij:bij};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window,document);
