/* De deterministische samensteller. Geen model, geen geheime mensscore en geen
   toegangsmutatie: alleen een stabiele presentatie van reeds toegestane apps. */
'use strict';

const GOAL_CAPABILITIES = Object.freeze({
  dagelijks_leven: ['leven', 'berichten', 'sociaal', 'geldcommand'],
  reizen: ['reizen', 'ov', 'flits'],
  talent_ontwikkelen: ['connect', 'library', 'podium'],
  ondernemen: ['onderneming', 'werkos', 'commerce'],
  werken_en_leren: ['loopbaan', 'werkos', 'connect'],
  ondersteuning: ['foundationzorg', 'leven', 'berichten'],
  bijdragen: ['connect', 'podium', 'sociaal']
});

function maak({ catalog, preferences, contextRef, subjectRef, authorityRevision, catalogVersion, now, hash }) {
  const p = preferences;
  const perId = new Map(catalog.map(x => [x.id, x]));
  const punten = new Map(catalog.map((x, i) => [x.id, 1000 - i]));
  const prioriteit = new Map(catalog.map(x => [x.id, 0]));
  const reasons = new Map(catalog.map(x => [x.id, 'available']));
  for (const doel of p.goals) for (const id of GOAL_CAPABILITIES[doel] || []) if (perId.has(id)) {
    punten.set(id, (punten.get(id) || 0) + 10000);
    prioriteit.set(id, (prioriteit.get(id) || 0) + 10);
    reasons.set(id, 'active_goal');
  }
  for (const id of p.pinnedCapabilities) if (perId.has(id)) {
    punten.set(id, (punten.get(id) || 0) + 100000);
    prioriteit.set(id, (prioriteit.get(id) || 0) + 100);
    reasons.set(id, 'user_selected');
  }
  const verborgen = new Set(p.hiddenSuggestions);
  const volgorde = [...catalog].sort((a, b) => (punten.get(b.id) - punten.get(a.id)) || a.id.localeCompare(b.id));
  const worldOrder = [...p.worldOrder];
  if (p.worldOrderMode === 'auto') worldOrder.sort((a, b) => {
    const score = world => catalog.filter(c => c.world === world && !verborgen.has(c.id))
      .reduce((som, c) => som + (prioriteit.get(c.id) || 0), 0);
    return score(b) - score(a) || p.worldOrder.indexOf(a) - p.worldOrder.indexOf(b);
  });
  const worlds = worldOrder.map(world => ({
    id: world,
    capabilities: volgorde.filter(c => c.world === world && !verborgen.has(c.id)).map(c => ({
      id: c.id, name: c.name, url: c.url, reason: reasons.get(c.id)
    }))
  })).filter(w => w.capabilities.length);
  const basis = { schemaVersion: 1, subjectRef, contextRef, catalogVersion,
    preferenceVersion: p.revision || 0, authorityRevision, layout: p.layout,
    goals: [...p.goals], worlds, availableCatalog: true, catalogComplete: false };
  return { ...basis, compositionVersion: 'c_' + hash(JSON.stringify(basis)).slice(0, 16), generatedAt: now() };
}

module.exports = { GOAL_CAPABILITIES, maak };
