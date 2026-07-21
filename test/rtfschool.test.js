/* De School-Bibliotheek (10.000 school-apps per leeftijdsgroep, altijd
   gratis, met de leeftijdspoort) en Samen voor de gezinsapps (kindveilig:
   alleen gezin en bevestigde vrienden). Draai los:
   node --experimental-sqlite --test test/rtfschool.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
function fnd(pad, body) {
  return fetch(base + '/api/foundation' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function api(pad, body, sess) {
  return fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {})) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function gezin(naam) {
  const t = naam + Date.now().toString().slice(-5);
  const g = (await fnd('/gezin/maak', { gezinsnaam: t, naam: 'Ouder ' + t, pin: '1234' })).body;
  const kp = (await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + t, rol: 'kind', groep: 'kind' })).body;
  const kies = (await fnd('/gezin/profiel/kies', { code: g.code, profielId: kp.profiel.id })).body;
  return { ouder: { code: g.code, token: g.token }, kind: { code: g.code, token: kies.token } };
}

let A, B;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfschool-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  A = await gezin('SchoolA');
  B = await gezin('SchoolB');
});
test.after(() => stop(srv && srv.child));

test('1. de School-Bibliotheek telt 50.000 apps: 10.000 per leeftijdsgroep, altijd gratis', async () => {
  const r = await api('/api/rtf/school', {}, A.ouder);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 50000);
  assert.equal(r.body.perGroep, 10000);
  assert.equal(r.body.gratis, true);
  assert.equal(r.body.groepen.length, 5, 'de ouder ziet alle vijf de niveaus, van kleuter tot universiteit');
  const cat = await api('/api/rtf/school/catalogus', { niveau: 'tiener', pagina: 1 }, A.ouder);
  for (const a of cat.body.items) {
    assert.equal(a.prijsCenten, 0);
    assert.match(a.uitleg, /Gezond leren/, 'de gezonde leerregel staat bij elke app');
  }
});

test('2. de leeftijdspoort: een basisschoolkind ziet kleuter en basisschool, geen examentraining', async () => {
  const o = await api('/api/rtf/school', {}, A.kind);
  assert.deepEqual(o.body.groepen.map(g => g.id).sort(), ['kind', 'mini'], 'eigen groep en eronder');
  const cat = await api('/api/rtf/school/catalogus', { per: 48, pagina: 7 }, A.kind);
  for (const a of cat.body.items) assert.ok(['mini', 'kind'].includes(a.groep), a.naam + ' past bij het kind');
  // een universiteits-app installeren wordt netjes geweigerd
  const uni = (await api('/api/rtf/school/catalogus', { niveau: 'jong', pagina: 1 }, A.ouder)).body.items[0];
  assert.equal((await api('/api/rtf/school/installeer', { id: uni.id }, A.kind)).status, 403);
});

test('3. vak-filter en installeren: van tafels tot examentraining vwo', async () => {
  const tafels = await api('/api/rtf/school/catalogus', { niveau: 'kind', vak: 'Tafels', pagina: 1 }, A.kind);
  assert.equal(tafels.body.totaal, 500, 'elk vak telt 500 apps per niveau');
  const r = await api('/api/rtf/school/installeer', { id: tafels.body.items[0].id }, A.kind);
  assert.equal(r.body.aantal, 1);
  const vwo = await api('/api/rtf/school/catalogus', { niveau: 'tiener', vak: 'Examentraining vwo' }, A.ouder);
  assert.ok(vwo.body.totaal === 500 && /Examentraining vwo/.test(vwo.body.items[0].naam));
  const mijn = await api('/api/rtf/school/mijn', {}, A.kind);
  assert.equal(mijn.body.apps.length, 1);
});

test('4. Samen voor de gezinsapps: het gezin doet mee, een vreemd gezin komt er niet in', async () => {
  const k = await api('/api/rtf/samen/maak', {}, A.ouder);
  assert.equal(k.status, 200);
  const code = k.body.kamer.code;
  // het eigen kind mag erbij
  const mee = await api('/api/rtf/samen/mee', { kamercode: code }, A.kind);
  assert.equal(mee.status, 200);
  assert.equal(mee.body.kamer.leden.length, 2);
  // een vreemd gezin (geen vriend) wordt geweigerd
  const vreemd = await api('/api/rtf/samen/mee', { kamercode: code }, B.ouder);
  assert.equal(vreemd.status, 403, 'alleen gezin en bevestigde vrienden');
});

test('5. "kijk hier" binnen de gezinsapps + de kamer-chat; buiten de gezinsapps geweigerd', async () => {
  const code = (await api('/api/rtf/samen/maak', {}, A.ouder)).body.kamer.code;
  await api('/api/rtf/samen/mee', { kamercode: code }, A.kind);
  const zet = await api('/api/rtf/samen/zet', { kamercode: code, pad: '/apps/foundation/schoolbieb.html', titel: 'School-Bibliotheek' }, A.ouder);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.kamer.volg >= 1, 'het volg-tellertje loopt voor de pollende widget');
  assert.equal((await api('/api/rtf/samen/zet', { kamercode: code, pad: '/apps/mall.html' }, A.ouder)).status, 400, 'buiten de gezinsapps: nee');
  await api('/api/rtf/samen/chat', { kamercode: code, tekst: 'Kom je meedoen met tafels?' }, A.kind);
  const staat = await api('/api/rtf/samen/staat', { kamercode: code }, A.ouder);
  assert.equal(staat.body.kamer.pad, '/apps/foundation/schoolbieb.html');
  assert.ok(staat.body.kamer.chat.some(c => /tafels/.test(c.tekst)));
});

test('6. verlaten ruimt op; zonder geldig gezin blijft alles dicht', async () => {
  const code = (await api('/api/rtf/samen/maak', {}, A.ouder)).body.kamer.code;
  await api('/api/rtf/samen/weg', { kamercode: code }, A.ouder);
  assert.equal((await api('/api/rtf/samen/staat', { kamercode: code }, A.ouder)).status, 404);
  assert.equal((await api('/api/rtf/school', {}, { code: 'NEP', token: 'nep' })).status, 403);
  assert.equal((await api('/api/rtf/samen/maak', {}, { code: 'NEP', token: 'nep' })).status, 403);
});
