'use strict';
/* A-P1-05: het ankerblok gaat periodiek naar buiten; een mislukte ronde is een stand, geen stilte. */
const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../server/lib/ankertimer');

test('zonder RTG_ANKERPOST_URL start er niets, en dat staat erbij', () => {
  const r = t.start({ ankerpost: {}, omgeving: {}, zet: () => { throw new Error('mag niet'); } });
  assert.equal(r.gestart, false);
  assert.match(r.reden, /niet in bedrijf/);
});

test('met bestemming wordt een interval gezet, minimaal een minuut', () => {
  let ms = null;
  const r = t.start({ ankerpost: {}, omgeving: { RTG_ANKERPOST_URL: 'https://x.example', RTG_ANKERPOST_MINUTEN: '0' }, zet: (f, m) => { ms = m; return {}; } });
  assert.equal(r.gestart, true);
  assert.equal(ms, 15 * 60 * 1000, '0 is ongeldig en valt terug op de standaard');
});

test('een geslaagde ronde en een mislukte ronde zijn allebei zichtbaar in de stand', async () => {
  const meldingen = [];
  await t.eenRonde({ post: async () => ({ ok: true, inBedrijf: true }) }, { warn: m => meldingen.push(m) });
  assert.equal(t.stand().laatste.ok, true);
  const goed = t.stand().laatsteGeslaagd;
  assert.ok(goed);
  await t.eenRonde({ post: async () => { throw new Error('boem'); } }, { warn: m => meldingen.push(m) });
  const s = t.stand();
  assert.equal(s.laatste.ok, false);
  assert.match(s.laatste.reden, /boem/);
  assert.equal(s.laatsteGeslaagd, goed, 'een mislukking wist het laatste succes niet en wordt er ook niet voor aangezien');
  assert.equal(meldingen.length, 1);
});
