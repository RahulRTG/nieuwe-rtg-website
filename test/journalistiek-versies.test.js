'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
function redactie() {
  return require('../server/kern/journalistiek')({ db: { data: {} }, save() {}, crypto: require('node:crypto'),
    findSupplier: code => ({ name: code }) });
}
const auteur = { name: 'Auteur', staffId: 'a1' }, editor = { name: 'Editor', staffId: 'e1' };
const stuk = { titel: 'De haven', chapo: 'Een bericht', inhoud: 'De eerste vastgestelde tekst.', notities: 'Vertrouwelijke bron: 0612345678' };

test('een werkversie en review lekken niet naar de krant; correctie heeft bronversie en toelichting', () => {
  const j = redactie(); let a = j.bewaarArtikel('EEN', stuk, auteur).artikel;
  assert.equal(j.leesArtikel('EEN', a.id).status, 404);
  a = j.publiceer('EEN', a.id, auteur, { revisie: a.revisie }).artikel;
  const eerste = j.leesArtikel('EEN', a.id).artikel;
  a = j.bewaarArtikel('EEN', { ...stuk, id: a.id, revisie: a.revisie, inhoud: 'Een interne nieuwe bevinding.', naarReview: true }, editor).artikel;
  assert.equal(a.redactiestand, 'eindredactie');
  assert.equal(j.artikelen('EEN', { status: 'eindredactie' }).lijst.length, 1);
  const openbaar = j.leesArtikel('EEN', a.id).artikel;
  assert.equal(openbaar.inhoud, stuk.inhoud);
  assert.equal(j.krant('EEN').artikelen[0].publicatieversie, 1);
  assert.ok(!JSON.stringify([openbaar, j.krant('EEN')]).includes('Vertrouwelijke'));
  assert.equal(j.publiceer('EEN', a.id, editor).status, 400);
  j.publiceer('EEN', a.id, editor, { revisie: a.revisie, toelichting: 'De aanlegdatum is gecorrigeerd.' });
  const tweede = j.leesArtikel('EEN', a.id).artikel;
  assert.equal(tweede.inhoud, 'Een interne nieuwe bevinding.'); assert.equal(tweede.versie, 2);
  assert.equal(tweede.gepubliceerd, eerste.gepubliceerd); assert.equal(tweede.auteur, 'Auteur');
  assert.deepEqual(tweede.correcties.map(x => x.toelichting), ['De aanlegdatum is gecorrigeerd.']);
  assert.ok(!JSON.stringify(tweede).includes('staffId'));
  assert.equal(j.artikelVol('EEN', a.id).historie.at(-1).staffId, 'e1');
  j.naarConcept('EEN', a.id, editor);
  assert.equal(j.leesArtikel('EEN', a.id).status, 404); assert.equal(j.krantGids().length, 0);
  assert.equal(j.publiceer('EEN', a.id, editor).status, 400, 'ook herpublicatie vraagt een toelichting');
});

test('verouderde werkversies kunnen niet overschrijven, publiceren of intrekken; vreemde IDs maken niets aan', () => {
  const j = redactie(); const a = j.bewaarArtikel('EEN', stuk, auteur).artikel, rev = a.revisie;
  j.bewaarArtikel('EEN', { ...stuk, id: a.id, revisie: rev, titel: 'Nieuwste kop' }, editor);
  for (const r of [j.bewaarArtikel('EEN', { ...stuk, id: a.id, revisie: rev }, auteur),
    j.publiceer('EEN', a.id, auteur, { revisie: rev }), j.naarConcept('EEN', a.id, auteur, { revisie: rev })]) assert.equal(r.status, 409);
  assert.equal(j.artikelVol('EEN', a.id).titel, 'Nieuwste kop');
  assert.equal(j.bewaarArtikel('TWEE', { ...stuk, id: a.id }, editor).status, 404);
  assert.equal(j.publiceer('TWEE', a.id, editor).status, 404);
  assert.equal(j.artikelVol('TWEE', a.id), null);
  assert.equal(j.snel('EEN', { ...stuk, id: a.id }, editor).status, 400);
  assert.equal(j.snel('EEN', { titel: 'Zonder tekst' }, editor).status, 400);
});

test('bestaande live artikelen blijven leesbaar; hun eerste correctie raakt het origineel pas bij publicatie', () => {
  const j = redactie(); const a = { id: 'oud', ...stuk, auteur: 'Oude auteur', status: 'live', bij: '2020-01-01T00:00:00Z' };
  j.ruimte('EEN').artikelen.push(a);
  assert.equal(j.leesArtikel('EEN', 'oud').artikel.versie, 1);
  j.bewaarArtikel('EEN', { ...stuk, id: 'oud', titel: 'Conceptcorrectie' }, editor);
  assert.equal(j.krant('EEN').artikelen[0].titel, stuk.titel);
  j.publiceer('EEN', 'oud', editor, { toelichting: 'Kop verbeterd.' });
  assert.equal(j.krant('EEN').artikelen[0].titel, 'Conceptcorrectie');
  assert.equal(j.leesArtikel('EEN', 'oud').artikel.gepubliceerd, '2020-01-01T00:00:00Z');
});
