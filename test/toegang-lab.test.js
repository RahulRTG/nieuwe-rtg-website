/* DE BEWONERSKANT VAN HET LIVING LAB VRAAGT EEN ACCOUNT, EN EEN STEM IS EEN
   PER ACCOUNT (eigenaarsbesluit 19 oktober 2026, AGENTS.md: gebruiken vraagt
   een account; gemeld door FoundationOS bij link:klimaat).

   /api/lab2/bewoner/{thema,stem,labs,themas,overzicht} gingen open zonder
   account, en een stem droeg een alias uit het lijf: wie een andere alias
   koos, stemde opnieuw. Nu:
     - zonder account (of gezinsprofiel onder een ouderaccount): 401;
     - een stem hangt aan de sessie, niet aan de alias: hetzelfde account met
       een andere alias krijgt 409, en een tweede account telt gewoon mee. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-lab-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de bewonersroutes vragen een account, en een stem is een per account', async () => {
  for (const pad of ['/api/lab2/bewoner/labs', '/api/lab2/bewoner/themas', '/api/lab2/bewoner/overzicht',
    '/api/lab2/bewoner/thema', '/api/lab2/bewoner/stem'])
    assert.equal((await post(pad, {})).status, 401, pad + ' zonder account');

  const a = await registreerGratis(BASE);
  const labs = await post('/api/lab2/bewoner/labs', {}, a.token);
  assert.equal(labs.status, 200, JSON.stringify(labs.body).slice(0, 160));
  const lab = (labs.body.labs || [])[0];
  assert.ok(lab && lab.id, 'er is een lab om in te stemmen');
  const t = await post('/api/lab2/bewoner/thema', { labId: lab.id, vraag: 'Hoe houden we de buurt koel in de zomer?', alias: 'Buurman' }, a.token);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  const id = t.body.thema.id;

  const een = await post('/api/lab2/bewoner/stem', { id, alias: 'Buurman' }, a.token);
  assert.equal(een.status, 200, JSON.stringify(een.body));
  assert.equal(een.body.thema.stemmen, 1);
  assert.equal((await post('/api/lab2/bewoner/stem', { id, alias: 'Iemand Anders' }, a.token)).status, 409,
    'hetzelfde account met een andere alias stemt niet nog eens');
  const b = await registreerGratis(BASE);
  const twee = await post('/api/lab2/bewoner/stem', { id, alias: 'Buurman' }, b.token);
  assert.equal(twee.status, 200, 'een tweede account stemt, ook met dezelfde alias: ' + JSON.stringify(twee.body));
  assert.equal(twee.body.thema.stemmen, 2);
});
