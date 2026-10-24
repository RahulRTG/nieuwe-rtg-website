'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meetIngang } = require('../scripts/appwerkt');

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
