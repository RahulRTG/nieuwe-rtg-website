/* DE BEWAARTERMIJN VAN EEN GEZIN (foundation/gezinbewaren.js,
   routes/techniek/bewaren.js; DPIA-GEZIN.md, besluit van 5 oktober 2026).

   Deel A is de zuivere module: welk gezin is kandidaat, en wanneer is het rijp.
   Deel B loopt over ECHTE servers op dezelfde map, met de klok verzet
   (lib/klok.js, RTG_KLOK): eerst nu, dan net over een jaar later (de wacht kondigt
   aan, er wordt nog niets gewist), dan dertig dagen daarna (de eigenaar geeft het
   wissen vrij). Wat hier vastligt:
   1. de machine kondigt aan en wist NOOIT zelf;
   2. de proefronde verandert niets, alleen bevestig 'WIS' wist;
   3. wie na de aankondiging terugkomt, blijft staan;
   4. de eigenaar van een gezin aan een account krijgt bericht;
   5. alleen de eigenaar van RTG geeft het wissen vrij.

   Draai los: node --test test/gezinbewaren.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, stopNet } = require('./helper');

const DAG = 86400000;

test('A1. zuiver: van voor B18, ongebruikt, en wanneer het rijp is', () => {
  let klok = Date.parse('2027-01-01T00:00:00Z');
  const nu = () => new Date(klok).toISOString();
  const gewist = [];
  const G = {
    OUD: { code: 'OUD', at: nu(), profielen: {} },                                // geen gezinscode, geen eigenaar
    VERS: { code: 'VERS', at: nu(), profielen: {} },                              // gezinscode, vers
    ACC: { code: 'ACC', at: nu(), eigenaar: { userId: 7, at: nu() }, profielen: {} } // account, geen gezinscode-rij
  };
  const gb = require('../server/foundation/gezinbewaren')({ G: () => G, save() {}, nu,
    heeftGezinscode: c => c === 'VERS', wisGezin: g => { gewist.push(g.code); delete G[g.code]; } });
  let r = gb.rapport();
  assert.equal(r.zonderGezinscode, 1, 'alleen het gezin zonder code EN zonder eigenaar');
  assert.equal(r.ongebruikt, 0);
  const berichten = [];
  assert.equal(gb.kondigAan((k, n) => { berichten.push(k); return n; }).aangekondigd, 1);
  assert.equal(gb.veeg({ echt: true }).gewist, 0, 'een aankondiging van vandaag is niet rijp');
  klok += 29 * DAG;
  assert.equal(gb.veeg({ echt: true }).gewist, 0, 'na 29 dagen nog niet');
  klok += DAG;
  assert.equal(gb.veeg().zouWissen, 1, 'na 30 dagen wel -- als proef');
  assert.deepEqual(gewist, [], 'een proef wist niets');
  klok += 340 * DAG; // VERS en ACC zijn nu ruim een jaar ongebruikt
  r = gb.rapport();
  assert.equal(r.ongebruikt, 2);
  gb.kondigAan((k, n) => { berichten.push(k); return n; });
  assert.deepEqual(berichten, ['user-7'], 'alleen een gezin aan een account krijgt bericht');
  G.VERS.profielen.a = { sessies: [{ issued_at: nu() }] }; // VERS komt terug
  klok += 31 * DAG;
  const v = gb.veeg({ echt: true });
  assert.deepEqual(gewist.sort(), ['ACC', 'OUD'], 'gebruik heft de aankondiging op');
  assert.equal(v.gewist, 2);
  assert.equal(gb.kondigAan().vervallen, 1, 'en de volgende ronde haalt de stempel weg');
  assert.equal(G.VERS.bewaren, undefined);
});

test('A2. de wisknop hangt achter techniek-inlog EN de eigenaar', () => {
  /* Op een echte server is dit niet te onderscheiden zonder een tweede
     techniekgebruiker die geen eigenaar is; dus hier de wachters zelf. */
  const routes = {};
  const app = { post(pad, ...w) { routes[pad] = w; }, get() {} };
  const techAuth = () => {}, eigenaarAlleen = () => {};
  require('../server/routes/techniek/bewaren')({ app, db: { data: {} }, save() {}, techAuth, eigenaarAlleen, zwaar: {}, sessieSleutel() {}, kern: {} });
  const w = routes['/api/techniek/bewaren/gezinnen'];
  assert.ok(w, 'de route bestaat');
  assert.ok(w.includes(techAuth) && w.includes(eigenaarAlleen), 'met beide sloten');
});

/* ---------- B: echte servers, verzette klok ---------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinbewaren-'));
const OWNER = 'bewaar-eigenaar@x.nl';
const ENV = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
  SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER, RTG_BEWAARRONDE_MS: '300' };
const EMAIL = 'bewaarouder' + Date.now().toString().slice(-6) + '@voorbeeld.nl';
let base, child;
const post = async (pad, body, token) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const mij = async (code, token) => (await fetch(base + '/api/foundation/gezin/' + code + '/mij',
  { headers: { Authorization: 'Bearer ' + token } })).status;
// een vorige server die na een gezakte toets bleef draaien, gaat eerst uit (anders hangt de suite)
const start = async (klok) => { if (child) { try { await stopNet(child); } catch (e) {} child = null; }
  ({ child, base } = await startServer({ env: Object.assign({}, ENV, klok ? { RTG_KLOK: klok } : {}) })); };
const techniek = async () => (await post('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
async function wachtOpRonde(tech, aantal) {
  for (let i = 0; i < 60; i++) {
    const r = await post('/api/techniek/bewaren/gezinnen', {}, tech);
    if (r.body.rapport && r.body.rapport.aangekondigd >= aantal) return r.body;
    await new Promise(k => setTimeout(k, 250));
  }
  throw new Error('de wacht heeft niet aangekondigd');
}

let A, D;
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('B1. vandaag: drie gezinnen, niets kandidaat', async () => {
  await start();
  const a = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam A', naam: 'Ma', pin: '2468', bevoegdGezin: true, privacyAkkoord: true })).body;
  const d = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam D', naam: 'Pa', pin: '1357', bevoegdGezin: true, privacyAkkoord: true })).body;
  A = { code: a.code, gezinscode: a.gezinscode, token: a.token };
  D = { code: d.code, gezinscode: d.gezinscode };
  const reg = await post('/api/auth/register', { name: 'Bewaar Ouder', email: EMAIL, phone: '06' + Date.now().toString().slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.ok(reg.body.token, JSON.stringify(reg.body).slice(0, 160));
  const b = await post('/api/rtf/eigen-gezin/maak', { gezinsnaam: 'Fam B', naam: 'Moeder', bevoegdGezin: true, privacyAkkoord: true }, reg.body.token);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 160));
  const tech = await techniek();
  assert.ok(tech, 'de eigenaar komt op de technische pagina');
  const r = await post('/api/techniek/bewaren/gezinnen', {}, tech);
  assert.equal(r.status, 200);
  assert.equal(r.body.rapport.kandidaten, 0);
  await stopNet(child); child = null;
});

test('B2. een jaar later: de wacht kondigt aan en wist niets; een lid zonder eigenaarsrol mag niet', async () => {
  await start('+8770u'); // 365,4 dagen: over de 365, en de gezinscode (366 dagen) werkt nog
  const tech = await techniek();
  const rap = await wachtOpRonde(tech, 3);
  assert.equal(rap.rapport.ongebruikt, 3, 'alle drie een jaar ongebruikt');
  assert.equal(rap.zouWissen, 0, 'een aankondiging van vandaag is niet rijp');
  const lid = (await post('/api/auth/login', { login: EMAIL, password: 'geheim12345' })).body.token;
  assert.ok(lid);
  assert.ok([401, 403].includes((await post('/api/techniek/bewaren/gezinnen', { bevestig: 'WIS' }, lid)).status));
  const meldingen = (await post('/api/notifications', {}, lid)).body;
  assert.ok(JSON.stringify(meldingen).includes('Uw gezin in FoundationOS'), 'de ouder met een account krijgt bericht: ' + JSON.stringify(meldingen).slice(0, 200));
  // D komt terug: een sessie is gebruik
  const kies = await post('/api/foundation/gezin/inloggen', { gezinscode: D.gezinscode, pin: '1357' });
  assert.ok(kies.body.token, 'D logt in: ' + JSON.stringify(kies.body).slice(0, 160));
  /* en maakt een nieuwe gezinscode: de oude verloopt op dag 366 (kern/bearercode.js),
     dus zonder deze stap kan D over dertig dagen niet meer binnen, gewist of niet */
  const nieuw = await post('/api/foundation/gezin/code/roteer', { code: D.code, token: kies.body.token });
  assert.ok(nieuw.body.gezinscode, JSON.stringify(nieuw.body).slice(0, 160));
  D.gezinscode = nieuw.body.gezinscode;
  await stopNet(child); child = null;
});

test('B3. dertig dagen daarna: de proef wist niets, WIS wist alleen wat aangekondigd en nog ongebruikt is', async () => {
  await start('+9500u'); // 395,8 dagen: de aankondiging is 30 dagen oud
  const tech = await techniek();
  let proef = await post('/api/techniek/bewaren/gezinnen', {}, tech);
  for (let i = 0; i < 40 && proef.body.rapport.kandidaten !== 2; i++) {
    await new Promise(k => setTimeout(k, 250)); proef = await post('/api/techniek/bewaren/gezinnen', {}, tech);
  }
  assert.equal(proef.body.echt, false);
  assert.equal(proef.body.zouWissen, 2, 'A en B, niet D: ' + JSON.stringify(proef.body));
  const nogEens = await post('/api/techniek/bewaren/gezinnen', {}, tech);
  assert.equal(nogEens.body.zouWissen, 2, 'de proef heeft niets weggehaald');
  const echt = await post('/api/techniek/bewaren/gezinnen', { bevestig: 'WIS' }, tech);
  assert.equal(echt.status, 200, JSON.stringify(echt.body).slice(0, 200));
  assert.equal(echt.body.gewist, 2);
  assert.equal((await post('/api/foundation/gezin/inloggen', { gezinscode: A.gezinscode, pin: '2468' })).body.token, undefined,
    'A bestaat niet meer en de gezinscode opent niets');
  const d = await post('/api/foundation/gezin/inloggen', { gezinscode: D.gezinscode, pin: '1357' });
  assert.ok(d.body.token, 'D is gebruikt en blijft staan');
  assert.equal(await mij(D.code, d.body.token), 200);
});
