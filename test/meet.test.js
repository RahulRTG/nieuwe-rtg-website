/* RTG Meet: kamers op codenaam, de toegangsregels (open op code, besloten
   via de agenda-afspraak), het doorgeefluik voor WebRTC-seinen en de
   idempotente koppeling met RTG Agenda.
   Draai los: node --test test/meet.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, lidC, codeA, codeB, codeC;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meet-'));

function api(pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Zaallid ' + seq, email: 'mt' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1991-07-07', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(); const b = await lid(); const c = await lid();
  lidA = a.token; lidB = b.token; lidC = c.token;
  codeA = a.codenaam; codeB = b.codenaam; codeC = c.codenaam;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een open kamer: de code is de sleutel, en de kamer kent alleen codenamen', async () => {
  const k = await api('/api/meet/maak', { titel: 'Proeverij voorbespreken' }, lidA);
  assert.equal(k.status, 200);
  assert.match(k.body.code, /^[A-Z0-9]{6}$/);

  const inA = await api('/api/meet/kom', { code: k.body.code }, lidA);
  const inB = await api('/api/meet/kom', { code: k.body.code.toLowerCase() }, lidB);
  assert.equal(inB.status, 200, 'de code is niet hoofdlettergevoelig');
  assert.deepEqual(inB.body.kamer.aanwezig.sort(), [codeA, codeB].sort());
  assert.ok(!/Zaallid/.test(JSON.stringify(inB.body)), 'nergens een echte naam');
  assert.equal(inA.body.ik, codeA);

  // een sein gaat alleen naar wie in de kamer zit
  const sein = await api('/api/meet/sein', { id: inA.body.kamer.id, naar: codeB, kind: 'offer',
    payload: { type: 'offer', sdp: 'x' } }, lidA);
  assert.equal(sein.status, 200);
  const fout = await api('/api/meet/sein', { id: inA.body.kamer.id, naar: codeC, kind: 'offer', payload: {} }, lidA);
  assert.equal(fout.status, 404, 'wie er niet is, krijgt geen seinen');
  const raar = await api('/api/meet/sein', { id: inA.body.kamer.id, naar: codeB, kind: 'onzin', payload: {} }, lidA);
  assert.equal(raar.status, 400, 'alleen bekende seinen');

  // C zit niet in de kamer en mag ook niet seinen
  const buiten = await api('/api/meet/sein', { id: inA.body.kamer.id, naar: codeB, kind: 'ice', payload: {} }, lidC);
  assert.equal(buiten.status, 403);
});

test('2. de agenda-afspraak is de sleutel: dezelfde afspraak geeft dezelfde besloten kamer', async () => {
  const af = await api('/api/agenda/bewaar', { titel: 'Kwartaaloverleg', datum: '2026-09-01', tijd: '10:00' }, lidA);
  assert.equal(af.status, 200);
  await api('/api/agenda/uitnodig', { id: af.body.id, codenaam: codeB }, lidA);

  const k1 = await api('/api/meet/maak', { agendaId: af.body.id }, lidA);
  assert.equal(k1.status, 200);
  const k2 = await api('/api/meet/maak', { agendaId: af.body.id }, lidB);
  assert.equal(k2.status, 200);
  assert.equal(k2.body.code, k1.body.code, 'organisator en genodigde landen in dezelfde kamer');

  // wie niet op de afspraak staat, komt er niet in: niet via maak en niet via de code
  const k3 = await api('/api/meet/maak', { agendaId: af.body.id }, lidC);
  assert.equal(k3.status, 403);
  const inC = await api('/api/meet/kom', { code: k1.body.code }, lidC);
  assert.equal(inC.status, 403, 'besloten is besloten, ook met de code in de hand');

  const inB = await api('/api/meet/kom', { code: k1.body.code }, lidB);
  assert.equal(inB.status, 200);
  assert.equal(inB.body.kamer.besloten, true);
  assert.equal(inB.body.kamer.titel, 'Kwartaaloverleg', 'de kamer erft de titel van de afspraak');
});

test('3. verlaten, opruimen en de vollegrens', async () => {
  const k = await api('/api/meet/maak', { titel: 'Even snel' }, lidA);
  const inA = await api('/api/meet/kom', { code: k.body.code }, lidA);
  await api('/api/meet/kom', { code: k.body.code }, lidB);
  await api('/api/meet/verlaat', { id: inA.body.kamer.id }, lidB);
  const mijn = await api('/api/meet/mijn', {}, lidA);
  const zaal = mijn.body.kamers.find(x => x.id === inA.body.kamer.id);
  assert.deepEqual(zaal.aanwezig, [codeA], 'wie weggaat is echt weg');

  // alleen de gastheer ruimt de kamer op
  assert.equal((await api('/api/meet/weg', { id: inA.body.kamer.id }, lidB)).status, 403);
  assert.equal((await api('/api/meet/weg', { id: inA.body.kamer.id }, lidA)).status, 200);
  assert.equal((await api('/api/meet/kom', { code: k.body.code }, lidB)).status, 404, 'de kamer is echt weg');
});
