'use strict';
/* RTG Office: VERWIJDEREN RESPECTEERT DE BEWAARTERMIJN EN HET SPOOR.

   Tot 19 oktober 2026 wiste `weg` een document hard: de bewaartermijn uit het
   beheer (standaard zeven jaar, de fiscale bewaarplicht van art. 52 AWR) telde
   niet, en het auditspoor -- dat in het document zelf woont -- verdween mee.
   Op de teamdrive van een zaak (sleutel 'sup:CODE') is het hele team de
   "eigenaar", dus elk personeelslid kon elk teamdocument definitief wissen.

   Nu:
   - binnen de bewaartermijn verdwijnt het document uit de drive, maar het
     blijft bewaard (met inhoud) tot de termijn om is;
   - daarna, of bij termijn "geen", blijft alleen het spoor over;
   - op de teamdrive wist alleen een manager.

   Draai los: node --test test/office-weg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const crypto = require('node:crypto');
const { maakBasis } = require('../server/kern/office/basis');
const maakDocs = require('../server/kern/office/docs');

function wereld() {
  const db = { data: {} };
  const state = { db, crypto, save() {}, codenaamVan: (k) => 'cn-' + k,
    schoon: (s, max) => String(s == null ? '' : s).trim().slice(0, max), sseToCustomer() {} };
  const basis = maakBasis(state);
  return { db, d: maakDocs(state, basis) };
}

test('binnen de bewaartermijn verdwijnt het document uit de drive maar blijft het bewaard, met spoor', () => {
  const { db, d } = wereld();
  const m = d.officeMaak('a', { soort: 'tekst', titel: 'Factuurafspraak' });
  const r = d.officeWeg('a', m.id);
  assert.equal(r.status, 200);
  assert.equal(r.bewaard, true, 'het antwoord zegt dat het document bewaard blijft');
  assert.match(String(r.bewaarTot || ''), /^\d{4}-\d{2}-\d{2}/, 'en tot wanneer');
  assert.equal(d.officeOpen('a', m.id).status, 404, 'uit de drive');
  assert.ok(!d.officeMijn('a').docs.some((x) => x.id === m.id), 'niet meer in de lijst');
  const bewaard = Object.values(db.data.officeBewaard || {}).find((x) => x.id === m.id);
  assert.ok(bewaard, 'het document is niet hard gewist');
  assert.ok(bewaard.doc && bewaard.doc.inhoud, 'binnen de termijn met inhoud');
  assert.ok(bewaard.doc.audit.some((a) => a.actie === 'verwijderd'), 'het spoor noemt het verwijderen');
  assert.ok(bewaard.doc.audit.some((a) => a.actie === 'aangemaakt'), 'en het eerdere spoor blijft');
});

test('bij bewaartermijn "geen" verdwijnt de inhoud, maar het spoor blijft', () => {
  const { db, d } = wereld();
  const m = d.officeMaak('a', { soort: 'tekst', titel: 'Kladje' });
  db.data.officeDocs[m.id].beheer.bewaartermijn = 'geen';
  const r = d.officeWeg('a', m.id);
  assert.equal(r.status, 200);
  assert.equal(r.bewaard, false);
  const bewaard = Object.values(db.data.officeBewaard || {}).find((x) => x.id === m.id);
  assert.ok(bewaard, 'een spoor blijft');
  assert.equal(bewaard.doc, undefined, 'zonder inhoud');
  assert.ok(Array.isArray(bewaard.audit) && bewaard.audit.some((a) => a.actie === 'verwijderd'));
});

test('alleen de eigenaar verwijdert nog steeds', () => {
  const { d } = wereld();
  const m = d.officeMaak('a', { soort: 'tekst' });
  assert.equal(d.officeWeg('b', m.id).status, 403);
  assert.equal(d.officeOpen('a', m.id).status, 200);
});

test('op de teamdrive van een zaak wist alleen een manager', () => {
  const bron = fs.readFileSync('server/routes/kantoorpakket.js', 'utf8');
  const i = bron.indexOf("'/api/supplier/kantoorpakket/weg'");
  assert.ok(i > 0, 'de route bestaat');
  const blok = bron.slice(i, bron.indexOf('});', i));
  assert.match(blok, /if \(!managerOnly\(req, res\)\) return;/, 'verwijderen op de teamdrive vraagt een manager');
});
