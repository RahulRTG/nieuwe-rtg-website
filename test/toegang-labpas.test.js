/* ALLES VAN HET BUURTLAB ACHTER EEN ACCOUNT (eigenaarsbesluit 19 oktober 2026,
   tweede ronde): ook een onderzoek bekijken, een klacht indienen, het kader en
   het labpaspoort. Het paspoort is progressie (niveaus en badges) en loopt
   daarom ook door de 18+-poort: een gratis, niet gekeurd account maakt er geen;
   een gekeurd volwassen account wel, en dan hangt het aan dat account. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, keurLidGoed } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

/* Een eigen server: de schrijfrem van het lab (10 per minuut per bron) hoort
   niet te delen met de stemtoetsen in test/toegang-lab.test.js. */
let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-labpas-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('studie, klacht, kader en paspoort vragen een account, en het paspoort de 18+-poort', async () => {
  for (const pad of ['/api/lab2/bewoner/studie', '/api/lab2/bewoner/klacht', '/api/lab2/bewoner/kader',
    '/api/lab2/bewoner/paspoort', '/api/lab2/bewoner/paspoort-maak'])
    assert.equal((await post(pad, { id: 'X', code: 'LABPAS-ZZZZZZZ' })).status, 401, pad + ' zonder account');

  const gratis = await registreerGratis(BASE);
  assert.equal((await post('/api/lab2/bewoner/kader', {}, gratis.token)).status, 200, 'het kader met een gratis account');
  assert.equal((await post('/api/lab2/bewoner/studie', { id: 'bestaat-niet' }, gratis.token)).status, 404,
    'een onderzoek dat niet bestaat: de deur is door, de kern zegt 404');
  assert.notEqual((await post('/api/lab2/bewoner/klacht', { id: 'bestaat-niet', tekst: 'Er werd niet naar ons geluisterd.' }, gratis.token)).status, 401,
    'een klacht met een gratis account komt door de deur');

  const lab = ((await post('/api/lab2/bewoner/labs', {}, gratis.token)).body.labs || [])[0];
  const onder = await post('/api/lab2/bewoner/paspoort-maak', { labId: lab.id, naam: 'Sam' }, gratis.token);
  assert.equal(onder.status, 403, 'een niet gekeurd account bewaart geen niveaus en badges: ' + JSON.stringify(onder.body));
  assert.equal(onder.body.progressie, false);

  const volwassen = async () => {
    const a = await registreerGratis(BASE);
    await keurLidGoed(BASE, a.token, a.codenaam, '1985-05-05');
    return a;
  };
  const a = await volwassen();
  const pas = await post('/api/lab2/bewoner/paspoort-maak', { labId: lab.id, naam: 'Sam' }, a.token);
  assert.equal(pas.status, 200, JSON.stringify(pas.body));
  const code = pas.body.paspoort.code;
  assert.equal((await post('/api/lab2/bewoner/paspoort', { code }, a.token)).status, 200, 'de eigenaar leest zijn paspoort');
  const b = await volwassen();
  assert.equal((await post('/api/lab2/bewoner/paspoort', { code }, b.token)).status, 404, 'een ander account met dezelfde code niet');
});
