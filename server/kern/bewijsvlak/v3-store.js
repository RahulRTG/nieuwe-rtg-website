'use strict';

const { hash, kopie, bevries } = require('./canon');

function maakStore(opties) {
  const o = opties || {}, state = o.state || {}, save = typeof o.save === 'function' ? o.save : () => {};
  for (const k of ['evidence', 'claims', 'decisions', 'conflicts', 'reconciliations'])
    if (!state[k] || typeof state[k] !== 'object') state[k] = {};

  function put(collection, id, record) {
    const doos = state[collection], bestaand = doos[id];
    if (bestaand) {
      if (hash(bestaand) !== hash(record)) throw new Error('bewijsvlak v3: immutable-recordconflict ' + id);
      return bevries(kopie(bestaand));
    }
    doos[id] = bevries(kopie(record)); save(); return bevries(kopie(record));
  }
  const get = (collection, id) => state[collection][id] ? kopie(state[collection][id]) : null;
  const list = collection => Object.values(state[collection]).map(kopie);
  return Object.freeze({ put, get, list, counts: () => Object.fromEntries(
    ['evidence', 'claims', 'decisions', 'conflicts', 'reconciliations'].map(k => [k, Object.keys(state[k]).length])) });
}

module.exports = { maakStore };
