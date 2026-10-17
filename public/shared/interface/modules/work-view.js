/* WorkOS-projectie voor de Workspace Runtime. Het vlak tekent alleen de door
   bestaande WerkOS-deuren samengestelde startprojectie; sessies en rechten
   worden hier niet bewaard of afgeleid. */
(function (w, d) {
  'use strict';
  function el(tag, cls, text) {
    var node = d.createElement(tag); if (cls) node.className = cls;
    if (text != null) node.textContent = text; return node;
  }
  function button(text, action, cls) {
    var node = el('button', cls || 'rtg-work-action', text); node.type = 'button';
    node.dataset.rtgWorkAction = action; return node;
  }
  function count(value) {
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return null;
  }
  function workspaceChoice(root, row, index) {
    var node = button('', 'select', 'rtg-work-space'); node.dataset.rtgWorkIndex = String(index);
    node.appendChild(el('strong', '', row.name || row.code || 'Werkruimte'));
    var roles = Array.isArray(row.roles) ? row.roles.slice(0, 3).join(' · ') : '';
    node.appendChild(el('small', '', roles || row.function || 'Actief lidmaatschap')); root.appendChild(node);
  }
  function dashboard(root, model) {
    var data = model.dashboard || {}, space = data.werkruimte || {}, who = data.wie || {};
    var summary = el('div', 'rtg-work-summary');
    summary.appendChild(el('strong', '', space.naam || 'RTG Werk OS'));
    summary.appendChild(el('span', '', [who.naam, who.functie, who.afdeling].filter(Boolean).join(' · ')));
    root.appendChild(summary);
    var blocks = data.blokken || {}, grid = el('div', 'rtg-work-metrics');
    Object.keys(blocks).filter(function (key) { return key !== 'waarschuwingen'; }).slice(0, model.state === 'peek' ? 2 : 6)
      .forEach(function (key) {
        var total = count(blocks[key]); if (total == null) return;
        var item = el('div', 'rtg-work-metric'); item.appendChild(el('small', '', key));
        item.appendChild(el('strong', '', String(total))); grid.appendChild(item);
      });
    if (grid.childNodes.length) root.appendChild(grid);
    var warnings = Array.isArray(blocks.waarschuwingen) ? blocks.waarschuwingen : [];
    if (warnings.length) root.appendChild(el('p', 'rtg-work-attention', warnings.length + ' aandachtspunt(en) vragen beoordeling in WerkOS.'));
    if (model.state !== 'peek') {
      var actions = el('div', 'rtg-work-actions');
      actions.appendChild(button('Open volledige WorkOS', 'open', 'rtg-module-primary'));
      actions.appendChild(button('Ververs', 'refresh')); root.appendChild(actions);
    }
  }
  w.RTGWorkView = function (root, model) {
    var m = model || {}; root.textContent = '';
    if (m.phase === 'loading') { root.appendChild(el('p', 'rtg-ss-quiet', 'WerkOS controleert uw actuele toegang…')); return; }
    if (m.phase === 'error') {
      root.appendChild(el('p', 'rtg-module-error', m.message || 'WorkOS is nu niet beschikbaar.'));
      root.appendChild(button('Opnieuw verbinden', 'connect')); return;
    }
    if (m.phase === 'stale') {
      root.appendChild(el('p', 'rtg-module-error', 'Uw account is gewijzigd. Verbind WorkOS opnieuw voor actuele toegang.'));
      root.appendChild(button('Opnieuw verbinden', 'connect')); return;
    }
    if (m.phase === 'ready') { dashboard(root, m); return; }
    if (m.phase === 'choose') {
      root.appendChild(el('p', 'rtg-ss-quiet', 'Kies de werkruimte die u in dit paneel wilt bekijken.'));
      var list = el('div', 'rtg-work-spaces');
      (m.spaces || []).forEach(function (row, index) { workspaceChoice(list, row, index); });
      root.appendChild(list); return;
    }
    if (m.phase === 'empty') {
      root.appendChild(el('p', 'rtg-ss-quiet', 'Aan dit RTG-account is nog geen actieve WorkOS-werkruimte gekoppeld.'));
      root.appendChild(button('Open WorkOS', 'open', 'rtg-module-primary')); return;
    }
    root.appendChild(el('p', 'rtg-ss-quiet', 'Open uw bestaande WorkOS-werkruimte zonder RTG te verlaten.'));
    root.appendChild(button('Verbind WorkOS', 'connect', 'rtg-module-primary'));
  };
})(window, document);
