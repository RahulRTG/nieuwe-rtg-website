'use strict';

const STATUS = Object.freeze({ BEKEND: 'bekend', ONBEKEND: 'onbekend',
  CONFLICT: 'conflict', NIET_GEVRAAGD: 'niet-gevraagd', NIET_BEOORDEELD: 'niet-beoordeeld' });
const tekst = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const code = (v) => tekst(v, 160).toUpperCase();

function diepBevries(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  for (const x of Object.values(v)) diepBevries(x);
  return Object.freeze(v);
}

function contextRef(kind, id, source, extra) {
  return Object.assign({ kind, id: tekst(id, 160), source }, extra || {});
}

function bronLees(fn, args) {
  if (typeof fn !== 'function') return { ok: false, reason: 'bron-niet-aangesloten' };
  try {
    const value = fn.apply(null, args || []);
    if (value && typeof value.then === 'function') return { ok: false, reason: 'asynchrone-bron-niet-ondersteund' };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, reason: 'bron-onbeschikbaar' };
  }
}

module.exports = { STATUS, tekst, code, diepBevries, contextRef, bronLees };
