'use strict';

const { createHash } = require('node:crypto');

const clone = value => JSON.parse(JSON.stringify(value));

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

const hash = value => createHash('sha256').update(canonical(value)).digest('hex');

function fail(code, message, status = 400) {
  throw Object.assign(new Error(message), { loopFabric: true, code, status });
}

function text(value, max = 500, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail('INVALID_INPUT', 'Ongeldige of te lange tekst.');
  return value.trim();
}

function instant(value, field = 'tijdstip') {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)
    fail('INVALID_TIME', 'Gebruik voor ' + field + ' een exact UTC-tijdstip.');
  return value;
}

function objectRef(value, options = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('INVALID_REF', 'Een bronverwijzing ontbreekt.');
  const allowed = ['domain', 'type', 'id', 'version'];
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('INVALID_REF', 'Onbekend veld in bronverwijzing.');
  const ref = {
    domain: text(value.domain, 60), type: text(value.type, 60), id: text(value.id, 160),
    version: value.version === undefined || value.version === null ? null
      : (typeof value.version === 'number' && Number.isSafeInteger(value.version)
        ? value.version : text(String(value.version), 160))
  };
  if (options.versioned !== false && ref.version === null)
    fail('VERSION_REQUIRED', 'Deze overdracht vereist een exacte bronversie.');
  return ref;
}

const refKey = ref => [ref.domain, ref.type, ref.id, ref.version === null ? '-' : ref.version].join(':');

function operationId(value) {
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(String(value || '')))
    fail('OPERATION_REQUIRED', 'Een geldige operatie-ID is vereist.', 428);
  return String(value);
}

function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key)))
    fail('INVALID_INPUT', 'Onbekende of ongeldige invoervelden.');
}

function error(error) {
  if (error && error.loopFabric) return { error: error.message, status: error.status, code: error.code };
  return { error: 'De opslag heeft de uitkomst niet bevestigd. Herhaal dezelfde operatie-ID.',
    status: 503, code: 'OUTCOME_UNKNOWN' };
}

module.exports = { clone, canonical, hash, fail, text, instant, objectRef, refKey,
  operationId, fields, error };
