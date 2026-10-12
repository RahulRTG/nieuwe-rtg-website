/* DE DUURZAME IDEM-RING: de idempotentie-opslag die server.js aan de betaal- en
   de munt-naad koppelt (server/betaal.js en server/muntbetaal.js, koppelStore).
   Dezelfde idempotentiesleutel geeft ook NA een herstart hetzelfde resultaat
   terug, zodat een netwerk-herhaling of dubbeltik nooit dubbel afschrijft. De
   sleutelvolgorde staat in `_keys`, begrensd als FIFO-ring.

   Een sleutel is een sleutel en geen eigenschapsnaam: `Object.hasOwn` en geen
   `in` (dat leest het prototype), en de twee namen die de opslag zelf draagt
   -- `_keys` en `__proto__` -- worden geweigerd. Bij het OPZOEKEN, want de
   naad zoekt op voordat hij de aanbieder belt: zo beweegt er geen geld onder
   een sleutel die nooit als herhaling herkend zou worden. De naad geeft de
   sleutel van de aanroeper ongewijzigd door (betaal-connect.js, ontvangst.js),
   dus deze grens hoort hier en niet bij elke aanroeper.
   Zie test/idemring.test.js; dezelfde regel voor ./idem.js staat in
   test/idem-sleutelnaam.test.js. */
'use strict';

const GERESERVEERD = new Set(['_keys', '__proto__']);

function weiger(k) {
  if (GERESERVEERD.has(k)) throw new Error('Ongeldige idempotentiesleutel: ' + k + ' is gereserveerd.');
}

module.exports = function maakIdemRing({ data, naam, max = 50000, save }) {
  const bak = () => {
    const d = data();
    if (!d[naam] || typeof d[naam] !== 'object') d[naam] = { _keys: [] };
    if (!Array.isArray(d[naam]._keys)) d[naam]._keys = [];
    return d[naam];
  };
  bak();
  return {
    get(k) {
      weiger(k);
      const s = bak();
      return Object.hasOwn(s, k) ? s[k] : undefined;
    },
    set(k, v) {
      weiger(k);
      const s = bak();
      if (!Object.hasOwn(s, k)) {
        s._keys.push(k);
        if (s._keys.length > max) for (const weg of s._keys.splice(0, s._keys.length - max)) delete s[weg];
      }
      s[k] = v;
      try { save(); } catch (e) { /* het geheugen-resultaat blijft geldig */ }
    }
  };
};
