/* Het "gewaagde" vragendek van de Residence (kern/residentie/rahul.js) is
   seksueel getint. Het opende voor elk gekoppeld paar dat prive in een suite
   zat, zonder de 18+-poort (kern/volwassen.js: eigen account, A3, 18 of
   ouder). Nu alleen als BEIDE leden die poort halen; anders blijft de
   directeur bij het eerlijke dek. */
const test = require('node:test');
const assert = require('node:assert/strict');

function huis(volwassen) {
  const k = { leden: { A: { codenaam: 'a' }, B: { codenaam: 'b' } } };
  const r = { potjes: {} };
  const spel = require('../server/kern/residentie/spel')({
    R: () => r, kamer: () => k, kamerVanLees: () => 'suite:a', potjesLees: () => ({}),
    sein: () => {}, sseToCustomer: () => {}, save: () => {},
    partnerVan: (key) => (key === 'A' ? 'B' : 'A'), volwassen });
  return (key) => { k.laatsteVraag = 0; return spel.vraag(key); };
}

test('zonder 18+-poort nooit het gewaagde dek, ook niet prive met het eigen paar', () => {
  for (const poort of [undefined, () => false, (key) => key === 'A']) {
    const vraag = huis(poort);
    for (let i = 0; i < 6; i++) {
      const v = vraag('A');
      assert.equal(v.status, 200);
      assert.notEqual(v.vraag ? v.vraag.niveau : v.niveau, 'gewaagd');
    }
  }
});

test('twee gekeurde volwassenen prive in de suite krijgen het gewaagde dek', () => {
  const vraag = huis(() => true);
  const niveaus = [];
  for (let i = 0; i < 4; i++) { const v = vraag('A'); niveaus.push(v.vraag ? v.vraag.niveau : v.niveau); }
  assert.ok(niveaus.includes('gewaagd'), niveaus.join(','));
});
