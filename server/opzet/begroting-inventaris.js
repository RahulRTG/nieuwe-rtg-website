/* De vorm van db.data verandert zelden; de inhoud verandert voortdurend. De
   effectbon en handelingstelling vroegen desondanks bij ieder verzoek meermaals
   Object.keys() over de hele wereld op. Hier bewaren we alleen de VORM. De
   begrotingsproxy wist de cache zodra een top-level sleutel verschijnt,
   verdwijnt of van/naar een rijcollectie verandert. Waarden worden niet
   gecachet en getters worden tijdens de inventarisatie nooit uitgevoerd. */
'use strict';

const vormen = new WeakMap();

function registreer(wikkel, doel) {
  const vorm = vormen.get(doel) || { doel, sleutels: null, rijsleutels: null };
  vormen.set(doel, vorm);
  vormen.set(wikkel, vorm);
}

function vervang(doel, sleutel, waarde) {
  const bestond = Object.prototype.hasOwnProperty.call(doel, sleutel);
  const oud = doel[sleutel];
  if (!bestond || Array.isArray(oud) !== Array.isArray(waarde)) wis(doel);
  doel[sleutel] = waarde;
  return true;
}

function verwijder(doel, sleutel) {
  if (Object.prototype.hasOwnProperty.call(doel, sleutel)) wis(doel);
  return Reflect.deleteProperty(doel, sleutel);
}

function definieer(doel, sleutel, descriptor) {
  const bestond = Object.prototype.hasOwnProperty.call(doel, sleutel);
  const oudDescriptor = bestond ? Object.getOwnPropertyDescriptor(doel, sleutel) : null;
  const oud = doel[sleutel];
  const ok = Reflect.defineProperty(doel, sleutel, descriptor);
  const nieuwDescriptor = ok ? Object.getOwnPropertyDescriptor(doel, sleutel) : null;
  if (ok && (!bestond || Array.isArray(oud) !== Array.isArray(doel[sleutel]) ||
      Boolean(oudDescriptor?.enumerable) !== Boolean(nieuwDescriptor?.enumerable))) wis(doel);
  return ok;
}

function wis(data) {
  const vorm = vormen.get(data);
  if (!vorm) return false;
  vorm.sleutels = null;
  vorm.rijsleutels = null;
  return true;
}

function collectieSleutels(data) {
  const vorm = vormen.get(data);
  if (!vorm) return Object.keys(data || {});
  if (!vorm.sleutels) vorm.sleutels = Object.freeze(Object.keys(vorm.doel));
  return vorm.sleutels;
}

function maakRijSleutels(doel) {
  return Object.keys(doel).filter(k => {
    const d = Object.getOwnPropertyDescriptor(doel, k);
    return !!d && Object.prototype.hasOwnProperty.call(d, 'value') && Array.isArray(d.value);
  });
}

function rijSleutels(data) {
  const vorm = vormen.get(data);
  if (!vorm) return maakRijSleutels(data || {});
  if (!vorm.rijsleutels) vorm.rijsleutels = Object.freeze(maakRijSleutels(vorm.doel));
  return vorm.rijsleutels;
}

module.exports = { registreer, wis, vervang, verwijder, definieer, collectieSleutels, rijSleutels };
