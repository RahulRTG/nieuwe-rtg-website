/* PersonalOS bewaart alleen vrijwillige compositievoorkeuren. Leeftijd,
   diagnoses, schulden, dossiers en bevoegdheden horen hier nadrukkelijk niet. */
'use strict';

const SCHEMA_VERSION = 1;
const GOALS = Object.freeze([
  'dagelijks_leven', 'reizen', 'talent_ontwikkelen', 'ondernemen',
  'werken_en_leren', 'ondersteuning', 'bijdragen'
]);
const LAYOUTS = Object.freeze(['simple', 'balanced', 'advanced']);
const WORLDS = Object.freeze(['livingos', 'travelos', 'workos', 'foundationos']);

function strings(waarde, toegestaan, max) {
  if (waarde == null) return [];
  if (!Array.isArray(waarde)) return null;
  const uit = [];
  for (const ruw of waarde) {
    const v = String(ruw || '').trim();
    if (!toegestaan.has(v)) return null;
    if (!uit.includes(v)) uit.push(v);
    if (uit.length > max) return null;
  }
  return uit;
}

function normaliseer(body, capabilityIds) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const ids = new Set(capabilityIds || []);
  const doelen = strings(b.goals, new Set(GOALS), GOALS.length);
  const pinned = strings(b.pinnedCapabilities, ids, 24);
  const hidden = strings(b.hiddenSuggestions, ids, 48);
  const worldOrder = strings(b.worldOrder, new Set(WORLDS), WORLDS.length);
  if (!doelen || !pinned || !hidden || !worldOrder)
    return { error: 'De PersonalOS-voorkeuren bevatten een onbekende of ongeldige keuze.', status: 400 };
  if (pinned.some(id => hidden.includes(id)))
    return { error: 'Een vastgezette functie kan niet tegelijk als suggestie verborgen zijn.', status: 400 };
  const layout = b.layout == null ? 'balanced' : String(b.layout);
  if (!LAYOUTS.includes(layout)) return { error: 'Onbekende weergave.', status: 400 };
  const automatisch = b.worldOrderMode === 'auto' || !Array.isArray(b.worldOrder) || !b.worldOrder.length;
  return {
    schemaVersion: SCHEMA_VERSION,
    goals: doelen,
    pinnedCapabilities: pinned,
    hiddenSuggestions: hidden,
    worldOrder: worldOrder.length ? worldOrder.concat(WORLDS.filter(x => !worldOrder.includes(x))) : [...WORLDS],
    worldOrderMode: automatisch ? 'auto' : 'manual',
    layout
  };
}

module.exports = { SCHEMA_VERSION, GOALS, LAYOUTS, WORLDS, normaliseer };
