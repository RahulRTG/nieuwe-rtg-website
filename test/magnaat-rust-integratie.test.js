'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/kern/magnaat-economie');

const motorUrl = process.env.RTG_MOTOR_REKEN_URL;

function economie(motorklant) {
  const wereld = {};
  return maak({ wereldState: () => wereld, motorklant, save: () => {} });
}

async function vergelijk(voorbereiden, commando) {
  const javascript = economie({ aan: false });
  const rust = economie();
  voorbereiden(javascript);
  voorbereiden(rust);
  const verwacht = javascript.volgendeDag('pariteit', commando);
  const werkelijk = await rust.volgendeDagAsync('pariteit', commando);
  assert.equal(werkelijk.rekenmotor, 'rust', 'de test mag niet ongemerkt op JS terugvallen');
  assert.deepEqual(werkelijk.macro, verwacht.macro);
  assert.deepEqual(werkelijk.bedrijven, verwacht.bedrijven);
  assert.deepEqual(werkelijk.grootboek, verwacht.grootboek);
}

test('Rust rekent een normale Magnaat-dag exact gelijk aan JavaScript', { skip: !motorUrl }, async () => {
  await vergelijk(() => {}, 'rust-pariteit-normaal');
});

test('Rust blijft gelijk bij besluiten, schok en uitgevoerd werk', { skip: !motorUrl }, async () => {
  await vergelijk(e => {
    e.beslis('directie', { prijs: 117, personeelDoel: 30, loonMaand: 3650, trainingDag: 1800, bestelling: 340, impactPct: 1.4 });
    e.kiesSchok('scenarioleider', 'arbeidstekort');
    e.registreerWerk('medewerker', {
      id: 'rust-werk', functieId: 'supplier-operatie', spelvorm: 'operatie', punten: 375,
      stappen: [{ soort: 'software' }, { soort: 'keuze' }, { soort: 'keuze' }]
    });
  }, 'rust-pariteit-zwaar');
});
