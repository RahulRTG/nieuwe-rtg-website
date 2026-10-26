'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meetIngang, volledigeBediening } = require('../scripts/appwerkt');

test('bedienbaar vereist honderd procent van de unieke toepasselijke bediening', () => {
  assert.equal(volledigeBediening({ gevonden: 10, geklikt: 10, overgeslagen: [] }), true);
  assert.equal(volledigeBediening({ gevonden: 10, geklikt: 9, overgeslagen: [] }), false,
    'ook negentig procent blijft open');
  assert.equal(volledigeBediening({ gevonden: 10, geklikt: 10, overgeslagen: ['Betaal'] }), false,
    'een overgeslagen risicoknop mag niet administratief groen worden');
  assert.equal(volledigeBediening({ gevonden: 0, geklikt: 0, overgeslagen: [] }), false,
    'een scherm zonder gemeten bediening heeft geen bedieningsbewijs');
});

test('een gewone app houdt zijn bestaande adres als meetingang', () => {
  assert.deepEqual(meetIngang({ functie: 'link:a', pad: '/apps/a.html' }, {}),
    { pad: '/apps/a.html', bestemming: '/apps/a.html', via: null });
});

test('een interne hash-tab gebruikt de bestaande contractingang', () => {
  const contract = { 'tab:a': { ingang: '/apps/app.html', via: '#tab=a', bestanden: ['public/apps/app-main/a.js'] } };
  assert.deepEqual(meetIngang({ functie: 'tab:a', pad: null }, contract),
    { pad: '/apps/app.html#tab=a', bestemming: '/apps/app.html', via: '#tab=a' });
});

test('een OS-kiezer met alleen bedieningsproza krijgt geen verzonnen URL', () => {
  const contract = { 'os:a': { ingang: '/apps/app.html', via: 'vraag Rahul om A', bestanden: ['public/apps/app-main/a.js'] } };
  assert.equal(meetIngang({ functie: 'os:a', pad: null }, contract), null);
  assert.equal(meetIngang({ functie: 'os:zonder-contract', pad: null }, contract), null);
});

test('een OS-kiezer wordt alleen meetbaar met een volledige expliciete bedieningsadapter', () => {
  const adapter = { type: 'rahul-opdracht', opdracht: 'open A', verwacht: '#a.open', bereik: '#a.open', titel: 'A' };
  const contract = { 'os:a': { ingang: '/apps/app.html', via: 'vraag Rahul om A', adapter } };
  assert.deepEqual(meetIngang({ functie: 'os:a', pad: null }, contract), {
    pad: '/apps/app.html', bestemming: '/apps/app.html', via: 'vraag Rahul om A', adapter
  });
  for (const ontbreekt of ['opdracht', 'verwacht', 'bereik', 'titel']) {
    const stuk = { ...adapter }; delete stuk[ontbreekt];
    assert.equal(meetIngang({ functie: 'os:a', pad: null }, { 'os:a': { ingang: '/apps/app.html', via: 'proza', adapter: stuk } }), null);
  }
});
