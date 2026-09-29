/* Commit van de vier wereldhomes. Identiteit, Edge, lettertypen en de bestaande
   bronrender landen voor de eerste inhoudspaint; bij een trage bron blijft haar
   eigen Loading/Error-state na maximaal twaalf seconden bereikbaar. */
(function (w,d) {
  'use strict';
  function start() {
    var body=d.body, layer=d.querySelector('.rtg-world-start');
    if(!layer || body.getAttribute('data-rtg-world-start')!=='loading')return;
    var embedded=false;try{embedded=w.self!==w.top;}catch(e){embedded=true;}
    var closed=false,fontsReady=!d.fonts,lastChange=performance.now(),timer=0;
    function finish() {
      if(closed)return;closed=true;observer.disconnect();w.clearTimeout(timer);w.clearTimeout(fallback);
      body.setAttribute('data-rtg-world-start','ready');body.removeAttribute('aria-busy');layer.hidden=true;
    }
    function presentationReady() {
      return embedded || body.dataset.rtgLayout !== 'standard' || body.dataset.rtgDesktopState === 'ready' ||
        (body.dataset.rtgDesktopState === 'error' && !!d.querySelector('.wd-shell'));
    }
    function fallbackFinish() {
      if (presentationReady()) { finish(); return; }
      closed=true;observer.disconnect();w.clearTimeout(timer);body.removeAttribute('aria-busy');
      body.dataset.rtgWorldStart='error';layer.textContent='Het scherm kon niet worden geopend. ';
      var retry=d.createElement('button');retry.type='button';retry.textContent='Probeer opnieuw';retry.onclick=function(){w.location.reload();};layer.appendChild(retry);
    }
    function check() {
      if(closed)return;
      /* Het dashboard commit alleen waar het hoort (niet ingebed, juiste route).
         Waar rtg-vandaag-luxe.js zelf zegt dat het hier NIET commit, is wachten
         op zijn vlag wachten op iets dat nooit komt: dan hing elke wereld die de
         schil in een frame opent twaalf seconden op dit scherm. */
      var luxe=w.RTGVandaagLuxe;
      var dashboardKlaar=body.getAttribute('data-rtg-world-dashboard-ready')==='true' || !!(luxe && typeof luxe.geschikt==='function' && !luxe.geschikt(d));
      var ready=(embedded || body.getAttribute('data-rtg-edge-2-rendered')==='true') && dashboardKlaar && presentationReady();
      if(ready && fontsReady && performance.now()-lastChange>=160) {
        requestAnimationFrame(function(){requestAnimationFrame(finish);});return;
      }
      timer=w.setTimeout(check,80);
    }
    var observer=new MutationObserver(function(){lastChange=performance.now();});
    observer.observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','data-rtg-edge-2-rendered','data-rtg-world-dashboard-ready','data-rtg-desktop-state']});
    if(d.fonts)d.fonts.ready.then(function(){fontsReady=true;lastChange=performance.now();});
    var fallback=w.setTimeout(fallbackFinish,12000);check();
    w.addEventListener('pageshow',function(e){if(e.persisted)finish();},{once:true});
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
}(window,document));
