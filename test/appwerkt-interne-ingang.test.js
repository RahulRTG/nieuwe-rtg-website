'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meet, meetRij, meetIngang, browserRaakvlakInvoer, volledigeBediening } = require('../scripts/appwerkt');

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


test('gewone query-ingangen behouden hun aangeboden context zonder een nieuwe hashregel', () => {
  assert.deepEqual(meetIngang({ pad: '/apps/app.html', ingang: '/apps/app.html?pas=rtg#tab=reizen' }, {}),
    { pad: '/apps/app.html?pas=rtg', bestemming: '/apps/app.html?pas=rtg', via: null });
});

test('virtuele OS en tab binden browserbronnen aan hun echte contractingang', () => {
  for (const functie of ['os:rtf', 'os:videobellen']) {
    const r = { functie, ingang: '(os in de app, geen eigen adres)' };
    const m = meetIngang(r);
    assert.equal(m.bestemming, '/apps/app.html?pas=rtg');
    assert.deepEqual(browserRaakvlakInvoer(r), {
      ingang: m.bestemming, soort: 'browser', kanaal: 'browser'
    });
    assert.equal(r.ingang, '(os in de app, geen eigen adres)', 'de bestaande rij-identiteit blijft intact');
  }
  const c = { 'tab:a': { ingang: '/apps/app.html?pas=rtg', via: '#tab=a' } };
  assert.equal(browserRaakvlakInvoer({ functie: 'tab:a', ingang: '(tab)' }, c).ingang, '/apps/app.html?pas=rtg');
  assert.equal(browserRaakvlakInvoer({ functie: 'os:onbekend', ingang: '(onbekend)' }, {}).ingang, '(onbekend)',
    'onbekende adapters blijven onbepaald, nooit een verzonnen bron');
  assert.equal(browserRaakvlakInvoer({ ingang: '/apps/a.html?keuze=1' }).ingang, '/apps/a.html?keuze=1');
});

test('de echte rijmeter accepteert het bestaande querydocument, zonder een browserbewijs te verzinnen', async () => {
  for (const functie of ['os:rtf', 'os:videobellen']) {
    const r = await meetRij({ functie, ingang: '(os in de app, geen eigen adres)', persona: 'lid', soort: 'os' },
      'http://127.0.0.1:1', {}, []);
    assert.equal(r.bewijzen.bereikbaar.status, 'NIET_GETEST');
    assert.doesNotMatch(r.bewijzen.bereikbaar.reden, /bestand bestaat niet/);
    assert.match(r.bewijzen.bereikbaar.reden, /^inloggen als lid lukte niet/);
    assert.equal(r.gevonden, 0, 'dit is uitsluitend de fysieke preflight, geen browsermeting');
  }
});

test('een echt ontbrekend document met query blijft defect in de echte rijmeter', async () => {
  const r = await meetRij({ functie: 'link:ontbrekend-proefdocument', persona: 'lid',
    pad: '/apps/__appwerkt-bestaat-niet__.html', ingang: '/apps/__appwerkt-bestaat-niet__.html?pas=rtg' },
    'http://127.0.0.1:1', {}, []);
  assert.equal(r.bewijzen.bereikbaar.status, 'GEBLOKKEERD_DOOR_DEFECT');
  assert.match(r.bewijzen.bereikbaar.reden, /__appwerkt-bestaat-niet__\.html\?pas=rtg/);
  assert.equal(r.status, 'GEBLOKKEERD_DOOR_DEFECT');
});

test('dezelfde meter weigert een lege, foutieve of dubbele selectie vóór infrastructuurstart', async () => {
  for (const lijst of [[], null, {}, [null], [{ functie: 'a' }, { functie: 'a' }]]) {
    await assert.rejects(meet(lijst), /niet-lege lijst unieke onderdelen/);
  }
});
