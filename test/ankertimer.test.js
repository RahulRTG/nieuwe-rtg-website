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
  await t.eenRonde({ afrekenen: async () => ({ afgerekend: false, ok: false, inBedrijf: true, status: 404 }), post: async () => ({ ok: true, inBedrijf: true }) }, { warn: m => meldingen.push(m) });
  assert.equal(t.stand().laatste.ok, true);
  const goed = t.stand().laatsteGeslaagd;
  assert.ok(goed);
  await t.eenRonde({ afrekenen: async () => ({ afgerekend: true, ok: true, inBedrijf: true }), post: async () => { throw new Error('boem'); } }, { warn: m => meldingen.push(m) });
  const s = t.stand();
  assert.equal(s.laatste.ok, false);
  assert.match(s.laatste.reden, /boem/);
  assert.equal(s.laatsteGeslaagd, goed, 'een mislukking wist het laatste succes niet en wordt er ook niet voor aangezien');
  assert.equal(meldingen.length, 1);
});

test('audit P1-3b: een blok dat niet afrekent laat het alarm afgaan en er gaat GEEN nieuw blok weg', async () => {
  const wacht = require('../server/lib/auditwacht'); wacht._wis();
  let gepost = 0;
  const r = await t.eenRonde({ afrekenen: async () => ({ afgerekend: true, inBedrijf: true, ok: false,
    perJournaal: { handelingLog: { ok: false, herschreven: true, reden: 'regel 9 heeft een andere hash' } } }),
    post: async () => { gepost++; return { ok: true }; } }, { warn() {}, error() {} });
  assert.equal(r.ok, false); assert.equal(r.afwijking, true);
  assert.equal(gepost, 0, 'een nieuw blok over een vervalst journaal zou het bewijs overschrijven');
  assert.match(wacht.bevinding() || '', /anker.*handelingLog/);
  /* Onbereikbaar is ook geen groen: niet vergeleken, niet gepost, wel een bevinding. */
  wacht._wis();
  const o = await t.eenRonde({ afrekenen: async () => ({ afgerekend: false, ok: false, inBedrijf: true, reden: 'time-out' }),
    post: async () => { gepost++; return { ok: true }; } }, { warn() {} });
  assert.equal(o.vergeleken, false); assert.equal(gepost, 0);
  assert.match(wacht.bevinding() || '', /niet worden vergeleken/);
  /* En een kloppend blok wist de bevinding en brengt het nieuwe blok weg. */
  const g = await t.eenRonde({ afrekenen: async () => ({ afgerekend: true, ok: true, inBedrijf: true }),
    post: async () => { gepost++; return { ok: true }; } }, { warn() {} });
  assert.equal(g.ok, true); assert.equal(gepost, 1); assert.equal(wacht.bevinding(), null);
});
