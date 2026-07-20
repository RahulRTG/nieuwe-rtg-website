/* De wauw-laag (kern/wauw.js): de dag-stemming (vaste 9+-lijst) en de
   verjaardagsglans die overal naast de codenaam meereizen (Pulse, Berichten),
   het Moment van de week in de Pulse-feed en De Terugblik op je sociale week.
   Draai los: node --experimental-sqlite --test test/wauw.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wauw-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid(geboortedatum) {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'w' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: geboortedatum || '1992-03-03', tier: 'rtg' }));
  return r.token;
}

test('de stemming: alleen uit de vaste 9+-lijst, en hij reist mee in de Pulse-feed', async () => {
  const a = await lid();
  const s = await json(await raw('/member/wauw/stemming', {}, a));
  assert.ok(Array.isArray(s.keuzes) && s.keuzes.length >= 10, 'er is een vaste lijst');
  // iets buiten de lijst wordt geweigerd
  assert.equal((await raw('/member/wauw/stemming/zet', { emoji: '🍺' }, a)).status, 400);
  assert.equal((await raw('/member/wauw/stemming/zet', { emoji: s.keuzes[0] }, a)).status, 200);
  // de stemming staat naast de codenaam in de feed
  await raw('/member/pulse/post', { tekst: 'Stemmingstest!' }, a);
  const f = await json(await raw('/member/pulse/feed', { soort: 'ontdek' }, a));
  const mijn = f.feed.find(p => p.eigen);
  assert.equal(mijn.stemming, s.keuzes[0], 'de dag-emoji reist mee');
  // weghalen kan ook
  assert.equal((await raw('/member/wauw/stemming/zet', { emoji: '' }, a)).status, 200);
});

test('de verjaardagsglans: wie vandaag jarig is, krijgt overal een taartje', async () => {
  const nu = new Date();
  const jarigDatum = '1995-' + String(nu.getMonth() + 1).padStart(2, '0') + '-' + String(nu.getDate()).padStart(2, '0');
  const jarig = await lid(jarigDatum);
  const niet = await lid('1995-01-15' === jarigDatum.slice(0, 10) ? '1995-06-20' : '1995-01-15');
  await raw('/member/pulse/post', { tekst: 'Vandaag is een mooie dag!' }, jarig);
  const f = await json(await raw('/member/pulse/feed', { soort: 'ontdek' }, niet));
  const post = f.feed.find(p => /mooie dag/.test(p.tekst));
  assert.equal(post.jarig, true, 'de jarige krijgt de glans');
  assert.ok(!f.feed.filter(p => p.eigen).some(p => p.jarig), 'wie niet jarig is, niet');
});

test('het Moment van de week: het meest gewaardeerde bericht wordt gevierd', async () => {
  const a = await lid(), b = await lid(), c = await lid();
  const p = await json(await raw('/member/pulse/post', { tekst: 'Dit wordt het moment van de week' }, a));
  await raw('/member/pulse/like', { id: p.post.id }, b);
  await raw('/member/pulse/like', { id: p.post.id }, c);
  const f = await json(await raw('/member/pulse/feed', { soort: 'ontdek' }, b));
  assert.ok(f.moment, 'er is een moment');
  assert.ok(f.moment.likes >= 2, 'het meest gelikete bericht wint');
});

test('De Terugblik: jouw week in een warm overzicht, zonder ranglijst', async () => {
  const a = await lid(), b = await lid();
  const p = await json(await raw('/member/pulse/post', { tekst: 'Terugbliktest' }, a));
  await raw('/member/pulse/like', { id: p.post.id }, b);
  await raw('/member/pulse/reactie', { id: p.post.id, tekst: 'Leuk!' }, b);
  const t = await json(await raw('/member/wauw/terugblik', {}, a));
  assert.ok(t.ok);
  assert.ok(t.week.posts >= 1, 'de eigen berichten tellen');
  assert.ok(t.week.likes >= 1, 'de hartjes tellen');
  assert.ok(t.week.reacties >= 1, 'de reacties van anderen tellen');
  assert.ok(t.zin && t.zin.length > 20, 'er is een warme zin');
  assert.ok(!('anderen' in t.week) && !('rang' in t.week), 'bewust geen vergelijking met anderen');
});
