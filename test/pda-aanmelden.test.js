/* 1x aanmelden voor de personeels-app: log één keer in met het eigen RTG-account
   en land meteen op de juiste bedrijfspagina. Wie bij meer bedrijven op het
   rooster staat, wisselt met één tik van werkplek, zonder opnieuw in te loggen.
   Inloggen zet je nooit automatisch aan het werk: de klok is een aparte knop.
   Draai: node --experimental-sqlite --test test/pda-aanmelden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanmelden-'));

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('RTG-account dat bij twee bedrijven werkt, landt en kan wisselen', async () => {
  // het demo-lid Nora Prins staat op het rooster van Sal de Mar en Vora Beach Club
  const r = await api('/api/supplier/mijn/login', { login: 'nora@rtg.example', password: 'werk' });
  assert.equal(r.status, 200, 'inloggen met het RTG-account lukt');
  const d = await json(r);
  assert.ok(d.token, 'er is een sessie-token');
  assert.ok(d.state && d.state.supplier, 'de bedrijfsstaat komt mee zodat de app meteen opent');
  assert.equal(d.posities.length, 2, 'beide werkplekken staan klaar');
  const codes = d.posities.map(p => p.code).sort();
  assert.deepEqual(codes, ['KIKUNOI', 'VORA'], 'de twee bedrijven kloppen');
  assert.equal(d.supplier.code, 'KIKUNOI', 'je landt op het eerste bedrijf');

  // inloggen mag NIET automatisch inklokken: de klok staat nog open (dicht)
  const staf = await json(await api('/api/staff/mine', {}, d.token));
  assert.ok(staf.klok && staf.klok.open === false, 'na inloggen ben je nog niet ingeklokt');

  // wisselen naar de tweede werkplek zonder opnieuw in te loggen
  const w = await api('/api/supplier/mijn/wissel', { code: 'VORA' }, d.token);
  assert.equal(w.status, 200, 'wisselen lukt');
  const dw = await json(w);
  assert.equal(dw.supplier.code, 'VORA', 'je bent nu bij Vora Beach Club');
  assert.ok(dw.token && dw.token !== d.token, 'de wissel geeft een verse sessie voor het andere bedrijf');

  // de opties zijn ook zonder verse login op te halen (na sessieherstel)
  const opt = await json(await api('/api/supplier/mijn/opties', {}, dw.token));
  assert.equal(opt.hier, 'VORA', 'de server weet waar je nu bent');
  assert.equal(opt.posities.length, 2, 'beide werkplekken blijven zichtbaar');
});

test('een landing op een gevraagd bedrijf (deeplink/onthouden)', async () => {
  const d = await json(await api('/api/supplier/mijn/login', { login: 'nora@rtg.example', password: 'werk', bedrijf: 'VORA' }));
  assert.equal(d.supplier.code, 'VORA', 'met een voorkeur land je daar direct');
});

test('fout wachtwoord of onbekend account komt er niet in', async () => {
  assert.equal((await api('/api/supplier/mijn/login', { login: 'nora@rtg.example', password: 'fout' })).status, 401);
  assert.equal((await api('/api/supplier/mijn/login', { login: 'niemand@x.nl', password: 'werk' })).status, 401);
});

test('een RTG-lid zonder werkplek krijgt een nette melding, geen sessie', async () => {
  const reg = await json(await api('/api/auth/register', { name: 'Los Lid', email: 'los@x.nl', phone: '0612349999',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  assert.ok(reg.token, 'het lid is geregistreerd');
  const r = await api('/api/supplier/mijn/login', { login: 'los@x.nl', password: 'geheim123' });
  assert.equal(r.status, 404, 'geen werkplek: geen toegang tot de personeels-app');
});

test('een sessie zonder RTG-koppeling (naam+pincode) kan niet wisselen tussen bedrijven', async () => {
  const roster = await json(await api('/api/supplier/roster', { code: 'HOSHI' }));
  const s = roster.staff.find(x => x.role === 'manager');
  const login = await json(await api('/api/supplier/login', { code: 'HOSHI', staffId: s.id, pin: '1234' }));
  // deze sessie heeft geen lid-koppeling: geen eigen werkplekken en geen wissel
  const opt = await json(await api('/api/supplier/mijn/opties', {}, login.token));
  assert.deepEqual(opt.posities, [], 'een apparaatlogin heeft geen eigen werkplekken');
  assert.equal((await api('/api/supplier/mijn/wissel', { code: 'KIKUNOI' }, login.token)).status, 403);
});
