/* De visuele projectie van Universele Regie. Brondata en bevoegdheden blijven
   bij Service en het Privékantoor; dit vlak tekent alleen hun regiebeeld. */
(function (w, d) {
  'use strict';
  function el(tag, cls, text) {
    var node = d.createElement(tag); if (cls) node.className = cls;
    if (text != null) node.textContent = text; return node;
  }
  function button(text, action, cls) {
    var node = el('button', cls || 'rtg-coordination-action', text); node.type = 'button';
    node.dataset.rtgCoordinationAction = action; return node;
  }
  function phaseName(id) {
    return ({ request: 'Ontvangen', triage: 'Beoordelen', match: 'Matchen', offer: 'Voorstel',
      agreement: 'Akkoord nodig', plan: 'Voorbereiden', execute: 'In uitvoering',
      verify: 'Controleren', settle: 'Afrekenen', close: 'Afgerond', cancel: 'Gestopt',
      dispute: 'Geschil', escalate: 'Herstel nodig' })[id] || 'In behandeling';
  }
  function card(item, selected, state) {
    var source = item.source || {}, phase = item.phase || {};
    var node = button('', 'select', 'rtg-coordination-case');
    node.dataset.rtgCoordinationId = source.id || '';
    node.setAttribute('aria-pressed', selected ? 'true' : 'false');
    var top = el('span', 'rtg-coordination-case-top');
    top.appendChild(el('span', 'rtg-coordination-kind', item.kind === 'service' ? 'Service' : 'Concierge'));
    top.appendChild(el('span', 'rtg-coordination-phase', phaseName(phase.id)));
    node.appendChild(top); node.appendChild(el('strong', '', item.title || source.id || 'RTG-zaak'));
    if (state !== 'peek') {
      var roles = (item.responsibilities || []).map(function (x) { return x.role; }).filter(Boolean).slice(0, 3);
      if (roles.length) node.appendChild(el('small', '', roles.join(' · ')));
    }
    return node;
  }
  function detail(root, item) {
    if (!item) return;
    var source = item.source || {}, attention = item.attention || {};
    var block = el('div', 'rtg-coordination-detail');
    block.appendChild(el('p', 'rtg-ss-quiet', source.id || 'Zaak'));
    var actions = el('div', 'rtg-coordination-actions');
    actions.appendChild(button(item.kind === 'service' ? 'Open hulp' : 'Open Privékantoor', 'open', 'rtg-module-primary'));
    if (item.kind === 'service' && !item.phase.terminal)
      actions.appendChild(button('Vraag een mens', 'human'));
    block.appendChild(actions);
    if (attention.decisionRequired) block.appendChild(el('p', 'rtg-coordination-attention', 'Uw besluit is nodig voordat RTG verdergaat.'));
    if (attention.recovery) block.appendChild(el('p', 'rtg-coordination-attention', 'Deze zaak vraagt herstel of menselijke aandacht.'));
    root.appendChild(block);
  }
  w.RTGCoordinationView = function (root, model) {
    var m = model || {}, items = Array.isArray(m.items) ? m.items : [];
    root.textContent = '';
    if (m.loading && !items.length) {
      root.appendChild(el('p', 'rtg-ss-quiet', 'Uw lopende zaken worden opgehaald…')); return;
    }
    if (m.error && !items.length) {
      root.appendChild(el('p', 'rtg-module-error', 'Uw zaken zijn nu niet beschikbaar. Probeer het opnieuw.'));
      root.appendChild(button('Opnieuw proberen', 'refresh')); return;
    }
    if (!items.length) {
      root.appendChild(el('p', 'rtg-ss-quiet', 'Er zijn geen lopende service- of conciergezaken.'));
      root.appendChild(button('Verversen', 'refresh')); return;
    }
    var selected = items.find(function (x) { return x.source && x.source.id === m.selectedId; }) || items[0];
    var list = el('div', 'rtg-coordination-list');
    items.slice(0, m.state === 'peek' ? 2 : 8).forEach(function (item) {
      list.appendChild(card(item, item === selected, m.state));
    });
    root.appendChild(list); if (m.state !== 'peek') detail(root, selected);
  };
})(window, document);
