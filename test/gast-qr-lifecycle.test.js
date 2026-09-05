const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer } = require('./helper');

const maakKern = (begin = {}) => {
  const db = { data: { horeca: begin } };
  let klok = Date.parse('2026-09-05T10:00:00.000Z');
  let saves = 0;
  const leeg = () => ({ rekeningen: {}, bonnen: {}, instel: {}, wachtrij: [] });
  const H = (code) => {
    db.data.horeca[code] = db.data.horeca[code] || leeg();
    return db.data.horeca[code];
  };
  const horeca = { H, Hlees: (code) => db.data.horeca[code] || leeg(), nu: () => new Date(klok).toISOString() };
  const plekcode = require('../server/kern/gast/plekcode')({ db, crypto, horeca, save: () => { saves += 1; } });
  return { db, plekcode, zetKlok: (waarde) => { klok = Date.parse(waarde); }, saves: () => saves };
};

test('plekcodes zijn hash-only, tijdbegrensd, intrekbaar en roteerbaar', () => {
  const k = maakKern();
  const eerste = k.plekcode.geefUit('ZAAK', 'Tafel 8', { door: { staffId: 'm1' } });
  assert.match(eerste.token, /^[a-f0-9]{32}$/);
  assert.equal(eerste.purpose, 'gast-horeca-plek');
  assert.deepEqual(eerste.scope, { zaakcode: 'ZAAK', plek: 'Tafel 8', soort: 'tafel' });
  assert.equal(eerste.issuer.id, 'm1');
  assert.ok(Date.parse(eerste.expiresAt) > Date.parse(eerste.issuedAt));

  const bewaard = k.db.data.horeca.ZAAK.instel.qr['Tafel 8'];
  assert.equal(bewaard.token, undefined, 'het bearer-geheim staat nooit in de opslag');
  assert.equal(bewaard.hash, k.plekcode.afdruk(eerste.token));
  assert.equal(k.plekcode.vind(eerste.token).plek, 'Tafel 8');
  assert.equal(bewaard.useCount, 1);

  const opnieuw = k.plekcode.geefUit('ZAAK', 'Tafel 8', { door: { staffId: 'm1' } });
  assert.equal(opnieuw.token, null, 'een bestaand bearer-geheim wordt niet opnieuw prijsgegeven');
  assert.equal(opnieuw.herdrukbaar, false);

  const ingetrokken = k.plekcode.trekIn('ZAAK', 'Tafel 8', { door: { staffId: 'm2' }, reden: 'sticker kwijt' });
  assert.ok(ingetrokken.revokedAt);
  assert.equal(k.plekcode.vind(eerste.token), null);

  const tweede = k.plekcode.geefUit('ZAAK', 'Tafel 8', { vernieuw: true, door: { staffId: 'm2' } });
  assert.notEqual(tweede.token, eerste.token);
  assert.equal(k.plekcode.vind(eerste.token), null);
  assert.equal(k.plekcode.vind(tweede.token).plek, 'Tafel 8');
  assert.equal(k.db.data.horeca.ZAAK.instel.qrHistorie.length, 1);

  k.zetKlok('2027-09-07T10:00:00.000Z');
  assert.equal(k.plekcode.vind(tweede.token), null, 'na de maximale geldigheidsduur is de code server-side nutteloos');
});

test('legacy plekcodes verliezen bij het laden hun leesbare geheim zonder de sticker te breken', () => {
  const token = '1234567890abcdef12';
  const rij = { token, hash: crypto.createHash('sha256').update(token).digest('hex'), soort: 'tafel', at: '2026-09-05T09:00:00.000Z' };
  const k = maakKern({ OUD: { rekeningen: {}, bonnen: {}, instel: { qr: { L1: rij } }, wachtrij: [] } });
  assert.equal(rij.token, undefined);
  assert.equal(rij.issuer.id, 'legacy');
  assert.equal(k.plekcode.vind(token).plek, 'L1');
  assert.ok(k.saves() >= 2, 'migratie en gebruik worden duurzaam opgeslagen');
});

test('de leveranciersdeur trekt in en roteert zonder de oude code te laten herleven', async (t) => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gast-qr-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '' } });
  t.after(() => {
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  });
  const post = (pad, body, token) => fetch(base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const manager = roster.staff.find((x) => x.role === 'manager') || roster.staff[0];
  const medewerker = roster.staff.find((x) => x.role !== 'manager');
  if (medewerker) {
    const gewoneLogin = await post('/api/supplier/login', { code: 'KIKUNOI', staffId: medewerker.id, pin: '5678' });
    assert.ok(gewoneLogin.body.token);
    assert.equal((await post('/api/supplier/horeca/gast/qr', { tafel: 'NIET-MAG' }, gewoneLogin.body.token)).status, 403,
      'een gewone medewerker kan de bearer-deur niet vervangen');
  }
  const login = await post('/api/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
  const auth = login.body.token;
  assert.ok(auth);

  const een = await post('/api/supplier/horeca/gast/qr', { tafel: 'L88' }, auth);
  assert.equal(een.status, 200);
  assert.ok(een.body.token && een.body.lifecycle.expiresAt);
  assert.equal((await post('/api/gast/tafel', { token: een.body.token })).status, 200);

  const zelfde = await post('/api/supplier/horeca/gast/qr', { tafel: 'L88' }, auth);
  assert.equal(zelfde.status, 200);
  assert.equal(zelfde.body.token, null);
  assert.equal(zelfde.body.pad, null);

  const intrek = await post('/api/supplier/horeca/gast/qr', { tafel: 'L88', intrek: true, reden: 'verloren' }, auth);
  assert.equal(intrek.status, 200);
  assert.ok(intrek.body.revokedAt);
  assert.equal((await post('/api/gast/tafel', { token: een.body.token })).status, 404);

  const twee = await post('/api/supplier/horeca/gast/qr', { tafel: 'L88', vernieuw: true }, auth);
  assert.equal(twee.status, 200);
  assert.notEqual(twee.body.token, een.body.token);
  assert.equal((await post('/api/gast/tafel', { token: twee.body.token })).status, 200);
});
