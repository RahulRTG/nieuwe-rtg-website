/* Het beraad (kern/beraad/index.js), de weigeringen en herhalingen: elke
   invoer die niet klopt (geen drager, lege vraag, telefoonnummer in de tekst,
   een quorum buiten de groep), elke handeling zonder regie, en elke herhaling
   die niets mag veranderen. test/beraad.test.js toetst het gewone verloop;
   dit bestand de zijpaden ervan.

   Draait op het ECHTE genootschap in het geheugen, behalve waar een drager
   moet verdwijnen of geen ledenlijst heeft: daar een nagemaakt genootschap. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const TELEFOON = 'Bel me op 0612345678 als het doorgaat.';

function wereld({ vasteKlok = false } = {}) {
  const db = { data: {} };
  let saves = 0;
  const save = () => { saves++; };
  const codenaamVan = (k) => 'Codenaam-' + k;
  const notify = () => {};
  const genootschap = require('../server/kern/genootschap')({ db, save() {}, codenaamVan, keyVanCodenaam: null, notify });
  let klok = Date.parse('2026-10-11T10:00:00Z');
  const beraad = require('../server/kern/beraad')({ db, save, codenaamVan, notify, genootschap, nu: () => vasteKlok ? klok : klok++ });
  const gr = genootschap.richtOp({ key: 'a' }, { naam: 'De Takkenkring', soort: 'openbaar' }).groep;
  for (const k of ['b', 'c', 'd']) genootschap.tredBinnen({ key: k }, gr.id);
  const drager = { soort: 'genootschap', id: gr.id };
  return { db, beraad, genootschap, gr, drager, saves: () => saves };
}
const s = key => ({ key });
function metBeraad(opties) {
  const w = wereld(opties);
  const o = w.beraad.open(s('a'), { drager: w.drager, vraag: 'Gaan we in juni samen naar Brugge?' });
  assert.ok(o.ok, o.error);
  return Object.assign(w, { id: o.beraad.id });
}

test('open: zonder invoer, zonder vraag, met telefoonnummer of fout quorum wordt geweigerd', () => {
  const w = wereld();
  assert.equal(w.beraad.open(s('a')).status, 400, 'zonder invoer geen drager');
  assert.equal(w.beraad.open(s('a'), { drager: w.drager }).status, 400);
  assert.match(w.beraad.open(s('a'), { drager: w.drager, vraag: '   ' }).error, /Een vraag is het begin/);
  assert.match(w.beraad.open(s('a'), { drager: w.drager, vraag: TELEFOON }).error, /telefoonnummers/);
  assert.equal(w.beraad.open(s('a'), { drager: { soort: 'genootschap', id: 999999 }, vraag: 'x?' }).status, 404);
  for (const quorum of [0, 5, 1.5, 'drie']) {
    const r = w.beraad.open(s('a'), { drager: w.drager, vraag: 'Een vraag?', quorum });
    assert.equal(r.status, 400, 'quorum ' + quorum);
    assert.match(r.error, /tussen 1 en het aantal leden \(4\)/);
  }
  assert.equal(w.beraad.lijstKijk().length, 0, 'niets geopend');
  assert.equal(w.saves(), 0);
});

test('open: het standaardquorum is de helft naar boven, een opgegeven quorum telt als getal', () => {
  const w = wereld();
  const a = w.beraad.open(s('a'), { drager: w.drager, vraag: 'Eerste vraag?', quorum: '' });
  const b = w.beraad.open(s('b'), { drager: w.drager, vraag: 'Tweede vraag?', quorum: '3', gevoelig: true });
  assert.equal(w.beraad.huidige(w.beraad.lijstKijk().find(x => x.id === a.beraad.id)).quorum, 2);
  const bb = w.beraad.lijstKijk().find(x => x.id === b.beraad.id);
  assert.equal(w.beraad.huidige(bb).quorum, 3);
  assert.equal(bb.gevoelig, true);
  assert.equal(w.beraad.lijstKijk()[0].id, b.beraad.id, 'het nieuwste staat vooraan');
});

test('open: bij een stilstaande klok krijgt elk beraad toch een eigen id', () => {
  const w = wereld({ vasteKlok: true });
  const a = w.beraad.open(s('a'), { drager: w.drager, vraag: 'Vraag een?' });
  const b = w.beraad.open(s('a'), { drager: w.drager, vraag: 'Vraag twee?' });
  const c = w.beraad.open(s('a'), { drager: w.drager, vraag: 'Vraag drie?' });
  assert.equal(b.beraad.id, a.beraad.id + 1);
  assert.equal(c.beraad.id, a.beraad.id + 2);
});

test('de poort: geen sessie, geen sleutel, geen id of een verdwenen drager geeft 404', () => {
  const w = metBeraad();
  assert.equal(w.beraad.lees(null, w.id).status, 404);
  assert.equal(w.beraad.lees({}, w.id).status, 404);
  assert.equal(w.beraad.lees(s('a'), null).status, 404);
  assert.equal(w.beraad.lees(s('a'), String(w.id)).ok, true, 'een id als tekst werkt');
  const leeg = require('../server/kern/beraad')({ db: { data: {} }, save() {}, codenaamVan: k => k, notify() {}, genootschap: w.genootschap });
  assert.equal(leeg.lees(s('a'), 1).status, 404, 'zonder lijst geen beraad');
  // dezelfde database, maar een genootschap dat de drager niet meer kent
  const weg = require('../server/kern/beraad')({ db: w.db, save() {}, codenaamVan: k => k, notify() {},
    genootschap: Object.assign({}, w.genootschap, { groepMet: () => null }) });
  assert.equal(weg.lees(s('a'), w.id).status, 404);
});

test('lees: de opener en een beheerder hebben regie, een gewoon lid niet', () => {
  const w = metBeraad();
  assert.equal(w.beraad.lees(s('a'), w.id).mijnRegie, true);
  assert.equal(w.beraad.lees(s('b'), w.id).mijnRegie, false);
});

test('inbreng: onbekende soort, lege tekst en telefoonnummer worden geweigerd', () => {
  const w = metBeraad();
  assert.match(w.beraad.inbreng(s('b'), w.id, { soort: 'grap', tekst: 'x' }).error, /inbreng, bezwaar of open-punt/);
  assert.match(w.beraad.inbreng(s('b'), w.id).error, /Wat wil je inbrengen/);
  assert.match(w.beraad.inbreng(s('b'), w.id, { tekst: TELEFOON }).error, /telefoonnummers/);
  const goed = w.beraad.inbreng(s('b'), w.id, { soort: 'bezwaar', tekst: 'Juni is te vroeg.' });
  assert.ok(goed.ok);
  assert.ok(goed.id != null);
});

test('inbreng intrekken: door een ander, twee keer, en een onbekende regel', () => {
  const w = metBeraad();
  const { id: regel } = w.beraad.inbreng(s('b'), w.id, { tekst: 'Ik neem de fiets mee.' });
  assert.equal(w.beraad.inbreng(s('c'), w.id, { intrek: regel }).status, 403);
  assert.equal(w.beraad.inbreng(s('b'), w.id, { intrek: 'bestaat-niet' }).status, 404);
  const voor = w.saves();
  const eerst = w.beraad.inbreng(s('b'), w.id, { intrek: regel });
  assert.equal(eerst.ok, true);
  assert.equal(eerst.herhaling, undefined);
  assert.equal(w.saves(), voor + 1);
  const nog = w.beraad.inbreng(s('b'), w.id, { intrek: regel });
  assert.equal(nog.herhaling, true);
  assert.equal(w.saves(), voor + 1, 'een herhaling bewaart niets');
});

test('voorstel: leeg, met telefoonnummer, tijdens stemmen zonder regie, en na het besluit', () => {
  const w = metBeraad();
  assert.match(w.beraad.voorstel(s('b'), w.id).error, /zonder tekst/);
  assert.match(w.beraad.voorstel(s('b'), w.id, { tekst: TELEFOON }).error, /telefoonnummers/);
  const v1 = w.beraad.voorstel(s('b'), w.id, { tekst: 'Op 14 juni met de trein.' });
  assert.equal(v1.versie, 1);
  assert.equal(w.beraad.naarStemmen(s('b'), w.id).status, 403, 'een gewoon lid zet niet naar stemmen');
  assert.ok(w.beraad.naarStemmen(s('a'), w.id).ok);
  assert.equal(w.beraad.naarStemmen(s('a'), w.id).herhaling, true, 'tweede keer is een herhaling');
  assert.equal(w.beraad.voorstel(s('b'), w.id, { tekst: 'Toch op 21 juni.' }).status, 403);
  const v2 = w.beraad.voorstel(s('a'), w.id, { tekst: 'Toch op 21 juni.' });
  assert.equal(v2.versie, 2);
  assert.ok(w.beraad.naarStemmen(s('a'), w.id).ok);
  assert.equal(w.beraad.stem(s('b'), w.id).status, 400, 'een lege keuze is geen stem');
  assert.ok(w.beraad.stem(s('b'), w.id, 'voor').ok);
  assert.equal(w.beraad.stem(s('b'), w.id, 'voor').herhaling, true);
  const dicht = w.beraad.sluit(s('a'), w.id, { toelichting: 'Dank voor het meedenken.' });
  assert.ok(dicht.ok);
  assert.equal(w.beraad.voorstel(s('a'), w.id, { tekst: 'Nog iets anders.' }).status, 409);
});

test('sluit: zonder regie, met telefoonnummer, buiten de stemming, en de herhaling', () => {
  const w = metBeraad();
  assert.equal(w.beraad.sluit(s('b'), w.id).status, 403);
  assert.match(w.beraad.sluit(s('a'), w.id, { toelichting: TELEFOON }).error, /telefoonnummers/);
  assert.equal(w.beraad.sluit(s('a'), w.id).status, 409, 'er wordt niet gestemd');
  assert.equal(w.beraad.sluit(s('a'), w.id, { intrekken: true, toelichting: 'kort' }).status, 400);
  const weg = w.beraad.sluit(s('a'), w.id, { intrekken: true, toelichting: 'We gaan toch niet, het weer wordt slecht.' });
  assert.ok(weg.ok);
  assert.equal(w.beraad.huidige(w.beraad.lijstKijk()[0]).eindstand.stand, 'ingetrokken');
  const voor = w.saves();
  const nog = w.beraad.sluit(s('a'), w.id);
  assert.equal(nog.herhaling, true);
  assert.equal(w.saves(), voor, 'een herhaalde sluiting bewaart niets');
});

test('heropen: zonder regie, met telefoonnummer, fout quorum, lopende ronde en het gelukte heropenen', () => {
  const w = metBeraad();
  const reden = 'Er is een nieuwe datum beschikbaar gekomen.';
  assert.equal(w.beraad.heropen(s('b'), w.id, { reden }).status, 403);
  assert.match(w.beraad.heropen(s('a'), w.id, { reden: TELEFOON }).error, /telefoonnummers/);
  assert.match(w.beraad.heropen(s('a'), w.id, { reden, quorum: 9 }).error, /quorum/);
  assert.equal(w.beraad.heropen(s('a'), w.id, { reden }).status, 409, 'de ronde loopt nog');
  w.beraad.sluit(s('a'), w.id, { intrekken: true, toelichting: 'Even pauzeren, tot de nieuwe datum.' });
  assert.equal(w.beraad.heropen(s('a'), w.id).status, 400, 'zonder reden');
  const r = w.beraad.heropen(s('a'), w.id, { reden, quorum: 4 });
  assert.ok(r.ok);
  const b = w.beraad.lijstKijk()[0];
  assert.equal(b.rondes.length, 2);
  assert.equal(w.beraad.huidige(b).quorum, 4);
  assert.equal(w.beraad.huidige(b).stand, 'open');
});

test('een genootschap zonder ledenlijst rekent met een lid', () => {
  const groep = { id: 7 };
  const nep = { groepMet: id => (id === 7 ? groep : null), isLid: () => true, isBeheer: () => false, mijne: () => [groep] };
  const beraad = require('../server/kern/beraad')({ db: { data: {} }, save() {}, codenaamVan: k => k, notify() {}, genootschap: nep });
  const r = beraad.open(s('x'), { drager: { soort: 'genootschap', id: 7 }, vraag: 'Alleen ik?' });
  assert.ok(r.ok);
  assert.equal(beraad.huidige(beraad.lijstKijk()[0]).quorum, 1);
  const fout = beraad.open(s('x'), { drager: { soort: 'genootschap', id: 7 }, vraag: 'Met twee?', quorum: 2 });
  assert.match(fout.error, /aantal leden \(0\)/);
  assert.equal(beraad.lees(s('x'), beraad.lijstKijk()[0].id).mijnRegie, true, 'de opener heeft regie');
});
