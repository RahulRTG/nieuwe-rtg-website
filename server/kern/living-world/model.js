'use strict';
const { createHash } = require('node:crypto');
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fail(message, status = 400, code = 'INVALID_INPUT') {
  throw Object.assign(new Error(message), { status, code, livingWorld: true });
}
function text(value, max = 600, required = false) {
  if (value != null && typeof value !== 'string') fail('Tekst verwacht.');
  const s = (value || '').trim();
  if (s.length > max || (required && !s)) fail('Vul de tekst volledig in (maximaal ' + max + ' tekens).');
  return s;
}
function date(value, required = true) {
  if (!value && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) fail('Kies een datum en tijd.');
  const d = new Date(value);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,19) !== value.slice(0,19)) fail('Ongeldige datum.');
  return d.toISOString();
}
function list(value, max, clean) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) fail('Te veel onderdelen.');
  return value.map(clean);
}
function get(state, type, id) {
  const row = state[type] && Object.hasOwn(state[type],String(id || '')) && state[type][String(id || '')];
  if (!row) fail('Dit onderdeel is niet beschikbaar.', 404, 'NOT_FOUND');
  return row;
}
function version(row, expected) {
  if (!Number.isInteger(expected) || row.revision !== expected)
    fail('Dit onderdeel is gewijzigd. Open de nieuwste versie; uw invoer blijft staan.', 409, 'STALE_VERSION');
}
const owner = (row, key) => row.owner === key;
const visible = (row, key) => owner(row, key) || row.status === 'published';
const snapshot = b => b.versions.find(v => v.version === b.version);
const activeKnowledge = (c, at, state) => c.status === 'accepted' && (!c.validUntil || c.validUntil > at)
  && (!c.planId || !state || !!(state.plans[c.planId] && state.plans[c.planId].acknowledgedAt
    && state.plans[c.planId].participation && !state.plans[c.planId].participation.revokedAt));
function knowledgeVisible(c, key, state) {
  const place = state && state.places && state.places[c.placeId];
  const visibility = c.sharing && c.sharing.visibility || 'private';
  return c.owner === key || place && place.owner === key || visibility === 'community';
}
function selectKnowledge(state, placeId, ids, at, key) {
  return [...new Set(list(ids,50,id=>text(id,80,true)))].map(id=>{
    const c = get(state,'contributions',id);
    if (c.placeId !== placeId || !activeKnowledge(c,at,state) || !knowledgeVisible(c,key,state))
      fail('Deze kennis is gewijzigd of niet beschikbaar.',409,'KNOWLEDGE_CHANGED');
    return {id:c.id,revision:c.revision};
  });
}
const ref = (type, id) => ({ domain: 'living-world', type, id });
const href = (type, id) => '/apps/living-world.html?' + type + '=' + encodeURIComponent(id);
const STEPS = Object.freeze({
  learn: ['Voorbereiding', '/apps/rtgschool.html'],
  travel: ['Reis', '/apps/reisbureau.html'], stay: ['Verblijf', '/apps/hotels.html'],
  community: ['Community', '/apps/genootschap.html'], crew: ['Reisgezelschap', '/apps/reizen.html#samen'],
  provider: ['Aanbieder', '/apps/mall.html'], equipment: ['Uitrusting', '/apps/mall.html'],
  organize: ['Organiseren', '/apps/genootschap.html'], capture: ['Vastleggen', '/apps/media.html'],
  story: ['Verhaal maken', '/apps/media.html']
});
function blueprint(value) {
  const b = value || {};
  return { title: text(b.title, 120, true), summary: text(b.summary, 1200, true),
    activity: text(b.activity, 80, true), route: text(b.route, 1600), season: text(b.season, 200),
    equipment: text(b.equipment, 800), transport: text(b.transport, 800), crew: text(b.crew, 800),
    requirements: list(b.requirements, 12, r => text(r, 240, true)),
    steps: list(b.steps, 20, s => {
      if (!s || !STEPS[s.kind]) fail('Onbekende voorbereidingsstap.');
      return { kind: s.kind, text: text(s.text, 500, true) };
    }), mediaRef: text(b.mediaRef, 120), remixAllowed: b.remixAllowed === true };
}
function empty() {
  return { places: {}, blueprints: {}, plans: {}, contributions: {}, receipts: {}, history: [], delivery:{},
    returnOperations:{},returns:{} };
}
module.exports = { clone, hash, fail, text, date, list, get, version, owner, visible, snapshot,
  activeKnowledge, knowledgeVisible, selectKnowledge, ref, href, STEPS, blueprint, empty };
