/* ALLEEN HET DOELHEK WORDT BEWAARD (NAVIGATIE.md N12).

   Een naderingsvenster hoort bij een bezoek aan EEN zaak. Het toestel krijgt de
   hekken van alle zaken in de buurt, en meldde elke overgang; de server schreef
   ze allemaal in de waarnemingen en in het actielog (90 dagen). Zo legde RTG
   onder een codenaam vast langs welke zaken iemand liep -- een bewegingsspoor
   (par. 6.2). Nu noemt het venster zijn hek, en een overgang langs een ander hek
   wordt verwerkt en niet bewaard.

   Draai los: node --test test/plaatsdoelhek.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const IK = 'Amberen Vos';
const A = 'leverancier:ZAAKA', B = 'leverancier:ZAAKB';

function maak() {
  const db = { data: {} };
  const navPoi = (lagen) => ({ status: 200, lagen: Object.fromEntries(lagen.map(l =>
    [l, l === 'leverancier'
      ? [{ naam: 'Zaak A', code: 'ZAAKA', lat: 38.91, lng: 1.43 }, { naam: 'Zaak B', code: 'ZAAKB', lat: 38.92, lng: 1.44 }]
      : []])) });
  const plaats = require('../server/kern/plaats')({ db, save: () => {}, crypto, weefsel: null, navPoi }).plaats;
  return { db, plaats };
}
const logOver = (db, hek) => (db.data.plaatsLog || []).filter(r => r.wat === 'waargenomen' && r.hek === hek);

test('1. een naderingsvenster zonder (bekend) hek gaat niet open', () => {
  const { plaats } = maak();
  assert.equal(plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'toets' }).status, 400);
  assert.equal(plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'toets', hek: 'leverancier:NERGENS' }).status, 400);
  assert.equal(plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'toets', hek: A }).status, 200);
});

test('2. een passage langs een andere zaak wordt verwerkt en nergens bewaard', () => {
  /* ZAKT OP: de doelhekregel uit kern/plaats/waarnemen.js halen -- dan staat de
     passage in de waarnemingen en in het actielog, zoals voor 29 september. */
  const { db, plaats } = maak();
  plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'bezoek aan A', hek: A });
  for (const wat of ['binnen', 'buiten']) {
    const r = plaats.plaatsWaarneem(IK, { doel: 'nadering', hek: B, wat });
    assert.equal(r.status, 200, 'het toestel deed niets fout');
    assert.equal(r.opgeslagen, false, 'en het antwoord zegt hardop dat er niets bewaard is');
  }
  assert.equal((db.data.plaatsWaarnemingen || []).filter(w => w.hek === B).length, 0, 'geen waarneming over B');
  assert.equal(logOver(db, B).length, 0, 'en geen regel in het actielog');
  assert.equal(plaats.plaatsStand(IK).waarnemingen.length, 0, 'de zelf-inzage toont ook niets over B');
});

test('3. het doelhek zelf wordt wel bewaard, en een verlenging kan het doel verzetten', () => {
  const { db, plaats } = maak();
  plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'bezoek aan A', hek: A });
  const r = plaats.plaatsWaarneem(IK, { doel: 'nadering', hek: A, wat: 'binnen' });
  assert.equal(r.status, 200);
  assert.equal(r.nieuw, true);
  assert.equal(logOver(db, A).length, 1, 'de nadering van het bezoek staat in het actielog');
  // een nieuw bezoek: hetzelfde venster, nu naar B -- dan telt B en A niet meer
  plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'bezoek aan B', hek: B });
  assert.equal(plaats.plaatsWaarneem(IK, { doel: 'nadering', hek: A, wat: 'buiten' }).opgeslagen, false);
  assert.equal(plaats.plaatsWaarneem(IK, { doel: 'nadering', hek: B, wat: 'binnen' }).nieuw, true);
});
