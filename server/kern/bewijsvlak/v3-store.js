'use strict';

const { hash, kopie, bevries } = require('./canon');

const COLLECTIONS = Object.freeze(['evidence', 'claims', 'decisions', 'conflicts', 'reconciliations']);
const DEFAULT_LIMITS = Object.freeze({ evidence: 50000, claims: 50000, decisions: 25000,
  conflicts: 10000, reconciliations: 25000 });

function limieten(input) {
  const i = input || {}, uit = {};
  for (const collection of COLLECTIONS) {
    const n = i[collection] == null ? DEFAULT_LIMITS[collection] : Number(i[collection]);
    if (!Number.isSafeInteger(n) || n < 1)
      throw new Error('bewijsvlak v3: ongeldige capaciteit ' + collection);
    uit[collection] = n;
  }
  return Object.freeze(uit);
}

function vol(collection, limit) {
  const fout = new Error('bewijsvlak v3: capaciteit bereikt voor ' + collection +
    '; archiveer de immutable historie voordat nieuw bewijs wordt toegelaten');
  fout.code = 'EVIDENCE_CAPACITY_REACHED';
  fout.collection = collection;
  fout.limit = limit;
  return fout;
}

function maakStore(opties) {
  const o = opties || {}, vasteState = o.state || {}, save = typeof o.save === 'function' ? o.save : () => {},
    limits = limieten(o.limits), transaction = o.transaction || null;
  const stateFor = typeof o.stateFor === 'function' ? o.stateFor : () => vasteState;
  function state() {
    const s = stateFor();
    if (!s || typeof s !== 'object') throw new Error('bewijsvlak v3: store-state ontbreekt');
    for (const k of COLLECTIONS) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    return s;
  }
  for (const k of COLLECTIONS) if (Object.keys(state()[k]).length > limits[k]) throw vol(k, limits[k]);

  function put(collection, id, record) {
    if (!COLLECTIONS.includes(collection)) throw new Error('bewijsvlak v3: onbekende collectie ' + collection);
    const doos = state()[collection], key = 'v3-store:' + collection + ':' + id;
    const gepland = transaction && transaction.pending(op => op.key === key)[0];
    const bestaand = gepland ? gepland.record : doos[id];
    if (bestaand) {
      if (hash(bestaand) !== hash(record)) throw new Error('bewijsvlak v3: immutable-recordconflict ' + id);
      return bevries(kopie(bestaand));
    }
    const pendingNew = transaction ? transaction.pending(op => op.type === 'v3-store' &&
      op.collection === collection && !op.replay).length : 0;
    if (Object.keys(doos).length + pendingNew >= limits[collection]) throw vol(collection, limits[collection]);
    const vast = bevries(kopie(record));
    if (transaction && transaction.active()) {
      let existed = false, previous;
      transaction.stage({ type: 'v3-store', collection, key, record: vast, replay: false,
        validate() {
          if (doos[id] && hash(doos[id]) !== hash(vast))
            throw new Error('bewijsvlak v3: immutable-recordconflict ' + id);
          if (!doos[id] && Object.keys(doos).length >= limits[collection]) throw vol(collection, limits[collection]);
        },
        apply() {
          if (doos[id] && hash(doos[id]) !== hash(vast))
            throw new Error('bewijsvlak v3: immutable-recordconflict ' + id);
          existed = Object.prototype.hasOwnProperty.call(doos, id); previous = doos[id];
          doos[id] = vast;
        },
        rollback() { if (existed) doos[id] = previous; else if (doos[id] === vast) delete doos[id]; }
      });
      return bevries(kopie(vast));
    }
    doos[id] = vast;
    try { save(); }
    catch (error) { if (doos[id] === vast) delete doos[id]; throw error; }
    return bevries(kopie(vast));
  }
  const get = (collection, id) => {
    const gepland = transaction && transaction.pending(op => op.key === 'v3-store:' + collection + ':' + id)[0];
    const record = gepland ? gepland.record : state()[collection][id];
    return record ? kopie(record) : null;
  };
  const list = collection => {
    const records = new Map(Object.entries(state()[collection]));
    if (transaction) for (const op of transaction.pending(x => x.type === 'v3-store' && x.collection === collection))
      records.set(op.key.slice(('v3-store:' + collection + ':').length), op.record);
    return [...records.values()].map(kopie);
  };
  const counts = () => Object.fromEntries(COLLECTIONS.map(k => [k, list(k).length]));
  return Object.freeze({ put, get, list, counts, capacity: () => Object.fromEntries(
    COLLECTIONS.map(k => [k, { used: Object.keys(state()[k]).length, limit: limits[k] }])) });
}

module.exports = { COLLECTIONS, DEFAULT_LIMITS, maakStore };
