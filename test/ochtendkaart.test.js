/* ============================================================================
   DE OCHTENDKAART (PERSONEEL.md par. 4, kern/ochtendkaart.js).

   Wat hier vast moet blijven:
     1. "Alles staat voor je klaar" staat er alleen als elke regel GEMETEN is en
        niets aandacht vraagt; een rooster uit het standaardpatroon of een
        verzuimlaag die niet antwoordt, zegt de kop hardop;
     2. een afwezige collega is een AANTAL op jouw kaart, nooit een naam of een
        reden; wie zelf afwezig is, krijgt geen knop om te beginnen;
     3. er staat geen getal dat niemand telde: leveringen zonder aflevertijd,
        gasten geteld uit reserveringen (geannuleerde niet);
     4. de kaart stelt niets voor (B4) en is er alleen voor de eigen
        persoonlijke login.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakOchtendkaart } = require('../server/kern/ochtendkaart');
const { maakInplanbaar } = require('../server/kern/payroll/inplanbaar');
const { startServer, stop } = require('./helper');

const DAG = '2026-09-28';
function wereld({ vast = true, lezer = () => [], orders = [], reserveringen = [], open = false, shifts, afw = [] } = {}) {
  const staff = [
    { id: 1, name: 'Amir', role: 'staff', shift: 'Ochtend 07:00-15:00' },
    { id: 2, name: 'Bo', role: 'staff', shift: 'Ochtend 07:00-15:00' },
    { id: 3, name: 'Cas', role: 'staff', shift: 'Vrij' }
  ].map((m, i) => (shifts ? { ...m, shift: shifts[i] } : m)).map(m => (afw.includes(m.id) ? { ...m, afwezig: true } : m));
  const db = { data: {
    suppliers: [{ code: 'Z', roosterVast: vast ? { [DAG]: {} } : {} }],
    groothandelOrders: orders, reserveringen
  } };
  return maakOchtendkaart({
    db, vrij: 'Vrij', vandaag: () => DAG,
    scheduleFor: () => ({ days: [{ date: DAG, staff }] }),
    klokVan: () => ({ open }),
    /* de lezer geeft regels in de vorm van voorPlanning; null = geen register */
    inplanbaar: maakInplanbaar(lezer === null ? undefined : (c, id) => (lezer(c, id)[0] || null))
  }).kaart;
}

test('1. alles gemeten en niets aan de hand: dan, en alleen dan, staat alles klaar', () => {
  const k = wereld()('Z', 1);
  assert.equal(k.kop, 'Alles staat voor je klaar.');
  assert.equal(k.naam, 'Amir');
  assert.deepEqual(k.regels.map(r => [r.soort, r.graad]), [['dienst', 'gemeten'], ['team', 'gemeten']]);
  assert.equal(k.regels[0].tekst, 'Ochtend 07:00-15:00');
  assert.equal(k.regels[1].tekst, 'Team compleet.');
  assert.deepEqual(k.knop, { tekst: 'Begin mijn dag', pad: '/api/staff/clock' });
  assert.match(k.stelt, /niets voor/);
});

test('2. een niet vastgesteld rooster en een stille verzuimlaag zegt de kop hardop', () => {
  const patroon = wereld({ vast: false })('Z', 1);
  assert.equal(patroon.kop, 'Het rooster van vandaag is nog niet vastgesteld: dit is het standaardpatroon.');
  assert.equal(patroon.regels[0].graad, 'vermoed');
  assert.notEqual(patroon.kop, 'Alles staat voor je klaar.');

  const blind = wereld({ lezer: null })('Z', 1);
  assert.equal(blind.regels[1].graad, 'onbekend');
  assert.equal(blind.regels[1].tekst, 'Ik kon niet nakijken of het team compleet is.');
  assert.equal(blind.kop, 'Ik kon niet nakijken: of het team compleet is.', 'onbekend gaat voor het patroon');
});

test('3. een afwezige collega is een aantal, zonder naam en zonder reden', () => {
  const k = wereld({ lezer: (c, id) => (id === 2 ? [{ wat: 'afwezig', inzetbaarheid: 'niets' }] : []) })('Z', 1);
  const team = k.regels.find(r => r.soort === 'team');
  assert.equal(team.tekst, 'Eén collega is vandaag afwezig.');
  assert.equal(team.aandacht, true);
  assert.equal(k.kop, 'Eén ding vraagt je aandacht.');
  assert.ok(!/Bo\b/.test(JSON.stringify(k)), 'de naam van de afwezige collega staat niet op jouw kaart');
  /* een vrije collega telt niet mee: Cas staat op vrij en is ook afwezig */
  const vrij = wereld({ lezer: (c, id) => (id === 3 ? [{ wat: 'Vakantie', inzetbaarheid: null }] : []) })('Z', 1);
  assert.equal(vrij.regels.find(r => r.soort === 'team').tekst, 'Team compleet.');
  /* het echte rooster (kern/personeel.js) zet wie afwezig is op vrij MET
     afwezig: true; die collega verdwijnt niet, hij ontbreekt */
  const ziekBo = (c, id) => (id === 2 ? [{ wat: 'afwezig', inzetbaarheid: 'niets' }] : []);
  const echt = wereld({ shifts: ['Ochtend 07:00-15:00', 'Vrij', 'Vrij'], afw: [2], lezer: ziekBo });
  assert.equal(echt('Z', 1).regels.find(r => r.soort === 'team').tekst, 'Eén collega is vandaag afwezig.');
  const zonderVlag = wereld({ shifts: ['Ochtend 07:00-15:00', 'Vrij', 'Vrij'], lezer: ziekBo });
  assert.equal(zonderVlag('Z', 1).regels.find(r => r.soort === 'team').tekst, 'Er werkt vandaag verder niemand.',
    'tegenproef: wie gewoon vrij stond, telt niet mee');
});

test('4. wie zelf afwezig of vrij is, wordt niet gevraagd te beginnen', () => {
  const zelf = wereld({ lezer: (c, id) => (id === 1 ? [{ wat: 'afwezig', inzetbaarheid: 'niets' }] : []) })('Z', 1);
  assert.match(zelf.regels[0].tekst, /als afwezig in de verzuimlaag/);
  assert.equal(zelf.knop, null);
  const vrij = wereld()('Z', 3);
  assert.equal(vrij.regels[0].tekst, 'Je bent vandaag vrij.');
  assert.equal(vrij.knop, null);
  const binnen = wereld({ open: true })('Z', 1);
  assert.deepEqual(binnen.knop, { tekst: 'Je bent ingeklokt', pad: null });
});

test('5. leveringen zonder tijd en gasten geteld -- en geen regel waar geen bron is', () => {
  const zonder = wereld()('Z', 1);
  assert.ok(!zonder.regels.some(r => r.soort === 'levering' || r.soort === 'gasten'),
    'een zaak die niet bij een groothandel bestelt en geen reserveringen kent, krijgt die regels niet');

  const k = wereld({
    orders: [
      { klant: { soort: 'partner', id: 'Z' }, status: 'bevestigd' },
      { klant: { soort: 'partner', id: 'Z' }, status: 'onderweg' },
      { klant: { soort: 'partner', id: 'Z' }, status: 'geleverd' },
      { klant: { soort: 'lid', id: 'Z' }, status: 'bevestigd' },
      { klant: { soort: 'partner', id: 'ANDER' }, status: 'bevestigd' }
    ],
    reserveringen: [
      { supplierCode: 'Z', datum: DAG, status: 'bevestigd', personen: 4 },
      { supplierCode: 'Z', datum: DAG, status: 'aangevraagd', personen: 2 },
      { supplierCode: 'Z', datum: DAG, status: 'geannuleerd', personen: 9 },
      { supplierCode: 'Z', datum: '2026-09-29', status: 'bevestigd', personen: 5 },
      { supplierCode: 'ANDER', datum: DAG, status: 'bevestigd', personen: 7 }
    ]
  })('Z', 1);
  const lev = k.regels.find(r => r.soort === 'levering');
  assert.equal(lev.tekst, '2 bevestigde leveringen onderweg (geen aflevertijd bekend).');
  assert.ok(!/\d{1,2}:\d{2}/.test(lev.tekst), 'er staat geen tijd die niemand heeft vastgelegd');
  const gasten = k.regels.find(r => r.soort === 'gasten');
  assert.equal(gasten.tekst, '6 gasten gereserveerd vandaag (2 reserveringen).');
  assert.match(gasten.bron, /geteld, geen voorspelling/);
});

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ochtendkaart-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
});
test.after(() => stop(srv && srv.child));

test('6. echte server: de eigen kaart, niet zonder persoonlijke login, en een vastgesteld rooster telt', async () => {
  const base = srv.base;
  const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const baas = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;

  const r0 = await api(base, '/api/staff/ochtend', {}, baas);
  assert.equal(r0.status, 200, JSON.stringify(r0.body).slice(0, 200));
  assert.equal(r0.body.kaart.naam, man.name, 'de eigen naam, uit het eigen account');
  assert.equal(r0.body.kaart.regels[0].soort, 'dienst');
  assert.equal(r0.body.kaart.regels[0].graad, 'vermoed', 'zonder vastgesteld rooster is de dienst een vermoeden');
  assert.match(r0.body.kaart.kop, /nog niet vastgesteld/);

  /* de manager stelt het weekrooster vast: nu is de dienst gemeten */
  assert.equal((await api(base, '/api/supplier/rooster/voorstel', {}, baas)).status, 200);
  assert.equal((await api(base, '/api/supplier/rooster/beslis', { actie: 'akkoord' }, baas)).status, 200);
  const r1 = await api(base, '/api/staff/ochtend', {}, baas);
  assert.equal(r1.body.kaart.regels[0].graad, 'gemeten');
  /* een lezing: een tweede oproep geeft hetzelfde en verandert niets */
  assert.deepEqual((await api(base, '/api/staff/ochtend', {}, baas)).body, r1.body, 'dubbeltik: identiek antwoord');
  assert.doesNotMatch(r1.body.kaart.kop, /nog niet vastgesteld/);

  /* inklokken via de knop van de kaart; daarna zegt de kaart dat je binnen bent */
  const knop = r1.body.kaart.knop;
  assert.equal(knop.pad, '/api/staff/clock', 'de manager werkt vandaag, dus er is een knop');
  assert.equal((await api(base, knop.pad, {}, baas)).body.actie, 'in');
  const r2 = await api(base, '/api/staff/ochtend', {}, baas);
  assert.deepEqual(r2.body.kaart.knop, { tekst: 'Je bent ingeklokt', pad: null });

  /* een zaak-inlog zonder persoon heeft geen ochtendkaart */
  const zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const z = await api(base, '/api/staff/ochtend', {}, zaak);
  assert.equal(z.status, 403);
  assert.equal((await api(base, '/api/staff/ochtend', {})).status, 401, 'zonder sessie geen kaart');
});
