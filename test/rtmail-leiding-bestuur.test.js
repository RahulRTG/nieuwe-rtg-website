/* HET BESTUUR VAN DE LEIDINGSPLEK (kern/rtmail-leiding.js) -- zevende
   tegenlezing van PR #584, op een echte server.

   1. DELEGATIE STEEKT DE ZAAKGRENS NIET OVER. Een medewerker van KIKUNOI geeft
      het postvak (exporteren) aan een andere zaak. Een MANAGER van die andere
      zaak is daarmee geen manager van KIKUNOI: zijn export bevat de
      wervingspost van KIKUNOI niet.
   2. EEN COLLEGA VERNIETIGT DE LEIDINGSPLEK NIET. Een termijn die een collega
      zet en een opruimronde die hij start, laten de wervingspost staan; alleen
      een manager van de zaak ruimt hem op, op een termijn die een manager
      zette. Het bewijs noemt de medewerker uit de INLOG, en een collega ziet
      geen aantal wervingspost in het bewijs.

   Draai: node --test test/rtmail-leiding-bestuur.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stopNet } = require('./helper');

let srv, TMP, postId;
const env = () => ({ RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1', RTG_STORE: 'json' });
const api = (pad, body, token) => fetch(srv.base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function zaak(code) {
  const staff = (await api('/api/supplier/roster', { code })).body.staff;
  const tok = async (rol, pin) => {
    const s = staff.find(x => x.role === rol);
    return { id: s.id, tok: (await api('/api/supplier/login', { code, staffId: s.id, pin })).body.token };
  };
  return { m: await tok('manager', '1234'), w: staff.some(x => x.role === 'staff') ? await tok('staff', '5678') : null };
}
const heeft = (r) => JSON.stringify(r.body).includes(postId);

test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leidingbestuur-'));
  srv = await startServer({ env: env() });
  const lid = (await api('/api/auth/register', { name: 'Noor Werving', email: 'noor.werving@x.nl', phone: '0612340019',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
  assert.equal((await api('/api/cv/save', { name: 'Noor Werving', contact: 'n@x.nl', skills: 'koken', experience: 'horeca' }, lid)).status, 200);
  assert.equal((await api('/api/member/apply', { supplierCode: 'KIKUNOI', func: 'Kok' }, lid)).status, 200);
  const k = await zaak('KIKUNOI');
  const post = (await api('/api/supplier/rtmail/inbox', {}, k.m.tok)).body.berichten.find(m => m.onderwerp === 'Nieuwe sollicitatie');
  assert.ok(post, 'de manager ziet de sollicitatiepost');
  postId = post.id;
  // oud genoeg maken voor een termijn van een dag
  await stopNet(srv.child);
  const pad = path.join(TMP, 'db.json');
  const db = JSON.parse(fs.readFileSync(pad, 'utf8'));
  db.rtmail.leiding.find(m => m.id === postId).at = new Date(Date.now() - 3 * 86400e3).toISOString();
  fs.writeFileSync(pad, JSON.stringify(db));
  srv = await startServer({ env: env() });
});
test.after(async () => {
  try { await stopNet(srv.child); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een manager van een ANDERE zaak krijgt via een delegatie de wervingspost niet mee in de export', async () => {
  const k = await zaak('KIKUNOI');
  const luz = await zaak('LUZ');
  const d = await api('/api/supplier/rtmail/delegeer', { postvak: 'kikunoi@partner.rtg', aan: 'luz@partner.rtg',
    rechten: ['exporteren', 'lezen', 'metadata', 'bewaarbeleid', 'vernietigen'], reden: 'vakantie' }, k.w.tok);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  const ex = await api('/api/supplier/rtmail/export', { postvak: 'kikunoi@partner.rtg', reden: 'proef', metInhoud: true }, luz.m.tok);
  assert.equal(ex.status, 200, JSON.stringify(ex.body));
  assert.ok(!heeft(ex), 'de export van een manager van LUZ bevat de wervingspost van KIKUNOI');
  // en zijn termijn plus opruimen raakt hem ook niet
  assert.equal((await api('/api/supplier/rtmail/bewaartermijn', { postvak: 'kikunoi@partner.rtg', dagen: 1, reden: 'proef' }, luz.m.tok)).status, 200);
  assert.equal((await api('/api/supplier/rtmail/opruimen', { postvak: 'kikunoi@partner.rtg', reden: 'proef' }, luz.m.tok)).status, 200);
  assert.ok(heeft(await api('/api/supplier/rtmail/inbox', {}, k.m.tok)), 'een manager van LUZ ruimde de leidingsplek van KIKUNOI op');
  // tegenproef: de manager van KIKUNOI zelf krijgt hem wel mee
  assert.ok(heeft(await api('/api/supplier/rtmail/export', { reden: 'proef', metInhoud: true }, k.m.tok)), 'de eigen manager mist hem');
});

test('2. een collega vernietigt de leidingsplek niet; het bewijs noemt de inlog', async () => {
  const k = await zaak('KIKUNOI');
  const inbox = async () => heeft(await api('/api/supplier/rtmail/inbox', {}, k.m.tok));
  assert.equal((await api('/api/supplier/rtmail/bewaartermijn', { dagen: 1, reden: 'proef' }, k.w.tok)).status, 200);
  assert.equal((await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, k.w.tok)).status, 200);
  assert.ok(await inbox(), 'een collega ruimde de wervingspost op');
  // de manager ruimt op, maar op de termijn van de COLLEGA: ook dan blijft hij staan
  assert.equal((await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, k.m.tok)).status, 200);
  assert.ok(await inbox(), 'een termijn die een collega zette ruimde de leidingsplek op');
  // een termijn van een manager, maar een opruimronde van een collega: hij blijft staan
  assert.equal((await api('/api/supplier/rtmail/bewaartermijn', { dagen: 1, reden: 'proef' }, k.m.tok)).status, 200);
  assert.equal((await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, k.w.tok)).status, 200);
  assert.ok(await inbox(), 'een opruimronde van een collega ruimde de leidingsplek op');
  // pas een termijn van een manager EN een opruimronde van een manager
  assert.equal((await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, k.m.tok)).status, 200);
  assert.ok(!(await inbox()), 'de manager kan de leidingsplek wel opruimen');
  const bewijsM = (await api('/api/supplier/rtmail/vernietigingen', {}, k.m.tok)).body.bewijs;
  const lijn = bewijsM.find(v => v.plek === 'leiding');
  assert.ok(lijn, 'de vernietiging van de leidingsplek staat in het bewijs');
  assert.equal(lijn.sessie, k.m.id, 'het bewijs noemt de medewerker uit de inlog');
  const bewijsW = (await api('/api/supplier/rtmail/vernietigingen', {}, k.w.tok)).body.bewijs;
  assert.ok(Array.isArray(bewijsW) && !bewijsW.some(v => v.plek === 'leiding'), 'een collega ziet het aantal wervingspost');
});
