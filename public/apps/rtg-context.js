RTGSterren.hang(document.body, { dichtheid: .9, helderheid: .75 });
(function (w, d) {
  'use strict';
  var tabs = ['vandaag', 'alles', 'mensen'], active = 'vandaag';
  function select(id) {
    if (tabs.indexOf(id) < 0) return false;
    active = id;
    d.querySelectorAll('[data-paneel]').forEach(function (button) {
      var on = button.dataset.paneel === id;
      button.classList.toggle('actief', on);
      if (on) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    d.querySelectorAll('[data-inhoud]').forEach(function (panel) {
      panel.classList.toggle('actief', panel.dataset.inhoud === id);
    });
    return true;
  }
  d.querySelectorAll('[data-paneel]').forEach(function (button) {
    button.addEventListener('click', function () { select(button.dataset.paneel); });
  });
  select(active);
  if (w.RTGRouteMemory) {
    w.RTGRouteMemory.register('living-home', {
      capture: function () { return { tab: active }; },
      restore: function (x) { if (x) select(x.tab); return true; }
    });
    w.RTGRouteMemory.start();
  }
}(window, document));
