/* POSITIEPROEF (NAVIGATIE.md par. 6.6, A0c) -- de opslaghelft van de meter.

   scripts/positieproef.js loopt een echte doorloop en leest daarna de hele
   opslag op herkenbare coordinaten. Deze toets houdt drie dingen vast: de lezer
   vindt een merkteken terug waar het staat en nergens anders, een niet gelopen
   stap is null en nooit 0, en het register loopt niet achter op een verse ronde.

   Draai los: node --test test/positieproef.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { meet, tel, zoekMerken, isMerk, MERK } = require('../scripts/positieproef');

const opslagMet = (collecties, extra) => Object.assign({
  opslag: { collecties, onleesbaar: [] }, aankomstGesteld: false, anderHek: 'leverancier:ANDER'
}, extra || {});

test('1. de lezer herkent een merkteken, ook onder lon, en geen buurcoordinaat', () => {
  assert.equal(isMerk(MERK.routeVan), 'routeVan');
  assert.equal(isMerk({ lat: MERK.zoek.lat, lon: MERK.zoek.lng }), 'zoek');
  assert.equal(isMerk({ lat: MERK.zoek.lat + 0.0001, lng: MERK.zoek.lng }), null, 'tien meter ernaast is een andere plek');
  assert.equal(isMerk({ lat: '38.9', lng: 'x' }), null);
  const pad = zoekMerken({ a: [{ b: MERK.melding }] }, 'x', []);
  assert.deepEqual(pad, [{ merk: 'melding', pad: 'x.a[0].b' }]);
});

test('2. een navigatiepositie die blijft staan, telt -- waar ze ook terechtkwam', () => {
  /* ZAKT OP: een teller die alleen in een verwachte collectie kijkt. */
  const t = tel(opslagMet({ ergensAnders: { log: [{ van: MERK.routeVan }] } }));
  assert.equal(t.tellers.blijvendeNavPositie, 1);
  assert.equal(tel(opslagMet({})).tellers.blijvendeNavPositie, 0);
});

test('3. alleen een passage langs een ANDER hek is een passageregel', () => {
  const log = [
    { wat: 'waargenomen', hek: 'leverancier:ANDER' },
    { wat: 'waargenomen', hek: 'leverancier:PONTO' },
    { wat: 'venster', hek: 'leverancier:ANDER' }
  ];
  assert.equal(tel(opslagMet({ plaatsLog: log })).tellers.passageLog, 1);
});

test('4. een stap die niet liep is null met een reden, nooit 0', () => {
  const t = tel(opslagMet({}, { anderHek: null, aankomstGesteld: null }));
  assert.equal(t.tellers.passageLog, null);
  assert.equal(t.tellers.aankomstUitPositie, null);
  assert.equal(t.tellers.onbegrensdeRitlijn, null);
  for (const k of ['passageLog', 'aankomstUitPositie', 'onbegrensdeRitlijn'])
    assert.ok(t.redenen[k] && t.redenen[k].length > 10, k + ' draagt zijn reden');
});

test('5. een echte doorloop: de lezer ziet, en het register loopt niet achter', { timeout: 300000 }, async () => {
  const uit = await meet();
  assert.ok(!uit.fout, uit.fout);
  assert.equal(uit.besturing.inOrde, true, 'de besturingsproef: de plek die een verkeersmelding met opzet bewaart (N15) wordt teruggevonden');
  for (const s of uit.stappen) assert.equal(s.status, 200, s.naam + ' liep niet (' + s.status + ')');
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'POSITIEPROEF.json'), 'utf8'));
  assert.deepEqual(reg.tellers, uit.tellers,
    'POSITIEPROEF.json loopt achter op een verse ronde -- draai npm run positieproef:vast op een schone boom');
});
