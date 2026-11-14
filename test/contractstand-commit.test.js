'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const context = require('../server/db/verzoekcontext');
const maakContractstand = require('../server/opzet/contractstand');

function opstelling() {
  let metingen = 0, lezingen = 0;
  const stand = maakContractstand({
    kernVoorAuth: { aanmeldingen: { lidAbonnement: { stand: () => { lezingen++; return null; } } },
      handhavingSchaduw: {} },
    lidpoort: { beoordeel: () => ({ stand: 'GEEN_CONTRACT' }),
      weeg: () => { metingen++; }, onbekend: () => ({ stand: 'ONBEKEND' }) }
  });
  const sess = { account: { id: 1 }, key: 'user-1', tier: 'rtg' };
  return { lees: () => stand(sess), metingen: () => metingen, lezingen: () => lezingen };
}

test('een afgewezen requestcommit maakt geen tien minuten durend meetbewijs', () => {
  const f = opstelling(), mislukt = context.nieuw();
  context.voer(mislukt, f.lees);
  assert.equal(f.metingen(), 1);
  context.sluit(mislukt); // zoals de responspoort na een afgewezen COMMIT
  const herstel = context.nieuw();
  context.voer(herstel, f.lees);
  assert.equal(f.metingen(), 2, 'een mislukte commit moet opnieuw kunnen meten');
  context.draaiNaCommit(herstel); context.sluit(herstel);
  const daarna = context.nieuw(); context.voer(daarna, f.lees); context.sluit(daarna);
  assert.equal(f.metingen(), 2, 'pas de bevestigde meting vult het venster');
  assert.equal(f.lezingen(), 3, 'de contractautoriteit wordt wel elk verzoek opnieuw gelezen');
});

test('in-flight is geen geslaagde commit; andere requests mogen nog meten', () => {
  const f = opstelling(), a = context.nieuw(), b = context.nieuw();
  context.voer(a, f.lees); context.voer(b, f.lees);
  assert.equal(f.metingen(), 2, 'A mag vóór COMMIT geen bewijs aan B beloven');
  context.draaiNaCommit(a); context.sluit(a); context.sluit(b);
  const c = context.nieuw(); context.voer(c, f.lees); context.sluit(c);
  assert.equal(f.metingen(), 2);
});

test('de synchrone opslagroute houdt het bestaande meetvenster', () => {
  const f = opstelling(); f.lees(); f.lees();
  assert.equal(f.metingen(), 1);
  assert.equal(f.lezingen(), 2);
});
