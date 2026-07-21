/* De echte RTG Bibliotheek: de RTF-afdeling in de Mall (open voor iedereen,
   ook de gast) en de bibliothecaris die in beide werelden alleen echte apps
   aanraadt. Draai los: node --experimental-sqlite --test test/bibliotheek.test.js */
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

let srv, base, gast, gezin, kind;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bieb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  gast = (await api(base, '/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.ok(gast);
  gezin = (await api(base, '/api/foundation/gezin/maak', { gezinsnaam: 'Biebgezin', naam: 'Mam', pin: '1234' })).body;
  const kp = (await api(base, '/api/foundation/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Fee', rol: 'kind', groep: 'kind' })).body;
  kind = (await api(base, '/api/foundation/gezin/profiel/kies', { code: gezin.code, profielId: kp.profiel.id })).body;
});
test.after(() => stop(srv && srv.child));

test('1. de RTF-afdeling in de Mall is voor de gast volledig open, installeren incluis', async () => {
  const o = await api(base, '/api/mall/rtf', {}, gast);
  assert.equal(o.status, 200);
  assert.equal(o.body.totaal, 20000);
  assert.ok(o.body.gratis);
  const cat = await api(base, '/api/mall/rtf/catalogus', { pagina: 1 }, gast);
  assert.ok(cat.body.items.length > 0);
  const eerste = cat.body.items[0];
  const i1 = await api(base, '/api/mall/rtf/installeer', { id: eerste.id }, gast);
  assert.equal(i1.status, 200);
  assert.equal((await api(base, '/api/mall/rtf/mijn', {}, gast)).body.apps.length, 1);
  assert.equal((await api(base, '/api/mall/rtf/weg', { id: eerste.id }, gast)).status, 200);
  assert.equal((await api(base, '/api/mall/rtf')).status, 401, 'zonder aanmelding geen bieb');
});

test('2. de bibliothecaris in de Mall raadt alleen ECHTE apps aan, ook voor de gast', async () => {
  const r = await api(base, '/api/bieb/ai', { vraag: 'wij gaan naar Londen en ik wil beter leren fotograferen' }, gast);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord.length > 30, 'een echt advies');
  assert.ok(r.body.aanraders.length >= 2, 'meerdere aanraders');
  const biebs = new Set(r.body.aanraders.map(a => a.bieb));
  assert.ok(biebs.has('Reis-Bibliotheek'), 'Londen komt uit de Reis-afdeling');
  for (const a of r.body.aanraders) assert.ok(a.naam.length > 3 && a.bieb, 'elke aanrader is een echte titel met afdeling');
  assert.equal((await api(base, '/api/bieb/ai', { vraag: 'x' }, gast)).status, 400, 'een lege vraag krijgt nette uitleg');
});

test('3. de bibliothecaris in de RTF-bieb is kindveilig en zoekt in de kinder-catalogi', async () => {
  const r = await api(base, '/api/rtf/bieb/ai', { code: gezin.code, token: kind.token, vraag: 'ik wil beter leren rekenen' });
  assert.equal(r.status, 200);
  assert.ok(r.body.aanraders.length >= 1);
  assert.ok(r.body.aanraders.every(a => ['App-Bibliotheek', 'School-Bibliotheek', 'Beroepen-Bibliotheek'].includes(a.bieb)),
    'aanraders komen alleen uit de kindveilige bibliotheken');
  assert.equal((await api(base, '/api/rtf/bieb/ai', { code: gezin.code, token: 'fout', vraag: 'rekenen' })).status, 403, 'zonder profiel geen bibliothecaris');
});
