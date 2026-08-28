/* Gewoonten (kern/gewoonten.js). Het meeste dat hier bewezen wordt is een
   NEGATIEF, en dat is de hele reden dat deze laag zo klein is:

   - de reeksteller staat UIT tot het lid hem zelf aanzet, en wat uit staat komt
     ook niet stiekem mee in het antwoord;
   - uitzetten gooit niets weg;
   - een gebroken reeks is geen gebeurtenis: geen melding, geen rood, geen tekst
     die zegt dat u iets verspeelde;
   - er is geen percentage, geen score en geen ranglijst.
   Draai los: node --test test/gewoonten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { reeksVan } = require('../server/kern/gewoonten');

let srv, base, lid, lid2, id;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gewoonten-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  assert.ok(lid && lid2);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de reeks telt dagen op rij, en een lege dag van vandaag breekt hem niet', () => {
  const nu = new Date('2026-08-09T12:00:00Z');
  assert.equal(reeksVan(['2026-08-07', '2026-08-08', '2026-08-09'], nu), 3);

  /* Vandaag is nog niet voorbij. Wie hem nog niet heeft afgevinkt, hoort niet
     te lezen dat zijn reeks op nul staat -- de dag loopt nog. */
  assert.equal(reeksVan(['2026-08-07', '2026-08-08'], nu), 2, 'de reeks loopt tot gisteren door');

  assert.equal(reeksVan(['2026-08-05', '2026-08-06'], nu), 0, 'maar een gat van twee dagen breekt hem wel');
  assert.equal(reeksVan([], nu), 0);
});

test('een nieuwe gewoonte heeft GEEN teller, en die staat ook niet in het antwoord', async () => {
  const r = await api('gewoonten/maak', { naam: 'Elke dag even buiten', waarom: 'hoofd leeg' }, lid);
  assert.equal(r.status, 200);
  id = r.body.gewoonte.id;
  assert.equal(r.body.gewoonte.reeksAan, false, 'uit, tenzij u hem zelf aanzet');
  assert.equal(r.body.gewoonte.reeks, undefined,
    'en wat uit staat komt niet stiekem mee: wat er niet is, kan ook niet opduiken');
  assert.equal(r.body.gewoonte.vandaagGedaan, false);
  assert.equal((await api('gewoonten/maak', { naam: '' }, lid)).status, 400);
});

test('afvinken is een tik, en dezelfde tik zet hem weer uit', async () => {
  const aan = await api('gewoonten/tik', { id }, lid);
  assert.equal(aan.body.gewoonte.vandaagGedaan, true);
  assert.deepEqual(aan.body.gewoonte.dagen, [overDagen(0)]);

  const uit = await api('gewoonten/tik', { id }, lid);
  assert.equal(uit.body.gewoonte.vandaagGedaan, false,
    'een vergissing is geen handeling die u in een apart menu moet terugdraaien');
  assert.deepEqual(uit.body.gewoonte.dagen, []);

  assert.equal((await api('gewoonten/tik', { id, op: overDagen(1) }, lid)).status, 400,
    'morgen valt niet af te vinken');
});

test('de teller aanzetten laat hem zien, uitzetten gooit niets weg', async () => {
  await api('gewoonten/tik', { id, op: overDagen(-2) }, lid);
  await api('gewoonten/tik', { id, op: overDagen(-1) }, lid);
  await api('gewoonten/tik', { id, op: overDagen(0) }, lid);

  const zonder = (await api('gewoonten', {}, lid)).body.gewoonten[0];
  assert.equal(zonder.reeks, undefined, 'zonder teller geen getal, ook al zijn er drie dagen');
  assert.equal(zonder.dagen.length, 3, 'de afvinkjes staan er wel');

  const aan = await api('gewoonten/reeks', { id, aan: true }, lid);
  assert.equal(aan.body.gewoonte.reeksAan, true);
  assert.equal(aan.body.gewoonte.reeks, 3);

  const weer_uit = await api('gewoonten/reeks', { id, aan: false }, lid);
  assert.equal(weer_uit.body.gewoonte.reeks, undefined, 'de teller is weg');
  assert.equal(weer_uit.body.gewoonte.dagen.length, 3, 'maar wat u deed staat er nog gewoon');
});

test('een gebroken reeks is geen gebeurtenis', async () => {
  /* Er komt geen melding, geen rood en geen zin die zegt dat u iets kwijt bent.
     Wie een dag oversloeg, ziet morgen gewoon weer een knop. */
  await api('gewoonten/reeks', { id, aan: true }, lid);
  await api('gewoonten/tik', { id, op: overDagen(-1) }, lid);   // gisteren weer weg
  await api('gewoonten/tik', { id, op: overDagen(0) }, lid);    // en vandaag ook

  const g = (await api('gewoonten', {}, lid)).body.gewoonten[0];
  assert.equal(g.reeks, 0, 'de teller staat gewoon op nul');
  const tekst = JSON.stringify(g);
  assert.ok(!/verspeeld|kwijt|mislukt|helaas|jammer|opnieuw beginnen/i.test(tekst),
    'en er staat geen enkel woord dat er een gebeurtenis van maakt');
});

test('er is geen score, geen percentage en geen ranglijst', async () => {
  const d = (await api('gewoonten', {}, lid)).body;
  const tekst = JSON.stringify(d);
  for (const veld of ['score', 'percentage', 'pct', 'ranglijst', 'best', 'record']) {
    assert.ok(!new RegExp('"' + veld, 'i').test(tekst), 'geen veld "' + veld + '"');
  }
  const g = d.gewoonten[0];
  assert.deepEqual(Object.keys(g).sort(),
    ['dagen', 'id', 'naam', 'reeks', 'reeksAan', 'vandaagGedaan', 'venster', 'waarom'],
    'de vorm ligt vast: hier hoort niets bij te sluipen zonder dat deze toets zakt');
});

test('de gewoonte van een ander bestaat niet voor jou', async () => {
  assert.equal((await api('gewoonten', {}, lid2)).body.gewoonten.length, 0);
  assert.equal((await api('gewoonten/tik', { id }, lid2)).status, 404);
  assert.equal((await api('gewoonten/reeks', { id, aan: true }, lid2)).status, 404);
  assert.equal((await api('gewoonten/stop', { id }, lid2)).status, 404);

  assert.equal((await api('gewoonten', {}, lid)).body.gewoonten.length, 1, 'en de uwe staat er nog');
  assert.equal((await api('gewoonten/stop', { id }, lid)).status, 200);
  assert.equal((await api('gewoonten', {}, lid)).body.gewoonten.length, 0);
});
