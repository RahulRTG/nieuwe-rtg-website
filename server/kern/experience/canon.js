'use strict';

function orden(v) {
  if (Array.isArray(v)) return v.map(orden);
  if (!v || typeof v !== 'object') return v;
  const uit = {};
  Object.keys(v).sort().forEach(k => { uit[k] = orden(v[k]); });
  return uit;
}

const tekst = v => JSON.stringify(orden(v));
const hash = (crypto, v) => crypto.createHash('sha256').update(tekst(v)).digest('hex');
const kopie = v => v == null ? v : JSON.parse(JSON.stringify(v));

module.exports = { orden, tekst, hash, kopie };
