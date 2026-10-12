/* HET BESTUUR VAN DE LEIDINGSPLEK (kern/rtmail-leiding.js) -- zevende
   tegenlezing van PR #584, op een echte server.

   1. DELEGATIE STEEKT DE ZAAKGRENS NIET OVER. Een medewerker van KIKUNOI geeft
      het postvak (exporteren) aan een andere zaak. Een MANAGER van die andere
      zaak is daarmee geen manager van KIKUNOI: zijn export bevat de
      wervingspost van KIKUNOI niet.
   2. EEN POSTVAKTERMIJN RAAKT DE LEIDINGSPLEK NIET, van een collega niet en
      van een manager niet: die volgt zijn eigen termijn (584A,
      test/rtmail-leidingtermijn.test.js). Het bewijs van een opruimronde noemt
      de medewerker uit de INLOG.

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
  // en een gewoon oud bericht in het gedeelde postvak, voor het bewijs van een opruimronde
  db.rtmail.berichten.unshift({ id: 'oudgewoon', van: 'klant@rtmail', naar: 'kikunoi@partner.rtg', soort: 'bericht',
    onderwerp: 'oud', tekst: 'x', at: new Date(Date.now() - 3 * 86400e3).toISOString(), draad: 'oudgewoon' });
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
  // en het bewaarbeleid toont hem de leidingsplek niet
  assert.equal((await api('/api/supplier/rtmail/bewaarbeleid', { postvak: 'kikunoi@partner.rtg' }, luz.m.tok)).body.leiding, undefined);
  // tegenproef: de manager van KIKUNOI zelf krijgt hem wel mee
  assert.ok(heeft(await api('/api/supplier/rtmail/export', { reden: 'proef', metInhoud: true }, k.m.tok)), 'de eigen manager mist hem');
});

test('2. een postvaktermijn raakt de leidingsplek nooit; het bewijs noemt de inlog', async () => {
  const k = await zaak('KIKUNOI');
  const inbox = async () => heeft(await api('/api/supplier/rtmail/inbox', {}, k.m.tok));
  // een collega zet een termijn van een dag en ruimt op: de wervingspost blijft
  assert.equal((await api('/api/supplier/rtmail/bewaartermijn', { dagen: 1, reden: 'proef' }, k.w.tok)).status, 200);
  const op = await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, k.w.tok);
  assert.equal(op.status, 200, JSON.stringify(op.body));
  assert.ok(await inbox(), 'een collega ruimde de wervingspost op');
  // het bewijs van zijn opruimronde noemt hem uit de inlog
  const r = (await api('/api/supplier/rtmail/vernietigingen', {}, k.w.tok)).body.bewijs.find(v => v.aantal > 0);
  assert.ok(r, 'het oude gewone bericht is opgeruimd en staat in het bewijs');
  assert.equal(r.sessie, k.w.id, 'het bewijs noemt de medewerker uit de inlog');
  // ook een manager neemt met een postvaktermijn geen kortere termijn voor de leidingsplek over (584A)
  assert.equal((await api('/api/supplier/rtmail/bewaartermijn', { dagen: 1, reden: 'proef' }, k.m.tok)).status, 200);
  assert.equal((await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, k.m.tok)).status, 200);
  assert.ok(await inbox(), 'een postvaktermijn ruimde de leidingsplek op');
});
