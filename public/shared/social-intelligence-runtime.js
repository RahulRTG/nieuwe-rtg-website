/* RTG Reality Engine runtime
   Houdt klok, zichtbare signalen, netwerkstatus en commandodeck levend. */
(function () {
  'use strict';

  function isCommandKey(event) {
    return !!(event && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k');
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { isCommandKey: isCommandKey };
  if (typeof document === 'undefined') return;

  function run() {
    var view = window.RTGRealityEngine;
    if (!view) return;
    view.addStylesheet();
    document.documentElement.classList.add('rtg-intelligence');
    view.mountGraph();
    view.mountTelemetry();
    var scrim = view.deck();
    var opener = document.querySelector('.rtg-intel-command');
    var closeButton = scrim.querySelector('.rtg-intel-close');
    var lastFocus;

    function openDeck() {
      lastFocus = document.activeElement;
      scrim.hidden = false;
      document.body.classList.add('rtg-intel-open');
      closeButton.focus();
      document.dispatchEvent(new CustomEvent('rtg:intel-open'));
    }
    function closeDeck() {
      scrim.hidden = true;
      document.body.classList.remove('rtg-intel-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function update() {
      var time = document.getElementById('rtgIntelTime');
      var signals = document.getElementById('rtgIntelSignals');
      var network = document.getElementById('rtgIntelNetwork');
      if (time) time.textContent = new Intl.DateTimeFormat('nl-NL', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date());
      if (signals) signals.textContent = view.visibleSignals() + ' VISIBLE';
      if (network) network.textContent = navigator.onLine
        ? (location.protocol === 'https:' ? 'ONLINE / TLS' : 'ONLINE / LOCAL')
        : 'OFFLINE / LOCAL';
    }

    opener.addEventListener('click', openDeck);
    closeButton.addEventListener('click', closeDeck);
    scrim.addEventListener('click', function (event) { if (event.target === scrim) closeDeck(); });
    document.addEventListener('keydown', function (event) {
      if (isCommandKey(event)) {
        event.preventDefault();
        if (scrim.hidden) openDeck(); else closeDeck();
      }
      if (event.key === 'Escape' && !scrim.hidden) closeDeck();
    });
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        return !mutation.target.closest || !mutation.target.closest('.rtg-intel-strip, .rtg-intel-scrim');
      });
      if (!relevant) return;
      window.clearTimeout(run.signalTimer);
      run.signalTimer = window.setTimeout(update, 100);
    }).observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'class']
    });
    update();
    window.setInterval(update, 1000);

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var host = document.querySelector('.rtg-intel-host');
      if (host) host.addEventListener('pointermove', function (event) {
        var rect = host.getBoundingClientRect();
        host.style.setProperty('--rtg-graph-x', ((event.clientX - rect.left) / rect.width - .5).toFixed(3));
        host.style.setProperty('--rtg-graph-y', ((event.clientY - rect.top) / rect.height - .5).toFixed(3));
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
