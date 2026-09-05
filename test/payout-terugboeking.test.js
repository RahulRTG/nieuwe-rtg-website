'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const terug = require('../server/kern/betaalopdracht/terugboeking');

const basis = () => ({ domein: 'pay', grootboek: () => [], van: 'extern:uitbetaald',
  naar: 'lid:A', centen: 137, soort: 'terug', oms: 'mislukt', ref: 'PB-HEEN' });

test('payout-teruggang gebruikt één duurzame economische sleutel', async () => {
  let invoer, keer = 0;
  const r = await terug(Object.assign(basis(), {
    geldModus: 'schaduw', boek: args => { keer++; return { ok: true, boeking: { id: 'PB-TERUG', ...args } }; },
    boekAsync: async () => assert.fail('async boekpad hoort in schaduwstand niet gebruikt te worden'),
    boekEenmaal: async (i, werk) => { invoer = i; return werk(); }
  }));
  assert.equal(r.ok, true);
  assert.equal(keer, 1);
  assert.match(invoer.sleutel, /^payout-terug:[a-f0-9]{64}$/);
  assert.doesNotMatch(invoer.sleutel, /PB-HEEN|pay:terug/);
  assert.match(invoer.afdruk, /^[a-f0-9]{64}$/);
  assert.deepEqual(invoer.collecties, ['paySaldi', 'payBoekingen']);
});

test('motor-cutover krijgt dezelfde economische sleutel en geen lokale preclaim', async () => {
  let gezien;
  const r = await terug(Object.assign(basis(), {
    geldModus: 'motor', boek: () => assert.fail('lokale boeking mag niet draaien'),
    boekEenmaal: () => assert.fail('lokale opslag mag niet de motor claimen'),
    boekAsync: async args => { gezien = args; return { ok: true, boeking: { id: 'M1' } }; }
  }));
  assert.equal(r.ok, true);
  assert.match(gezien.economischeSleutel, /^payout-terug:[a-f0-9]{64}$/);
});

test('vreemde en lange providerref blijft alleen in de afdruk, nooit in de sleutel', async () => {
  const ref = 'persoon / payout met spaties ? ' + 'x'.repeat(500);
  let invoer;
  const r = await terug(Object.assign(basis(), { ref, geldModus: 'schaduw',
    boek: args => ({ ok: true, boeking: { id: 'B1', ...args } }),
    boekAsync: async () => assert.fail('onverwacht async pad'),
    boekEenmaal: async (i, werk) => { invoer = i; return werk(); }
  }));
  assert.equal(r.ok, true);
  assert.match(invoer.sleutel, /^payout-terug:[a-f0-9]{64}$/);
  assert.equal(invoer.sleutel.includes(ref), false);
  assert.match(invoer.afdruk, /^[a-f0-9]{64}$/);
});

test('productie zonder economische backend weigert vóór de boeking', async () => {
  const oud = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let geboekt = 0;
  try {
    const r = await terug(Object.assign(basis(), {
      geldModus: 'schaduw', boekAsync: async () => { geboekt++; return { ok: true }; }
    }));
    assert.equal(r.status, 503);
    assert.equal(r.code, 'ECONOMISCHE_OPSLAG_ONTBREEKT');
    assert.equal(geboekt, 0);
  } finally {
    if (oud === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud;
  }
});
