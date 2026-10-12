'use strict';
/* Een reservering van begin tot eind (server/kern/waarde/reserve.js).

   De module belooft: een reservering zet geld vast tot een tijdstip, een
   herhaling met hetzelfde nummer is dezelfde reservering, vastleggen mag nooit
   boven het gereserveerde bedrag, een verlopen reservering zet niets meer vast,
   en niets houdt geld langer dan een dag vast. Elke belofte krijgt hier een
   geval met een klok die de toets zelf verzet. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakReserve, MAX_PER_REKENING, MAX_MS } = require('../server/kern/waarde/reserve');

function wereld() {
  let t = 1760000000000;
  let opgeslagen = 0;
  const db = { data: {} };
  const r = maakReserve({ db, save: () => { opgeslagen++; }, crypto, nu: () => t });
  return { r, db, verzet: (ms) => { t += ms; }, nu: () => t, opgeslagen: () => opgeslagen };
}

test('1. reserveren zet geld vast tot een tijdstip, binnen de grenzen van een minuut en een dag', () => {
  const w = wereld();
  const een = w.r.reserveer({ rek: 'A', centen: 1250.4, doel: 'taxirit', ref: 'rit-1' });
  assert.equal(een.ok, true);
  assert.match(een.reservering.id, /^RS[0-9A-F]{10}$/);
  assert.equal(een.reservering.centen, 1250);
  assert.equal(een.reservering.tot - een.reservering.at, w.r.STANDAARD_MS);
  assert.equal(w.r.vastgezet('A'), 1250);
  assert.equal(w.opgeslagen(), 1);

  const kort = w.r.reserveer({ rek: 'A', centen: 1, msGeldig: 5 }).reservering;
  assert.equal(kort.tot - kort.at, 60000);
  const lang = w.r.reserveer({ rek: 'A', centen: 1, msGeldig: MAX_MS * 3 }).reservering;
  assert.equal(lang.tot - lang.at, MAX_MS);
  const lijf = w.r.reserveer({ rek: 'A', centen: 1, doel: 'd'.repeat(80) }).reservering;
  assert.equal(lijf.doel.length, 60);
  assert.equal(w.r.reserveer({ rek: 'A', centen: 1 }).reservering.doel, 'reservering');

  assert.equal(w.r.reserveer({ centen: 1 }).status, 400);
  for (const centen of [0, -5, 'veel', undefined]) assert.equal(w.r.reserveer({ rek: 'A', centen }).status, 400, String(centen));
});

test('2. een vast nummer maakt een herhaling tot dezelfde reservering, en een afwijking tot een conflict', () => {
  const w = wereld();
  const id = 'RS0123456789';
  const eerste = w.r.reserveer({ rek: 'A', centen: 500 }, { id });
  assert.equal(eerste.reservering.id, id);
  const weer = w.r.reserveer({ rek: 'A', centen: 500 }, { id });
  assert.equal(weer.herhaald, true);
  assert.equal(w.r.open('A').length, 1);
  assert.equal(w.r.reserveer({ rek: 'A', centen: 501 }, { id }).status, 409);
  assert.equal(w.r.reserveer({ rek: 'B', centen: 500 }, { id }).status, 409);
  assert.equal(w.r.reserveer({ rek: 'A', centen: 500 }, { id: 'rs-kapot' }).status, 400);
  assert.equal(w.r.vind(id).rek, 'A');
  assert.equal(w.r.vind('bestaat-niet'), null);
  assert.equal(w.r.vind(undefined), null);
});

test('3. een rekening kan niet onbeperkt reserveringen openzetten', () => {
  const w = wereld();
  for (let i = 0; i < MAX_PER_REKENING; i++) assert.equal(w.r.reserveer({ rek: 'A', centen: 1 }).ok, true);
  assert.equal(w.r.reserveer({ rek: 'A', centen: 1 }).status, 429);
  assert.equal(w.r.reserveer({ rek: 'B', centen: 1 }).ok, true);
});

test('4. vastleggen mag voor minder en nooit voor meer, en maar een keer', () => {
  const w = wereld();
  const id = w.r.reserveer({ rek: 'A', centen: 2000, ref: 'rit-9' }).reservering.id;
  assert.equal(w.r.voorRef('rit-9').length, 1);
  assert.equal(w.r.vastleggen({ id, centen: 2001 }).status, 409);
  assert.equal(w.r.vastleggen({ id, centen: 0 }).status, 400);
  const vast = w.r.vastleggen({ id, centen: 1500 });
  assert.equal(vast.ok, true);
  assert.equal(vast.vrijgevallen, 500);
  assert.equal(vast.reservering.status, 'vastgelegd');
  assert.equal(w.r.vastgezet('A'), 0);
  assert.deepEqual(w.r.voorRef('rit-9'), []);
  assert.equal(w.r.vastleggen({ id }).status, 409);
  assert.equal(w.r.vastleggen({ id: 'RS0000000000' }).status, 404);

  const heel = w.r.reserveer({ rek: 'A', centen: 700 }).reservering.id;
  assert.equal(w.r.vastleggen({ id: heel }).centen, 700);
});

test('5. een verlopen reservering zet niets meer vast en kan niet meer worden vastgelegd', () => {
  const w = wereld();
  const id = w.r.reserveer({ rek: 'A', centen: 300, msGeldig: 60000 }).reservering.id;
  assert.equal(w.r.vastgezet('A'), 300);
  w.verzet(60000);
  assert.equal(w.r.vastgezet('A'), 0);
  const laat = w.r.vastleggen({ id });
  assert.equal(laat.status, 409);
  assert.match(laat.error, /verlopen/);
  assert.equal(w.r.vind(id).status, 'verlopen');
});

test('6. vrijgeven sluit een open reservering, en een tweede keer zegt dat hij al af was', () => {
  const w = wereld();
  const id = w.r.reserveer({ rek: 'A', centen: 900 }).reservering.id;
  const vrij = w.r.vrijgeven({ id });
  assert.deepEqual(vrij, { ok: true, vrijgevallen: 900 });
  assert.equal(w.r.vastgezet('A'), 0);
  const weer = w.r.vrijgeven({ id });
  assert.equal(weer.alAf, true);
  assert.equal(weer.status2, 'vrijgegeven');
  assert.equal(w.r.vrijgeven({ id: 'RS0000000000' }).status, 404);
});
