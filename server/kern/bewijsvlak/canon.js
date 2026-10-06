'use strict';

const crypto = require('crypto');

function sorteer(waarde) {
  if (Array.isArray(waarde)) return waarde.map(sorteer);
  if (!waarde || typeof waarde !== 'object') return waarde;
  const uit = {};
  for (const sleutel of Object.keys(waarde).sort()) uit[sleutel] = sorteer(waarde[sleutel]);
  return uit;
}

function canon(waarde) { return JSON.stringify(sorteer(waarde)); }
function hash(waarde) { return crypto.createHash('sha256').update(canon(waarde)).digest('hex'); }
function id(voorvoegsel, waarde) { return voorvoegsel + '_' + hash(waarde).slice(0, 24); }
function kopie(waarde) { return waarde == null ? waarde : JSON.parse(JSON.stringify(waarde)); }

function bevries(waarde) {
  if (!waarde || typeof waarde !== 'object' || Object.isFrozen(waarde)) return waarde;
  Object.values(waarde).forEach(bevries);
  return Object.freeze(waarde);
}

module.exports = { sorteer, canon, hash, id, kopie, bevries };
