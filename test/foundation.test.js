/* Integratietests voor de RTFoundation-lesapp (gratis onderwijs): de live-les,
   het bord, het schrift, opgaven en de AI-bijles. Draait tegen een echte
   RTG-server in een tijdelijke datamap.

   Draai los: node --experimental-sqlite --test test/foundation.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3900 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/foundation/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server startte niet op tijd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function les() {
  const d = await json(await api('/les/maak', { vak: 'Rekenen', naam: 'Juf' }));
  const s = await json(await api('/les/join', { code: d.code, naam: 'Sara' }));
  return { code: d.code, tToken: d.token, sToken: s.token, studentId: s.studentId };
}

test('les maken en meedoen geeft een code en tokens', async () => {
  const d = await json(await api('/les/maak', { vak: 'Taal', naam: 'Meester' }));
  assert.equal(d.code.length, 6);
  assert.ok(d.token);
  const s = await api('/les/join', { code: d.code, naam: 'Kim' });
  assert.equal(s.status, 200);
  assert.ok((await json(s)).token);
  // meedoen met een onbekende code kan niet
  assert.equal((await api('/les/join', { code: 'XXXXXX', naam: 'Kim' })).status, 404);
});

test('het bord: docent tekent, iedereen ziet het; een leerling mag niet op het bord', async () => {
  const L = await les();
  const stroke = { tool: 'pen', kleur: '#ffffff', dikte: 4, points: [[10, 10], [20, 20], [30, 15]] };
  const r = await api('/bord/stroke', { code: L.code, token: L.tToken, stroke });
  assert.equal(r.status, 200);
  const bord = await json(await fetch(BASE + '/api/foundation/bord/' + L.code));
  assert.equal(bord.strokes.length, 1);
  assert.deepEqual(bord.strokes[0].points[0], [10, 10]);
  // een leerling kan niet op het bord tekenen
  assert.equal((await api('/bord/stroke', { code: L.code, token: L.sToken, stroke })).status, 403);
  // wissen mag alleen de docent
  assert.equal((await api('/bord/wis', { code: L.code, token: L.sToken })).status, 403);
  assert.equal((await api('/bord/wis', { code: L.code, token: L.tToken })).status, 200);
  assert.equal((await json(await fetch(BASE + '/api/foundation/bord/' + L.code))).strokes.length, 0);
});

test('opgave klaarzetten, inleveren, en de docent leest het schrift mee', async () => {
  const L = await les();
  const o = await json(await api('/opgave', { code: L.code, token: L.tToken, tekst: 'Hoeveel is 6 x 9?' }));
  assert.ok(o.opgave.id);
  // een leerling kan geen opgave klaarzetten
  assert.equal((await api('/opgave', { code: L.code, token: L.sToken, tekst: 'stiekem' })).status, 403);
  // leerling levert in
  assert.equal((await api('/opgave/inleveren', { code: L.code, token: L.sToken, opgaveId: o.opgave.id, antwoord: '54' })).status, 200);
  const opgaven = await json(await fetch(BASE + '/api/foundation/opgaven/' + L.code + '?token=' + L.tToken));
  assert.equal(Object.keys(opgaven.opgaven[0].inzendingen).length, 1);

  // schrift opslaan en de docent leest mee
  await api('/schrift/opslaan', { code: L.code, token: L.sToken, pages: [{ type: 'tekst', titel: 'Som', inhoud: '6 x 9 = 54' }] });
  const peek = await json(await fetch(BASE + '/api/foundation/schrift/' + L.code + '/' + L.studentId + '?token=' + L.tToken));
  assert.equal(peek.schrift.pages[0].inhoud, '6 x 9 = 54');
  // zonder docent-token mag je niet in andermans schrift
  assert.equal((await fetch(BASE + '/api/foundation/schrift/' + L.code + '/' + L.studentId + '?token=' + L.sToken)).status, 403);
});

test('XSS-preventie: HTML in een naam wordt ontdaan van < en >', async () => {
  const d = await json(await api('/les/maak', { vak: '<img src=x onerror=1>Wiskunde', naam: 'x' }));
  const info = await json(await fetch(BASE + '/api/foundation/les/' + d.code));
  assert.ok(!/[<>]/.test(info.les.vak), 'vak zonder < of >, kreeg: ' + info.les.vak);
});

test('AI-bijles: alleen voor wie meedoet, en de tip laadt', async () => {
  const L = await les();
  const goed = await api('/ai', { code: L.code, token: L.sToken, messages: [{ role: 'user', content: 'Help met breuken' }] });
  assert.equal(goed.status, 200);
  assert.ok((await json(goed)).text.length > 5);
  // zonder geldig lestoken geen hulp
  assert.equal((await api('/ai', { code: L.code, token: 'nep', messages: [{ role: 'user', content: 'hoi' }] })).status, 403);
  const tip = await json(await fetch(BASE + '/api/foundation/tip'));
  assert.ok(tip.tip && tip.tip.length > 5);
});
