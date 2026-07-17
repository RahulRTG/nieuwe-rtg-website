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

// Regressie-hek: CSV-/formule-injectie. Een cel die met = + - @ of een
// besturingsteken begint mag in Excel/Sheets niet als formule uitgevoerd
// kunnen worden. csvCel zet er een apostrof voor; gewone (ook negatieve)
// bedragen blijven ongemoeid.
test('csvCel: neutraliseert formule-injectie maar spaart getallen', () => {
  // gevaarlijke leidende tekens krijgen een apostrof
  assert.equal(factuur.csvCel('=1+1'), "'=1+1");
  assert.equal(factuur.csvCel('+SUM(A1)'), "'+SUM(A1)");
  assert.equal(factuur.csvCel('@foo'), "'@foo");
  // de klassieke aanval, inclusief csv-escaping van de puntkomma
  assert.equal(factuur.csvCel('=cmd|"/c calc"!A1'), '"\'=cmd|""/c calc""!A1"');
  // een leidende tab wordt ook geneutraliseerd
  assert.ok(factuur.csvCel('\t=1').startsWith("'"));
  // gewone tekst blijft onaangeroerd
  assert.equal(factuur.csvCel('AURELIA'), 'AURELIA');
  // bedragen krijgen GEEN formule-apostrof (een leidende - blijft een getal).
  // (een komma zorgt wel voor csv-quoting, dat is de bestaande escaping.)
  assert.ok(!factuur.csvCel('12,50').startsWith("'"));
  assert.ok(!factuur.csvCel('-12,50').startsWith("'") && !factuur.csvCel('-12,50').startsWith('"\''));
  assert.equal(factuur.csvCel('-8%'), '-8%');   // geen komma: blijft kaal
  // en het werkt door de hele csv() heen
  const rij = factuur.csv([['gast', '=WEBSERVICE("http://x")']]);
  assert.ok(rij.includes("'=WEBSERVICE"), 'formule in een rij wordt geneutraliseerd');
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

test('e2e: een leverancier exporteert de boekhouding als PDF en CSV', async () => {
  const zaak = (await (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).json()).token;
  assert.ok(zaak, 'leverancier-login');

  const pdf = await api(base, '/api/supplier/finance/export', { formaat: 'pdf' }, zaak);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.ok(Buffer.from(await pdf.arrayBuffer()).toString('latin1').startsWith('%PDF-1.4'));

  const csv = await api(base, '/api/supplier/finance/export', { formaat: 'csv' }, zaak);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type') || '', /text\/csv/);
  const tekst = await csv.text();
  assert.ok(/boekhoudoverzicht/i.test(tekst) && tekst.includes(';'), 'CSV met kop en scheidingsteken');
});
