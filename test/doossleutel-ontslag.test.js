/* ============================================================================
   EEN VERWIJDERDE MANAGER HOUDT GEEN DOOSSLEUTEL -- regressie voor N53 uit de
   V1-audit (ronde 9, besluit van de eigenaar: twee lagen, zoals N52).

   DE FOUT: een manager gaf met /api/supplier/doos/sleutel een eigen sleutel
   voor een Zaakdoos uit (standaard 180, maximaal 365 dagen, standaard alle
   scopes inclusief `kloon`). staff/remove trok die niet in, dus na zijn
   verwijdering gaf GET /api/doos/kloon met zijn sleutel nog 200: het zaakrecord,
   de orders, reserveringen, boekingen en de kassadag.

   DE FIX, twee lagen:
   - staff/remove en staff/invite/intrek trekken de sleutels in die deze plek
     uitgaf (server/kern/zaakdoos/sleutels-uitgever.js);
   - welke() in server/kern/zaakdoos/sleutels.js weigert een sleutel waarvan de
     uitgever geen actieve plek bij die zaak meer heeft. Dat vangt een uitgifte
     die tegelijk met de verwijdering liep.

   Draai los: node --test test/doossleutel-ontslag.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const WW = 'geheim12';
let srv, dir, baas, zaakNaam;
let volgnummer = 1;

async function api(pad, body, token, kop) {
  const n = volgnummer++;
  const headers = Object.assign({ 'Content-Type': 'application/json',
    'X-Forwarded-For': '198.20.' + (n >> 8) + '.' + (n & 255) }, kop || {});
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(srv.base + pad, body === undefined ? { headers }
    : { method: 'POST', headers, body: JSON.stringify(body) });
  const tekst = await r.text();
  let json = {};
  try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst };
}
const kort = r => r.status + ' ' + r.tekst.slice(0, 160);
const kloon = (doos, sleutel) => api('/api/doos/kloon', undefined, null, { 'x-doos-id': doos, 'x-doos-eigen-sleutel': sleutel });

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doosontslag-'));
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

async function nieuweManager(email, naam) {
  const reg = await api('/api/auth/register', { name: 'Lid ' + naam, email, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + kort(reg));
  const inv = await api('/api/supplier/staff/invite', { name: naam, role: 'manager', func: 'Leiding' }, baas);
  assert.equal(inv.status, 200, 'uitnodiging: ' + kort(inv));
  const join = await api('/api/supplier/staff/join', { bedrijf: zaakNaam, kassacode: inv.body.invite.kassacode, login: email, password: WW });
  assert.equal(join.status, 200, 'aanmelding: ' + kort(join));
  const werk = await api('/api/supplier/mijn/login', { login: email, password: WW });
  assert.ok(werk.body.token, 'werksessie: ' + kort(werk));
  return { staffId: join.body.staffId, token: werk.body.token, inviteId: inv.body.invite.id };
}

test('1. N53: na staff/remove kloont de sleutel van de verwijderde manager niets meer', async () => {
  const mara = await nieuweManager('mara@doosontslag.test', 'Mara');
  const zijne = await api('/api/supplier/doos/sleutel', { doos: 'kassa-mara' }, mara.token);
  assert.equal(zijne.status, 200, 'Mara geeft een doossleutel uit: ' + kort(zijne));
  const vanBaas = await api('/api/supplier/doos/sleutel', { doos: 'kassa-baas' }, baas);
  assert.equal(vanBaas.status, 200, 'de baas ook: ' + kort(vanBaas));
  assert.equal((await kloon('kassa-mara', zijne.body.sleutel)).status, 200, 'voor de verwijdering kloont hij');

  const weg = await api('/api/supplier/staff/remove', { staffId: mara.staffId }, baas);
  assert.equal(weg.status, 200, 'de baas haalt Mara weg: ' + kort(weg));
  // N55: de baas ziet wat er meeging (haar eigen geclaimde code en haar ene sleutel)
  assert.deepEqual(weg.body.ingetrokken, { uitnodigingen: 1, doossleutels: 1 }, kort(weg));
  const na = await kloon('kassa-mara', zijne.body.sleutel);
  assert.equal(na.status, 403, 'na de verwijdering geen kloon: ' + kort(na));
  assert.equal(na.body.data, undefined, 'en geen zaakgegevens');
  assert.equal(na.body.code, 'doos-sleutel-ingetrokken', 'laag 1 trok hem in (niet alleen laag 2): ' + kort(na));

  // TEGENPROEF: de sleutel van de baas blijft werken
  assert.equal((await kloon('kassa-baas', vanBaas.body.sleutel)).status, 200, 'de sleutel van de baas blijft geldig');
});

test('2. N53: ook staff/invite/intrek (iemand via zijn uitnodiging uit het team) trekt zijn sleutels in', async () => {
  const joost = await nieuweManager('joost@doosontslag.test', 'Joost');
  const zijne = await api('/api/supplier/doos/sleutel', { doos: 'kassa-joost' }, joost.token);
  assert.equal(zijne.status, 200, kort(zijne));
  const intrek = await api('/api/supplier/staff/invite/intrek', { id: joost.inviteId }, baas);
  assert.equal(intrek.status, 200, kort(intrek));
  assert.equal(intrek.body.ingetrokken.doossleutels, 1, 'N55: het aantal staat in het antwoord');
  const na = await kloon('kassa-joost', zijne.body.sleutel);
  assert.equal(na.status, 403, 'geen kloon meer: ' + kort(na));
});

/* Laag 2 los, zonder server: de plek gaat uit ZONDER dat laag 1 loopt (precies
   het racegeval: een uitgifte tegelijk met de verwijdering, op PostgreSQL in
   twee transacties). De sleutel opent dan niets meer, met een eigen reden. */
test('3. N53 laag 2: een sleutel van een plek die niet meer actief is, opent niets', async () => {
  const crypto = require('crypto');
  const { maakDoosSleutels } = require('../server/kern/zaakdoos/sleutels');
  const { uitgeverWeg, plekVan } = require('../server/kern/zaakdoos/sleutels-uitgever');
  const plekken = [{ id: 7, active: 1, supplier_code: 'KIKUNOI', member_id: 70 }, { id: 8, active: 1, supplier_code: 'HOSHI' }];
  const leden = { 70: { id: 70, actief: 1 } };
  const accounts = { getStaffByIdAny: id => plekken.find(p => p.id === Number(id)) || null,
    getUserById: id => leden[id] || null, isActief: u => u.actief === 1 };
  // het echte oordeel van de werksessie, over de namaakrijen hierboven
  accounts.plekWerkt = (id, zaak) => require('../server/accounts/staff-sessie').plekWerkt(accounts, id, zaak);
  const db = { data: {}, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save: () => {} });
  const s = maakDoosSleutels({ db, save: () => {}, crypto, bewerkCollectie, uitgeverWeg: r => uitgeverWeg(r, accounts) });

  const zijne = await s.geef({ doos: 'kassa-a', zaak: 'KIKUNOI', door: 'zaak:KIKUNOI#7' });
  const kantoor = await s.geef({ doos: 'kassa-k', zaak: 'KIKUNOI', door: 'kantoor:Eigenaar' });
  const elders = await s.geef({ doos: 'kassa-e', zaak: 'KIKUNOI', door: 'zaak:KIKUNOI#8' });
  assert.equal(s.welke('kassa-a', zijne.sleutel, 'kloon').zaak, 'KIKUNOI', 'TEGENPROEF: zolang de plek actief is, opent hij');
  assert.deepEqual(s.welke('kassa-e', elders.sleutel, 'kloon'), { fout: 'uitgever-niet-actief' },
    'een plek van een andere zaak is geen uitgever voor deze zaak');

  leden[70].actief = 0;                                  // N54: het ACCOUNT uit (SCIM), de plek staat nog aan
  assert.deepEqual(s.welke('kassa-a', zijne.sleutel, 'kloon'), { fout: 'uitgever-niet-actief' }, 'account uit');
  leden[70].actief = 1;
  assert.equal(s.welke('kassa-a', zijne.sleutel, 'kloon').zaak, 'KIKUNOI', 'weer aan: uitzetten is geen wissen');
  plekken[0].active = 0;                                 // uit het team, maar niet ingetrokken
  assert.deepEqual(s.welke('kassa-a', zijne.sleutel, 'kloon'), { fout: 'uitgever-niet-actief' });
  assert.equal(s.welke('kassa-k', kantoor.sleutel, 'kloon').zaak, 'KIKUNOI',
    'TEGENPROEF: een sleutel van het kantoor hangt niet aan een personeelsplek');

  // wie roteert, wordt de uitgever: dan opent de nieuwe sleutel weer
  plekken.push({ id: 9, active: 1, supplier_code: 'KIKUNOI' });
  const rot = await s.geef({ doos: 'kassa-a', zaak: 'KIKUNOI', door: 'zaak:KIKUNOI#9' });
  assert.equal(s.welke('kassa-a', rot.sleutel, 'kloon').zaak, 'KIKUNOI');

  // een ingetrokken sleutel zegt ingetrokken, ook als de uitgever weg is
  await s.trekIn({ doos: 'kassa-a', zaak: 'KIKUNOI', door: 'zaak:KIKUNOI#9' });
  plekken[2].active = 0;
  assert.deepEqual(s.welke('kassa-a', rot.sleutel, 'kloon'), { fout: 'ingetrokken' });

  assert.deepEqual(plekVan('zaak:KIKUNOI#12'), { zaak: 'KIKUNOI', staffId: 12 });
  assert.equal(plekVan('zaak:KIKUNOI/lid-3'), null, 'een lidsleutel zonder plek valt erbuiten');
});

/* De bedrading van laag 2: het ene register van de server (kern.doosSleutels)
   krijgt uitgeverWeg mee. Op een echte server is het racegeval niet na te
   spelen (in SQLite loopt alles synchroon in een tik), dus zonder deze toets
   kan de bedrading stil wegvallen terwijl toets 1 en 2 groen blijven. */
test('4. N53: het register van de server krijgt de uitgevercontrole mee', () => {
  const fs2 = require('fs');
  const bron = fs2.readFileSync(path.join(__dirname, '../server/opzet/kernlaag6b.js'), 'utf8');
  const stuk = bron.slice(bron.indexOf('kern.doosSleutels ='), bron.indexOf('kern.personeelsUitnodiging ='));
  assert.match(stuk, /uitgeverWeg: r => require\('\.\.\/kern\/zaakdoos\/sleutels-uitgever'\)\.uitgeverWeg\(r, kern\.accounts\)/);
});
