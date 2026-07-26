/* RTG Clips: korte verticale video's die alleen op het toestel van de maker
   staan (OPFS). De server bewaart enkel de kaart (titel, duur, affiche) en
   relayeert signalen; de feed is een eindige dagselectie zonder oneindige
   scroll. Draai los: node --experimental-sqlite --test test/clips.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, maker, kijker, office, clipId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-clips-'));
const POSTER = 'data:image/jpeg;base64,/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'clip' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1993-03-03', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  maker = await lid('Maker'); kijker = await lid('Kijker');
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(maker && kijker && office, 'maker, kijker en kantoor zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. maken: alleen de kaart naar RTG; de duur is begrensd op 60 seconden', async () => {
  assert.equal((await api('/api/clips/maak', { titel: '', duurS: 10 }, maker)).status, 400, 'zonder titel niet');
  assert.equal((await api('/api/clips/maak', { titel: 'Te lang', duurS: 90 }, maker)).status, 400, 'langer dan 60s niet');
  const r = await api('/api/clips/maak', { titel: 'Zonsondergang haven', duurS: 30, mbGeschat: 5, poster: POSTER }, maker);
  assert.equal(r.status, 200);
  clipId = r.body.id;
  assert.ok(clipId, 'de kaart heeft een id; het beeld zelf komt nooit bij RTG');
});

test('2. de feed: eindige dagselectie met een expliciet einde, maker online', async () => {
  const r = await api('/api/clips/feed', {}, kijker);
  assert.equal(r.status, 200);
  const c = r.body.clips.find(x => x.id === clipId);
  assert.ok(c, 'de kijker ziet de clip in de dagselectie');
  assert.equal(c.online, true, 'de maker is net actief, dus online');
  assert.equal(c.volgIk, false);
  assert.ok(r.body.einde, 'de feed heeft een expliciet einde (geen oneindige scroll)');
  assert.ok(r.body.clips.length <= 25, 'de dagselectie is begrensd');
});

test('3. volgen: gevolgde makers staan voortaan bovenaan de selectie', async () => {
  const v = await api('/api/clips/volg', { id: clipId, aan: true }, kijker);
  assert.equal(v.status, 200);
  const r = await api('/api/clips/feed', {}, kijker);
  assert.equal(r.body.clips.find(x => x.id === clipId).volgIk, true);
  assert.equal((await api('/api/clips/volg', { id: clipId }, maker)).status, 400, 'uzelf volgen hoeft niet');
});

test('4. het signaal-doorgeefluik: kijker vraagt, regels bewaakt', async () => {
  assert.equal((await api('/api/clips/signaal', { id: clipId, kind: 'vraag' }, kijker)).status, 200,
    'de vraag gaat door naar de maker (SSE)');
  assert.equal((await api('/api/clips/signaal', { id: clipId, kind: 'raar' }, kijker)).status, 400, 'onbekend signaal niet');
  assert.equal((await api('/api/clips/signaal', { id: clipId, kind: 'offer' }, maker)).status, 400,
    'de maker antwoordt altijd gericht aan een kijker');
});

test('5. reacties en melden; kantoor ziet de melding en kan de kaart weghalen', async () => {
  const re = await api('/api/clips/reactie', { id: clipId, tekst: 'Prachtig licht!' }, kijker);
  assert.equal(re.status, 200);
  assert.equal((await api('/api/clips/reacties', { id: clipId }, kijker)).body.reacties.length, 1);
  assert.equal((await api('/api/clips/meld', { id: clipId, reden: 'test' }, kijker)).status, 200);
  const lijst = await api('/api/office/clips', {}, office);
  assert.ok(lijst.body.meldingen.some(m => m.clipId === clipId), 'de melding ligt bij kantoor');
  // weghalen door een ander lid kan niet; door kantoor wel
  assert.equal((await api('/api/clips/weg', { id: clipId }, kijker)).status, 404);
  assert.equal((await api('/api/office/clips/verwijder', { id: clipId }, office)).status, 200);
  const na = await api('/api/clips/feed', {}, kijker);
  assert.ok(!na.body.clips.some(x => x.id === clipId), 'de kaart is weg; het beeld stond toch al alleen bij de maker');
});

/* ---- de studio: knippen, geluid en ondertitels (kern/clips-studio.js) ----
   Het beeld staat alleen bij de maker, dus een knip is een begin en een eind
   en geen nieuwe video; ondertitels zijn tekst en staan daarom wel bij RTG,
   want de kijker moet ze kunnen lezen. */
let studioId;
test('6. knippen: een begin en een eind, en altijd terug te draaien', async () => {
  const r = await api('/api/clips/maak', { titel: 'Kade bij avond', duurS: 30, poster: POSTER, mbGeschat: 6 }, maker);
  assert.equal(r.status, 200);
  studioId = r.body.id;

  // een knip buiten de opname of korter dan een seconde bestaat niet
  assert.equal((await api('/api/clips/knip', { id: studioId, van: 5, tot: 44 }, maker)).status, 400);
  assert.equal((await api('/api/clips/knip', { id: studioId, van: 5, tot: 5.4 }, maker)).status, 400);
  // en een ander knipt niet in andermans clip
  assert.equal((await api('/api/clips/knip', { id: studioId, van: 2, tot: 8 }, kijker)).status, 403);

  const k = await api('/api/clips/knip', { id: studioId, van: 4, tot: 19 }, maker);
  assert.equal(k.status, 200);
  assert.equal(k.body.duurNa, 15, 'de speelduur volgt uit de knip');

  const feed = await api('/api/clips/feed', {}, maker);
  const mijn = feed.body.mijn.find(c => c.id === studioId);
  assert.deepEqual(mijn.knip, { van: 4, tot: 19 });
  assert.equal(mijn.speelduurS, 15);
  assert.equal(mijn.duurS, 30, 'de opname zelf is niet ingekort -- er is niets weggegooid');

  // terugdraaien kan altijd, juist omdat er niets weg is
  assert.equal((await api('/api/clips/knip', { id: studioId, weg: true }, maker)).body.knip, null);
  const na = (await api('/api/clips/feed', {}, maker)).body.mijn.find(c => c.id === studioId);
  assert.equal(na.speelduurS, 30);
});

test('7. ondertitels: tekst hoort bij RTG, want de kijker moet ze lezen', async () => {
  const r = await api('/api/clips/ondertitels', { id: studioId, regels: [
    { van: 6, tot: 9, tekst: 'De boten liggen stil.' },
    { van: 1, tot: 4, tekst: 'Het is bijna donker.' },
    { van: 12, tot: 40, tekst: 'valt buiten de opname' },
    { van: 15, tot: 14, tekst: 'eindigt voor het begint' },
    { van: 20, tot: 22, tekst: '' }
  ] }, maker);
  assert.equal(r.status, 200);
  assert.equal(r.body.regels, 2, 'alleen wat klopt wordt bewaard');
  assert.deepEqual(r.body.ondertitels.map(c => c.van), [1, 6], 'op tijd gesorteerd');

  const kf = await api('/api/clips/feed', {}, kijker);
  const bij = kf.body.clips.find(c => c.id === studioId);
  assert.equal(bij.ondertiteld, true, 'de kijker ziet dat hij deze kan volgen');
  assert.equal(bij.ondertitels.length, 2, 'en krijgt de regels erbij');

  // een ander schrijft geen ondertitels onder andermans clip
  assert.equal((await api('/api/clips/ondertitels', { id: studioId, regels: [] }, kijker)).status, 403);
});

test('8. geluid: drie eerlijke antwoorden, en geen muziekbibliotheek', async () => {
  assert.equal((await api('/api/clips/geluid', { id: studioId, soort: 'muziek' }, maker)).status, 400,
    'we hebben geen rechten op muziek en doen dus niet alsof');
  for (const s of ['eigen', 'stil', 'stem']) {
    assert.equal((await api('/api/clips/geluid', { id: studioId, soort: s }, maker)).body.geluid, s);
  }
  const bij = (await api('/api/clips/feed', {}, kijker)).body.clips.find(c => c.id === studioId);
  assert.equal(bij.geluid, 'stem');
});

test('9. de kijker mag de selectie beperken tot wat hij kan volgen', async () => {
  const kaal = await api('/api/clips/maak', { titel: 'Zonder ondertitel', duurS: 8, poster: POSTER }, maker);
  assert.equal(kaal.status, 200);

  const alles = await api('/api/clips/feed', {}, kijker);
  assert.equal(alles.body.alleenOndertiteld, false, 'het filter staat uit tenzij de kijker hem aanzet');
  assert.ok(alles.body.clips.some(c => c.id === kaal.body.id));

  const alleen = await api('/api/clips/feed', { alleenOndertiteld: true }, kijker);
  assert.equal(alleen.body.alleenOndertiteld, true);
  assert.equal(alleen.body.clips.some(c => c.id === kaal.body.id), false, 'zonder ondertitel valt hij af');
  assert.ok(alleen.body.clips.some(c => c.id === studioId), 'met ondertitel blijft hij staan');
  // je eigen clips blijven zichtbaar: het filter gaat over wat je KIJKT.
  // Dus gevraagd als de MAKER -- die ziet zijn eigen werk onder "mijn".
  const bijMaker = await api('/api/clips/feed', { alleenOndertiteld: true }, maker);
  assert.ok(bijMaker.body.mijn.some(c => c.id === kaal.body.id),
    'je eigen werk verdwijnt niet uit je eigen lijst, ook niet met het filter aan');
  assert.equal(alleen.body.einde, 'Dat was het voor nu.', 'de selectie houdt zijn expliciete einde');
});
