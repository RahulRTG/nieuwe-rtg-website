'use strict';
const { createHash } = require('node:crypto');
const clone = value => JSON.parse(JSON.stringify(value));
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
function fail(code, message, status = 400) {
  throw Object.assign(new Error(message), { library: true, code, status });
}
function text(v, max = 500, required = true) {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    fail('INVALID_INPUT', 'Ongeldige of te lange tekst.');
  return v.trim();
}
function fields(v, allowed) {
  if (!v || typeof v !== 'object' || Array.isArray(v) ||
      Object.keys(v).some(k => !allowed.includes(k))) fail('INVALID_INPUT', 'Onbekende invoervelden.');
}
function list(v, clean, max = 40) {
  if (!Array.isArray(v) || v.length > max) fail('INVALID_INPUT', 'Ongeldige lijst.');
  return v.map(clean);
}
const strings = (v, max = 40) => [...new Set(list(v, x => text(x, 160), max))];
function date(v) {
  if (v === null) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) ||
      !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail('INVALID_INPUT', 'Gebruik een geldige UTC-datum.');
  return v;
}
function get(map, id) {
  if (typeof id !== 'string' || !Object.hasOwn(map, id)) fail('NOT_FOUND', 'Dit onderdeel is niet beschikbaar.', 404);
  return map[id];
}
function version(w, expected) {
  if (!Number.isSafeInteger(expected) || expected !== w.revision)
    fail('STALE_REVISION', 'Open de actuele werkrevisie.', 409);
}
function empty() { return { schemaVersion: 2, works: {}, receipts: {}, journal: [], delivery: {} }; }
function state(raw) {
  if (Object.keys(raw).length === 0) return empty();
  if (![1, 2].includes(raw.schemaVersion) || !raw.works || !raw.receipts || !Array.isArray(raw.journal) || !raw.delivery)
    fail('SCHEMA_UNAVAILABLE', 'De Library-opslag heeft een onbekende versie.', 503);
  const s = clone(raw);
  if (s.schemaVersion === 1) {
    for (const w of Object.values(s.works)) {
      w.structure = Object.keys(w.nodes || {}).sort();
      w.feedback = {};
    }
    s.schemaVersion = 2;
  }
  return s;
}
const POLICY = Object.freeze({ id: 'library.kernel', version: 1,
  rules: ['no-implicit-ip-transfer', 'credit-is-not-authority', 'edition-bound-consent', 'check-at-commit'] });
module.exports = { clone, canonical, hash, fail, text, fields, list, strings, date, get, version, empty, state, POLICY };
