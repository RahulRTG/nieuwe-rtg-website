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
