/* Personeel = RTG-lid, met uitnodiging. Een manager nodigt uit en krijgt een
   eenmalige kassacode; pas daarna kan de medewerker zich aanmelden met de
   bedrijfsnaam + kassacode + eigen RTG-inlog. Alleen RTG/Lifestyle/Business
   leden komen erin; een gast niet, een verkeerde code niet, en tweemaal met
   dezelfde code lukt niet.
   Draai: node --experimental-sqlite --test test/staffinvite.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inv-'));
let child, managerToken, balieToken, lidToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
let BEDRIJF; // de echte demonaam van KIKUNOI, uit de roster

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  BEDRIJF = roster.supplier.name;
  const man = roster.staff.find(x => x.role === 'manager');
  const balie = roster.staff.find(x => x.role !== 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  balieToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: balie.id, pin: '5678' }))).token;
  // een echt RTG-lid dat werknemer wordt
  lidToken = (await json(await api('/api/auth/register', { name: 'Nova de Wit', email: 'nova@x.nl', phone: '0612345670',
    password: 'geheim123', geboortedatum: '1995-03-03', tier: 'rtg', pasApp: 'rtg' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('alleen een manager kan uitnodigen; een medewerker niet', async () => {
  assert.equal((await api('/api/supplier/staff/invite', { name: 'Nova de Wit', func: 'Bediening' }, balieToken)).status, 403);
  const r = await json(await api('/api/supplier/staff/invite', { name: 'Nova de Wit', func: 'Bediening' }, managerToken));
  assert.ok(r.ok && /^[A-Z2-9]{6}$/.test(r.invite.kassacode), 'de manager krijgt een kassacode');
  assert.equal(r.bedrijf, BEDRIJF);
  global.__code = r.invite.kassacode;
});

test('zonder geldige uitnodiging kom je er niet in (verkeerde kassacode)', async () => {
  const r = await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: 'ZZZZZZ', login: 'nova@x.nl', password: 'geheim123', pin: '2468' });
  assert.equal(r.status, 403);
});

test('een niet-lid (gast) kan zich niet aanmelden, ook niet met een geldige code', async () => {
  // een gast-account (geen betaalde pas)
  const gast = await json(await api('/api/auth/register', { name: 'Gast Persoon', email: 'gast@x.nl', phone: '0612345671',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest', pasApp: 'rtg' }));
  assert.ok(gast.token, 'de gast is aangemaakt');
  const r = await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: global.__code, login: 'gast@x.nl', password: 'geheim123', pin: '2468' });
  assert.equal(r.status, 403, 'een gast is geen RTG-lid');
});

test('verkeerde RTG-inlog wordt geweigerd', async () => {
  const r = await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: global.__code, login: 'nova@x.nl', password: 'FOUT', pin: '2468' });
  assert.equal(r.status, 401);
});

test('het lid meldt zich aan met bedrijfsnaam + kassacode + RTG-inlog en kan daarna werken', async () => {
  const r = await json(await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: global.__code, login: 'nova@x.nl', password: 'geheim123', pin: '2468' }));
  assert.ok(r.ok && r.code === 'KIKUNOI' && r.staffId, 'aangemeld en gekoppeld aan het bedrijf');
  global.__sid = r.staffId;
  // het lid staat nu in de roster als teamlid-lid
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const ik = roster.staff.find(x => x.id === r.staffId);
  assert.ok(ik && ik.lid === true, 'het teamlid is herkenbaar als RTG-lid');
  // dagelijkse inlog met naam + gekozen pincode werkt
  const login = await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: r.staffId, pin: '2468' }));
  assert.ok(login.token && login.state, 'de medewerker kan inloggen en de app gebruiken');
});

test('een kassacode is eenmalig: dezelfde code werkt geen tweede keer', async () => {
  // tweede lid, zelfde (al gebruikte) code
  await api('/api/auth/register', { name: 'Bram Jansen', email: 'bram@x.nl', phone: '0612345672',
    password: 'geheim123', geboortedatum: '1992-02-02', tier: 'lifestyle', pasApp: 'lifestyle' });
  const r = await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: global.__code, login: 'bram@x.nl', password: 'geheim123', pin: '1357' });
  assert.equal(r.status, 403, 'de kassacode is al gebruikt');
});

test('een tweede uitnodiging + Business-lid: ook Business mag werken', async () => {
  const inv = await json(await api('/api/supplier/staff/invite', { func: 'Keuken' }, managerToken));
  await api('/api/auth/register', { name: 'Sara Pauls', email: 'sara@x.nl', phone: '0612345673',
    password: 'geheim123', geboortedatum: '1988-05-05', tier: 'business', pasApp: 'business' });
  const r = await json(await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: inv.invite.kassacode, login: 'sara@x.nl', password: 'geheim123', pin: '9753' }));
  assert.ok(r.ok && r.staffId, 'een Business-lid kan zich aanmelden');
});
