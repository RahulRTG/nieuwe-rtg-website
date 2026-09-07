/* Eén vaste ingang naar bestaande taal, profiel en zoeken. Geen nieuwe
   accountlogica; dezelfde knoppen blijven staan wanneer live status wijzigt. */
(function (w, d) {
  'use strict';
  if (w.RTGEdgePreferences) return;
  function button(name, text, label) {
    var b = d.createElement('button'); b.type = 'button'; b.className = name;
    b.textContent = text; b.setAttribute('aria-label', label); return b;
  }
  function bind() {
    var e = w.RTGEdge && w.RTGEdge.active;
    if (!e) return;
    if (w.RTGEdge2 && d.querySelector('body > .ws-balk')) {
      var tokens=(d.body.getAttribute('data-rtg-edge-2-context') || '').split(',').filter(function(x){return x && x !== 'none';});
      if (tokens.indexOf('world-shell') < 0) w.RTGEdge2.registerContext(tokens.concat('world-shell'));
    }
    if (w.RTGActionDock) w.RTGActionDock.mount(e);
    var index = e.root.querySelector('.rtg-edge-index-inner');
    if (index && !index.querySelector('.rtg-edge-preferences-open')) {
      var entry = button('rtg-edge-preferences-open','Bediening en weergave','Bediening en weergave');
      entry.onclick = function () { e.root.querySelector('.rtg-edge-state').click(); var first=e.root.querySelector('[data-edge-2-mode]'); if(first)first.focus(); };
      index.insertBefore(entry,index.firstChild);
    }
    var context = e.root.querySelector('.rtg-edge-2-context-slot');
    if (context && w.RTGUitvoer && !d.getElementById('rtgCommand') && !context.hasAttribute('data-rtg-export-host')) {
      var exportHost = d.createElement('div'); exportHost.className = 'rtg-edge-export'; context.appendChild(exportHost);
      context.setAttribute('data-rtg-export-host', 'true'); w.RTGUitvoer.mount(exportHost, null);
    }
    if (e.root.hasAttribute('data-rtg-preferences')) return;
    var top = e.root.querySelector('.rtg-edge-top');
    var language = button('rtg-edge-language', (d.documentElement.lang || 'nl').slice(0, 2).toUpperCase(), 'Taal kiezen');
    language.onclick = function () { if (w.RTGi18n) w.RTGi18n.openModal(); };
    var profile = d.createElement('a'); profile.className = 'rtg-edge-profile';
    profile.href = '/apps/mijn-gegevens.html'; profile.setAttribute('aria-label', 'Mijn profiel');
    profile.textContent = '◎'; top.appendChild(language); top.appendChild(profile);
    var search = button('rtg-edge-search', '⌕', 'Zoeken');
    search.onclick = function () { if (w.RTGSprong) w.RTGSprong.open(); else w.RTGEdge.openFunctions(); };
    top.insertBefore(search, language);
    if (!e.workspace) e.root.querySelector('.rtg-edge-layout').hidden = true;
    var panel = e.root.querySelector('.rtg-edge-status-inner');
    if (!d.body.hasAttribute('data-rtg-density')) d.body.setAttribute('data-rtg-density', 'comfortable');
    var density = d.createElement('fieldset'); density.className = 'rtg-edge-density';
    var legend = d.createElement('legend'); legend.textContent = 'Informatiedichtheid'; density.appendChild(legend);
    ['comfortable', 'compact'].forEach(function (value) {
      var control = button('', value === 'compact' ? 'Compact' : 'Ruim', '');
      control.removeAttribute('aria-label'); control.dataset.density = value;
      control.onclick = function () { d.body.setAttribute('data-rtg-density', value); if (w.RTGRouteMemory) w.RTGRouteMemory.save(); };
      density.appendChild(control);
    });
    if (!d.getElementById('rtgCommand')) panel.appendChild(density);
    function updateDensity() {
      density.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.density === d.body.dataset.rtgDensity)); });
    }
    new MutationObserver(updateDensity).observe(d.body, { attributes: true, attributeFilter: ['data-rtg-density'] }); updateDensity();
    e.root.setAttribute('data-rtg-preferences', 'true');
  }
  function start() {
    bind();
    var observer = new MutationObserver(bind);
    observer.observe(d.body, { childList: true, subtree: true });
    new MutationObserver(function () {
      var b = d.querySelector('.rtg-edge-language');
      if (b) b.textContent = (d.documentElement.lang || 'nl').slice(0, 2).toUpperCase();
    }).observe(d.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  w.RTGEdgePreferences = { bind: bind };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}(window, document));
