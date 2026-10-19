/* School: EEN DUBBELE TIK OP "EEN LEERJAAR ERBIJ" TELT EEN LEERJAAR.

   /api/onderwijs/jaar-over (en de Foundation-variant) telde bij elke
   aanroep een leerjaar op. Zonder herhaalsleutel werd een dubbele tik, of een
   afgebroken verzoek dat opnieuw ging, twee leerjaren -- in een leerpaspoort
   dat de leerling en zijn ouders lezen. Gevonden bij de domeinkaart van
   19 oktober 2026.

   De vaste regel voor herhaalsleutels (integrator, 19 oktober): het scherm
   stuurt per intentie een RTGId; de kern bewaart de sleutel op het object
   (hier: het paspoort), zodat hij ook na een crash nog geldt; dezelfde sleutel
   geeft het eerste resultaat terug.

   Draai los: node --test test/onderwijs-jaarover.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { maakOnderwijs } = require('../server/kern/onderwijs');

function school() {
  const db = { data: {} };
  return { db, O: maakOnderwijs({ db, save: () => {} }) };
}

test('dezelfde sleutel telt een leerjaar, ook als hij twee keer komt', () => {
  const { O } = school();
  assert.equal(O.inschrijf('lid1', { fase: 'vmbo-kb' }).status || 200, 200);
  const jaar0 = O.mijn('lid1').jaar;
  const a = O.jaarOver('lid1', 'jo-1');
  const b = O.jaarOver('lid1', 'jo-1');
  assert.equal(a.jaar, jaar0 + 1);
  assert.equal(b.jaar, jaar0 + 1, 'de herhaling telt niet opnieuw');
  assert.equal(b.herhaald, true, 'en zegt dat het een herhaling was');
});

test('een nieuwe sleutel is een nieuwe intentie', () => {
  const { O } = school();
  O.inschrijf('lid1', { fase: 'vmbo-kb' });
  const jaar0 = O.mijn('lid1').jaar;
  O.jaarOver('lid1', 'jo-1');
  assert.equal(O.jaarOver('lid1', 'jo-2').jaar, jaar0 + 2);
});

test('de sleutel woont op het paspoort, dus hij overleeft een herstart', () => {
  const { db, O } = school();
  O.inschrijf('lid1', { fase: 'vmbo-kb' });
  O.jaarOver('lid1', 'jo-1');
  const opnieuw = maakOnderwijs({ db, save: () => {} });
  const r = opnieuw.jaarOver('lid1', 'jo-1');
  assert.equal(r.herhaald, true);
});

test('het scherm stuurt per tik een sleutel mee', () => {
  const bron = fs.readFileSync('public/apps/rtgschool/leer.js', 'utf8');
  assert.match(bron, /\/api\/onderwijs\/jaar-over', \{ idem: RTGId\(/);
});

/* Tweede reparatieronde (19 oktober 2026): inschrijf zette altijd jaar = 1,
   ook bij dezelfde fase, en had geen herhaalsleutel. Een dubbele tik op
   "Inschrijven" zette havo 3 stil terug naar havo 1 -- dataverlies in het
   leerpaspoort. */
test('opnieuw inschrijven op dezelfde fase zet het leerjaar niet terug', () => {
  const { O } = school();
  O.inschrijf('lid1', { fase: 'havo' });
  O.jaarOver('lid1', 'j1'); O.jaarOver('lid1', 'j2');
  assert.equal(O.mijn('lid1').jaar, 3);
  const r = O.inschrijf('lid1', { fase: 'havo' });
  assert.equal(r.jaar, 3, 'havo 3 blijft havo 3');
  assert.equal(r.alIngeschreven, true);
});

test('inschrijven draagt een herhaalsleutel: dezelfde sleutel na een overstap doet niets nieuws', () => {
  const { O } = school();
  O.inschrijf('lid1', { fase: 'havo', idem: 'in-1' });
  O.jaarOver('lid1', 'j1');
  const voor = O.mijn('lid1');
  const r = O.inschrijf('lid1', { fase: 'havo', idem: 'in-1' });
  assert.equal(r.herhaald, true);
  assert.equal(r.jaar, voor.jaar);
  assert.equal(O.mijn('lid1').historie.length, voor.historie.length, 'geen extra historieregel');
});

test('het scherm stuurt bij inschrijven een sleutel mee', () => {
  const bron = fs.readFileSync('public/apps/rtgschool/leer/leer-04.js', 'utf8');
  assert.match(bron, /\/api\/onderwijs\/inschrijf', \{ fase: f, idem: RTGId\(/);
});
