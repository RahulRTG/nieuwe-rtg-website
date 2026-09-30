/* A failed Command dependency must leave a visible way back, not an empty
   panel. This notices startup failure; it never grants access or clears data. */
(function (w, d) {
  'use strict';
  if (w.self !== w.top) return;
  var panel, timer, unavailable = false;
  function visible(el) {
    return !!el && !el.hidden && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 40;
  }
  function healthy() {
    if (visible(d.getElementById('onbGate'))) return true;
    var app = d.getElementById('app'), gate = d.getElementById('gate');
    if (unavailable && (!app || !app.classList.contains('active'))) return false;
    if (!app || !app.classList.contains('active')) return visible(gate);
    if (app.classList.contains('os-open')) return visible(app.querySelector('.view.active'));
    var panes = d.querySelector('#rtgCommand .cmd-panes');
    return visible(panes) && !!panes.querySelector('.cmd-leeg,.cmd-pane');
  }
  function check() {
    clearTimeout(timer);
    if (d.readyState !== 'complete') return;
    if (healthy()) { if (panel && !panel.hidden) panel.hidden = true; return; }
    timer = setTimeout(function () {
      if (healthy()) return;
      if (!panel) {
        panel = d.createElement('section'); panel.id = 'passStartup'; panel.setAttribute('role','status');
        var title = d.createElement('h2'), text = d.createElement('p'), retry = d.createElement('button');
        title.textContent = 'Uw Pass kon niet volledig openen.';
        text.textContent = 'Controleer uw verbinding en probeer het opnieuw.';
        retry.type = 'button'; retry.textContent = 'Opnieuw proberen';
        retry.addEventListener('click', function () { w.location.reload(); });
        panel.append(title, text, retry);
        (d.querySelector('.wd-page') || d.body).prepend(panel);
      }
      if (panel.hidden) panel.hidden = false;
    }, 800);
  }
  function start() {
    new MutationObserver(check).observe(d.body, {childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
    check();
  }
  w.addEventListener('load', start, {once:true});
  w.addEventListener('pageshow', check);
  w.addEventListener('rtg-pass-unavailable', function () { unavailable = true; check(); });
})(window, document);
