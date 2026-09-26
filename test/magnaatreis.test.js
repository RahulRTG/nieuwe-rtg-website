/* Magnaat V5: VOLLEDIGE REIZEN EN BELASTING. Een automatische speler
   (./lib-magnaatspeler.js) speelt het spel van een maandag met bijna niets tot
   zijn ontslag bij de keuken, op alle drie de moeilijkheden, en daarna twee
   jaar door. Daarbij moet gelden:
   - het einde van V1 is haalbaar: je kunt van je eigen bedrijf gaan leven;
   - de mijlpalen komen in de volgorde van het verhaal;
   - na elke dag kloppen de boeken, en het leven bevriest nooit;
   - een lang leven blijft snel, en wat het scherm krijgt blijft begrensd.
   De tijdsgrenzen zijn ruim, want een CI-machine is trager dan een laptop: ze
   vangen een ontsporing (een kwadratische lus, een beeld dat onbegrensd
   groeit), geen milliseconden. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSpeler } = require('./lib-magnaatspeler');
const { controleer } = require('../server/kern/magnaat-leven/bewaking');
const { boekVan } = require('../server/kern/magnaat-leven/boek');

const schoon = (p) => controleer(p.st(), boekVan(p.st()));
const VOLGORDE = ['klant', 'geld', 'onderneming', 'contract', 'zelfstandig'];

for (const moeilijkheid of ['licht', 'normaal', 'zwaar']) {
  test('de hele reis op ' + moeilijkheid + ': van bijna niets en een baan tot je eigen bedrijf', () => {
    const p = maakSpeler({ moeilijkheid });
    for (let i = 0; i < 150 && !p.st().zelfstandig; i++) {
      p.dag();
      assert.deepEqual(schoon(p), [], 'dag ' + p.st().dag);
    }
    assert.ok(p.st().zelfstandig, 'binnen 150 dagen leeft de speler van zijn eigen bedrijf');
    assert.equal(p.st().bevroren, undefined);
    const ids = p.st().mijlpalen.map(m => m.id).filter(id => VOLGORDE.includes(id));
    assert.deepEqual(ids, VOLGORDE, 'de mijlpalen komen in de volgorde van het verhaal');
    assert.ok(p.beeld().verhaal.slot, 'en het spel vertelt het slot');
    assert.equal(p.L.verifieer(p.key).ok, true);
  });
}

test('twee jaar spelen: snel, begrensd, en de boeken kloppen', () => {
  const p = maakSpeler({ aanbod: 'foto' });
  const t0 = Date.now();
  for (let i = 0; i < 730; i++) p.dag();
  const perDag = (Date.now() - t0) / 730;
  assert.ok(perDag < 60, 'een speldag met een handvol handelingen kost ' + perDag.toFixed(1) + ' ms');
  const beeld = JSON.stringify(p.beeld()).length;
  assert.ok(beeld < 120000, 'het beeld blijft begrensd: ' + beeld + ' tekens');
  assert.ok(p.beeld().netwerk.eerder > 0, 'oude contacten staan niet meer allemaal in het beeld');
  assert.deepEqual(schoon(p), []);
  const t1 = Date.now();
  p.tijd(180000 * 120);
  const s = p.L.staat(p.key);
  assert.ok(Date.now() - t1 < 3000, '120 dagen bijrekenen in een verzoek');
  assert.equal(s.dag, 731 + 120);
  assert.equal(p.L.verifieer(p.key).ok, true);
});
