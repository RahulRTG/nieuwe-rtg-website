/* ============================================================================
   EEN OUDE KASSACODE MAAKT GEEN ONTSLAG ONGEDAAN -- regressie voor N36 uit de
   V1-audit (ronde 7, besluit van de eigenaar: helemaal dicht).

   DE FOUT: een medewerker die een manager met /api/supplier/staff/remove uit het
   team haalde, meldde zich met zijn oude kassacode opnieuw aan (staff/join of
   /api/werving/verbind). De hersteltak van verbindCode zette de plek weer actief
   en antwoordde 409 "veilig hersteld" -- met de ruwe personeelsrij (pin_hash),
   het ruwe zaakrecord en de uitnodiging in het antwoord. Daarna gaf de
   werkplekinlog weer een werksessie. Live bevestigd op de oude en de nieuwe code.

   DE FIX, drie lagen:
   - staff/remove trekt elke uitnodiging in die aan die plek hangt
     (trekInVoorStaff in server/routes/supplier/werving/uitnodiging-uitgifte.js);
   - de hersteltak weigert een plek die al eens actief was en nu uit staat
     (ook voor een verwijdering van voor deze fix, waar de code nog geldig is);
   - geen route stuurt het antwoord van verbindCode nog in zijn geheel terug.

   Toets 1 loopt de echte keten op een server; toets 2 en 3 nemen elk een laag
   apart, zodat de ene de andere niet verbergt.

   Draai los: node --test test/staff-ontslag.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const WW = 'geheim12';
let srv, dir, baas, zaakNaam;
let volgnummer = 1;

async function api(pad, body, token) {
  const n = volgnummer++;
  const headers = { 'Content-Type': 'application/json',
    'X-Forwarded-For': '198.19.' + (n >> 8) + '.' + (n & 255) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {};
  try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst };
}
const kort = (r) => r.status + ' ' + r.tekst.slice(0, 160);
const VERBODEN = ['staff', 's', 'invite', 'pin_hash'];

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ontslag-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const manager = roster.body.staff.find(x => x.role === 'manager');
  const ml = await api('/api/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
  assert.ok(ml.body.token, 'de manager logt in: ' + kort(ml));
  baas = ml.body.token; zaakNaam = roster.body.supplier.name;
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

async function aangemeld(email, naam) {
  const reg = await api('/api/auth/register', { name: 'Lid ' + naam, email, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + kort(reg));
  const inv = await api('/api/supplier/staff/invite', { name: 'Ontslag ' + naam, func: 'Bediening' }, baas);
  assert.equal(inv.status, 200, 'uitnodiging: ' + kort(inv));
  const join = await api('/api/supplier/staff/join', { bedrijf: zaakNaam, kassacode: inv.body.invite.kassacode, login: email, password: WW });
  assert.equal(join.status, 200, 'aanmelding: ' + kort(join));
  const werk = await api('/api/supplier/mijn/login', { login: email, password: WW });
  assert.equal(werk.status, 200, 'werkplekinlog voor het ontslag: ' + kort(werk));
  return { email, token: reg.body.token, kassacode: inv.body.invite.kassacode, staffId: join.body.staffId };
}

test('1. na staff/remove geeft de oude kassacode geen plek, geen sessie en geen ruwe rijen', async () => {
  const m = await aangemeld('daan@ontslag.test', 'Daan');
  const weg = await api('/api/supplier/staff/remove', { staffId: m.staffId }, baas);
  assert.equal(weg.status, 200, 'de manager haalt hem uit het team: ' + kort(weg));
  assert.equal((await api('/api/supplier/mijn/login', { login: m.email, password: WW })).status, 404,
    'na het ontslag geen werkplek');

  const opnieuw = await api('/api/supplier/staff/join', { bedrijf: zaakNaam, kassacode: m.kassacode, login: m.email, password: WW });
  assert.notEqual(opnieuw.status, 200, 'opnieuw aanmelden lukt niet: ' + kort(opnieuw));
  assert.notEqual(opnieuw.body.hersteld, true, 'geen herstel: ' + kort(opnieuw));
  for (const k of VERBODEN) assert.equal(k in opnieuw.body, false, 'het antwoord draagt geen ' + k + ': ' + kort(opnieuw));
  assert.doesNotMatch(opnieuw.tekst, /pin_hash|supplier_code|s2\$/, 'geen ruwe rij in de tekst');

  const verbind = await api('/api/werving/verbind', { kassacode: m.kassacode }, m.token);
  assert.notEqual(verbind.status, 200, 'ook /api/werving/verbind herstelt niets: ' + kort(verbind));
  for (const k of VERBODEN) assert.equal(k in verbind.body, false, 'verbind draagt geen ' + k + ': ' + kort(verbind));

  assert.equal((await api('/api/supplier/mijn/login', { login: m.email, password: WW })).status, 404,
    'na beide pogingen nog steeds geen werkplek');
});

test('2. TEGENPROEF: wie niet verwijderd is, houdt zijn plek, en de hersteltak werkt nog voor een halve aanmelding', async () => {
  const m = await aangemeld('ilse@ontslag.test', 'Ilse');
  const nogEens = await api('/api/supplier/staff/join', { bedrijf: zaakNaam, kassacode: m.kassacode, login: m.email, password: WW });
  assert.equal(nogEens.status, 409, 'al aangemeld: ' + kort(nogEens));
  assert.equal((await api('/api/supplier/mijn/login', { login: m.email, password: WW })).status, 200,
    'de plek blijft gewoon werken');
});

/* De hersteltak los, op een namaakwereld: een plek die al eens actief was en nu
   uit staat, wordt niet heractiveerd. Dit is de laag die een verwijdering van
   VOOR de fix vangt, waar de uitnodiging nooit is ingetrokken. */
function wereld({ ooitActief }) {
  const inv = { id: 'inv-1', supplierCode: 'Z', role: 'staff', toegang: {},
    claim: { status: 'voltooid', memberId: 1, staffId: 7, ...(ooitActief ? { geactiveerd_at: '2026-10-01' } : {}) } };
  const geactiveerd = [];
  const plek = { id: 7, supplier_code: 'Z', member_id: 1, role: 'staff', active: 0, name: 'Plek' };
  const ctx = {
    accounts: { staffByMember: () => null, getStaffByIdAny: () => plek,
      activateStaff: id => { geactiveerd.push(id); return Object.assign({}, plek, { active: 1 }); },
      deactivateStaff: () => {}, legacyStaffPinToegestaan: () => false },
    crypto: require('crypto'), transactie: fn => fn({ lijst: [inv] }), vindIn: () => inv,
    publiek: x => ({ id: x.id, supplierCode: x.supplierCode, role: x.role }),
    geldig: () => null, herstelGeldig: () => null, supplierVanCode: () => ({ code: 'Z', name: 'Zaak' }),
    bearer: { gebruik() {} }, logActivity() {}, notifySupplier() {}, kern: {}
  };
  return { verbind: require('../server/routes/supplier/werving/uitnodiging-claim')(ctx).verbindCode, geactiveerd };
}

test('3. de hersteltak weigert een plek die al eens actief was en nu uit staat', async () => {
  const w = wereld({ ooitActief: true });
  const v = await w.verbind({ id: 1 }, 'CODE', {}, 'Z');
  assert.equal(v.status, 403, 'geweigerd: ' + JSON.stringify(v));
  assert.deepEqual(w.geactiveerd, [], 'er is niets heractiveerd');
  for (const k of VERBODEN) assert.equal(k in v, false, 'de weigering draagt geen ' + k);

  /* TEGENPROEF: een aanmelding die halverwege bleef steken (nooit actief
     geweest) wordt wel hersteld, en ook dan zonder ruwe rijen. */
  const half = wereld({ ooitActief: false });
  const h = await half.verbind({ id: 1 }, 'CODE', {}, 'Z');
  assert.equal(h.hersteld, true, 'een halve aanmelding wordt hersteld: ' + JSON.stringify(h));
  assert.deepEqual(half.geactiveerd, [7]);
  for (const k of VERBODEN) assert.equal(k in h, false, 'het herstel draagt geen ' + k);
});

test('4. staff/remove trekt de uitnodiging van precies die plek in', () => {
  const ingetrokken = [];
  const lijst = [
    { id: 'a', toegang: { n: 'a' }, claim: { staffId: 7 } },
    { id: 'b', toegang: { n: 'b' }, claim: { staffId: 8 } },
    { id: 'c', toegang: { n: 'c' } }
  ];
  const { trekInVoorStaff } = require('../server/routes/supplier/werving/uitnodiging-uitgifte')({
    db: { data: {} }, crypto: require('crypto'), transactie: fn => fn({}), lijstVan: () => lijst,
    publiek: x => x, geldig: () => null, idemHash: x => x, doel: 'd', scope: 's', dagen: 30, dubbeltikMs: 0,
    bearer: { intrekken: (t, actor, reden) => ingetrokken.push([t.n, actor, reden]) }
  });
  const r = trekInVoorStaff('Z', 7, 'Manager');
  assert.equal(r.ingetrokken, 1);
  assert.deepEqual(ingetrokken, [['a', 'Manager', 'medewerker uit het team gehaald']],
    'alleen de uitnodiging van plek 7, niet die van een collega en niet een open uitnodiging');
});

test('5. de route roept de intrekking aan voordat de plek uit gaat', () => {
  const bron = fs.readFileSync(path.join(__dirname, '../server/routes/supplier/werving/personeel.js'), 'utf8');
  const route = bron.slice(bron.indexOf("'/api/supplier/staff/remove'"));
  const trek = route.indexOf('trekInVoorStaff('), uit = route.indexOf('deactivateStaff(');
  assert.ok(trek > 0, 'staff/remove roept trekInVoorStaff aan');
  assert.ok(trek < uit, 'eerst intrekken, dan pas de plek uitzetten: lukt het intrekken niet, dan verandert er niets');
});
