/* Samen: meekijken en samen doen door het leden-OS. Kamers op code, alles op
   codenaam, live seintjes via de SSE-stroom; gasten doen niet mee en kamers
   verlopen vanzelf. Draai los:
   node --experimental-sqlite --test test/samen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, A, B;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samen-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = (n) => api(base, '/api/auth/register', { name: 'Samen ' + n, email: 'samen' + n + '@x.nl', phone: '061234567' + n,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  A = (await reg(1)).body.token;
  B = (await reg(2)).body.token;
});
test.after(() => stop(srv && srv.child));

let code;
test('1. een lid start een samen-sessie en een vriend doet mee met de code', async () => {
  const r = await api(base, '/api/samen/maak', {}, A);
  assert.equal(r.status, 200);
  code = r.body.kamer.code;
  assert.match(code, /^[A-Z0-9]{6}$/, 'een korte deelbare code');
  const mee = await api(base, '/api/samen/mee', { code }, B);
  assert.equal(mee.status, 200);
  assert.equal(mee.body.kamer.leden.length, 2, 'twee codenamen in de kamer');
  // nog een keer meedoen is idempotent
  assert.equal((await api(base, '/api/samen/mee', { code }, B)).body.kamer.leden.length, 2);
});

test('2. "kijk hier": een lid deelt waar hij is en de kamer onthoudt het; het SSE-seintje komt live binnen', async () => {
  // B luistert op de stroom; A stuurt de kamer naar de Mall
  const events = [];
  const es = await fetch(base + '/api/stream?token=' + encodeURIComponent(B));
  const lezer = es.body.getReader();
  const leesEven = (async () => {
    const dec = new TextDecoder(); let buf = '';
    const tot = Date.now() + 5000;
    while (Date.now() < tot) {
      const { value, done } = await Promise.race([lezer.read(), new Promise(r => setTimeout(() => r({ done: true }), 1200))]);
      if (done || !value) break;
      buf += dec.decode(value);
      if (buf.includes('event: samen')) { events.push(buf); break; }
    }
  })();
  await new Promise(r => setTimeout(r, 300));
  const zet = await api(base, '/api/samen/zet', { code, pad: '/apps/mall.html', titel: 'De RTG Mall' }, A);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.kamer.pad, '/apps/mall.html');
  await leesEven;
  try { await lezer.cancel(); } catch (e) {}
  assert.ok(events.length && /"kind":"kijk"/.test(events[0]) && /mall\.html/.test(events[0]), 'B kreeg het kijk-seintje live');
  // en wie later binnenkomt ziet het in de staat
  const staat = await api(base, '/api/samen/staat', { code }, B);
  assert.equal(staat.body.kamer.pad, '/apps/mall.html');
});

test('3. alleen plekken binnen RTG; externe adressen komen de kamer niet in', async () => {
  assert.equal((await api(base, '/api/samen/zet', { code, pad: 'https://kwaad.example/x' }, A)).status, 400);
  assert.equal((await api(base, '/api/samen/zet', { code, pad: '//kwaad.example' }, A)).status, 400);
});

test('4. de kamer-chat werkt en is begrensd; buitenstaanders komen er niet in', async () => {
  const r = await api(base, '/api/samen/chat', { code, tekst: 'Kijk deze etage!' }, B);
  assert.equal(r.status, 200);
  const staat = await api(base, '/api/samen/staat', { code }, A);
  assert.ok(staat.body.kamer.chat.some(c => c.tekst === 'Kijk deze etage!'));
  // een derde lid dat NIET meedoet mag niets
  const reg3 = await api(base, '/api/auth/register', { name: 'Pottenkijker', email: 'samen3@x.nl', phone: '0612345673', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const C = reg3.body.token;
  assert.equal((await api(base, '/api/samen/staat', { code }, C)).status, 403);
  assert.equal((await api(base, '/api/samen/chat', { code, tekst: 'ik gluur' }, C)).status, 403);
  assert.equal((await api(base, '/api/samen/zet', { code, pad: '/apps/sport.html' }, C)).status, 403);
});

test('4b. samen luisteren: de gastheer deelt de muziek, de leden zien het en volgen; alleen de gastheer bepaalt', async () => {
  const zet = await api(base, '/api/samen/muziek', { code, media: { stationId: 'sunset', seed: 4242, startOffsetMs: 12000, speelt: true } }, A);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.kamer.muziek && zet.body.kamer.muziek.stationId === 'sunset', 'de kamer draagt nu de muziek');
  // B ziet de muziek in de staat, met een serverklok om op te synchroniseren
  const staat = await api(base, '/api/samen/staat', { code }, B);
  assert.equal(staat.body.kamer.muziek.seed, 4242);
  assert.ok(staat.body.kamer.muziek.start > 0 && staat.body.kamer.now >= staat.body.kamer.muziek.start, 'starttijd en serverklok kloppen');
  // een lid dat niet de gastheer is, mag de muziek niet sturen
  assert.equal((await api(base, '/api/samen/muziek', { code, media: { stationId: 'nacht', seed: 1 } }, B)).status, 403);
});

test('5. verlaten: de laatste doet het licht uit en de code vervalt', async () => {
  assert.equal((await api(base, '/api/samen/weg', { code }, B)).status, 200);
  assert.equal((await api(base, '/api/samen/weg', { code }, A)).status, 200);
  assert.equal((await api(base, '/api/samen/staat', { code }, A)).status, 404, 'de kamer is weg');
});

test('6. zonder inlog blijft samen dicht', async () => {
  assert.equal((await api(base, '/api/samen/maak', {})).status, 401);
});
