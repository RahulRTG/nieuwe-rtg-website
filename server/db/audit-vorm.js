'use strict';
/* Alleen de twee bestaande auditvormen. Domeinmodules blijven eigenaar van
   hashes, actoren en betekenis; de opslag kent uitsluitend volgorde en teller. */
const vormen = Object.freeze({
  handelingLog: { omgekeerd: true, max: 50000 },
  apiSpoor: { omgekeerd: false, max: 5000 }
});
function eis(naam) { if (!Object.hasOwn(vormen, naam)) throw new Error('Onbekend auditjournaal.'); return vormen[naam]; }
const rijen = (naam, waarde) => naam === 'handelingLog' ? (Array.isArray(waarde) ? waarde : [])
  : (Array.isArray(waarde?.commandJournaal) ? waarde.commandJournaal : []);
const extra = (naam, waarde) => {
  if (naam === 'handelingLog') return {};
  const uit = { ...(waarde || {}) }; delete uit.commandJournaal; delete uit.commandJournaalTotaal; return uit;
};
const totaal = (naam, waarde) => naam === 'handelingLog' ? rijen(naam, waarde).length
  : Math.max(rijen(naam, waarde).length, Number(waarde?.commandJournaalTotaal) || 0);
const pak = (naam, lijst, aantal, rest) => naam === 'handelingLog' ? lijst
  : { ...rest, commandJournaal: lijst, commandJournaalTotaal: aantal };
const kopie = waarde => JSON.parse(JSON.stringify(waarde));
const gezien = new WeakMap(), bewaakt = new WeakSet();
const { NIET_VOLGEN } = require('./mutatietracker');
function alleenLezen(waarde) {
  const dicht = () => { throw new Error('Auditprojectie is alleen leesbaar; gebruik de journaalpoort.'); };
  function wikkel(v) {
    if (!v || typeof v !== 'object') return v;
    if (bewaakt.has(v)) return v;
    if (gezien.has(v)) return gezien.get(v);
    // NIET_VOLGEN: de mutatietracker wikkelt deze projectie niet opnieuw in.
    const p = new Proxy(v, { get: (o, k) => (k === NIET_VOLGEN ? true : wikkel(Reflect.get(o, k))),
      getOwnPropertyDescriptor(o, k) {
        const d = Reflect.getOwnPropertyDescriptor(o, k);
        return d && Object.hasOwn(d, 'value') ? { ...d, value: wikkel(d.value) } : d;
      }, set: dicht,
      deleteProperty: dicht, defineProperty: dicht, setPrototypeOf: dicht, preventExtensions: dicht });
    gezien.set(v, p); bewaakt.add(p); return p;
  }
  return wikkel(waarde);
}
module.exports = { vormen, eis, rijen, extra, totaal, pak, kopie, alleenLezen };
