/* RTG Balans: Rahul kijkt naar agenda, rooster en eetpatroon en adviseert
   ook eens niks: rust, hobby's, ontprikkelen; eerlijk en zonder dwang.
   Draai los: node --experimental-sqlite --test test/balans.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { weekBeeld, adviezenUit, seintjeVoorBalans } = require('../server/kern/balans.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-balans-'));
let srv, base, lid, zaak, staf;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const dagPlus = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test('het pure weekbeeld: volle en lege dagen, avonden en late nachten', () => {
  const agenda = [0, 1, 2, 3, 4, 5, 6].map(i => ({ datum: dagPlus(i), tijd: '20:00', gedaan: false }));
  const vol = weekBeeld({ agenda, rijen: [] });
  assert.equal(vol.vrijeDagen, 0);
  assert.equal(vol.avonden, 7);
  const a = adviezenUit(vol);
  assert.match(a[0].tekst, /geen enkele lege dag/i, 'volle week krijgt het rustadvies voorop');
  const leeg = weekBeeld({ agenda: [], rijen: [] });
  assert.equal(leeg.vrijeDagen, 7);
  assert.match(adviezenUit(leeg)[0].tekst, /ademt/i);
  // late nachten uit het grootboek (afgelopen 14 dagen)
  const laat = weekBeeld({ agenda: [], rijen: [0, 1, 2].map(i => ({
    at: new Date(Date.now() - i * 86400000).toISOString().slice(0, 11) + '23:30:00.000Z',
    naar: 'partner:X', centen: 100 })) });
  assert.equal(laat.laat, 3);
  assert.ok(adviezenUit(laat).some(x => /slaap/i.test(x.tekst)));
});

test('het stille balans-seintje: alleen een echt volle week fluistert', () => {
  const vol = seintjeVoorBalans({ beeld: { vrijeDagen: 0 } });
  assert.ok(vol && /rustmoment/i.test(vol.tekst));
  assert.equal(seintjeVoorBalans({ beeld: { vrijeDagen: 1 } }), null, 'een dag lucht: stil');
  assert.equal(seintjeVoorBalans(null), null);
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Balans Lid', email: 'balans@x.nl', phone: '0633322211',
    password: 'geheim123', geboortedatum: '1984-04-04', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  zaak = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const rooster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = (rooster.body.staff || []).find(s => s.role === 'manager');
  staf = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  assert.ok(lid && zaak && staf);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het lid krijgt een weekbeeld met adviezen en kookhulp', async () => {
  const r = await api('/api/balans', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.beeld.perDag.length, 7);
  assert.ok(r.body.adviezen.length >= 1 && r.body.adviezen.length <= 4);
  assert.match(r.body.koken, /zorgprofiel/i);
  assert.ok(r.body.vraagRust && r.body.vraagKoken && r.body.vraagBewegen, 'kant-en-klare vragen voor Rahul');
  assert.match(r.body.vraagBewegen, /wellness|sport/i);
});

test('personeel: eigen klokbalans op naam, eerlijk zonder staffId', async () => {
  const eigen = await api('/api/staff/balans', {}, staf);
  assert.equal(eigen.status, 200);
  assert.ok(eigen.body.klok && typeof eigen.body.klok.weekUren === 'number');
  assert.ok(eigen.body.adviezen.length >= 1);
  const baas = await api('/api/staff/balans', {}, zaak);
  assert.equal(baas.body.klok, null, 'bedrijfsinlog zonder persoon krijgt geen persoonlijke uren');
});

test('de deuren zijn dicht zonder inlog', async () => {
  assert.equal((await api('/api/balans', {})).status, 401);
  assert.equal((await api('/api/staff/balans', {})).status, 401);
});
