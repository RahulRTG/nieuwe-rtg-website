/* Een van de TWEE wegen onder de 128 bit in CODECREDENTIALS.json: een verklaarde
   korte menscode (`beleid.korte_menscode`), voor een code die een mens voorleest.
   De andere is `korte_code` van de bezorgcode (mode.bezorgcode, vier cijfers aan
   de deur, zeven dagen, gebonden aan een bestelling): andere plafonds, dus een
   eigen verklaring en een eigen toets (test/codecredentials.test.js). Deze
   toets houdt de uitzondering smal: zonder binding, rem, uitgifte na een
   handeling van de houder, binnen de plafonds van het beleid en met een
   onderbouwing zakt een gemigreerde deur onder de 128 bit weer.

   Draai los: node --test test/codecredentials-kortecode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const poort = require('../scripts/codecredentials');

const ID = 'service.balie_bevestigingscode';
const zakt = (wijzig) => {
  const register = JSON.parse(JSON.stringify(poort.lees()));
  wijzig(register.deuren.find(d => d.id === ID), register);
  return poort.controleer(register).fouten.some(f => f.startsWith(ID + ': gemigreerde credential mist minimaal 128-bit'));
};

test('de balie-bevestigingscode is eerlijk 20 bit, en de uitzondering draagt hem', () => {
  const d = poort.lees().deuren.find(x => x.id === ID);
  assert.equal(d.status, 'migrated');
  assert.equal(d.controls.entropy_bits, 20, 'de entropie wordt niet opgepoetst tot 128');
  assert.equal(zakt(() => {}), false);
});

test('elke voorwaarde van de uitzondering is nodig', () => {
  assert.equal(zakt(d => { delete d.korte_menscode; }), true, 'zonder verklaring');
  assert.equal(zakt((d, r) => { delete r.beleid.korte_menscode; }), true, 'zonder beleid');
  assert.equal(zakt(d => { d.korte_menscode.geldig_seconden = 3600; }), true, 'een uur geldig');
  assert.equal(zakt(d => { d.korte_menscode.max_pogingen_per_code = 50; }), true, 'vijftig pogingen');
  assert.equal(zakt(d => { d.korte_menscode.max_uitgiften = 50; }), true, 'vijftig uitgiften');
  assert.equal(zakt(d => { d.korte_menscode.waarom = 'kort'; }), true, 'zonder onderbouwing');
  for (const c of ['gebonden_aan_een_onderwerp', 'rate_limited', 'pas_na_houderactie'])
    assert.equal(zakt(d => { d.controls[c] = false; }), true, 'zonder ' + c);
  assert.equal(zakt(d => { d.controls.entropy_bits = 0; }), true, 'zonder gemeten entropie');
});

test('een 128-bitdeur heeft de uitzondering niet nodig, en geen andere deur gebruikt haar', () => {
  const register = poort.lees();
  const met = register.deuren.filter(d => d.korte_menscode);
  assert.deepEqual(met.map(d => d.id), [ID], 'een nieuwe korte code hoort een eigen besluit te zijn');
  // de bezorgcode gaat langs haar eigen uitzondering (korte_code), en nooit langs deze
  const eigen = new Set([ID, 'mode.bezorgcode']);
  assert.deepEqual(register.deuren.filter(d => d.korte_code).map(d => d.id), ['mode.bezorgcode'],
    'een nieuwe korte code hoort een eigen besluit te zijn');
  for (const d of register.deuren.filter(x => x.status === 'migrated' && !eigen.has(x.id) &&
    (x.classificatie === 'credential' || x.classificatie === 'money_credential')))
    assert.ok(Number(d.controls.entropy_bits) >= 128, d.id);
});
