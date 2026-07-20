/* RTFoundation-afdracht: van elke bevestigde maandbetaling gaat 30% (ex btw)
   automatisch naar de foundation. We toetsen drie lagen:
   1. de uitbetaal-naad (betaal.maakUitbetaling): zonder IBAN reserveren, met IBAN
      inplannen, altijd idempotent;
   2. het afdracht-grootboek (kern/fonds.js): juiste 30%-ex-btw-berekening, alleen
      abonnementen dragen af, idempotent per factuur;
   3. end-to-end: een betaalde maandfactuur boekt de afdracht en de backoffice ziet
      het te-storten bedrag.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const betaal = require('../server/betaal');
const { maakFonds, aandeelCenten } = require('../server/kern/fonds');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

// ---- 1. de uitbetaal-naad ----
test('uitbetaling: zonder IBAN reserveren (te_storten), met IBAN inplannen, idempotent', async () => {
  const zonder = await betaal.maakUitbetaling({ bedrag: 1950, iban: '', referentie: 'U-1', idempotentieSleutel: 'k1' });
  assert.equal(zonder.status, 'te_storten', 'geen bestemming: gereserveerd, niet verstuurd');
  assert.equal(zonder.bedrag, 1950);

  const met = await betaal.maakUitbetaling({ bedrag: 1950, iban: 'NL00BANK0123456789', referentie: 'U-2', idempotentieSleutel: 'k2' });
  assert.equal(met.status, 'ingepland', 'met IBAN: ingepland (demo)');
  assert.equal(met.iban, 'NL00BANK0123456789');

  const weer = await betaal.maakUitbetaling({ bedrag: 1950, iban: 'NL00BANK0123456789', referentie: 'U-2', idempotentieSleutel: 'k2' });
  assert.equal(weer.id, met.id, 'zelfde sleutel: exact hetzelfde resultaat');
  assert.equal(weer.herhaald, true);

  await assert.rejects(() => betaal.maakUitbetaling({ bedrag: 0, iban: '' }), /positief bedrag/);
});

// ---- 2. het afdracht-grootboek ----
function nepDb() { return { data: { fondsAfdrachten: [] } }; }

test('fonds: 30% ex btw, alleen abonnementen, idempotent per factuur', async () => {
  const db = nepDb();
  const fonds = maakFonds({ db, save: () => {}, betaal, env: {} }); // geen IBAN

  // 78,65 incl btw -> 65 ex btw -> 30% = 19,50 -> 1950 cent
  assert.equal(aandeelCenten(78.65), 1950, 'zuivere 30%-ex-btw-rekensom');

  const a = await fonds.boekAfdracht({ invoiceId: 'INV-1', wie: 'acc:1', bijdrage: 78.65, betaalId: 'b1', omschrijving: 'Maandbijdrage lidmaatschap juli' });
  assert.ok(a, 'abonnement draagt af');
  assert.equal(a.centen, 1950);
  assert.equal(a.status, 'te_storten', 'zonder IBAN: gereserveerd');

  const weer = await fonds.boekAfdracht({ invoiceId: 'INV-1', wie: 'acc:1', bijdrage: 78.65, betaalId: 'b1', omschrijving: 'Maandbijdrage lidmaatschap juli' });
  assert.equal(db.data.fondsAfdrachten.length, 1, 'zelfde factuur boekt nooit twee keer');
  assert.equal(weer.id, a.id);

  const geenAbo = await fonds.boekAfdracht({ invoiceId: 'B-9', wie: 'acc:1', bijdrage: 500, omschrijving: 'Ibiza, 3 nachten' });
  assert.equal(geenAbo, null, 'een boeking draagt niets af');
  assert.equal(db.data.fondsAfdrachten.length, 1);

  const ov = fonds.overzicht();
  assert.equal(ov.aantal, 1);
  assert.equal(ov.teStortenCenten, 1950);
  assert.equal(ov.gestortCenten, 0);
});

test('fonds: met IBAN wordt de afdracht meteen ingepland als uitbetaling', async () => {
  const db = nepDb();
  const fonds = maakFonds({ db, save: () => {}, betaal, env: { RTF_IBAN: 'NL11FOUND0000000001', RTF_BEGUNSTIGDE: 'Stichting RTFoundation' } });
  const a = await fonds.boekAfdracht({ invoiceId: 'INV-2', wie: 'acc:2', bijdrage: 78.65, omschrijving: 'Maandbijdrage lidmaatschap' });
  assert.equal(a.status, 'ingepland', 'met IBAN: ingepland');
  assert.ok(a.uitbetaalId, 'er is een uitbetaal-referentie');
  assert.equal(a.iban, 'NL11FOUND0000000001');
});

test('fonds: op de eigen rails (bank-naad) boekt de afdracht meteen als gestort', async () => {
  const db = nepDb();
  const fonds = maakFonds({ db, save: () => {}, betaal, env: { RTF_IBAN: 'NL11FOUND0000000001' } });
  // de bank-naad zoals server.js hem koppelt: alleen als de knop effectief op
  // "eigen" staat een boeking, anders null -> terugval op de betaal-naad
  let eigen = false; const boekingen = [];
  fonds.koppelBank(({ centen, referentie, oms }) => {
    if (!eigen) return null;
    boekingen.push({ centen, referentie, oms });
    return { ok: true, boeking: { id: 'BB-TEST' } };
  });

  // stand partner: de naad geeft null en de betaal-naad plant gewoon in
  const a = await fonds.boekAfdracht({ invoiceId: 'INV-3', wie: 'acc:3', bijdrage: 78.65, omschrijving: 'Maandbijdrage lidmaatschap' });
  assert.equal(a.status, 'ingepland', 'buiten de eigen-stand verandert er niets');
  assert.equal(a.via, undefined);

  // stand eigen: dezelfde soort factuur gaat als boeking door het eigen grootboek
  eigen = true;
  const b = await fonds.boekAfdracht({ invoiceId: 'INV-4', wie: 'acc:3', bijdrage: 78.65, omschrijving: 'Maandbijdrage lidmaatschap' });
  assert.equal(b.status, 'gestort', 'op de eigen rails is de afdracht per direct afgewikkeld');
  assert.equal(b.via, 'eigen-bank');
  assert.equal(b.boekingId, 'BB-TEST');
  assert.equal(boekingen.length, 1);
  assert.equal(boekingen[0].centen, 1950, 'exact het 30%-ex-btw-bedrag');
  assert.equal(fonds.overzicht().gestortCenten, 1950);

  // een kapotte bank-naad laat de afdracht nooit zoekraken: terugval
  fonds.koppelBank(() => { throw new Error('bank stuk'); });
  const c = await fonds.boekAfdracht({ invoiceId: 'INV-5', wie: 'acc:3', bijdrage: 78.65, omschrijving: 'Maandbijdrage lidmaatschap' });
  assert.equal(c.status, 'ingepland', 'bij een bankfout valt de afdracht terug op de betaal-naad');
});

// ---- 3. end-to-end ----
let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fonds-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'FONDS-KEURING-1', RTF_IBAN: '' } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('e2e: een betaalde maandfactuur boekt 30% en de backoffice ziet het te storten', async () => {
  const lid = (await api(base, '/api/login', { tier: 'business' })).body.token;
  const st = (await api(base, '/api/state', {}, lid)).body.state;
  const abo = (st.invoices || []).find(i => /maandbijdrage|lidmaatschap|jaarbijdrage/i.test(i.desc || '') && i.status === 'open');
  assert.ok(abo, 'er staat een open abonnementsfactuur klaar');

  const betaald = await api(base, '/api/pay', { invoiceId: abo.id }, lid);
  assert.equal(betaald.status, 200);
  const foundation = betaald.body.foundation;
  assert.ok(foundation > 0, '30% ex btw komt terug als foundation-bedrag');

  // nog eens betalen kan niet (al betaald): geen dubbele afdracht
  const nog = await api(base, '/api/pay', { invoiceId: abo.id }, lid);
  assert.equal(nog.status, 409);

  // Kerninvariant: wat als foundation-deel is teruggemeld, staat exact zo in het
  // afdracht-grootboek. De backoffice ziet het als "te storten" (geen IBAN hier).
  const office = (await api(base, '/api/office/login', { code: 'FONDS-KEURING-1' })).body.token;
  assert.ok(office, 'backoffice-login');
  const state = (await api(base, '/api/office/state', {}, office)).body.state;
  const af = state.stats.fondsAfdracht;
  assert.ok(af, 'de backoffice toont het afdracht-overzicht');
  assert.equal(af.aantal, 1, 'precies een afdracht geboekt (geen dubbele)');
  assert.equal(af.teStorten, foundation, 'het te storten bedrag is exact het teruggemelde foundation-deel');
  assert.equal(af.iban, '', 'IBAN nog niet ingesteld in deze omgeving');
});
