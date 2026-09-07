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
      d.dispatchEvent(new CustomEvent('rtg-world-start-ready'));
    }
    function check() {
      if(closed)return;
      var ready=(embedded || body.getAttribute('data-rtg-edge-2-rendered')==='true') && body.getAttribute('data-rtg-world-dashboard-ready')==='true';
      if(ready && fontsReady && performance.now()-lastChange>=160) {
        requestAnimationFrame(function(){requestAnimationFrame(finish);});return;
      }
      timer=w.setTimeout(check,80);
    }
    var observer=new MutationObserver(function(){lastChange=performance.now();});
    observer.observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','data-rtg-edge-2-rendered','data-rtg-world-dashboard-ready']});
    if(d.fonts)d.fonts.ready.then(function(){fontsReady=true;lastChange=performance.now();});
    var fallback=w.setTimeout(finish,12000);check();
    w.addEventListener('pageshow',function(e){if(e.persisted)finish();},{once:true});
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
}(window,document));
