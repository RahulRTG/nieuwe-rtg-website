'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { REGELS, vergelijk, controleer } = require('../scripts/registerratel');
function zet(obj, pad, waarde) {
  const delen = pad.split('.');
  const laatste = delen.pop();
  let plek = obj;
  for (const d of delen) plek = plek[d] ||= {};
  plek[laatste] = waarde;
}
test('de vastgelegde meetrapporten verslechteren niet tegenover de hoofdlijn', () => {
  assert.deepEqual(controleer(), []);
});
test('iedere ratel weigert verslechtering en ontbrekend bewijs, en accepteert herstel', () => {
  for (const [naam, regels] of Object.entries(REGELS)) {
    const basis = {};
    for (const [veld, richting] of Object.entries(regels)) zet(basis, veld, richting === 'waar' ? true : richting === 'leeg' ? [] : 10);
    assert.deepEqual(vergelijk(naam, basis, basis), [], naam);
    for (const [veld, richting] of Object.entries(regels)) {
      const stuk = structuredClone(basis);
      zet(stuk, veld, richting === 'waar' ? false : richting === 'leeg' ? ['ontbreekt'] : richting === 'omlaag' ? 11 : 9);
      assert.equal(vergelijk(naam, stuk, basis).length, 1, naam + ' ' + veld);
      for (const ontbreekt of [null, undefined, '0', NaN]) {
        zet(stuk, veld, ontbreekt);
        assert.equal(vergelijk(naam, stuk, basis).length, 1, naam + ' mist ' + veld);
      }
      if (richting === 'omlaag' || richting === 'omhoog') {
        zet(stuk, veld, richting === 'omlaag' ? 9 : 11);
        assert.deepEqual(vergelijk(naam, stuk, basis), [], naam + ' herstel');
      }
    }
  }
});
