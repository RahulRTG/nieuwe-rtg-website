/* Partnerdeelname aan Connection OS.

   Een algemene schakelaar voor reserveringen is geen toestemming om als
   dateplek, Society-locatie of conciergepartner te worden ingezet. Deze laag
   houdt die besluiten daarom per programma en per locatie uit elkaar.

   Afwezig is UIT. Dat is bewust fail-closed: een bestaande of nieuwe partner
   verschijnt pas in een Connection-flow nadat een manager daar uitdrukkelijk
   voor heeft gekozen. Een wijziging raakt alleen nieuwe voorstellen; reeds
   opgeslagen reserveringen worden hier nooit aangepast. */
'use strict';

const PROGRAMS = Object.freeze({
  vonk: Object.freeze({ id: 'vonk', label: 'Vonk-dates', services: ['koffie', 'borrel', 'diner'], reservation: true }),
  rendezvous: Object.freeze({ id: 'rendezvous', label: 'Rendez-vous-arrangementen', services: ['diner', 'borrel', 'cultuur'], reservation: false }),
  table: Object.freeze({ id: 'table', label: 'The Table', services: ['diner', 'borrel'], reservation: true }),
  concierge: Object.freeze({ id: 'concierge', label: 'Concierge', services: ['diner', 'borrel', 'cultuur', 'verblijf', 'vervoer', 'activiteit'], reservation: false })
});
const DAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const bool = v => v === true;
const time = (v, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : fallback;
const date = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
const number = (v, fallback, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

function locations(supplier) {
  const out = [];
  if (supplier && supplier.loc) out.push({ id: 'primary', label: supplier.loc.label || supplier.city || supplier.name || 'Hoofdlocatie' });
  for (const l of (supplier && Array.isArray(supplier.locations) ? supplier.locations : [])) {
    const id = String(l && l.id || '').trim();
    if (id && !out.some(x => x.id === id)) out.push({ id, label: String(l.label || l.name || id).slice(0, 100) });
  }
  return out;
}

function defaultProgram(id) {
  return { enabled: false, locations: [], services: [], days: DAYS.slice(), from: '00:00', to: '23:59', maxPerSlot: 1, pausedUntil: '' };
}

function stored(supplier, id) {
  const raw = supplier && supplier.settings && supplier.settings.connectionParticipation;
  const p = raw && raw.programs && raw.programs[id];
  const def = PROGRAMS[id];
  if (!def || !p || typeof p !== 'object') return defaultProgram(id);
  const knownLocations = new Set(locations(supplier).map(x => x.id));
  return {
    enabled: bool(p.enabled),
    locations: (Array.isArray(p.locations) ? p.locations : []).map(String).filter((x, i, a) => knownLocations.has(x) && a.indexOf(x) === i),
    services: (Array.isArray(p.services) ? p.services : []).map(String).filter((x, i, a) => def.services.includes(x) && a.indexOf(x) === i),
    days: (Array.isArray(p.days) ? p.days : DAYS).map(Number).filter((x, i, a) => DAYS.includes(x) && a.indexOf(x) === i),
    from: time(p.from, '00:00'), to: time(p.to, '23:59'),
    maxPerSlot: number(p.maxPerSlot, 1, 1, 100),
    pausedUntil: date(p.pausedUntil)
  };
}

function project(supplier) {
  return {
    version: 1,
    default: 'off',
    locations: locations(supplier),
    programs: Object.values(PROGRAMS).map(def => ({ ...def, ...stored(supplier, def.id), servicesAvailable: def.services.slice() }))
  };
}

function update(supplier, input) {
  if (!supplier || !input || typeof input !== 'object' || !input.programs || typeof input.programs !== 'object') return [];
  supplier.settings = supplier.settings || { ordersOpen: true, reservationsOpen: true };
  const root = supplier.settings.connectionParticipation = supplier.settings.connectionParticipation || { version: 1, programs: {} };
  root.version = 1; root.programs = root.programs || {};
  const changed = [];
  for (const id of Object.keys(PROGRAMS)) {
    if (!own(input.programs, id) || !input.programs[id] || typeof input.programs[id] !== 'object') continue;
    const before = stored(supplier, id), patch = input.programs[id];
    const merged = { ...before };
    if (typeof patch.enabled === 'boolean') merged.enabled = patch.enabled;
    if (Array.isArray(patch.locations)) merged.locations = patch.locations;
    if (Array.isArray(patch.services)) merged.services = patch.services;
    if (Array.isArray(patch.days)) merged.days = patch.days;
    if (own(patch, 'from')) merged.from = patch.from;
    if (own(patch, 'to')) merged.to = patch.to;
    if (own(patch, 'maxPerSlot')) merged.maxPerSlot = patch.maxPerSlot;
    if (own(patch, 'pausedUntil')) merged.pausedUntil = patch.pausedUntil;
    root.programs[id] = merged;
    root.programs[id] = stored(supplier, id);
    if (JSON.stringify(before) !== JSON.stringify(root.programs[id])) changed.push(PROGRAMS[id].label);
  }
  return changed;
}

function withinTime(now, from, to) {
  if (!now) return true;
  if (from <= to) return now >= from && now <= to;
  return now >= from || now <= to; // een nachtvenster, bijv. 22:00-02:00
}

function eligible(supplier, program, context = {}) {
  const def = PROGRAMS[program];
  if (!def || !supplier) return { ok: false, reason: 'UNKNOWN_PROGRAM' };
  if (supplier.partnerStatus === 'geschorst' || supplier.partnerStatus === 'beeindigd' || supplier.online === false)
    return { ok: false, reason: 'PARTNER_INACTIVE' };
  const p = stored(supplier, program);
  if (!p.enabled) return { ok: false, reason: 'NOT_OPTED_IN' };
  const locationId = String(context.locationId || 'primary');
  if (!p.locations.includes(locationId)) return { ok: false, reason: 'LOCATION_NOT_OPTED_IN' };
  if (p.pausedUntil && p.pausedUntil >= String(context.today || new Date().toISOString().slice(0, 10)))
    return { ok: false, reason: 'PAUSED' };
  if (!supplier.loc || !Number.isFinite(supplier.loc.lat) || !Number.isFinite(supplier.loc.lng))
    return { ok: false, reason: 'NO_LOCATION' };
  if (def.reservation && supplier.settings && supplier.settings.reservationsOpen === false)
    return { ok: false, reason: 'RESERVATIONS_CLOSED' };
  if (def.reservation && !(supplier.tables || []).length) return { ok: false, reason: 'NO_TABLES' };
  if (context.service && !p.services.includes(String(context.service))) return { ok: false, reason: 'SERVICE_NOT_OPTED_IN' };
  if (context.date) {
    const d = date(context.date);
    if (!d || !p.days.includes(new Date(d + 'T12:00:00Z').getUTCDay())) return { ok: false, reason: 'DAY_NOT_AVAILABLE' };
  }
  if (context.time && !withinTime(String(context.time), p.from, p.to)) return { ok: false, reason: 'TIME_NOT_AVAILABLE' };
  const active = Number(context.activeBookings || 0);
  if (Number.isFinite(active) && active >= p.maxPerSlot) return { ok: false, reason: 'PROGRAM_CAPACITY_REACHED' };
  return { ok: true, program, participation: p };
}

function activeBookings(bookings, supplierCode, dateValue, timeValue) {
  if (!dateValue || !timeValue) return 0;
  return (Array.isArray(bookings) ? bookings : []).filter(r => r && r.supplierCode === supplierCode &&
    r.datum === dateValue && r.tijd === timeValue && ['aangevraagd', 'bevestigd'].includes(r.status)).length;
}

function candidates(suppliers, program, context = {}) {
  return Object.values(suppliers || {}).filter(s => (!context.city || String(s.city || '').toLowerCase() === String(context.city).toLowerCase()) && eligible(s, program, {
    ...context, activeBookings: activeBookings(context.bookings, s.code, context.date, context.time)
  }).ok);
}

module.exports = { PROGRAMS, DAYS, locations, stored, project, update, eligible, candidates, activeBookings };
