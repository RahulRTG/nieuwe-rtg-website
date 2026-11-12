'use strict';
/* Alleen owner-gecertificeerde onveranderlijke JSON-subtrees mogen hun bytes
   hergebruiken. Geen merk of toJSON op domeinobjecten; geladen JSON is nooit
   vanzelf gecertificeerd. Een onbekende vorm gebruikt de oorspronkelijke
   native serializer, zonder vooraf getters/proxytraps/toJSON uit te voeren. */
const { isProxy, isBoxedPrimitive } = require('node:util').types;
const fragmenten = new WeakMap();
const TERUG = Symbol('native-json');

function gewonePrototypes() {
  return Object.getPrototypeOf(Object.prototype) === null &&
    Object.getPrototypeOf(Array.prototype) === Object.prototype &&
    !Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON') &&
    !Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
}
function vorm(v) {
  if (!v || typeof v !== 'object' || isProxy(v) || isBoxedPrimitive(v) ||
      (typeof JSON.isRawJSON === 'function' && JSON.isRawJSON(v))) return null;
  const p = Object.getPrototypeOf(v), lijst = Array.isArray(v);
  if (lijst ? p !== Array.prototype : p !== Object.prototype && p !== null) return null;
  if (Object.getOwnPropertyDescriptor(v, 'toJSON')) return null;
  return lijst ? 'lijst' : 'kaart';
}
function descriptor(v, k) {
  const d = Object.getOwnPropertyDescriptor(v, k);
  return d && Object.hasOwn(d, 'value') ? d : null;
}

function certifieer(v) {
  if (!gewonePrototypes() || !v || typeof v !== 'object') return false;
  if (fragmenten.has(v)) return true;
  let budget = 4096;
  const pad = new Set();
  function veilig(x, diepte) {
    if (--budget < 0 || diepte > 64) return false;
    if (x === null || ['string', 'number', 'boolean'].includes(typeof x)) return true;
    const type = vorm(x);
    if (!type || !Object.isFrozen(x) || pad.has(x)) return false;
    pad.add(x);
    if (type === 'lijst' && x.length > budget) return false;
    const keys = type === 'lijst' ? Array.from({ length: x.length }, (_, i) => String(i)) : Object.keys(x);
    if (keys.length > budget) return false;
    for (const k of keys) {
      const d = descriptor(x, k);
      if (!d || !veilig(d.value, diepte + 1)) return false;
    }
    pad.delete(x);
    return true;
  }
  // Een cache is geen nieuwe validatiepoort voor een domeinwrite.
  try {
    if (!veilig(v, 0)) return false;
    fragmenten.set(v, JSON.stringify(v));
    return true;
  } catch (_) { return false; }
}

function serialiseer(waarde, ruw = v => v) {
  const wortel = ruw(waarde);
  if (!gewonePrototypes()) return JSON.stringify(wortel);
  let budget = 512;
  const pad = new Set();
  function tekst(invoer, diepte) {
    // Alleen de root was ook vóór deze optimalisatie onthuld. Een geneste
    // trackerproxy behoudt zijn get-semantiek via volledige native fallback.
    const v = invoer;
    const vast = v && typeof v === 'object' ? fragmenten.get(v) : undefined;
    if (vast !== undefined) return vast;
    if (--budget < 0 || diepte > 64) return TERUG;
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) return JSON.stringify(v);
    // BigInt/toJSON, undefined en andere exotische waarden: native HELE root.
    const type = vorm(v);
    if (!type || pad.has(v)) return TERUG;
    pad.add(v);
    const delen = [];
    if (type === 'lijst') {
      for (let i = 0; i < v.length; i++) {
        const d = descriptor(v, String(i));
        if (!d) return TERUG; // gaten of accessors, zonder ze te lezen
        const t = tekst(d.value, diepte + 1);
        if (t === TERUG) return TERUG;
        delen.push(t);
      }
    } else {
      for (const k of Object.keys(v)) {
        const d = descriptor(v, k);
        if (!d) return TERUG;
        const t = tekst(d.value, diepte + 1);
        if (t === TERUG) return TERUG;
        delen.push(JSON.stringify(k) + ':' + t);
      }
    }
    pad.delete(v);
    return type === 'lijst' ? '[' + delen.join(',') + ']' : '{' + delen.join(',') + '}';
  }
  const uit = tekst(wortel, 0);
  return uit === TERUG ? JSON.stringify(wortel) : uit;
}

module.exports = { certifieer, serialiseer };
