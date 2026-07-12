/* Integratietests voor RTG Zakelijk (de LinkedIn-laag van de Business Pass):
   profiel (opt-in), gids, professioneel verbinden via de bestaande
   vriendengraaf, de zakelijke feed en aanbevelingen. Draait tegen een echte
   server. Draai los: node --experimental-sqlite --test test/zakelijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3880 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zakelijk-'));
let child;

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

// registreer een echt account met een eigen sessie (elke pas zijn eigen sleutel)
async function lid(naam, email, tier) {
  const d = await json(await post('/api/auth/register', {
    name: naam, email, phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier
  }));
  assert.ok(d.token, 'registratie geeft een sessietoken');
  return { token: d.token, codename: d.state.user.codename };
}

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server startte niet op tijd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('alleen de Business Pass komt binnen; profiel is opt-in en stuurt de gids', async () => {
  const a = await lid('Anna Bakker', 'anna@x.nl', 'business');
  const l = await lid('Lars Visser', 'lars@x.nl', 'lifestyle');
  // een Lifestyle-lid wordt geweigerd
  assert.equal((await post('/api/zakelijk/profiel', {}, l.token)).status, 403);
  assert.equal((await post('/api/zakelijk/gids', {}, l.token)).status, 403);
  // zonder profiel: gids leeg, feed meldt dat het profiel er nog niet is
  const feed0 = await json(await post('/api/zakelijk/feed', {}, a.token));
  assert.equal(feed0.mijnProfiel, false);
  // profiel zonder kop wordt geweigerd; met kop lukt het
  assert.equal((await post('/api/zakelijk/profiel/zet', { naam: 'Anna' }, a.token)).status, 400);
  const zet = await json(await post('/api/zakelijk/profiel/zet', {
    naam: 'Anna Bakker', kop: 'Oprichter Bakkerij De Zon', sector: 'Horeca', plaats: 'Utrecht',
    vaardigheden: ['Brood', 'Ondernemen', 'Marketing'], ervaring: ['2019-nu: eigenaar De Zon'],
    bio: 'Bakker met een missie.', openVoorWerk: false
  }, a.token));
  assert.ok(zet.ok);
});

test('gids: zoeken, verbinden via de vriendengraaf, en zichtbaarheid uitzetten', async () => {
  const a = await lid('Bram Kok', 'bram@x.nl', 'business');
  const b = await lid('Cato Smit', 'cato@x.nl', 'business');
  await post('/api/zakelijk/profiel/zet', { kop: 'Fotograaf', sector: 'Media', vaardigheden: ['Fotografie', 'Video'] }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Jurist ondernemingsrecht', sector: 'Juridisch', vaardigheden: ['Contracten'] }, b.token);

  // zoeken op sector vindt de jurist, niet de fotograaf
  const gids = await json(await post('/api/zakelijk/gids', { q: 'juridisch' }, a.token));
  assert.equal(gids.resultaten.length, 1);
  assert.equal(gids.resultaten[0].kop, 'Jurist ondernemingsrecht');
  assert.equal(gids.resultaten[0].status, 'geen');
  const bKey = gids.resultaten[0].key;

  // verbinden: verzoek gaat via de bestaande vriendengraaf
  const con = await json(await post('/api/zakelijk/connect', { key: bKey }, a.token));
  assert.equal(con.status, 'aangevraagd');
  // B ziet het verzoek in zijn gewone Contacten en accepteert daar
  const conns = await json(await post('/api/member/connections', {}, b.token));
  assert.equal(conns.requests.length, 1);
  await post('/api/member/connect/respond', { key: conns.requests[0].key, action: 'accept' }, b.token);
  const gids2 = await json(await post('/api/zakelijk/gids', { q: 'juridisch' }, a.token));
  assert.equal(gids2.resultaten[0].status, 'verbonden');

  // B zet zijn profiel op onzichtbaar: hij verdwijnt uit de gids
  await post('/api/zakelijk/profiel/zet', { kop: 'Jurist ondernemingsrecht', zichtbaar: false }, b.token);
  const gids3 = await json(await post('/api/zakelijk/gids', { q: 'juridisch' }, a.token));
  assert.equal(gids3.resultaten.length, 0, 'onzichtbaar profiel staat niet in de gids');
  // en verbinden met een onzichtbaar profiel kan niet meer
  assert.equal((await post('/api/zakelijk/connect', { key: bKey }, a.token)).status, 404);
});

test('feed: posten vereist een profiel; liken en reageren werken', async () => {
  const a = await lid('Dirk Mol', 'dirk@x.nl', 'business');
  const b = await lid('Eva Riet', 'eva@x.nl', 'business');
  // posten zonder profiel: nette 409 met de reden
  const zonder = await post('/api/zakelijk/post', { tekst: 'Hallo!' }, a.token);
  assert.equal(zonder.status, 409);
  assert.equal((await zonder.json()).needProfiel, true);

  await post('/api/zakelijk/profiel/zet', { kop: 'Investeerder', vaardigheden: ['Financiering'] }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Ontwerper', vaardigheden: ['UX'] }, b.token);
  const p = await json(await post('/api/zakelijk/post', { tekst: 'Wie bouwt er mee aan duurzame horeca?' }, a.token));
  assert.ok(p.ok && p.id);

  // B ziet de post, liket en reageert
  const feed = await json(await post('/api/zakelijk/feed', {}, b.token));
  const post0 = feed.posts.find(x => x.id === p.id);
  assert.ok(post0 && post0.kop === 'Investeerder');
  const like = await json(await post('/api/zakelijk/like', { id: p.id }, b.token));
  assert.equal(like.likes, 1);
  const re = await json(await post('/api/zakelijk/reactie', { id: p.id, tekst: 'Ik! Stuur me een DM.' }, b.token));
  assert.equal(re.reactiesTotaal, 1);
  // nogmaals liken = intrekken
  const like2 = await json(await post('/api/zakelijk/like', { id: p.id }, b.token));
  assert.equal(like2.likes, 0);
});

test('aanbevelingen: alleen verbonden leden, alleen bestaande vaardigheden', async () => {
  const a = await lid('Fien Bos', 'fien@x.nl', 'business');
  const b = await lid('Gijs Kamp', 'gijs@x.nl', 'business');
  await post('/api/zakelijk/profiel/zet', { kop: 'Marketeer', vaardigheden: ['SEO', 'Copywriting'] }, a.token);
  await post('/api/zakelijk/profiel/zet', { kop: 'Developer', vaardigheden: ['Node.js'] }, b.token);
  const gids = await json(await post('/api/zakelijk/gids', { q: 'marketeer' }, b.token));
  const aKey = gids.resultaten[0].key;

  // niet verbonden: aanbevelen wordt geweigerd
  assert.equal((await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'SEO' }, b.token)).status, 403);
  // verbind en accepteer
  await post('/api/zakelijk/connect', { key: aKey }, b.token);
  const conns = await json(await post('/api/member/connections', {}, a.token));
  await post('/api/member/connect/respond', { key: conns.requests[0].key, action: 'accept' }, a.token);
  // een vaardigheid die niet op het profiel staat: 404
  assert.equal((await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'Toveren' }, b.token)).status, 404);
  // en een echte: telt op het profiel
  const r = await json(await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'SEO' }, b.token));
  assert.ok(r.aanbevolen && r.aantal === 1);
  const gids2 = await json(await post('/api/zakelijk/gids', { q: 'marketeer' }, b.token));
  const seo = gids2.resultaten[0].vaardigheden.find(v => v.naam === 'SEO');
  assert.equal(seo.aanbevolen, 1);
  assert.equal(seo.doorMij, true);
  // nogmaals klikken trekt de aanbeveling in
  const r2 = await json(await post('/api/zakelijk/aanbevelen', { key: aKey, vaardigheid: 'SEO' }, b.token));
  assert.equal(r2.aanbevolen, false);
});
