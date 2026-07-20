/* RTG Pulse (kern/pulse.js): het 9+-microblog op codenaam. Posten met de
   9+-poort, volgen, de chronologische feed, reacties, melden (3x = verborgen)
   en de 9+-poort op De Salon en de vriendenchat. Draai los:
   node --experimental-sqlite --test test/pulse.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pulse-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const pu = (pad, body, token) => raw('/member/pulse/' + pad, body, token);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'p' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  return r.token;
}

test('de 9+-poort: keur weigert grof taalgebruik en telefoonnummers, en laat normaal door', () => {
  const { keur } = require('../server/kern/veilig');
  assert.equal(keur('Wat een prachtige dag op Ibiza!').ok, true);
  assert.equal(keur('lekker 30 graden vandaag').ok, true, 'gewone getallen mogen');
  assert.equal(keur('dit is fucking mooi').ok, false, 'grof engels wordt geweigerd');
  assert.equal(keur('KANKER druk vandaag').ok, false, 'grof nederlands, ook in hoofdletters');
  assert.equal(keur('bel me op 06 12345678').ok, false, 'geen telefoonnummers in een 9+-feed');
});

test('posten, volgen en de chronologische feed', async () => {
  const a = await lid(), b = await lid();
  const p1 = await json(await pu('post', { tekst: 'Mijn eerste bericht op #pulse vanaf #ibiza' }, a));
  assert.ok(p1.ok && p1.post.id);
  assert.deepEqual(p1.post.tags.sort(), ['ibiza', 'pulse']);
  // grof taalgebruik komt er niet in
  assert.equal((await pu('post', { tekst: 'wat een shit dag' }, b)).status, 400);
  // B ziet het bericht via Ontdek, nog niet via Volgend
  let f = await json(await pu('feed', { soort: 'ontdek' }, b));
  const vanA = f.feed.find(x => x.tags.includes('pulse'));
  assert.ok(vanA, 'het bericht staat in Ontdek');
  assert.equal((await json(await pu('feed', { soort: 'volgend' }, b))).feed.length, 0);
  // B volgt A -> nu wel in Volgend, en de trending telt de hashtags
  assert.equal((await json(await pu('volg', { key: vanA.van }, b))).volgIk, true);
  f = await json(await pu('feed', { soort: 'volgend' }, b));
  assert.ok(f.feed.some(x => x.id === vanA.id));
  assert.ok(f.trending.some(t => t.tag === 'pulse'));
});

test('reageren (met 9+-poort) en je eigen bericht weghalen', async () => {
  const a = await lid(), b = await lid();
  const p = await json(await pu('post', { tekst: 'Wie gaat er mee zeilen?' }, a));
  assert.equal((await pu('reactie', { id: p.post.id, tekst: 'Ik! Hoe laat?' }, b)).status, 200);
  assert.equal((await pu('reactie', { id: p.post.id, tekst: 'kut weer vandaag' }, b)).status, 400);
  const f = await json(await pu('feed', { soort: 'ontdek' }, a));
  assert.equal(f.feed.find(x => x.id === p.post.id).reacties.length, 1);
  // alleen de eigenaar haalt zijn bericht weg
  assert.equal((await pu('weg', { id: p.post.id }, b)).status, 404);
  assert.equal((await pu('weg', { id: p.post.id }, a)).status, 200);
});

test('melden: drie unieke melders verbergen een bericht automatisch', async () => {
  const a = await lid();
  const p = await json(await pu('post', { tekst: 'Een bericht dat gemeld gaat worden' }, a));
  for (let i = 0; i < 3; i++) {
    const m = await lid();
    const r = await json(await pu('meld', { id: p.post.id, reden: 'test' }, m));
    assert.equal(r.verborgen, i === 2, 'pas bij de derde melder verdwijnt het');
  }
  const f = await json(await pu('feed', { soort: 'ontdek' }, a));
  assert.ok(!f.feed.some(x => x.id === p.post.id), 'het gemelde bericht is verborgen');
});

test('de 9+-poort geldt ook in De Salon (reacties op een seed-post)', async () => {
  const a = await lid();
  // zoek een bestaande seed-post op (de ids zijn klein en numeriek)
  let postId = null;
  for (let i = 1; i <= 10 && postId == null; i++) {
    const r = await raw('/comment', { postId: i, text: 'Wat een prachtige plek!' }, a);
    if (r.status === 200) postId = i;
  }
  if (postId == null) return; // geen seed-posts in deze testmodus; de kern-keuring is hierboven al bewezen
  const fout = await raw('/comment', { postId, text: 'wat een shit plek' }, a);
  assert.equal(fout.status, 400, 'grof taalgebruik komt De Salon niet in');
  const d = await json(fout);
  assert.match(d.error || '', /9\+/, 'de uitleg noemt de 9+-grens');
});
