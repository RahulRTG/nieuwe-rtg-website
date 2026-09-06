/* Drie vaste, door de gebruiker gekozen ingangen uit de bestaande wereld.
   Live data en scores veranderen nooit hun volgorde. Dit dock navigeert alleen. */
(function (g, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) g.RTGActionDock = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function model(catalog, saved) {
    var known = Object.create(null), slots = [null, null, null];
    catalog.forEach(function (item) { if (item && typeof item[0] === 'string' && /^\/(?!\/)/.test(item[3] || '')) known[item[0]] = item; });
    (Array.isArray(saved) ? saved : []).slice(0, 3).forEach(function (id, i) {
      if (known[id] && slots.indexOf(id) < 0) slots[i] = id;
    });
    return { slots: function () { return slots.slice(); }, entries: function () { return slots.map(function (id) { return known[id] || null; }); },
      pin: function (index, id) {
        if (!Number.isInteger(index) || index < 0 || index > 2 || id !== null && !known[id]) return false;
        if (id !== null) { var old = slots.indexOf(id); if (old >= 0) slots[old] = null; }
        slots[index] = id; return true;
      }, catalog: function () { return Object.keys(known).map(function (id) { return known[id]; }); }
    };
  }
  function mount(edge) {
    var parent = edge.root.querySelector('.rtg-edge-index-inner');
    if (!parent || parent.querySelector('.rtg-action-dock')) return;
    var d = parent.ownerDocument, w = d.defaultView, key = 'rtg.action-dock.v1:' + edge.key, saved;
    try { saved = JSON.parse(w.localStorage.getItem(key) || 'null'); } catch (e) {}
    var state = model(edge.cfg.all || edge.cfg.tools || [], saved);
    var section = d.createElement('section'); section.className = 'rtg-action-dock'; section.setAttribute('aria-label', 'Vaste acties');
    var row = d.createElement('div'); row.className = 'rtg-action-dock-slots';
    var settings = d.createElement('details'), summary = d.createElement('summary'); summary.textContent = 'Vaste acties instellen'; settings.appendChild(summary);
    var cells = [], selects = [];
    function draw() {
      state.entries().forEach(function (item, i) {
        cells[i].textContent = '';
        var el = d.createElement(item ? 'a' : 'span'); el.textContent = item ? item[1] : 'Vrije plek ' + (i + 1);
        if (item) {
          el.href = item[3];
          if (edge.onTool) el.onclick = function (ev) {
            if(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)return;
            ev.preventDefault(); edge.onTool(item[0],item[3]);
            var menu=edge.root.querySelector('.rtg-edge-menu');
            if(menu && menu.getAttribute('aria-expanded')==='true')menu.click();
          };
        }
        cells[i].appendChild(el);
        selects[i].value = item ? item[0] : '';
      });
    }
    for (var i = 0; i < 3; i++) {
      var cell = d.createElement('div'); row.appendChild(cell); cells.push(cell);
      var label = d.createElement('label'), select = d.createElement('select'); label.textContent = 'Plek ' + (i + 1); label.appendChild(select);
      var empty = d.createElement('option'); empty.value = ''; empty.textContent = 'Vrij laten'; select.appendChild(empty);
      state.catalog().forEach(function (item) { var option = d.createElement('option'); option.value = item[0]; option.textContent = item[1]; select.appendChild(option); });
      select.dataset.slot = String(i); select.onchange = function () {
        state.pin(Number(this.dataset.slot), this.value || null);
        try { w.localStorage.setItem(key, JSON.stringify(state.slots())); } catch (e) {}
        draw();
      };
      selects.push(select); settings.appendChild(label);
    }
    section.appendChild(row); section.appendChild(settings); parent.insertBefore(section, parent.querySelector('.rtg-edge-groups')); draw();
  }
  return { model: model, mount: mount };
}));
