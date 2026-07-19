/* De voorspeller: RTG leert het ritme van leden en zaken uit het
   Pay-grootboek en voorspelt eerlijk (bij te weinig data: zeggen dat het
   nog niet kan). Draai los:
   node --experimental-sqlite --test test/voorspel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { gewoontenUit, seintjeVoor } = require('../server/kern/voorspel.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voorspel-'));
let srv, base, lid, zaak;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Ritme Lid', email: 'ritme@x.nl', phone: '0611122233',
    password: 'geheim123', geboortedatum: '1988-03-03', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  const zl = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  zaak = zl.body.token;
  assert.ok(lid && zaak, 'lid en zaak ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het pure leren: drie vrijdagavonden bij dezelfde zaak worden een gewoonte', () => {
  const rek = 'lid:X';
  const rijen = ['2026-06-26', '2026-07-03', '2026-07-10'].map((d, i) => ({
    at: d + 'T20:0' + i + ':00.000Z', van: rek, naar: 'partner:KIKUNOI', centen: 8000, soort: 'kas'
  }));
  const g = gewoontenUit(rijen, rek, new Date('2026-07-17T12:00:00.000Z'));
  assert.equal(g.length, 1);
  assert.equal(g[0].code, 'KIKUNOI');
  assert.equal(g[0].n, 3);
  assert.equal(g[0].dagNaam, 'vrijdag');
  assert.ok(Math.abs(g[0].tussenDagen - 7) < 0.1, 'ritme van een week');
  assert.ok(g[0].zekerheid > 0.25, 'zekerheid groeit met rijpheid');
  assert.equal(g[0].gemCenten, 8000);
});

test('het pure leren: minder dan drie bezoeken is geen gewoonte', () => {
  const rek = 'lid:X';
  const rijen = [{ at: '2026-07-01T10:00:00.000Z', van: rek, naar: 'partner:A', centen: 500 },
    { at: '2026-07-08T10:00:00.000Z', van: rek, naar: 'partner:A', centen: 500 }];
  assert.equal(gewoontenUit(rijen, rek).length, 0);
});

test('het stille seintje: alleen een rijpe gewoonte fluistert mee', () => {
  const basis = { wat: 'Sal de Mar rond 20:00', waarom: '6 eerdere bezoeken', zekerheid: 0.5 };
  const rijp = seintjeVoor({ verwachtingen: [{ ...basis, rijp: 0.9 }] });
  assert.ok(rijp && rijp.tekst.includes('Sal de Mar'), 'rijp wordt een seintje');
  assert.equal(seintjeVoor({ verwachtingen: [{ ...basis, rijp: 0.1 }] }), null, 'vers bezoek blijft stil');
  assert.equal(seintjeVoor({ verwachtingen: [] }), null, 'geen gewoonte, geen seintje');
});

test('het pure leren: een rijpe weekgewoonte krijgt een hoge rijpheid', () => {
  const rek = 'lid:X';
  const rijen = ['2026-06-26', '2026-07-03', '2026-07-10'].map((d, i) => ({
    at: d + 'T20:0' + i + ':00.000Z', van: rek, naar: 'partner:KIKUNOI', centen: 8000
  }));
  const g = gewoontenUit(rijen, rek, new Date('2026-07-17T12:00:00.000Z'));
  assert.ok(g[0].rijp >= 0.9, 'bijna een week later is de gewoonte rijp (rijp=' + g[0].rijp + ')');
});

test('lid zonder geschiedenis krijgt een eerlijk "nog te weinig"', async () => {
  const r = await api('/api/voorspel', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.verwachtingen.length, 0);
  assert.match(r.body.uitleg, /te weinig/i);
});

test('na drie kassabetalingen voorspelt RTG de vaste zaak van het lid', async () => {
  await api('/api/pay/oplaad', { centen: 30000, idem: 'op1' }, lid);
  for (let i = 0; i < 3; i++) {
    const kc = await api('/api/pay/kascode', {}, lid);
    const inr = await api('/api/supplier/pay/in',
      { code: kc.body.code, centen: 6000, oms: 'diner', idem: 'in' + i }, zaak);
    assert.equal(inr.status, 200, JSON.stringify(inr.body));
  }
  const r = await api('/api/voorspel', {}, lid);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.verwachtingen.length, 1);
  const v = r.body.verwachtingen[0];
  assert.equal(v.code, 'KIKUNOI');
  assert.match(v.wat, /Sal de Mar/);
  assert.match(v.vraag, /Sal de Mar/);
  assert.ok(v.zekerheid > 0 && v.zekerheid <= 1);
});

test('de zaak ziet een eerlijke morgen-verwachting met vaste gasten', async () => {
  const r = await api('/api/supplier/voorspel', {}, zaak);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  if (r.body.morgen) {
    assert.ok(typeof r.body.morgen.verwachtTransacties === 'number');
    assert.ok(Array.isArray(r.body.morgen.drukUren));
    assert.ok(typeof r.body.morgen.advies === 'string' && r.body.morgen.advies.length > 0, 'werkvloer-advies aanwezig');
    assert.ok(Array.isArray(r.body.vasteGasten));
  } else {
    assert.match(r.body.uitleg, /te weinig/i);
  }
});

test('het profiel-endpoint blijft gezond met de voorspeller erbij', async () => {
  const r = await api('/api/fluister/profiel', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.ok(Array.isArray(r.body.seintjes), 'seintjes is een lijst');
});

test('beide paden zijn dicht zonder inlog', async () => {
  assert.equal((await api('/api/voorspel', {})).status, 401);
  assert.equal((await api('/api/supplier/voorspel', {})).status, 401);
});
