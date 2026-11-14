/* Broncompatibiliteit, geen browserbewijs: voer echte kernuitvoer door de
   validator die het scherm gebruikt. De kern rekent op expliciete testdata. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { maakGhost } = require('../server/kern/ghost');
const source = fs.readFileSync(path.join(__dirname, '../public/apps/ghost-voorzijde.js'), 'utf8');
const begin = source.indexOf('  function volledig(d) {');
const einde = source.indexOf('\n  function toon(d)', begin);
assert.ok(begin >= 0 && einde > begin, 'de gebruikte schermvalidator is vindbaar');
const volledig = vm.runInNewContext('(' + source.slice(begin, einde).trim() + ')');

function voorspelling(druk) {
  const tijden = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00');
  const zaak = { code: 'GHOST-COMPAT', name: 'Testvervoerder', city: 'Teststad', fleet: [] };
  const punt = { code: 'PUNT', name: 'Testknooppunt', city: 'Teststad', loc: { lat: 1, lng: 1 },
    activiteiten: [{ id: 'event', name: 'Testevenement', tijden }] };
  const db = { data: { suppliers: druk ? [punt] : [], rides: druk ? tijden.flatMap((_, h) =>
    Array.from({ length: 5 }, () => ({ supplierCode: zaak.code, at: new Date(Date.UTC(2026, 9, 30, h)).toISOString() }))) : [] } };
  return maakGhost({ db, boekingenVanZaak: () => [{ kind: 'ticket', paid: true, activiteitId: 'event', personen: 20 }] }).ghostSimuleer(zaak);
}

test('Ghost accepteert echte kernuitvoer met en zonder knooppunten/waarschuwingen', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 30, 8) });
  const rustig = voorspelling(false), druk = voorspelling(true);
  assert.equal(rustig.knooppunten.length, 0);
  assert.equal(rustig.waarschuwingen.length, 0);
  assert.equal(rustig.uurbeeld.length, 12);
  assert.ok(druk.waarschuwingen.length > 0, 'ook simulatievelden worden werkelijk beproefd');
  assert.equal(volledig(rustig), true);
  assert.equal(volledig(druk), true);
});

test('Ghost weigert ontbrekende voorspelling en onbruikbare rendergegevens', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 30, 8) });
  const geldig = voorspelling(true);
  for (const defect of [null, {}, { ...geldig, uurbeeld: [] },
    { ...geldig, uurbeeld: [null] }, { ...geldig, waarschuwingen: [null] },
    { ...geldig, waarschuwingen: [{ ...geldig.waarschuwingen[0], simulatie: null }] }]) {
    assert.ok(!volledig(defect));
  }
});
