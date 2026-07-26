/* RTG Galerij: de tijdlijn leest De Salon en RTG Bestanden (geen dubbele
   opslag), albums zijn verwijzingen en favorieten blijven van het lid.
   Draai los: node --experimental-sqlite --test test/galerij.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-galerij-'));

function api(pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// een minimale geldige PNG (1x1), genoeg voor de kluis en de tijdlijn
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';

let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Beeldlid ' + seq, email: 'gl' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1989-06-06', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  return { token: reg.body.token };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(); const b = await lid();
  lidA = a.token; lidB = b.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de tijdlijn leest RTG Bestanden: beeld erin is beeld in de galerij, tekst niet', async () => {
  const foto = await api('/api/bestanden/upload', { naam: 'strand.png', dataUrl: PNG }, lidA);
  assert.equal(foto.status, 200);
  await api('/api/bestanden/upload', { naam: 'lijstje.txt',
    dataUrl: 'data:text/plain;base64,' + Buffer.from('geen beeld').toString('base64') }, lidA);

  const g = await api('/api/galerij/mijn', {}, lidA);
  assert.equal(g.status, 200);
  const beeld = g.body.beelden.find(b => b.bron === 'bestand' && b.id === foto.body.id);
  assert.ok(beeld, 'het beeld uit de kluis staat in de tijdlijn');
  assert.ok(!g.body.beelden.some(b => b.naam === 'lijstje.txt'), 'tekst hoort niet in een galerij');

  // en de galerij van B blijft leeg: beelden zijn van het lid zelf
  const gb = await api('/api/galerij/mijn', {}, lidB);
  assert.ok(!gb.body.beelden.some(b => b.id === foto.body.id), 'B ziet de beelden van A niet');
});

test('2. favorieten en albums: verwijzingen, geen kopieen', async () => {
  const foto = await api('/api/bestanden/upload', { naam: 'wijngaard.png', dataUrl: PNG }, lidA);
  const item = { bron: 'bestand', id: foto.body.id };

  assert.equal((await api('/api/galerij/favoriet', { item }, lidA)).status, 200);
  let g = await api('/api/galerij/mijn', {}, lidA);
  assert.equal(g.body.beelden.find(b => b.id === foto.body.id).favoriet, true);
  await api('/api/galerij/favoriet', { item, aan: false }, lidA);
  g = await api('/api/galerij/mijn', {}, lidA);
  assert.equal(g.body.beelden.find(b => b.id === foto.body.id).favoriet, false, 'favoriet eraf is eraf');

  const alb = await api('/api/galerij/album', { naam: 'Zomer' }, lidA);
  assert.equal(alb.status, 200);
  assert.ok((await api('/api/galerij/album', { naam: '  ' }, lidA)).status >= 400, 'een album heeft een naam');
  await api('/api/galerij/zet', { album: alb.body.id, item }, lidA);
  await api('/api/galerij/zet', { album: alb.body.id, item }, lidA);
  g = await api('/api/galerij/mijn', {}, lidA);
  assert.equal(g.body.albums.find(a => a.id === alb.body.id).items.length, 1, 'twee keer zetten blijft een verwijzing');

  // het album weghalen laat het beeld gewoon staan
  await api('/api/galerij/album', { id: alb.body.id, weg: true }, lidA);
  g = await api('/api/galerij/mijn', {}, lidA);
  assert.ok(!g.body.albums.find(a => a.id === alb.body.id));
  assert.ok(g.body.beelden.find(b => b.id === foto.body.id), 'het beeld staat er nog: een album is geen map');
});

test('3. een eigen Salon-post met beeld verschijnt vanzelf; die van een ander niet', async () => {
  const post = await api('/api/salon/plaats', { tekst: 'Avondlicht aan zee.',
    media: [{ beeld: PNG, alt: 'De zee bij avond' }] }, lidA);
  assert.equal(post.status, 200);
  const g = await api('/api/galerij/mijn', {}, lidA);
  const uitSalon = g.body.beelden.filter(b => b.bron === 'salon');
  assert.ok(uitSalon.length >= 1, 'de eigen Salon-post staat in de tijdlijn');
  assert.ok(uitSalon[0].src.startsWith('/media/'), 'als lichte verwijzing, niet als kopie');
  assert.ok(!/Beeldlid/.test(JSON.stringify(g.body)), 'nergens een echte naam');

  const gb = await api('/api/galerij/mijn', {}, lidB);
  assert.ok(!gb.body.beelden.some(b => b.bron === 'salon'), 'de galerij toont alleen EIGEN posts');
});
