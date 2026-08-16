/* De vakmannen-golf: tien alledaagse vakken (autogarage, schoonmaak, hovenier,
   wasserij, rijschool, dierenarts, tandarts, fotograaf, verhuizer, IT-hulp)
   op de vakwerk-motor, elk met een demo-zaak op het Dienstenplein; de
   mondhygienist bij de tandarts en de slotenmaker bij het bouw-genre.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const NIEUW = ['autogarage', 'schoonmaak', 'hovenier', 'wasserij', 'rijschool',
  'dierenarts', 'tandarts', 'fotograaf', 'verhuizer', 'ithulp'];

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const lokaleDatum = d => String(d.getFullYear()).padStart(4, '0') + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const morgen = () => lokaleDatum(new Date(Date.now() + 86400000));
/* De eerstvolgende dag dat een zaak met standaard-openingstijden OPEN is.
   Blind "morgen" nemen leek onschuldig, maar een zaak is standaard maandag t/m
   vrijdag open (kern/vakwerk/agenda.js): op donderdag is morgen vrijdag en gaat
   het goed, op vrijdag is morgen zaterdag en zijn er nul tijdvakken. Deze test
   zakte dus elke vrijdag en zaterdag, aan niets anders dan de kalender. Wat hij
   wil toetsen is boeken bij de garage, niet boeken op een zaterdag. */
const eerstvolgendeWerkdag = () => {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    if (d.getDay() >= 1 && d.getDay() <= 5) return lokaleDatum(d);
  }
  return morgen();
};

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakken-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-VAK-1' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Vakkentest', email: 'v' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = { token: reg.body.token };
});
test.after(() => stop(srv && srv.child));

test('1. elk nieuw vak staat met een demo-zaak op het Dienstenplein', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  assert.equal(r.status, 200);
  const dp = r.body.diensten || [];
  for (const t of NIEUW) {
    const g = dp.find(x => x.type === t);
    assert.ok(g, 'genre ' + t + ' staat op het plein');
    assert.ok(g.zaken.length >= 1 && g.zaken[0].diensten.length >= 3,
      t + ' heeft een zaak met een gevuld aanbod');
  }
  // en de gids stuurt elk nieuw vak naar het Dienstenplein om te boeken
  for (const t of NIEUW) {
    const g = (r.body.gids || []).find(x => x.type === t);
    assert.ok(g && g.boekbaar && g.pagina === '/apps/mall.html', t + ' boekt in de Mall');
  }
});

test('2. de tandarts heeft een mondhygienist: als dienst en als collega', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  const tand = (r.body.diensten || []).find(g => g.type === 'tandarts');
  const zaak = tand && tand.zaken.find(z => z.code === 'DENTAL');
  assert.ok(zaak, 'Clinica Dental Blanca staat op het plein');
  assert.ok(zaak.diensten.some(d => /mondhygi/i.test(d.naam)), 'gebitsreiniging door de mondhygienist is boekbaar');
  const roster = await api(base, '/api/supplier/roster', { code: 'DENTAL' });
  assert.ok((roster.body.staff || []).some(x => /mondhygi/i.test(x.func || '')), 'de mondhygienist staat op het rooster');
});

test('3. de slotenmaker hoort bij het bouw-genre (Castell)', async () => {
  const r = await api(base, '/api/mall', {}, lid.token);
  const bouw = (r.body.diensten || []).find(g => g.type === 'bouw');
  const castell = bouw && bouw.zaken.find(z => z.code === 'CASTELL');
  assert.ok(castell && castell.diensten.some(d => /slotenmaker/i.test(d.naam)), 'de slotenmaker-dienst bestaat');
});

test('4. boeken bij de garage: tijdvakken, codenaam en het vandaag-bord', async () => {
  const slots = await api(base, '/api/booking/slots', { supplierCode: 'TALLER', serviceId: 'g1', date: eerstvolgendeWerkdag() }, lid.token);
  assert.equal(slots.status, 200);
  assert.ok((slots.body.tijden || []).length > 0, 'de garage heeft vrije tijdvakken');
  const r = await api(base, '/api/booking/request', { supplierCode: 'TALLER', serviceId: 'g1',
    date: eerstvolgendeWerkdag(), time: slots.body.tijden[0], note: 'APK graag' }, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.boeking.customerCodename && !JSON.stringify(r.body.boeking).includes('Vakkentest'),
    'de boeking draait op de codenaam, nooit de echte naam');
  const roster = await api(base, '/api/supplier/roster', { code: 'TALLER' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager');
  const login = await api(base, '/api/supplier/login', { code: 'TALLER', staffId: mgr && mgr.id, pin: '1234' });
  const bord = await api(base, '/api/supplier/vak/bord', {}, login.body.token);
  assert.equal(bord.status, 200);
  assert.equal(bord.body.label, 'Autogarage & werkplaats');
  assert.ok(!JSON.stringify(bord.body).includes('Vakkentest'), 'ook het bord toont geen echte naam');
});
