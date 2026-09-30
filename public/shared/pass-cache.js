/* The first page loads before its worker controls it. Transfer only public
   interface resources, including the server's exact bundle URLs, afterwards. */
(function (w, d) {
  'use strict';
  if (!('serviceWorker' in navigator) || w.self !== w.top) return;
  var sent = new Set(), busy = false, again = false;
  function warm() {
    var worker = navigator.serviceWorker.controller;
    if (!worker || d.readyState !== 'complete') return;
    if (busy) { again = true; return; }
    var urls = performance.getEntriesByType('resource').filter(function (r) {
      return ['script','link','css','fetch','img'].includes(r.initiatorType);
    }).map(function (r) { return r.name; }).filter(function (url) { return !sent.has(url); });
    if (!urls.length) return;
    busy = true;
    var channel = new MessageChannel();
    var timer = setTimeout(function () { channel.port1.close(); busy = false; }, 30000);
    channel.port1.onmessage = function (e) {
      clearTimeout(timer); channel.port1.close(); busy = false;
      (e.data.saved || []).forEach(function (url) { sent.add(url); });
      d.body.dataset.rtgPassCache = e.data.ok ? 'ready' : 'incomplete';
      if (again) { again = false; warm(); }
    };
    worker.postMessage({type:'rtg-pass-assets', urls:urls}, [channel.port2]);
  }
  w.addEventListener('load', warm);
  w.addEventListener('online', warm);
  w.addEventListener('pageshow', warm);
  navigator.serviceWorker.addEventListener('controllerchange', warm);
  // The catalogue and atmosphere may finish after the window load event.
  new MutationObserver(function (records) {
    if (records.some(function (r) { return r.attributeName === 'data-rtg-desktop-state'; })) warm();
  }).observe(d.body, {attributes:true, attributeFilter:['data-rtg-desktop-state']});
  warm();
})(window, document);
