'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-saloon-'));
let srv, token, ander, bode;
async function api(pad, body = {}, wie = token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    Authorization: 'Bearer ' + (wie || '') }, body: JSON.stringify(body) });
  return { status: r.status, ...await r.json() };
}
const feed = o => api('/api/wereld/feed', { ervaring: 'saloon', lens: 'all', ...o });
const red = (pad, o) => api('/api/supplier/redactie/artikel/' + pad, o, bode);
test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '' } });
  async function lid(n) { return (await api('/api/auth/register', { name: 'Test Saloon ' + n,
    email: 'saloon' + n + '@example.test', phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }, null)).token; }
  token = await lid(1); ander = await lid(2); assert.ok(token && ander);
  const r = await api('/api/supplier/roster', { code: 'BODE' }, null);
  bode = (await api('/api/supplier/login', { code: 'BODE', staffId: r.staff.find(x => x.role === 'manager').id, pin: '1234' }, null)).token;
  assert.ok(bode);
});
test.after(() => { stop(srv && srv.child); fs.rmSync(tmp, { recursive: true, force: true }); });

test('publiceren, lezen, bewaren, corrigeren en intrekken sluiten dezelfde lus', async () => {
  const maak = await red('bewaar', { titel: 'Nieuwe route langs de haven', chapo: 'De buurt krijgt ruimte.', inhoud: 'Eerste verslag.', rubriek: 'Stad' });
  const id = maak.artikel.id, ref = 'nieuws:BODE:' + id;
  const selectie = { bronnen: ['nieuws'] };
  assert.equal((await feed(selectie)).items.some(x => x.id === ref), false, 'concept blijft binnen');
  assert.equal((await red('publiceer', { id })).ok, true);
  const open = await feed(selectie);
  assert.equal(open.bronstatus[0].ok, true, JSON.stringify(open.bronstatus));
  const item = open.items.find(x => x.id === ref); assert.ok(item);
  assert.match(item.url, /krant.html\?zaak=BODE#/);
  const gelezen = await api('/api/krant/artikel', item.artikel); assert.equal(gelezen.artikel.inhoud, 'Eerste verslag.');
  await api('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['nieuws'], bewaar: { id: ref, aan: true } } });
  assert.equal((await feed({ vorm: 'bewaard' })).items[0].id, ref);
  assert.equal((await api('/api/wereld/state', {}, ander)).saloon.voorkeuren.bewaard.length, 0);
  await red('bewaar', { id, titel: 'Gecorrigeerd verslag haven', inhoud: 'Het juiste verslag.', rubriek: 'Stad' });
  const gewijzigd = (await feed()).items.find(x => x.id === ref);
  assert.notEqual(gewijzigd.versie, item.versie); assert.equal(gewijzigd.titel, 'Gecorrigeerd verslag haven');
  await red('concept', { id });
  assert.equal((await feed({ vorm: 'bewaard' })).items.some(x => x.id === ref), false, 'bewaren verleent geen toegang');
  assert.equal((await api('/api/krant/artikel', item.artikel)).status, 404);
});

test('keuzes overleven opnieuw openen; bronnen en privécontext blijven expliciet', async () => {
  let d = await api('/api/wereld/state');
  assert.ok(!d.saloon.voorkeuren.bronnen.includes('persoonlijk'));
  await api('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['sociaal'], plaats: 'Amsterdam', vorm: 'agenda' } });
  d = await api('/api/wereld/state');
  assert.equal(d.saloon.voorkeuren.plaats, 'Amsterdam'); assert.equal(d.saloon.voorkeuren.vorm, 'agenda');
  assert.deepEqual(d.saloon.voorkeuren.bronnen, ['sociaal']);
  assert.equal((await feed({ modus: 'business' })).status, 403);
  const alles = await feed({ bronnen: ['sociaal', 'nieuws', 'makers', 'plekken', 'persoonlijk'], vorm: 'overzicht', plaats: '' });
  assert.equal(alles.status, 200);
  assert.ok(alles.bronstatus.every(b => b.ok), JSON.stringify(alles.bronstatus));
  assert.ok(!JSON.stringify(alles.items).includes('authorKey'));
});

test('publicatie, privacy, reactie en verbergen werken ook via Saloon', async () => {
  const p = await api('/api/salon/plaats', { tekst: 'Een persoonlijk testbericht #eigen', publiek: 'alleenik' });
  const q = { ervaring: 'saloon', bronnen: ['sociaal'], lens: 'all', vorm: 'overzicht', plaats: '' };
  assert.ok((await api('/api/wereld/feed', q)).items.some(i => i.id === 'salon:' + p.post.id));
  assert.equal((await api('/api/wereld/feed', q, ander)).items.some(i => i.id === 'salon:' + p.post.id), false);
  assert.equal((await api('/api/salon/reacties', { id: p.post.id }, ander)).status, 404);
  assert.equal((await api('/api/like', { postId: p.post.id, liked: true }, ander)).status, 404);
  assert.equal((await api('/api/salon/reageer', { id: p.post.id, tekst: 'Mijn aanvulling' })).ok, true);
  await api('/api/salon/verberg', { id: p.post.id, aan: true });
  assert.equal((await api('/api/wereld/feed', q)).items.some(i => i.id === 'salon:' + p.post.id), false);
});
