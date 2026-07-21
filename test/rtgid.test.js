/* RTG iD: de DigiD-vervanger op de eigen identiteitskluis. Bewaakt de
   koppelflow (code, bevestigen, weigeren, eenmalig token), de selectieve
   gegevensdeling (18plus zonder geboortedatum, alleen wat gevraagd is),
   het inzagelog met intrekken, machtigingen (mantelzorg) en de poorten.
   Draai los: node --experimental-sqlite --test test/rtgid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, codeA, codeB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-id-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(geboortedatum) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'id' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum, geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}
// de dienst-kant start een inlog; het lid zoekt de code op en bevestigt
async function inlog(dienst, attributen, lidToken, machtigingId) {
  const s = await api('/api/rtgid/start', { dienst, attributen });
  assert.equal(s.status, 200);
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidToken);
  assert.equal(k.status, 200);
  const b = await api('/api/rtgid/bevestig', { koppelId: k.body.koppelId, machtigingId }, lidToken);
  assert.equal(b.status, 200);
  const st = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.equal(st.body.stand, 'bevestigd');
  return { idToken: st.body.idToken, koppelId: s.body.koppelId, code: s.body.code };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid('1990-05-05'); const b = await lid('1992-02-02');
  lidA = a.token; codeA = a.codenaam; lidB = b.token; codeB = b.codenaam;
  assert.ok(lidA && lidB && codeA && codeB, 'twee leden met codenamen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de koppelflow: code, dienstnaam in de app, bevestigen, eenmalig token', async () => {
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam', '18plus'] });
  assert.match(s.body.code, /^ID-[A-Z2-9]{5}$/, 'een koppelcode zonder verwarrende tekens');
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  assert.equal(k.body.dienst, 'MijnOverheid', 'het lid ziet WIE er aanklopt voor er iets gebeurt');
  assert.deepEqual(k.body.attributen, ['codenaam', '18plus'], 'en welke gegevens er gevraagd worden');
  assert.equal((await api('/api/rtgid/status', { koppelId: s.body.koppelId })).body.stand, 'wacht');
  await api('/api/rtgid/bevestig', { koppelId: k.body.koppelId }, lidA);
  const st = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.equal(st.body.stand, 'bevestigd');
  assert.ok(st.body.idToken, 'het token komt precies een keer mee');
  const nogEen = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.ok(!nogEen.body.idToken, 'en daarna nooit meer');
  // dezelfde code is daarna waardeloos
  assert.equal((await api('/api/rtgid/koppel', { code: s.body.code }, lidB)).status, 404);
});

test('2. selectieve deling: 18plus als bewijs, nooit meer dan gevraagd', async () => {
  const { idToken } = await inlog('Slijterij De Kurk', ['18plus'], lidA);
  const wie = await api('/api/rtgid/wie', { idToken });
  assert.equal(wie.status, 200);
  assert.equal(wie.body.dienst, 'Slijterij De Kurk');
  assert.equal(wie.body.attributen['18plus'], true, 'het bewijs 18-plus');
  assert.ok(!('leeftijd' in wie.body.attributen), 'geen leeftijd');
  assert.ok(!('naam' in wie.body.attributen), 'geen naam');
  assert.ok(!JSON.stringify(wie.body).includes('geboortedatum'), 'de geboortedatum verlaat de kluis nooit');
});

test('3. weigeren: er wordt niets gedeeld en er komt geen token', async () => {
  const s = await api('/api/rtgid/start', { dienst: 'Vage Webshop' });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  await api('/api/rtgid/weiger', { koppelId: k.body.koppelId }, lidA);
  const st = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.equal(st.body.stand, 'geweigerd');
  assert.ok(!st.body.idToken);
});

test('4. het inzagelog en intrekken: het lid houdt de regie', async () => {
  const { idToken } = await inlog('Gemeente Ibiza', ['codenaam'], lidA);
  const inz = await api('/api/rtgid/inzage', {}, lidA);
  assert.ok(inz.body.log.some(l => l.dienst === 'Gemeente Ibiza' && l.soort === 'inlog'), 'de inlog staat in het log');
  assert.ok(inz.body.sessies.some(s => s.dienst === 'Gemeente Ibiza'), 'de actieve sessie is zichtbaar');
  await api('/api/rtgid/intrek', { dienst: 'Gemeente Ibiza' }, lidA);
  assert.equal((await api('/api/rtgid/wie', { idToken })).status, 403, 'na intrekken is het token dood');
  const na = await api('/api/rtgid/inzage', {}, lidA);
  assert.ok(na.body.log.some(l => l.soort === 'toegang ingetrokken'));
});

test('5. machtigen (mantelzorg): B logt in namens A, herroepbaar, alles in het log van A', async () => {
  const m = await api('/api/rtgid/machtig', { codenaam: codeB, dienst: 'MijnOverheid', dagen: 30 }, lidA);
  assert.equal(m.status, 200);
  const mId = m.body.machtiging.id;
  // B ziet de machtiging bij het opzoeken van een code voor die dienst
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidB);
  assert.ok(k.body.machtigingen.some(x => x.id === mId), 'B kan kiezen: als zichzelf of namens A');
  const { idToken } = await inlog('MijnOverheid', ['codenaam'], lidB, mId);
  const wie = await api('/api/rtgid/wie', { idToken });
  assert.equal(wie.body.attributen.codenaam, codeA, 'de dienst ziet de identiteit van A');
  assert.equal(wie.body.namens, codeB, 'met de vermelding dat een gemachtigde handelde');
  const logA = await api('/api/rtgid/inzage', {}, lidA);
  assert.ok(logA.body.log.some(l => l.soort.includes('gemachtigde')), 'A ziet de inlog in het eigen log');
  // een machtiging geldt alleen voor de eigen dienst
  const s2 = await api('/api/rtgid/start', { dienst: 'Belastingdienst', attributen: ['codenaam'] });
  const k2 = await api('/api/rtgid/koppel', { code: s2.body.code }, lidB);
  assert.equal((await api('/api/rtgid/bevestig', { koppelId: k2.body.koppelId, machtigingId: mId }, lidB)).status, 403);
  // en intrekken maakt er direct een einde aan
  await api('/api/rtgid/machtig/intrek', { id: mId }, lidA);
  assert.equal((await api('/api/rtgid/wie', { idToken })).status, 403, 'lopende namens-sessies gaan mee dicht');
});

test('6. de poorten: vals token, onbekende koppel, gast en anoniem', async () => {
  assert.equal((await api('/api/rtgid/wie', { idToken: 'vals' })).status, 403);
  assert.equal((await api('/api/rtgid/status', { koppelId: 'bestaatniet' })).status, 404);
  assert.equal((await api('/api/rtgid/inzage', {})).status, 401, 'de app-kant vraagt een leden-inlog');
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/rtgid/inzage', {}, gast)).status, 403, 'gasten hebben geen iD');
  assert.equal((await api('/api/rtgid/start', {})).status, 400, 'zonder dienstnaam geen koppel');
});
