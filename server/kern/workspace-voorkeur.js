/* Alleen de COMPOSITIE van de Adaptive Workspace wordt bewaard. Brondata,
   formulierinhoud en sessiegeheimen horen bij hun eigen module en komen niet
   door deze grens. De scherpe vorm voorkomt dat een vrije JSON-instelling een
   tweede persoonlijk dossier wordt. */
'use strict';
const klok = require('../lib/klok');

const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX = 40;

function lijst(v, naam) {
  if (v == null) return [];
  if (!Array.isArray(v)) return { error: naam + ' moet een lijst zijn.', status: 400 };
  const uit = [], gezien = new Set();
  for (const ruw of v) {
    const id = String(ruw || '').trim();
    if (!ID.test(id)) return { error: 'Ongeldig module-id in ' + naam + '.', status: 400 };
    if (!gezien.has(id)) { gezien.add(id); uit.push(id); }
    if (uit.length > MAX) return { error: 'Een werkruimte bevat maximaal ' + MAX + ' modules.', status: 400 };
  }
  return uit;
}

function normaliseerWorkspace(invoer, op) {
  const x = invoer && typeof invoer === 'object' && !Array.isArray(invoer) ? invoer : {};
  const order = lijst(x.order, 'order'); if (order.error) return order;
  const hidden = lijst(x.hidden, 'hidden'); if (hidden.error) return hidden;
  const actief = x.active == null || x.active === '' ? null : String(x.active);
  if (actief && !ID.test(actief)) return { error: 'Ongeldige actieve module.', status: 400 };
  if (actief && order.length && !order.includes(actief)) return { error: 'De actieve module staat niet in de werkruimte.', status: 400 };
  if (actief && hidden.includes(actief)) return { error: 'Een verborgen module kan niet actief zijn.', status: 400 };
  return { version: 2, order, hidden: hidden.filter(id => !order.length || order.includes(id)), active: actief,
    density: x.density === 'compact' ? 'compact' : 'comfortable', updatedAt: op || null };
}

function scopeNaam(scope) {
  return scope == null || scope === '' ? 'default' :
    ['living', 'travel', 'work', 'foundation'].includes(scope) ? scope : null;
}
function lees(md, scope) {
  const key = scopeNaam(scope);
  if (!key) return { status: 400, error: 'Onbekende werkruimte.' };
  const opgeslagen = md && md.interface && (key === 'default' ? md.interface.workspace :
    md.interface.worldWorkspaces && md.interface.worldWorkspaces[key]);
  const w = normaliseerWorkspace(opgeslagen || {}, opgeslagen && opgeslagen.updatedAt);
  return w.error ? normaliseerWorkspace({}, null) : w;
}

function zet(md, invoer, op, scope) {
  const key = scopeNaam(scope);
  if (!key) return { status: 400, error: 'Onbekende werkruimte.' };
  const w = normaliseerWorkspace(invoer, op || klok.datum().toISOString());
  if (w.error) return w;
  if (!md.interface || typeof md.interface !== 'object' || Array.isArray(md.interface)) md.interface = {};
  if (key === 'default') md.interface.workspace = w;
  else {
    if (!md.interface.worldWorkspaces) md.interface.worldWorkspaces = {};
    md.interface.worldWorkspaces[key] = w;
  }
  return w;
}

module.exports = { normaliseer: normaliseerWorkspace, lees, zet, ID, MAX };
