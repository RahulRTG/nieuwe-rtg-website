/* Facturen downloaden. Zelfgebouwde PDF-schrijver (geen pakketten) + de
   leden-endpoints om een factuur en een jaaroverzicht op te halen.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const factuur = require('../server/kern/factuur');
const { startServer, stop } = require('./helper');

// ---- 1. de PDF-schrijver ----
test('factuur: ledenFactuur levert een geldige PDF met de kerngegevens', () => {
  const pdf = factuur.ledenFactuur(
    { id: 'RTG-2026-0207', desc: 'Maandbijdrage lidmaatschap juli 2026', netto: 0, bijdrage: 78.65, btw: 13.65, status: 'open', date: 'Vervalt 1 augustus 2026' },
    { codename: 'AURELIA', tier: 'business' });
  assert.ok(Buffer.isBuffer(pdf), 'geeft een Buffer');
  const s = pdf.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'), 'begint met de PDF-kop');
  assert.ok(s.trimEnd().endsWith('%%EOF'), 'eindigt met %%EOF');
  assert.ok(s.includes('startxref'), 'heeft een xref-tabel');
  assert.ok(s.includes('RTG-2026-0207'), 'bevat het factuurnummer');
  assert.ok(s.includes('EUR 78,65'), 'bevat het bijdragebedrag');
  assert.ok(s.includes('RTFoundation'), 'toont de foundation-regel voor een abonnement');
});

test('factuur: overzichtPdf en csv', () => {
  const pdf = factuur.overzichtPdf({ titel: 'Factuuroverzicht 2026', periode: '2026' },
    [{ label: 'RTG-1 Iets', waarde: factuur.euroTekst(100) }, { label: 'Totaal', waarde: factuur.euroTekst(100), bold: true, streep: true }]);
  assert.ok(pdf.toString('latin1').startsWith('%PDF-1.4'));
  // CSV escapet velden met puntkomma/aanhalingstekens
  const c = factuur.csv([['a', 'b;c', 'd"e']]);
  assert.ok(c.includes('"b;c"') && c.includes('"d""e"'));
});

// ---- 2. de download-endpoints ----
function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}

let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fact-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('e2e: een lid downloadt zijn factuur en een jaaroverzicht als PDF', async () => {
  const lid = (await (await api(base, '/api/login', { tier: 'business' })).json()).token;
  const st = await (await api(base, '/api/state', {}, lid)).json();
  const inv = (st.state.invoices || [])[0];
  assert.ok(inv, 'er is een factuur');

  const r = await api(base, '/api/factuur', { invoiceId: inv.id }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.match(r.headers.get('content-disposition') || '', /attachment; filename=/);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.toString('latin1').startsWith('%PDF-1.4'), 'echt een PDF');
  assert.ok(buf.length > 400, 'geen lege PDF');

  const ov = await api(base, '/api/facturen/overzicht', {}, lid);
  assert.equal(ov.status, 200);
  assert.ok(Buffer.from(await ov.arrayBuffer()).toString('latin1').startsWith('%PDF-1.4'));

  // een gast (geen lid) mag niet
  const gast = (await (await api(base, '/api/login', { tier: 'guest' })).json()).token;
  const weg = await api(base, '/api/factuur', { invoiceId: inv.id }, gast);
  assert.equal(weg.status, 403);
});
