/* Context is server-afgeleid en first-class. De browser mag een context-id
   kiezen uit deze lijst, maar nooit zelf bindings of authority verzinnen. */
'use strict';

const { hash, kopie } = require('./canon');

module.exports = function maakContexten({ kern, crypto }) {
  const id = grond => 'ctx_' + hash(crypto, grond).slice(0, 20);
  /* Een context overleeft een nieuwe codenaam en lekt die naam niet in zijn
     identiteit. De sessiesleutel is server-side en wordt alleen gehasht. */
  const principal = key => 'actor_' + hash(crypto, String(key || '')).slice(0, 20);

  function basis(key, world, type, label, bindings) {
    const b = bindings || {};
    return Object.freeze({
      id: id({ world, type, actor: principal(key), bindings: b }),
      world, type, label: String(label || world), bindings: kopie(b),
      authorityScope: Object.freeze(['world.read', 'attention.acknowledge', 'schedule.item.create'])
    });
  }

  function travel(key) {
    const algemeen = basis(key, 'travel', 'journey', 'Alle reizen', {});
    try {
      const beeld = kern.mijnReizen(key) || {};
      const reizen = (beeld.reizen || []).map(r => basis(key, 'travel', 'journey',
        r.bestemming || 'Reis', { journey: { domain: 'travel', type: 'journey', id: String(r.id) } }));
      return [algemeen].concat(reizen);
    } catch (e) { return [algemeen]; }
  }

  function voor(key, world) {
    const w = String(world || '').toLowerCase();
    if (w === 'travel') return travel(key);
    if (w === 'work') return [basis(key, w, 'workspace', 'Mijn werk', {})];
    if (w === 'foundation') return [basis(key, w, 'participant', 'Mijn ontwikkeling', {})];
    if (w === 'living') return [basis(key, w, 'person', 'Mijn leven', {})];
    return [];
  }

  function kies(key, world, gevraagd) {
    const lijst = voor(key, world);
    return lijst.find(c => c.id === gevraagd) || lijst[0] || null;
  }

  return { voor, kies };
};
