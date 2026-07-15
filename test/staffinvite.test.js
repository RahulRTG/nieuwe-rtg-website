/* Personeel = RTG-account, met uitnodiging. Een manager nodigt uit en krijgt
   een eenmalige kassacode; pas daarna kan de medewerker zich aanmelden met de
   bedrijfsnaam + kassacode + eigen RTG-inlog. Elk echt account is genoeg (ook
   het gratis gast-account, een betaalde pas is niet nodig); zonder geldige
   uitnodiging komt niemand erin, en tweemaal met dezelfde code lukt niet.
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

test('een gratis account (gast, zonder betaalde pas) mag ook werken, met een eigen uitnodiging', async () => {
  const gast = await json(await api('/api/auth/register', { name: 'Gast Persoon', email: 'gast@x.nl', phone: '0612345671',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest', pasApp: 'rtg' }));
  assert.ok(gast.token, 'de gast is aangemaakt');
  // zonder uitnodiging blijft de deur dicht
  assert.equal((await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: 'XXXXXX', login: 'gast@x.nl', password: 'geheim123', pin: '2468' })).status, 403);
  // met een eigen kassacode komt het gratis account er wel in: een pas is niet nodig
  const inv = await json(await api('/api/supplier/staff/invite', { name: 'Gast Persoon', func: 'Afwas' }, managerToken));
  const r = await json(await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: inv.invite.kassacode, login: 'gast@x.nl', password: 'geheim123', pin: '2468' }));
  assert.ok(r.ok && r.staffId, 'het gratis account is genoeg om te werken');
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

test('de manager reset de code van een collega: oude pincode dood, nieuwe werkt', async () => {
  // niet als medewerker
  assert.equal((await api('/api/supplier/staff/reset-pin', { staffId: global.__sid }, balieToken)).status, 403);
  const r = await json(await api('/api/supplier/staff/reset-pin', { staffId: global.__sid }, managerToken));
  assert.ok(/^\d{4}$/.test(r.pin), 'de manager krijgt eenmalig een nieuwe pincode');
  // de oude pincode (2468) werkt niet meer
  assert.equal((await api('/api/supplier/login', { code: 'KIKUNOI', staffId: global.__sid, pin: '2468' })).status, 401);
  // de nieuwe wel
  const login = await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: global.__sid, pin: r.pin }));
  assert.ok(login.token, 'de collega logt in met de nieuwe code');
});

test('een open uitnodiging intrekken maakt de kassacode onbruikbaar', async () => {
  const inv = await json(await api('/api/supplier/staff/invite', { name: 'Nooit Gekomen' }, managerToken));
  // hij staat in de lijst met open uitnodigingen
  const open1 = await json(await api('/api/supplier/staff/invites', {}, managerToken));
  assert.ok(open1.invites.some(i => i.kassacode === inv.invite.kassacode));
  assert.equal((await api('/api/supplier/staff/invite/intrek', { kassacode: inv.invite.kassacode }, managerToken)).status, 200);
  const open2 = await json(await api('/api/supplier/staff/invites', {}, managerToken));
  assert.ok(!open2.invites.some(i => i.kassacode === inv.invite.kassacode), 'weg uit de lijst');
  // en aanmelden met de ingetrokken code is geweigerd
  const r = await api('/api/supplier/staff/join', { bedrijf: BEDRIJF, kassacode: inv.invite.kassacode, login: 'nova@x.nl', password: 'geheim123', pin: '1111' });
  assert.equal(r.status, 403);
});

test('ontslag: een verwijderd teamlid kan niet meer inloggen', async () => {
  // Sara (uit de Business-test) opzoeken en ontslaan
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const sara = roster.staff.find(x => x.name === 'Sara Pauls');
  assert.ok(sara, 'Sara staat in het team');
  await api('/api/supplier/staff/remove', { staffId: sara.id }, managerToken);
  assert.equal((await api('/api/supplier/login', { code: 'KIKUNOI', staffId: sara.id, pin: '9753' })).status, 401, 'na ontslag komt zij er niet meer in');
});

test('een sollicitant aannemen levert een kassacode op, geen kant-en-klaar account', async () => {
  // solliciteer als ons lid
  assert.equal((await api('/api/supplier/apply', { code: 'KIKUNOI', name: 'Nova de Wit', func: 'Bediening', contact: 'nova@x.nl' })).status, 200);
  const lijst = await json(await api('/api/supplier/state', {}, managerToken));
  const open = (lijst.state.applications || []).find(x => x.status === 'nieuw');
  assert.ok(open, 'de sollicitatie staat open bij de werkgever');
  const d = await json(await api('/api/supplier/apply/decide', { id: open.id, action: 'aannemen' }, managerToken));
  assert.ok(d.invite && /^[A-Z2-9]{6}$/.test(d.invite.kassacode), 'aannemen geeft een kassacode om door te geven');
  assert.equal(d.bedrijf, BEDRIJF);
});
