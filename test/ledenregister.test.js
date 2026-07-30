/* Ledenregister (kern/ledenregister.js): leden op codenaam, gesplitst per
   stad/land/alfabet/geslacht en pas, met de omzet per pas en de 30%-
   foundationsplit (20% lokaal, 10% RTF). Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

function maak(rijen) {
  const accounts = { ledenRegisterRijen: () => rijen };
  const onboarding = { store: () => ({ profielen: {
    'user-1': { velden: { woonplaats: 'Ibiza' } },
    'user-2': { velden: { woonplaats: 'Amsterdam' } },
    'user-3': { velden: { woonplaats: 'Ibiza' } }
  } }) };
  const geldPasprijzen = () => ({ passen: { rtg: { maandCenten: 6500 }, lifestyle: { maandCenten: 2000000 } } });
  return require('../server/kern/ledenregister')({ accounts, onboarding, geldPasprijzen, ledenAantal: () => rijen.length }).ledenregister;
}

const RIJEN = [
  { id: 1, key: 'user-1', tier: 'rtg', codename: 'Anemoon', geslacht: 'v', land: 'ES' },
  { id: 2, key: 'user-2', tier: 'lifestyle', codename: 'Berkenhout', geslacht: 'm', land: 'NL' },
  { id: 3, key: 'user-3', tier: 'rtg', codename: 'Ceder', geslacht: 'x', land: 'ES' },
  { id: 4, key: 'user-4', tier: 'guest', codename: 'Dennenhout', geslacht: null, land: null },
  { id: 5, key: 'user-5', tier: 'business', codename: 'Eik', geslacht: 'm', land: 'NL' }
];

test('splitst per pas, geslacht, land en stad', () => {
  const lr = maak(RIJEN);
  const r = lr.register();
  const pas = Object.fromEntries(r.perPas.map(p => [p.pas, p.aantal]));
  assert.equal(pas.rtg, 2);
  assert.equal(pas.lifestyle, 1);
  assert.equal(pas.business, 1);
  assert.equal(pas.gratis, 1); // de gast telt als gratis
  const gesl = Object.fromEntries(r.perGeslacht.map(g => [g.naam, g.aantal]));
  assert.equal(gesl.Vrouw, 1); assert.equal(gesl.Man, 2); assert.equal(gesl.X, 1);
  const stad = Object.fromEntries(r.perStad.map(s => [s.naam, s.aantal]));
  assert.equal(stad.Ibiza, 2); assert.equal(stad.Amsterdam, 1);
});

test('omzet per pas en de 30%-split (20% lokaal, 10% RTF)', () => {
  const lr = maak(RIJEN);
  const r = lr.register();
  const omzet = Object.fromEntries(r.omzet.map(o => [o.pas, o]));
  assert.equal(omzet.rtg.maandOmzet, 130);       // 2 x 65
  assert.equal(omzet.lifestyle.maandOmzet, 20000); // 1 x 20000
  assert.equal(omzet.business.opMaat, true);     // Business is prijs op maat
  // totaal over de bekende prijzen = 130 + 20000 = 20130
  assert.equal(r.split.totaalOmzet, 20130);
  assert.equal(r.split.foundation30, Math.round(20130 * 0.30 * 100) / 100);
  assert.equal(r.split.lokaal20, Math.round(20130 * 0.20 * 100) / 100);
  assert.equal(r.split.rtf10, Math.round(20130 * 0.10 * 100) / 100);
});

test('de alfabetische lijst is te filteren per pas en stad', () => {
  const lr = maak(RIJEN);
  const alle = lr.register().lijst.map(m => m.codenaam);
  assert.deepEqual(alle, ['Anemoon', 'Berkenhout', 'Ceder', 'Dennenhout', 'Eik']); // alfabetisch
  const rtgIbiza = lr.register({ pas: 'rtg', stad: 'Ibiza' }).lijst.map(m => m.codenaam);
  assert.deepEqual(rtgIbiza, ['Anemoon', 'Ceder']);
});
