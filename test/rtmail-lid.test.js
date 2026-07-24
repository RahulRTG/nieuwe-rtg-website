/* RTMAIL aan de lid-kant: elk nieuw lid krijgt een welkom in zijn eigen
   postvak, dat als kanaal in de verenigde Berichten-app verschijnt en te lezen
   is. End-to-end tegen een echte server.
   Draai: node --experimental-sqlite --test test/rtmail-lid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtmail-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await json(await api('/api/auth/register', { name: 'Post Lid', email: 'post@x.nl', phone: '0612345611',
    password: 'geheim123', geboortedatum: '1992-05-05', tier: 'rtg', pasApp: 'rtg' }));
  token = reg.token;
  assert.ok(token, 'het lid is aangemeld');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een nieuw lid heeft direct een welkom in zijn RTMAIL-postvak', async () => {
  const d = await json(await api('/api/member/rtmail/inbox', {}, token));
  assert.ok(d.adres && d.adres.endsWith('@rtmail'), 'er is een postvak-adres op codenaam');
  assert.ok(Array.isArray(d.berichten) && d.berichten.length >= 1, 'er staat een bericht');
  assert.match(d.berichten[0].onderwerp, /Welkom/);
  assert.equal(d.berichten[0].van, 'rtg@rtmail');
  assert.equal(d.ongelezen, 1);
});

test('RTMAIL verschijnt als kanaal in de verenigde Berichten-app', async () => {
  const d = await json(await api('/api/member/berichten', {}, token));
  const kanaal = (d.kanalen || []).find(k => k.soort === 'rtmail');
  assert.ok(kanaal, 'er is een RTMAIL-kanaal');
  assert.equal(kanaal.link, '/apps/rtmail.html');
  assert.match(kanaal.laatste, /Welkom/);
  assert.equal(kanaal.ongelezen, 1);
});

test('een bericht lezen zet de teller op nul', async () => {
  const inbox = await json(await api('/api/member/rtmail/inbox', {}, token));
  const id = inbox.berichten[0].id;
  const r = await api('/api/member/rtmail/lees', { id }, token);
  assert.equal(r.status, 200);
  const na = await json(await api('/api/member/rtmail/inbox', {}, token));
  assert.equal(na.ongelezen, 0);
  assert.equal(na.berichten[0].gelezen, true);
});

test('zonder inlog blijft het postvak dicht', async () => {
  const r = await fetch(BASE + '/api/member/rtmail/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 401);
});
