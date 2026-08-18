/* Rahul Bijles: iedereen een eigen, geduldige bijles-AI die op niveau werkt
   en positief laat leren. Twee werelden, een motor: het RTG-lid (niveau uit
   het leerpaspoort) en het schoolkind (niveau uit de klas, doelen uit het
   open huiswerk). Zonder ANTHROPIC_API_KEY antwoordt de demo-terugval, en
   die is net zo geduldig -- daar rekenen deze tests op.
   Draai los: node --test test/bijles.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bijles-'));

const post = (pad, body, headers) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const lid = (pad, body) => post('/api' + pad, body, { Authorization: 'Bearer ' + token });
const rtf = (pad, body) => post('/api/foundation' + pad, body);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Levenslang Lerende', email: 'bl' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-01-15', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) });
  token = (await r.json()).token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het lid: de bijles kent je niveau uit het leerpaspoort, blijft geduldig en onthoudt het gesprek', async () => {
  await lid('/onderwijs/inschrijf', { fase: 'po-g3' });
  const r = await lid('/bijles/vraag', { tekst: 'Ik snap optellen over het tiental niet.' });
  assert.equal(r.status, 200);
  assert.match(r.body.text, /stap voor stap/i, 'geduldig: samen, in stapjes');
  assert.match(r.body.text, /Groep 3/, 'de bijles werkt op het niveau uit het paspoort');
  assert.match(r.body.text, /hint/i, 'eerst een hint, niet het antwoord');
  assert.doesNotMatch(JSON.stringify(r.body), /score|ranglijst|streak|dom/i, 'positief leren: geen druk, geen vergelijken');
  await lid('/bijles/vraag', { tekst: 'En hoe zit het met 8 + 5?' });
  const g = await lid('/bijles/gesprek');
  assert.equal(g.body.beurten.length, 4, 'het gesprek is van jou en blijft bewaard');
  assert.equal(g.body.beurten[0].rol, 'user');
  // zonder vraag geen beurt, zonder token geen bijles
  assert.equal((await lid('/bijles/vraag', { tekst: '' })).status, 400);
  assert.equal((await post('/api/bijles/vraag', { tekst: 'hoi' })).status, 401);
});

test('2. het schoolkind: de eigen Rahul kent de klas en het open huiswerk, en het gesprek is per kind', async () => {
  // school + klas + kind (zelf aangesloten)
  const sch = await rtf('/school/school/maak', { naam: 'De Bijlesboom', plaats: 'Zwolle' });
  const login = await post('/api/office/login', { code: 'RTG-OFFICE' });
  await post('/api/office/school/decide', { code: sch.body.schoolCode, action: 'goedkeuren' }, { Authorization: 'Bearer ' + login.body.token });
  const p = await rtf('/school/personeel/aanmeld', { schoolCode: sch.body.schoolCode, naam: 'Juf Bijles', rol: 'leraar' });
  await rtf('/school/personeel/besluit', { schoolCode: sch.body.schoolCode, beheerToken: sch.body.beheerToken, personeelId: p.body.personeelId, akkoord: true });
  const kl = await rtf('/school/leraar/klas/maak', { schoolCode: sch.body.schoolCode, personeelToken: p.body.personeelToken, naam: 'Groep 6' });
  const g = await rtf('/gezin/maak', { gezinsnaam: 'Fam Bijles', naam: 'Ouder Bijles', pin: '1234' });
  const kind = await rtf('/gezin/profiel/maak', { code: g.body.code, token: g.body.token, naam: 'Kind Bijles', rol: 'kind', groep: 'kind' });
  const kindToken = (await rtf('/gezin/profiel/kies', { code: g.body.code, profielId: kind.body.profiel.id })).body.token;
  await rtf('/school/koppel', { code: g.body.code, token: kindToken, klasCode: kl.body.code });
  await rtf('/school/huiswerk/maak', { klasCode: kl.body.code, leraarToken: p.body.personeelToken,
    titel: 'Oefen optellen', vak: 'rekenen', doel: 'rekenen.g3.optellen-tot-20' });
  // de eigen Rahul: niveau = de klas, en het gesprek hoort bij dit kind
  const r = await rtf('/school/bijles/vraag', { code: g.body.code, token: kindToken, klasCode: kl.body.code, tekst: 'Ik vind keersommen moeilijk.' });
  assert.equal(r.status, 200);
  assert.match(r.body.text, /Groep 6/, 'de bijles staat op het niveau van de klas');
  assert.match(r.body.text, /stap voor stap/i);
  const gesprek = await rtf('/school/bijles/gesprek', { code: g.body.code, token: kindToken });
  assert.equal(gesprek.body.beurten.length, 2);
  // de ouder heeft een EIGEN gesprek (zelfde gezin, ander profiel)
  const ouderGesprek = await rtf('/school/bijles/gesprek', { code: g.body.code, token: g.body.token });
  assert.equal(ouderGesprek.body.beurten.length, 0, 'ieder zijn eigen Rahul, ook binnen een gezin');
  // en zonder klas werkt de bijles ook, alleen zonder niveau-vermelding
  const los = await rtf('/school/bijles/vraag', { code: g.body.code, token: g.body.token, tekst: 'Mag ik ook meedoen als ouder?' });
  assert.equal(los.status, 200);
  assert.doesNotMatch(los.body.text, /Groep 6/);
});
