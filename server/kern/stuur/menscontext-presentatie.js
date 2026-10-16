'use strict';

const werkruimteModi = Object.freeze(['peek', 'panel', 'workspace', 'focus']);
const assistentSoorten = Object.freeze(['read', 'search', 'open', 'propose']);
const actiePatroon = /^[a-z][a-z0-9]*(?:\.[a-z0-9-]+)+$/;

function sleutel(x, max) {
  if (typeof x !== 'string') return '';
  return /^[a-z][a-z0-9-]*$/.test(x) ? x.slice(0, max) : '';
}

function saneerWerkruimte(raw, gewist) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const uit = { id: sleutel(raw.id, 40),
    modus: werkruimteModi.includes(raw.modus) ? raw.modus : '', module: sleutel(raw.module, 40) };
  for (const k of Object.keys(raw)) if (!['id', 'modus', 'module'].includes(k))
    gewist.push({ sleutel: 'werkruimte.' + k, reden: 'staat niet op de positieve Workspace-lijst' });
  return uit.id || uit.modus || uit.module ? uit : null;
}

function saneerAssistent(raw, gewist) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const module = sleutel(raw.module, 40), mogelijkheden = [];
  for (const k of Object.keys(raw)) if (!['module', 'mogelijkheden'].includes(k))
    gewist.push({ sleutel: 'assistent.' + k, reden: 'staat niet op de positieve assistentlijst' });
  (Array.isArray(raw.mogelijkheden) ? raw.mogelijkheden : []).slice(0, 8).forEach((rij, i) => {
    if (!rij || typeof rij !== 'object' || Array.isArray(rij)) return;
    for (const k of Object.keys(rij)) if (!['id', 'soort'].includes(k))
      gewist.push({ sleutel: 'assistent.mogelijkheden.' + i + '.' + k, reden: 'geen declaratief assistentveld' });
    const id = typeof rij.id === 'string' && actiePatroon.test(rij.id) ? rij.id : '';
    const soort = assistentSoorten.includes(rij.soort) ? rij.soort : '';
    if (id && soort && !mogelijkheden.some((m) => m.id === id)) mogelijkheden.push({ id, soort });
    else if (rij.id || rij.soort) gewist.push({ sleutel: 'assistent.mogelijkheden.' + i,
      reden: 'actie-id of assistenttype is ongeldig' });
  });
  return module && mogelijkheden.length ? { module, mogelijkheden } : null;
}

module.exports = { saneerWerkruimte, saneerAssistent };
