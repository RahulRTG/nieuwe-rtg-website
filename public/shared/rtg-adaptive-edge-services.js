(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdgeServices) return;
  var MODES = ['rahul', 'connect', 'media', 'account'];
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function lips() {
    return '<svg class="rtg-adaptive-lips" viewBox="0 0 100 58" aria-hidden="true"><path d="M3 31C20 26 32 6 50 17C68 6 80 26 97 31C80 52 68 57 50 47C32 57 20 52 3 31Z"/><path d="M13 31C29 34 40 29 50 29C60 29 71 34 87 31"/></svg>';
  }
  function serviceButton(label, action, secondary) {
    var button = d.createElement('button'); button.type = 'button';
    button.className = 'rtg-adaptive-service-action' + (secondary ? ' is-secondary' : '');
    button.innerHTML = '<span>' + esc(label) + '</span><b aria-hidden="true">→</b>';
    button.addEventListener('click', action); return button;
  }
  function navigate(rt, api, path) {
    if (!path) return false;
    api.setState('dock'); rt.win.location.href = path; return true;
  }
  function modes(rt) {
    if (!rt || !rt.modes) return;
    rt.modes.querySelectorAll('[data-rtg-adaptive-mode]').forEach(function (button) {
      var mode = button.dataset.rtgAdaptiveMode;
      var active = rt.serviceMode ? mode === rt.serviceMode :
        mode === 'rahul' ? rt.model.deck === 'rahul' : mode === 'now' && rt.model.deck !== 'rahul';
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function render(rt, api) {
    if (!rt || !rt.serviceMode) return false;
    var mode = rt.serviceMode, panel = rt.servicePanel;
    panel.textContent = ''; panel.hidden = false;
    if (rt.controls) rt.controls.hidden = true;
    rt.sheetList.hidden = true;
    if (rt.primarySlot) {
      if (rt.primaryHidden == null) rt.primaryHidden = rt.primarySlot.hidden;
      rt.primarySlot.hidden = true;
    }
    if (rt.contextPanel) rt.contextPanel.hidden = true;
    if (mode === 'rahul') {
      rt.sheetTitle.textContent = 'Rahul';
      rt.sheetCopy.textContent = 'Vraag, begrijp en bereid voor. Uitvoering blijft binnen uw toestemming en bevoegdheid.';
      panel.appendChild(serviceButton('Open beveiligd gesprek', function () {
        api.setState('dock');
        if (w.RTGMetgezel && typeof w.RTGMetgezel.rahul === 'function') w.RTGMetgezel.rahul();
        else if (!api.legacy('.rtg-edge-ai')) navigate(rt, api, '/apps/app.html');
      }));
      panel.appendChild(serviceButton('Wat ziet Rahul?', function () { navigate(rt, api, '/apps/mijn-gegevens.html'); }, true));
    } else if (mode === 'connect') {
      rt.sheetTitle.textContent = 'Connect';
      rt.sheetCopy.textContent = 'Berichten, bellen en videobellen blijven bij de persoon en het gesprek.';
      panel.appendChild(serviceButton('Open berichten', function () { navigate(rt, api, '/apps/comm.html'); }));
      panel.appendChild(serviceButton('Open uw mensen', function () { navigate(rt, api, '/apps/wereld.html'); }, true));
    } else if (mode === 'media') {
      var player = w.RTGSpeler, live = player && typeof player.live === 'function' && player.live();
      rt.sheetTitle.textContent = 'Media';
      rt.sheetCopy.textContent = live ? 'Uw actieve media reist mee met deze Edge.' : 'Open RTG Media voor muziek, video en uw bibliotheek.';
      if (live && typeof player.stuur === 'function') {
        var controls = d.createElement('div'); controls.className = 'rtg-adaptive-media-controls';
        controls.appendChild(serviceButton('Vorige', function () { player.stuur('prev'); }, true));
        controls.appendChild(serviceButton('Speel of pauzeer', function () { player.stuur('toggle'); }));
        controls.appendChild(serviceButton('Volgende', function () { player.stuur('next'); }, true));
        panel.appendChild(controls);
      }
      panel.appendChild(serviceButton('Open RTG Media', function () { navigate(rt, api, '/apps/media.html'); }));
      panel.appendChild(serviceButton('Open RTG Sound', function () { navigate(rt, api, '/apps/muziek.html'); }, true));
    } else {
      rt.sheetTitle.textContent = 'RTG Account';
      rt.sheetCopy.textContent = 'Uw identiteit, gegevens, apparaten en veiligheidskeuzes op één plaats.';
      panel.appendChild(serviceButton('Open uw account', function () { navigate(rt, api, '/apps/ik.html'); }));
      panel.appendChild(serviceButton('Privacy en veiligheid', function () { navigate(rt, api, '/apps/veilig.html'); }, true));
      panel.appendChild(serviceButton('Uw gegevens', function () { navigate(rt, api, '/apps/mijn-gegevens.html'); }, true));
    }
    modes(rt); return true;
  }
  function clear(rt) {
    if (!rt) return;
    rt.serviceMode = null;
    if (rt.servicePanel) { rt.servicePanel.hidden = true; rt.servicePanel.textContent = ''; }
    rt.sheetList.hidden = false;
    if (rt.controls) rt.controls.hidden = false;
    if (rt.primarySlot && rt.primaryHidden != null) {
      rt.primarySlot.hidden = rt.primaryHidden; rt.primaryHidden = null;
    }
    modes(rt);
  }
  function open(rt, mode, api) {
    if (!rt || MODES.indexOf(mode) < 0) return false;
    api.closePanel(); rt.serviceMode = mode; api.setState('expanded'); render(rt, api);
    if (w.RTGAdaptiveEdgeInput) w.RTGAdaptiveEdgeInput.haptic(w);
    return true;
  }
  function mount(rt, api) {
    var nav = d.createElement('nav'); nav.className = 'rtg-adaptive-modes'; nav.setAttribute('aria-label', 'RTG Edge schermen');
    nav.innerHTML = '<button type="button" data-rtg-adaptive-mode="now">Nu</button><button type="button" data-rtg-adaptive-mode="rahul">Rahul</button><button type="button" data-rtg-adaptive-mode="connect">Connect</button><button type="button" data-rtg-adaptive-mode="media">Media</button><button type="button" data-rtg-adaptive-mode="account">Account</button>';
    var panel = d.createElement('div'); panel.className = 'rtg-adaptive-service'; panel.hidden = true;
    rt.sheet.querySelector('.rtg-adaptive-sheet-head').after(nav);
    rt.sheetList.after(panel); rt.modes = nav; rt.servicePanel = panel;
    nav.addEventListener('click', function (event) {
      var button = event.target.closest('[data-rtg-adaptive-mode]'); if (!button) return;
      var mode = button.dataset.rtgAdaptiveMode;
      if (mode === 'now') { api.setDeck('actions'); api.setState('expanded'); }
      else if (mode === 'rahul') api.execute('ai');
      else open(rt, mode, api);
    });
    modes(rt);
  }
  w.RTGAdaptiveEdgeServices = Object.freeze({ mount: mount, open: open, render: render, clear: clear,
    modes: modes, escape: esc, lips: lips });
}(window, document));
