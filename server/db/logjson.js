'use strict';
/* Onveranderlijke, vlakke auditregels hoeven niet bij iedere toevoeging opnieuw
   te worden gecodeerd. Alleen zulke regels krijgen een cache; gewone toestand,
   geneste waarden en getters blijven door de volledige JSON-encoder gaan.
   De uitvoer blijft dezelfde JSON-array, dus de opslagvorm verandert niet. */
const regels = new WeakMap();
const lijsten = new WeakMap();
const { isProxy } = require('node:util').types;
function vlak(v) {
  if (!v || isProxy(v) || Object.getPrototypeOf(v) !== Object.prototype || 'toJSON' in v) return false;
  return Object.values(Object.getOwnPropertyDescriptors(v)).every(d =>
    'value' in d && (d.value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof d.value)));
}
function borg(regel) {
  if (vlak(regel)) Object.freeze(regel);
  return regel;
}
function regelJson(r) {
  if (r && typeof r === 'object' && regels.has(r)) return regels.get(r);
  const tekst = JSON.stringify(r);
  if (r && typeof r === 'object' && Object.isFrozen(r) && vlak(r)) regels.set(r, tekst);
  return tekst === undefined ? 'null' : tekst;
}
function serialiseer(sleutel, waarde) {
  if (sleutel !== 'handelingLog' || !Array.isArray(waarde) || 'toJSON' in waarde || 'toJSON' in Object.prototype)
    return JSON.stringify(waarde);
  const oud = lijsten.get(waarde), delen = new Array(waarde.length);
  let gelijk = !!oud && oud.delen.length === waarde.length;
  for (let i = 0; i < waarde.length; i++) {
    delen[i] = regelJson(waarde[i]);
    if (gelijk && delen[i] !== oud.delen[i]) gelijk = false;
  }
  if (gelijk) return oud.tekst;
  const tekst = '[' + delen.join(',') + ']';
  lijsten.set(waarde, { delen, tekst });
  return tekst;
}
module.exports = { serialiseer, borg };
