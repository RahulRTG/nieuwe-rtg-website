/* De branchegerichte AI-boekhouder: genre-profielen, datagedreven adviezen en de
   leverancier-endpoints (vragen, adviezen, antwoord). Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bk = require('../server/kern/boekhoudkennis');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

// ---- 1. de kennis ----
test('genreProfiel kiest de juiste branche', () => {
  assert.equal(bk.genreProfiel('restaurant').label, 'Horeca');
  assert.equal(bk.genreProfiel('hotel').label, 'Verblijf');
  assert.equal(bk.genreProfiel('autoverhuur').label, 'Verhuur');
  assert.equal(bk.genreProfiel('taxi').label, 'Vervoer');
  assert.equal(bk.genreProfiel('mode').label, 'Retail');
  assert.equal(bk.genreProfiel('iets onbekends').label, 'Onderneming');
});

test('adviezen zijn datagedreven en branchebewust', () => {
  const fin = {
    maand: '2026-07', landNaam: 'Nederland',
    btw: [{ label: 'Eten 9%', omzet: 10000, grondslag: 9174, tarief: 9, btw: 826 }],
    btwTotaal: 826,
    personeel: { uren: 400, uurloon: 14, bruto: 5600, lasten: 1200, totaal: 6800 },
    giftcards: { verkocht: 0, ingewisseld: 0, open: 250, aantal: 5 }
  };
  const out = bk.adviezen({ type: 'restaurant', name: 'Sal de Mar' }, fin);
  assert.equal(out.genre, 'Horeca');
  assert.ok(out.adviezen.length >= 3, 'meerdere adviezen');
  assert.ok(out.adviezen.some(a => /btw/i.test(a.titel + ' ' + a.tekst)), 'een btw-reservering');
  assert.ok(out.adviezen.some(a => /cadeaukaart/i.test(a.titel + ' ' + a.tekst)), 'cadeaukaart-verplichting');
  assert.equal(out.netto, Math.round((10000 - 826 - 6800) * 100) / 100, 'netto klopt');
  // loon is 68% van de omzet -> waarschuwing personeelskosten
  assert.ok(out.adviezen.some(a => /personeel/i.test(a.titel)), 'wijst op hoge personeelskosten');
});

test('systeemContext bevat de branche en de cijfers', () => {
  const fin = { maand: '2026-07', landNaam: 'Nederland', btw: [{ omzet: 500 }], btwTotaal: 40, personeel: { uren: 10, totaal: 150 }, giftcards: { open: 0 } };
  const ctx = bk.systeemContext({ type: 'hotel', name: 'H' }, fin, 'Nederland');
  assert.ok(/Verblijf/.test(ctx) && /Kengetallen/.test(ctx));
});

// ---- 2. de endpoints ----
let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bh-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('AI-boekhouder-endpoints: branchevragen, adviezen en een antwoord met genre', async () => {
  const zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(zaak, 'leverancier-login');

  const vr = await api(base, '/api/supplier/accountant/vragen', {}, zaak);
  assert.equal(vr.status, 200);
  assert.ok(Array.isArray(vr.body.vragen) && vr.body.vragen.length >= 1, 'branchevragen');
  assert.ok(vr.body.genre, 'genre-label');

  const adv = await api(base, '/api/supplier/accountant/adviezen', {}, zaak);
  assert.equal(adv.status, 200);
  assert.ok(Array.isArray(adv.body.adviezen) && adv.body.adviezen.length >= 1, 'adviezen');
  assert.ok(adv.body.cijfers && typeof adv.body.cijfers.netto === 'number', 'cijfers meegeleverd');
  assert.equal(adv.body.ai, false, 'zonder sleutel deterministisch');

  const ans = await api(base, '/api/supplier/accountant', { question: 'hoeveel btw draag ik af?' }, zaak);
  assert.equal(ans.status, 200);
  assert.ok(ans.body.answer && ans.body.genre, 'antwoord met genre');
});
