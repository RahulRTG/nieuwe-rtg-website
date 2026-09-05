/* Productiecontract van de RTG-iD-koppelcredential: 128-bit, hash-only,
   eenmalige uitgifte, duurzame retrybinding en server-side rotate/revoke. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

test('de kern bewaart geen kale code, statuscredential of afgeleverd token', () => {
  let tijd = Date.parse('2026-09-05T08:00:00.000Z');
  const toegang = require('../server/kern/rtgid-koppeltoegang')({
    crypto, nu: () => new Date(tijd).toISOString(), koppelTtlMs: 120000
  });
  const staat = { koppels: [] };
  const gemaakt = toegang.nieuw(staat, { dienst: 'Voorbeeld', attributen: ['codenaam'], eis: null,
    uitgifte: { idem_hash: 'a'.repeat(64), fingerprint_hash: 'b'.repeat(64) } });
  staat.koppels.push(gemaakt.koppel);
  assert.match(gemaakt.code, /^ID\.[A-F0-9]{32}$/);
  assert.match(gemaakt.statusToken, /^RID\.[A-F0-9]{32}$/);
  let opSchijf = JSON.stringify(staat);
  assert.ok(!opSchijf.includes(gemaakt.code));
  assert.ok(!opSchijf.includes(gemaakt.statusToken));
  assert.equal(toegang.zoekCode(staat, gemaakt.code), gemaakt.koppel);
  assert.equal(toegang.zoekStatus(staat, gemaakt.statusToken), gemaakt.koppel);

  toegang.noteerKijker(gemaakt.koppel, 'lid-geheim');
  assert.equal(toegang.gebruikCode(gemaakt.koppel, 'lid-geheim'), true);
  assert.equal(toegang.codeReden(gemaakt.koppel), 'ingetrokken');
  opSchijf = JSON.stringify(staat);
  assert.ok(!opSchijf.includes('lid-geheim'), 'ook de kijker staat alleen als afdruk opgeslagen');

  const legacy = { koppels: [{ id: 'koud', code: 'ID-ABCDE', dienst: 'Oud', status: 'bevestigd',
    gemaakt: new Date(tijd).toISOString(), verloopt: tijd + 1000, tokenEenmalig: 'KAAL-TOKEN' }] };
  assert.equal(toegang.migreerLegacy(legacy), true);
  const oudJson = JSON.stringify(legacy);
  assert.ok(!oudJson.includes('ID-ABCDE'));
  assert.ok(!oudJson.includes('KAAL-TOKEN'));
  assert.equal(legacy.koppels[0].status, 'legacy-gesloten');
});

test('rotatie vervangt beide credentials en een oude statuscredential krijgt geen tweede kans', () => {
  const toegang = require('../server/kern/rtgid-koppeltoegang')({
    crypto, nu: () => '2026-09-05T08:00:00.000Z', koppelTtlMs: 120000
  });
  const staat = { koppels: [] };
  const eerste = toegang.nieuw(staat, { dienst: 'Voorbeeld', attributen: ['codenaam'], eis: null });
  staat.koppels.push(eerste.koppel);
  const tweede = toegang.roteer(staat, eerste.koppel, 'Voorbeeld', { idem_hash: 'c'.repeat(64) });
  assert.notEqual(tweede.code, eerste.code);
  assert.notEqual(tweede.statusToken, eerste.statusToken);
  assert.equal(toegang.zoekCode(staat, eerste.code), null);
  assert.equal(toegang.zoekStatus(staat, eerste.statusToken), null);
  assert.equal(toegang.zoekStatusOoit(staat, eerste.statusToken), eerste.koppel);
  assert.equal(toegang.zoekCode(staat, tweede.code), eerste.koppel);
  assert.equal(toegang.zoekStatus(staat, tweede.statusToken), eerste.koppel);
  const json = JSON.stringify(staat);
  for (const geheim of [eerste.code, eerste.statusToken, tweede.code, tweede.statusToken])
    assert.ok(!json.includes(geheim));
});

test('intrekking en machtiging muteren uitsluitend binnen het RTG-iD-collectieslot', async () => {
  const staat = { koppels: [], logs: {}, sessies: [
    { memberKey: 'lid-a', dienst: 'Dienst', ingetrokken: false, namens: null },
    { memberKey: 'lid-a', dienst: 'Dienst', ingetrokken: false,
      namens: 'Lid B', machtigingId: 'machtiging-b' }
  ], machtigingen: [
    { id: 'machtiging-b', vanKey: 'lid-a', naarKey: 'lid-b', dienst: 'Dienst',
      tot: Date.now() + 60000, ingetrokken: false }
  ] };
  let transacties = 0;
  const regie = require('../server/kern/rtgid-regie')({
    S: () => { throw new Error('mutatie buiten collectieslot'); },
    metStaat: werk => { transacties++; return werk(staat); },
    nu: () => Date.now(), iso: () => '2026-09-05T08:00:00.000Z',
    schoon: x => String(x || '').trim(),
    keyVanCodenaam: async () => ({ key: 'lid-c' }),
    accountVanKey: key => key === 'lid-c' ? { id: 3 } : null,
    crypto, codenaamUit: key => ({ 'lid-b': 'Lid B', 'lid-c': 'Lid C' })[key] || key,
    logVan: (key, bron) => (bron.logs[key] || (bron.logs[key] = [])),
    cap: (lijst, max) => { if (lijst.length > max) lijst.length = max; },
    ATTRIBUTEN: ['codenaam'], MAX_LOG: 100
  });
  assert.equal((await regie.intrek('lid-a', 'Dienst')).ingetrokken, 2);
  assert.equal(staat.sessies.every(x => x.ingetrokken), true);
  const nieuw = await regie.machtig('lid-a', { dienst: 'Andere', dagen: 1, codenaam: 'Lid C' });
  assert.equal(nieuw.status, 200);
  assert.match(nieuw.machtiging.id, /^m[a-f0-9]{32}$/);
  assert.equal((await regie.machtigIntrek('lid-a', 'machtiging-b')).status, 200);
  assert.equal(staat.machtigingen.find(x => x.id === 'machtiging-b').ingetrokken, true);
  assert.equal(transacties, 3, 'iedere schrijfactie gebruikte precies één collectieslot');
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-id-credential-'));
let server;
const vraag = async (pad, body, idem) => {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'rtgid-credential-test' };
  if (idem) headers['Idempotency-Key'] = idem;
  const r = await fetch(server.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
};

test.before(async () => { server = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); });
test.after(() => {
  stop(server && server.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('HTTP-uitgifte eist een sleutel en herhaalt geen geheim', async () => {
  const geen = await vraag('/api/rtgid/start', { dienst: 'Voorbeeld' });
  assert.equal(geen.status, 400);
  const idem = 'rtgid-http-start-00000001';
  const [a, b] = await Promise.all([
    vraag('/api/rtgid/start', { dienst: 'Voorbeeld', attributen: ['codenaam'] }, idem),
    vraag('/api/rtgid/start', { dienst: 'Voorbeeld', attributen: ['codenaam'] }, idem)
  ]);
  const goed = [a, b].find(x => x.status === 200);
  const retry = [a, b].find(x => x.status === 409);
  assert.ok(goed && retry, 'één uitgifte en één veilige retry');
  assert.match(goed.body.code, /^ID\.[A-F0-9]{32}$/);
  assert.match(goed.body.koppelId, /^RID\.[A-F0-9]{32}$/);
  assert.equal(goed.headers.get('cache-control'), 'no-store');
  assert.ok(!retry.body.code && !retry.body.koppelId, 'retry heronthult geen credential');
  const botsing = await vraag('/api/rtgid/start', { dienst: 'Andere dienst' }, idem);
  assert.equal(botsing.status, 409);
  assert.ok(!botsing.body.code && !botsing.body.koppelId);
});

test('HTTP-rotatie vervangt code en status samen; retry en oude token blijven dicht', async () => {
  const start = await vraag('/api/rtgid/start', { dienst: 'Rotatiedienst' }, 'rtgid-rotate-start-0001');
  assert.equal(start.status, 200);
  const rotatieIdem = 'rtgid-rotate-action-0001';
  const nieuw = await vraag('/api/rtgid/roteer', { koppelId: start.body.koppelId }, rotatieIdem);
  assert.equal(nieuw.status, 200);
  assert.match(nieuw.body.code, /^ID\.[A-F0-9]{32}$/);
  assert.match(nieuw.body.koppelId, /^RID\.[A-F0-9]{32}$/);
  assert.notEqual(nieuw.body.code, start.body.code);
  assert.notEqual(nieuw.body.koppelId, start.body.koppelId);
  assert.equal(nieuw.headers.get('cache-control'), 'no-store');
  assert.equal((await vraag('/api/rtgid/status', { koppelId: start.body.koppelId })).status, 404);
  assert.equal((await vraag('/api/rtgid/status', { koppelId: nieuw.body.koppelId })).body.stand, 'wacht');
  const retry = await vraag('/api/rtgid/roteer', { koppelId: start.body.koppelId }, rotatieIdem);
  assert.equal(retry.status, 409);
  assert.ok(!retry.body.code && !retry.body.koppelId);
  assert.equal((await vraag('/api/rtgid/roteer', { koppelId: start.body.koppelId },
    'rtgid-rotate-action-0002')).status, 404, 'oude credential autoriseert geen nieuwe rotatie');
});

test('HTTP-annulering trekt code en status server-side in en is veilig herhaalbaar', async () => {
  const start = await vraag('/api/rtgid/start', { dienst: 'Annuleerdienst' }, 'rtgid-cancel-start-0001');
  const idem = 'rtgid-cancel-action-0001';
  const eerste = await vraag('/api/rtgid/annuleer', { koppelId: start.body.koppelId }, idem);
  assert.equal(eerste.status, 200);
  const tweede = await vraag('/api/rtgid/annuleer', { koppelId: start.body.koppelId }, idem);
  assert.equal(tweede.status, 200);
  assert.equal(tweede.body.herhaald, true);
  assert.equal((await vraag('/api/rtgid/status', { koppelId: start.body.koppelId })).status, 404);
  assert.equal((await vraag('/api/rtgid/annuleer', { koppelId: 'RID.' + '0'.repeat(32) },
    'rtgid-cancel-unknown-0001')).status, 404);
});

test('route- en UI-contracten bewaren geen eenmalige RTG-iD-respons', () => {
  const eenmalig = require('../server/lib/eenmalig-geheim-routes').ROUTES;
  const eigen = require('../server/middleware/idempotentie').EIGEN;
  assert.ok(eenmalig.has('POST /api/rtgid/start'));
  assert.ok(eenmalig.has('POST /api/rtgid/roteer'));
  assert.ok(eigen.includes('/api/rtgid/annuleer'));
  assert.equal(eigen.includes('/api/rtgid/'), false,
    'alleen de zelf-idempotente annulering mag de centrale laag overslaan');
  const html = fs.readFileSync(path.join(__dirname, '../public/apps/rtgid.html'), 'utf8');
  assert.match(html, /id="codeIn"[^>]*maxlength="40"/);
  assert.match(html, /autocomplete="one-time-code"/);
});
