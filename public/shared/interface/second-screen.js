/* Second Screen boven de Workspace Runtime. */
(function (w, d) {
  'use strict';
  function el(tag, cls, tekst) { var n = d.createElement(tag); if (cls) n.className = cls; if (tekst != null) n.textContent = tekst; return n; }
  function knop(tekst, actie, cls) { var n = el('button', cls || '', tekst); n.type = 'button'; n.dataset.ssAction = actie; n.setAttribute('aria-label', tekst); return n; }
  w.RTGInterfaceSecondScreen = function (o) {
    var root = o.root, bank = root && root.querySelector('.cmd-bank'), nav = bank && bank.querySelector('.cmd-nav');
    var experience = w.RTGWorkspaceExperience;
    if (!bank || !nav || !w.RTGWorkspaceRuntime || !w.RTGModuleSDK || !w.RTGWorkspaceComposer || !experience) return null;
    var state = 'peek', vorige = 'panel', editing = false, returnFocus = null, focusTerug = null;
    var mq = w.matchMedia('(min-width:1000px)'), eerste = mq.matches ? 'workspace' : 'peek';
    var uitvoerKijk = null, runtime, composer;

    runtime = w.RTGWorkspaceRuntime({
      services: { navigation: nav },
      context: function () { return w.RTGAdaptief && w.RTGAdaptief.context ? w.RTGAdaptief.context() : {}; },
      open: function (url, title) {
        if (w.matchMedia('(max-width:999px)').matches) zet('peek');
        return o.open(url, title);
      },
      confirm: function (vraag) { return w.confirm(String(typeof vraag === 'function' ? vraag() : vraag)); },
      onOrchestrate: function (layout, changes, event) {
        var kritiek = event && event.event === 'safety.incident.started' && event.payload && event.payload.severity === 'critical';
        if (!kritiek) return;
        if (composer) composer.setActive('safety', false); zet('focus');
      }
    });
    w.RTGModuleSDK.catalog().forEach(function (def) { runtime.register(def); });

    var shell = el('div', 'rtg-ss-shell'), head = el('header', 'rtg-ss-header');
    var brand = el('div', 'rtg-ss-brand'); brand.appendChild(el('span', 'rtg-ss-mark', 'RTG'));
    brand.appendChild(el('h2', '', experience.productName)); head.appendChild(brand);
    var modes = el('div', 'rtg-ss-header-actions');
    modes.appendChild(experience.glyph(knop('Panel', 'panel'), 'paneel'));
    modes.appendChild(experience.glyph(knop('Workspace', 'workspace'), 'werk'));
    modes.appendChild(experience.glyph(knop('Focus', 'focus'), 'rtg'));
    modes.appendChild(knop('Sluiten', 'close', 'rtg-ss-close')); head.appendChild(modes); shell.appendChild(head);
    var scroll = el('div', 'rtg-ss-scroll'), lijst = el('div', 'rtg-ss-modules');
    var editor = el('section', 'rtg-ss-editor'); editor.hidden = true;
    editor.appendChild(el('h3', '', 'Maak je ruimte'));
    editor.appendChild(el('p', 'rtg-ss-quiet', 'Modules toevoegen, ordenen en verbergen. Uw brondata blijft bij de module zelf.'));
    var editorLijst = el('div', 'rtg-ss-editor-list'); editor.appendChild(editorLijst);
    var dichtheid = el('div', 'rtg-ss-density');
    dichtheid.appendChild(knop('Comfortabel', 'density-comfortable'));
    dichtheid.appendChild(knop('Compact', 'density-compact'));
    editor.appendChild(dichtheid); editor.appendChild(knop('Gereed', 'edit-done', 'rtg-ss-editor-done'));
    scroll.appendChild(lijst); scroll.appendChild(editor); shell.appendChild(scroll);
    var acties = el('div', 'rtg-ss-actions'); acties.appendChild(knop('Aanpassen', 'edit'));
    acties.appendChild(knop('Maak je ruimte', 'ask', 'rtg-ss-compose')); shell.appendChild(acties);
    bank.insertBefore(shell, bank.querySelector('.cmd-bankvoet'));
    bank.id = bank.id || 'rtgDynamicWorkspace'; var greep = root.querySelector('.cmd-lade');
    if (greep) greep.setAttribute('aria-controls', bank.id);
    composer = w.RTGWorkspaceComposer({ runtime: runtime, root: root, bank: bank, list: lijst,
      editor: editor, editorList: editorLijst, density: dichtheid,
      onChange: function () { runtime.setState(state, composer.active()); } });

    state = eerste; root.classList.add('rtg-interface-second-screen', 'rtg-ss-' + eerste);
    root.dataset.rtgSecondScreen = eerste; root.dataset.rtgWorkspace = '2';
    if (w.RTGUitvoer && w.RTGUitvoer.mount) w.RTGUitvoer.mount(head, bank);
    function merkUitvoer() {
      var b = head.querySelector('.rtguitvoer-knop'); if (!b || b.dataset.ssOutput) return;
      b.dataset.ssOutput = '1'; b.setAttribute('aria-label', 'Gegevens meenemen'); experience.glyph(b, 'logboek');
    }
    merkUitvoer(); if (w.MutationObserver) { uitvoerKijk = new MutationObserver(merkUitvoer); uitvoerKijk.observe(root, { childList: true, subtree: true }); }

    function bewaar() { composer.save(); }
    function teken() { composer.draw(state, editing); }
    function aria(s) {
      var werk = root.querySelector('.cmd-werk'), focus = s === 'focus';
      bank.setAttribute('aria-hidden', s === 'peek' ? 'true' : 'false'); bank.setAttribute('aria-label', 'RTG ' + experience.surfaceName);
      if (focus) { bank.setAttribute('role', 'dialog'); bank.setAttribute('aria-modal', 'true'); }
      else { bank.removeAttribute('role'); bank.removeAttribute('aria-modal'); }
      if (werk) { werk.toggleAttribute('inert', focus); if (focus) werk.setAttribute('aria-hidden', 'true'); else werk.removeAttribute('aria-hidden'); }
    }
    function zet(next) {
      if (['peek', 'panel', 'workspace', 'focus'].indexOf(next) < 0) return;
      if (next === 'peek' && mq.matches) next = 'workspace';
      var oud = state, vanPeek = oud === 'peek' && next !== 'peek' && d.activeElement && d.activeElement !== d.body;
      if (next !== 'peek' && next !== 'focus') vorige = next;
      if (vanPeek) returnFocus = d.activeElement; if (next === 'focus' && oud !== 'focus') focusTerug = d.activeElement;
      if (next === 'focus') composer.setActive(composer.activeOrFirst(), false);
      root.classList.remove('rtg-ss-' + oud); state = next; root.classList.add('rtg-ss-' + state);
      root.dataset.rtgSecondScreen = state; root.classList.toggle('bank-open', state !== 'peek');
      var grip = root.querySelector('.cmd-lade'); if (grip) grip.setAttribute('aria-expanded', state === 'peek' ? 'false' : 'true');
      aria(state); runtime.setState(state, composer.active());
      if (state !== 'peek') composer.sync().catch(function () {});
      ['panel', 'workspace', 'focus'].forEach(function (s) {
        var b = bank.querySelector('[data-ss-action="' + s + '"]'); if (b) b.setAttribute('aria-pressed', state === s ? 'true' : 'false');
      });
      if (state === 'focus' || vanPeek) { var f = experience.focusable(bank); if (f.length) f[0].focus(); }
      if (oud === 'focus' && state !== 'focus' && focusTerug && d.contains(focusTerug)) { focusTerug.focus(); focusTerug = null; }
      if (state === 'peek' && returnFocus && d.contains(returnFocus)) { returnFocus.focus(); returnFocus = null; }
    }
    function klik(e) {
      var t = e.target.closest('[data-ss-action],[data-ss-url],[data-ss-context-id],[data-rtg-legacy-open]');
      if (!t || !bank.contains(t)) return;
      if (runtime.dispatch(t)) { e.preventDefault(); bewaar(); return; }
      var a = t.dataset.ssAction, id = t.dataset.ssModuleId || (t.closest('[data-ss-module]') && t.closest('[data-ss-module]').dataset.ssModule);
      if (a === 'close') zet('peek');
      else if (a === 'panel' || a === 'workspace' || a === 'focus') zet(a);
      else if (a === 'focus-module') { composer.setActive(id, false); zet('focus'); bewaar(); }
      else if (a === 'edit') { editing = !editing; teken(); }
      else if (a === 'edit-done') { editing = false; teken(); }
      else if (a === 'ask') { if (o.vraag) o.vraag('Maak een gevalideerde RTG Workspace Blueprint voor mijn doel'); }
      else if (a === 'up') composer.move(id, -1); else if (a === 'down') composer.move(id, 1);
      else if (a === 'hide') composer.hide(id, true); else if (a === 'show') composer.hide(id, false);
      else if (a === 'density-compact' || a === 'density-comfortable') composer.setDensity(a.slice(8));
    }
    function toets(e) {
      if (e.defaultPrevented || (w.RTGUitvoer && w.RTGUitvoer.zichtbaar && w.RTGUitvoer.zichtbaar())) return;
      if (e.key === 'Escape' && state !== 'peek') { e.preventDefault(); zet(state === 'focus' ? vorige : 'peek'); return; }
      if (e.key === 'Tab' && state === 'focus') experience.trapTab(e, bank);
    }
    function vorm(e) { if (e.matches && state === 'peek') zet('workspace'); else if (!e.matches && state === 'workspace') zet('peek'); }

    bank.addEventListener('click', klik); d.addEventListener('keydown', toets);
    if (mq.addEventListener) mq.addEventListener('change', vorm); else mq.addListener(vorm);
    teken(); zet(eerste);
    var api = { get state() { return state; }, setState: zet, runtime: runtime,
      applyBlueprint: function (blueprint) { return experience.applyBlueprint(composer, mq, zet, blueprint); }, refresh: function () {
      runtime.publish('workspace.refresh.requested', {});
    }, destroy: function () {
      d.removeEventListener('keydown', toets); bank.removeEventListener('click', klik);
      if (mq.removeEventListener) mq.removeEventListener('change', vorm); else mq.removeListener(vorm);
      if (uitvoerKijk) uitvoerKijk.disconnect(); if (nav && nav.parentNode !== bank) bank.insertBefore(nav, bank.querySelector('.cmd-bankvoet'));
      composer.destroy(); runtime.destroy(); aria('peek');
      var uit = head.querySelector('.rtguitvoer-knop'); if (uit) { delete uit.dataset.ssOutput; uit.removeAttribute('aria-label'); var gg = uit.querySelector('.rtg-ss-mode-glyf'); if (gg) gg.remove(); }
      if (w.RTGUitvoer && w.RTGUitvoer.unmount) w.RTGUitvoer.unmount(); shell.remove();
      root.classList.remove('rtg-interface-second-screen', 'rtg-ss-' + state); delete root.dataset.rtgSecondScreen;
      delete root.dataset.rtgWorkspace; delete root.dataset.rtgDensity; delete root.__rtgSecondScreen;
    } };
    root.__rtgSecondScreen = api; return api;
  };
})(window, document);
