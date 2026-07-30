/* Golf 3: de directie-cockpit van de schoolpartner op kantoren-niveau,
   met de onderwijsregels leidend. Getoetst: signalen op organisatieniveau
   (wachtend personeel, klas zonder rooster), de schoolbrede mededeling die
   in elke klas landt met de directie als afzender, en dat de cockpit
   NOOIT leerlingnamen of cijfers bevat.
   Draai los: node --experimental-sqlite --test test/schooldirectie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dir-'));
const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('directie-cockpit: signalen, schoolbrede mededeling en geen leerlingdata', async () => {
  // school aanmelden + personeel dat wacht
  const sch = (await api('/school/school/maak', { naam: 'Lyceum De Branding', plaats: 'Ibiza' })).body;
  assert.ok(sch.beheerToken);
  const p = (await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Idris', rol: 'leraar' })).body;

  // de cockpit ziet het wachtende personeel als signaal
  let c = (await api('/school/directie/cockpit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken })).body;
  assert.equal(c.ok, true);
  assert.ok(c.signalen.some(s => s.soort === 'personeel'), 'wachtend personeel staat in de signalen');

  // RTG keurt de school goed; de directie laat de leraar toe; de leraar maakt een klas
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.equal((await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, kantoor)).body.ok, true);
  assert.equal((await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true })).body.ok, true);
  const klas = (await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelId: p.personeelId, personeelToken: p.personeelToken, naam: '3B' })).body;
  assert.ok(klas.code);

  // zonder rooster: het rooster-signaal verschijnt, met aggregaten per klas
  c = (await api('/school/directie/cockpit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken })).body;
  assert.ok(c.signalen.some(s => s.soort === 'rooster' && s.tekst.indexOf('3B') >= 0), 'klas zonder rooster wordt gesignaleerd');
  assert.equal(c.klassen[0].huiswerkWeek, 0);
  // onderwijsregel: nergens leerlingnamen of cijfers in het directiebeeld
  const plat = JSON.stringify(c);
  assert.ok(plat.indexOf('cijfer') < 0 && plat.indexOf('leerlingNamen') < 0, 'geen cijfers of namen op directieniveau');

  // schoolbrede mededeling: een keer schrijven, elke klas ziet hem met afzender
  const m = (await api('/school/directie/mededeling', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, tekst: 'Vrijdag studiedag: de school is dicht.' })).body;
  assert.equal(m.klassen, 1);
  const kv = (await api('/school/klas', { klasCode: klas.code, personeelToken: p.personeelToken })).body;
  const med = kv.mededelingen || [];
  assert.ok(med.some(x => x.vanDirectie && x.tekst.indexOf('studiedag') >= 0), 'de mededeling staat in de klas met de directie als afzender');

  // en hij staat als laatste schoolbrede mededeling in de cockpit
  c = (await api('/school/directie/cockpit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken })).body;
  assert.ok((c.mededelingen || []).some(x => x.tekst.indexOf('studiedag') >= 0));
});
