/* RTF School, de tweetalige klasgenoot: een kind uit het buitenland ziet de
   klas in de eigen taal EN in het Nederlands (de taal die het erbij leert).
   Draai los: node --experimental-sqlite --test test/schooltaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-schooltaal-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function office(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + '/api' + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function opzet(naam) {
  const sch = await json(await api('/school/school/maak', { naam: 'De Wereldklas ' + naam, plaats: 'Delft' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf ' + naam, rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 4' }));
  const klas = { code: kl.code, leraarToken: p.personeelToken };
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam ' + naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + naam, rol: 'kind', groep: 'kind' }));
  const kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  await api('/school/koppel', { code: g.code, token: kindToken, klasCode: klas.code });
  return { sch, klas, g, kindToken, profielId: kind.profiel.id };
}
const lr = (klas, pad, body) => api(pad, Object.assign({ klasCode: klas.code, leraarToken: klas.leraarToken }, body || {}));

test('1. de thuistaal: de ouder zet hem, rommel wordt geweigerd, de leraar ziet hem in de klas', async () => {
  const { klas, g, profielId } = await opzet('Taal');
  const zet = await json(await api('/school/taal', { code: g.code, token: g.token, klasCode: klas.code, profielId, taal: 'en' }));
  assert.equal(zet.taal, 'en');
  const raar = await api('/school/taal', { code: g.code, token: g.token, klasCode: klas.code, profielId, taal: 'xx' });
  assert.equal(raar.status, 400, 'een onbekende taal wordt geweigerd');
  const kd = await json(await lr(klas, '/school/klas'));
  assert.equal(kd.leerlingen[0].taal, 'en', 'de leraar weet wie extra taalsteun verdient');
  // en weer terug naar alleen Nederlands kan ook
  const uit = await json(await api('/school/taal', { code: g.code, token: g.token, klasCode: klas.code, profielId, taal: 'nl' }));
  assert.equal(uit.taal, null);
  await api('/school/taal', { code: g.code, token: g.token, klasCode: klas.code, profielId, taal: 'en' });
});

test('2. tweetalig overzicht: de eigen taal ernaast, het Nederlands blijft staan', async () => {
  const { klas, g, kindToken, profielId } = await opzet('Twee');
  await api('/school/taal', { code: g.code, token: g.token, klasCode: klas.code, profielId, taal: 'en' });
  const hw = await json(await lr(klas, '/school/huiswerk/maak', { titel: 'Morgen oefenen', vak: 'taal' }));
  await lr(klas, '/school/mededeling', { tekst: 'Morgen is er geen school.' });
  const mijn = await json(await api('/school/mijn', { code: g.code, token: kindToken }));
  const entry = mijn.school[0];
  assert.equal(entry.taal, 'en');
  // het Nederlands staat er nog gewoon (dat is de taal die het kind leert)
  assert.equal(entry.huiswerk[0].titel, 'Morgen oefenen');
  // en de eigen taal staat ernaast
  assert.ok(entry.vertaling, 'de tweetalige laag reist mee');
  assert.match(entry.vertaling.huiswerk[hw.huiswerk.id].titel, /Tomorrow/i, 'vertaald naar de thuistaal');
  const medIds = Object.keys(entry.vertaling.mededelingen);
  assert.ok(medIds.length >= 1);
  assert.match(entry.vertaling.mededelingen[medIds[0]], /Tomorrow/i);
  // een klasgenoot zonder thuistaal krijgt geen vertaallaag (niets dubbels)
  const g2 = await json(await api('/gezin/maak', { gezinsnaam: 'Fam NL', naam: 'Ouder NL', pin: '1234' }));
  const kind2 = await json(await api('/gezin/profiel/maak', { code: g2.code, token: g2.token, naam: 'Kind NL', rol: 'kind', groep: 'kind' }));
  const kind2Token = (await json(await api('/gezin/profiel/kies', { code: g2.code, profielId: kind2.profiel.id }))).token;
  await api('/school/koppel', { code: g2.code, token: kind2Token, klasCode: klas.code });
  const nl = await json(await api('/school/mijn', { code: g2.code, token: kind2Token }));
  assert.equal(nl.school[0].vertaling, undefined);
});

test('3. de eigen Rahul doet mee: bijles wordt tweetalig zodra de thuistaal bekend is', async () => {
  const { klas, g, kindToken, profielId } = await opzet('Bijles');
  await api('/school/taal', { code: g.code, token: g.token, klasCode: klas.code, profielId, taal: 'uk' });
  const r = await json(await api('/school/bijles/vraag', { code: g.code, token: kindToken, klasCode: klas.code, tekst: 'Ik snap de som niet.' }));
  assert.match(r.text, /eigen taal/i, 'Rahul legt het in de thuistaal uit');
  assert.match(r.text, /Nederlands/, 'en zet het Nederlands ernaast: zo leer je beide');
});
