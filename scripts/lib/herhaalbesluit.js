'use strict';
/* Alleen de bron van een bestaand besluit verbinden, nooit gedrag afleiden uit
   een route-naam of meetuitkomst. Het centrale contract heeft voorrang op het
   oudere register: een onbesliste/ongeldige herziening mag niet terugvallen op
   een geruststellend oud besluit. Classificatie is nog steeds geen runtimebewijs. */
const { keur } = require('../../server/kern/mutatiecontract');
function besluitVoor(route, contracten, legacy) {
  const sleutel = (route.methode || 'POST').toUpperCase() + ' ' + route.pad;
  const c = contracten[sleutel];
  if (c) {
    if (!['PROTECTED', 'NOT_APPLICABLE', 'INTENTIONALLY_NON_IDEMPOTENT'].includes(c.stand) ||
        c.semantiek?.klasse === 'onbekend' || keur({ ...c, route: sleutel }).length) return null;
    return { route: sleutel, bron: 'server/lib/mutatiecontracten.js',
      klasse: c.semantiek.klasse, stand: c.stand, afgetekend: c.afgetekend };
  }
  const oud = (legacy.routes || {})[route.pad];
  if ((route.methode || 'POST').toUpperCase() !== 'POST' || !oud ||
      !Object.hasOwn(legacy.klassen || {}, oud.klasse) || oud.klasse === 'tebeslissen') return null;
  return { route: sleutel, bron: 'IDEMBESLUIT.json', klasse: oud.klasse };
}
function inventaris(rijen, contracten, legacy) {
  const besluiten = [], ontbreekt = [];
  for (const route of rijen.filter(r => !/geen werk/.test(r.reden || ''))) {
    const b = besluitVoor(route, contracten, legacy);
    if (b) besluiten.push(b);
    else ontbreekt.push((route.methode || 'POST').toUpperCase() + ' ' + route.pad);
  }
  return { besluiten, ontbreekt };
}
module.exports = { besluitVoor, inventaris };
