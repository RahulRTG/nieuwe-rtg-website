'use strict';
const { DIMENSIES } = require('./register');
function beoordeel({ catalogus, ketens, contracten, proeven, journal = [], uitgevoerd = {}, run, bron }) {
  if (!run || !bron) throw Error('Operationeel bewijs vereist een actuele run en bronvingerafdruk.');
  const ids = new Set(catalogus.map(f => f.id)), ketenIds = new Set(ketens.map(k => k.id));
  if (ids.size !== catalogus.length || ketenIds.size !== ketens.length) throw Error('Dubbele catalogus- of ketensleutel.');
  for (const c of contracten) if (!ids.has(c.functie) || !c.ketens.length || c.ketens.some(k => !ketenIds.has(k)))
    throw Error('Ongeldige capability-koppeling: ' + c.functie);
  if (new Set(contracten.map(c => c.functie)).size !== contracten.length) throw Error('Dubbel capability-contract.');
  const bewijs = (id, d) => {
    const records = journal.filter(j => j.proef === id);
    return !!proeven[id] && uitgevoerd[proeven[id]] === true && records.length === 1 &&
      records[0].run === run && records[0].bron === bron && Array.isArray(records[0].dimensies) && records[0].dimensies.includes(d);
  };
  const journeys = ketens.map(k => {
    const dimensies = Object.fromEntries(DIMENSIES.map(d => {
      const eisen = k.vereist?.[d];
      return [d, Array.isArray(eisen) && eisen.length > 0 && eisen.every(id => bewijs(id, d)) ? 'PROVEN' : 'UNKNOWN'];
    }));
    const ontbreekt = DIMENSIES.filter(d => dimensies[d] !== 'PROVEN');
    return { ...k, dimensies, ontbreekt, status: ontbreekt.length ? 'NOT_PROVEN' : 'PROVEN' };
  });
  const capabilities = catalogus.map(f => {
    const c = contracten.find(x => x.functie === f.id);
    const gekoppeld = journeys.filter(k => c?.ketens.includes(k.id));
    const mapped = c?.volledig === true && gekoppeld.length > 0;
    const dimensies = Object.fromEntries(DIMENSIES.map(d => [d,
      mapped && gekoppeld.every(k => k.dimensies[d] === 'PROVEN') ? 'PROVEN' : 'UNKNOWN']));
    return { id: f.id, naam: f.naam || f.label || f.id, v1: true, mapped, deelcontract: !!c,
      ketens: gekoppeld.map(k => k.id), dimensies,
      status: mapped && gekoppeld.every(k => k.status === 'PROVEN') ? 'PROVEN' : 'NOT_PROVEN' };
  });
  const inventaris = journal.find(j => j.proef === 'installatie-inventaris');
  const volledigBereik = inventaris && bewijs('installatie-inventaris', 'PROOF') &&
    Array.isArray(inventaris.bereik) && inventaris.bereik.length === ids.size &&
    new Set(inventaris.bereik).size === ids.size && inventaris.bereik.every(id => ids.has(id));
  // Zonder volledige meting geen nul uit een kleine steekproef afleiden.
  const controles = Object.fromEntries(['Orphan actions', 'Dead-end CTAs', 'Ownerless requests',
    'False confirmations', 'Hidden payment dependencies'].map(k => [k,
    volledigBereik && Number.isSafeInteger(inventaris.controles?.[k]) && inventaris.controles[k] >= 0 ? inventaris.controles[k] : null]));
  const compleet = capabilities.length > 0 && journeys.length > 0 && capabilities.every(c => c.status === 'PROVEN') &&
    journeys.every(k => k.status === 'PROVEN');
  const modi = Object.fromEntries(['PAYMENTS OFF', 'AI OFF', 'PUSH OFF'].map(m => [m, {
    status: compleet && volledigBereik && inventaris.modi?.includes(m) && bewijs('installatie-inventaris', 'DEGRADED') ? 'PROVEN' : 'NOT_PROVEN',
    deelproeven: journal.filter(j => j.modi?.includes(m) && bewijs(j.proef, 'DEGRADED')).map(j => j.proef)
  }]));
  return { run, bron, capabilities, journeys, controles, modi,
    dimensies: Object.fromEntries(DIMENSIES.map(d => [d, capabilities.filter(c => c.dimensies[d] === 'PROVEN').length])),
    status: compleet && Object.values(controles).every(n => n === 0) && Object.values(modi).every(m => m.status === 'PROVEN')
      ? 'PROVEN' : 'NOT_PROVEN' };
}
module.exports = { beoordeel };
