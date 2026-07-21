/* Het sportstadion en het clubsysteem: de club tekent zijn EIGEN plattegrond
   (vakken met capaciteit en prijs, horeca en wc's erop), leden reserveren
   tickets per vak (afrekenen aan de poort), de scan is eenmalig, de stand
   telt echte uitslagen, het veldbeheer geeft signalen, een trainingskamp
   bevestigt een MENS bij RTG, sponsors kiest de club zelf, en de financien
   tellen ook de kantine (kassa) mee. Draai los:
   node --experimental-sqlite --test test/sportclub.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, club, lid, office, wedstrijdId;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sport-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api(base, '/api/supplier/roster', { code: 'FCRTG' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  club = (await api(base, '/api/supplier/login', { code: 'FCRTG', staffId: man.id, pin: '1234' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Sport Fan', email: 'sp' + u + '@x.nl',
    phone: '063' + u.slice(1), password: 'geheim123', geboortedatum: '1992-03-03', tier: 'rtg', pasApp: 'rtg' })).body.token;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  // de komende thuiswedstrijd uit de seed, voor de ticket-tests
  const b = await api(base, '/api/member/sport/bord', {}, lid);
  wedstrijdId = b.body.wedstrijden.find(w => w.thuis && !w.uitslag).wedstrijdId;
});
test.after(() => stop(srv && srv.child));

test('1. de club tekent zijn eigen stadion: vakken met prijs, en de horeca en wc\'s erop', async () => {
  const p = await api(base, '/api/sport/plattegrond', {}, club);
  assert.equal(p.status, 200);
  assert.ok(p.body.vakken.length >= 4, 'de seed-tribunes staan erop');
  assert.ok(p.body.voorzieningen.some(v => v.soort === 'horeca'), 'met horeca op de kaart');
  assert.ok(p.body.voorzieningen.some(v => v.soort === 'wc'), 'en de wc\'s');
  const zet = await api(base, '/api/sport/plattegrond/zet', {
    vakken: p.body.vakken.concat([{ naam: 'Tribune Oost', capaciteit: 250, prijsCenten: 1000 }]),
    voorzieningen: p.body.voorzieningen.concat([{ soort: 'horeca', naam: 'Bar Oost', bij: 'noord' }])
  }, club);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.vakken.some(v => v.naam === 'Tribune Oost'), 'het nieuwe vak staat erop');
  assert.ok(zet.body.voorzieningen.some(v => v.naam === 'Bar Oost'), 'met de nieuwe bar');
  // en een leeg stadion kan niet
  assert.equal((await api(base, '/api/sport/plattegrond/zet', { vakken: [] }, club)).status, 400);
});

test('2. tickets: reserveren per vak, capaciteit bewaakt, en nooit voor een uitwedstrijd', async () => {
  const k = await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId, vak: 'hoofd', aantal: 2 }, lid);
  assert.equal(k.status, 200);
  assert.match(k.body.ticket.code, /^ST-[0-9A-F]{6}$/, 'de oplichtende code');
  assert.equal(k.body.ticket.prijsCenten, 5000, '2 x 25 euro op de Hoofdtribune');
  assert.match(k.body.ticket.let, /poort/, 'afrekenen aan de poort, contant of RTG Pay');
  // een uitwedstrijd verkoopt de club hier niet
  const b = await api(base, '/api/member/sport/bord', {}, lid);
  const uit = b.body.wedstrijden.find(w => !w.thuis);
  assert.equal((await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId: uit.wedstrijdId, vak: 'hoofd' }, lid)).status, 409);
  // de capaciteit is heilig: het familievak (150) laat geen 8 boven de rand toe
  for (let i = 0; i < 19; i++) await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId, vak: 'familie', aantal: 8 }, lid);
  const vol = await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId, vak: 'familie', aantal: 8 }, lid);
  assert.equal(vol.status, 409, '19 x 8 = 152 > 150: de rand is bereikt');
  assert.match(vol.body.error, /vol/i);
});

test('3. de scan bij de poort is eenmalig; mijn tickets tonen de status', async () => {
  const k = await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId, vak: 'noord', aantal: 1 }, lid);
  const code = k.body.ticket.code;
  const s1 = await api(base, '/api/sport/scan', { code }, club);
  assert.equal(s1.body.geldig, true, 'de eerste scan is goed');
  assert.equal(s1.body.ticket.aantal, 1);
  const s2 = await api(base, '/api/sport/scan', { code }, club);
  assert.equal(s2.body.geldig, false, 'dezelfde code komt er geen tweede keer in');
  assert.match(s2.body.reden, /Al gescand/);
  const mijn = await api(base, '/api/member/sport/tickets', {}, lid);
  assert.ok(mijn.body.tickets.some(t => t.code === code && t.status === 'gescand'), 'het lid ziet: gescand');
});

test('4. de uitslag erin en de stand telt hem echt mee (3-1-0 en doelsaldo)', async () => {
  const voor = await api(base, '/api/sport/stand', {}, club);
  const eigenVoor = voor.body.tabel.find(r => r.team === 'RTG 1');
  const w = await api(base, '/api/sport/wedstrijd/maak', { tegenstander: 'Testclub', thuis: false, datum: '2020-01-01' }, club);
  await api(base, '/api/sport/uitslag', { wedstrijdId: w.body.wedstrijd.id, voor: 4, tegen: 0 }, club);
  const na = await api(base, '/api/sport/stand', {}, club);
  const eigen = na.body.tabel.find(r => r.team === 'RTG 1');
  assert.equal(eigen.p, eigenVoor.p + 3, 'de winst is drie punten');
  assert.equal(eigen.dv, eigenVoor.dv + 4, 'en de goals tellen in het doelsaldo');
  // onzin-uitslagen ketsen af
  assert.equal((await api(base, '/api/sport/uitslag', { wedstrijdId: w.body.wedstrijd.id, voor: -1, tegen: 3 }, club)).status, 400);
  assert.equal((await api(base, '/api/sport/uitslag', { wedstrijdId: 'bestaatniet', voor: 1, tegen: 0 }, club)).status, 404);
});

test('5. het veldbeheer: een thuiswedstrijd op een afgekeurd veld is een signaal', async () => {
  const v = await api(base, '/api/sport/velden', {}, club);
  const hoofdveld = v.body.velden.find(x => x.naam === 'Hoofdveld');
  await api(base, '/api/sport/veld/zet', { veldId: hoofdveld.id, status: 'afgekeurd', notitie: 'Drainage kapot' }, club);
  const co = await api(base, '/api/sport/cockpit', {}, club);
  assert.ok(co.body.signalen.some(s => s.soort === 'veld' && /AFGEKEURD/.test(s.tekst)), 'de cockpit slaat aan');
  await api(base, '/api/sport/veld/zet', { veldId: hoofdveld.id, status: 'goed', notitie: '' }, club);
  assert.equal((await api(base, '/api/sport/veld/zet', { veldId: hoofdveld.id, status: 'kapot' }, club)).status, 400, 'een onbekende status kan niet');
});

test('6. het trainingskamp: de club vraagt aan, een MENS bij RTG bevestigt met het verblijf', async () => {
  const k = await api(base, '/api/sport/kamp/vraag', { bestemming: 'Marbella', periode: 'winterstop', personen: 24 }, club);
  assert.equal(k.status, 200);
  assert.match(k.body.kamp.code, /^TK-[0-9A-F]{6}$/);
  assert.equal(k.body.kamp.status, 'aangevraagd');
  // de reisdesk (office) bevestigt; de AI mag dat nooit
  const b = await api(base, '/api/office/sport/kamp/beslis', { club: 'FCRTG', id: k.body.kamp.id, akkoord: true,
    naam: 'Reisdesk Anna', verblijf: 'RTG-partnerhotel Marbella', kostenCenten: 1800000 }, office);
  assert.equal(b.status, 200);
  assert.equal(b.body.kamp.status, 'bevestigd');
  assert.equal(b.body.kamp.door, 'Reisdesk Anna', 'met de naam van de mens die besliste');
  // besluit is besluit: nog eens beslissen kan niet
  assert.equal((await api(base, '/api/office/sport/kamp/beslis', { club: 'FCRTG', id: k.body.kamp.id, akkoord: false }, office)).status, 409);
});

test('7. sponsors: leden tonen interesse op codenaam, en de club beslist zelf', async () => {
  const open = await api(base, '/api/member/sport/sponsors', { club: 'FCRTG' }, lid);
  assert.equal(open.status, 200);
  const pakket = open.body.sponsors[0];
  assert.ok(pakket, 'het seed-pakket staat open');
  const i1 = await api(base, '/api/member/sport/sponsor', { club: 'FCRTG', id: pakket.id }, lid);
  assert.equal(i1.status, 200);
  assert.equal((await api(base, '/api/member/sport/sponsor', { club: 'FCRTG', id: pakket.id }, lid)).status, 409, 'dubbel op de lijst kan niet');
  const sp = await api(base, '/api/sport/sponsors', {}, club);
  const kandidaat = sp.body.sponsors.find(s => s.id === pakket.id).interesse[0].codenaam;
  const g = await api(base, '/api/sport/sponsor/beslis', { id: pakket.id, codenaam: kandidaat }, club);
  assert.equal(g.status, 200);
  assert.equal(g.body.sponsor.status, 'gesloten');
  assert.equal(g.body.sponsor.sponsor, kandidaat, 'de club gunde het pakket');
});

test('8. de financien tellen alles: tickets, sponsors en de kantine uit de gewone kassa', async () => {
  // de kantine draait op de bestaande kassalaag van de zaak
  const bon = await api(base, '/api/supplier/pos/sale', { total: 7, method: 'cash',
    items: [{ name: 'Stadionbroodje', qty: 1, price: 4.5 }, { name: 'Koffie', qty: 1, price: 2.5 }] }, club);
  assert.equal(bon.status, 200);
  const f = await api(base, '/api/sport/financien', {}, club);
  assert.equal(f.status, 200);
  assert.ok(f.body.ticketOmzetCenten >= 5000, 'de tickets tellen mee');
  assert.equal(f.body.sponsorsCenten, 2500000, 'het gesloten hoofdsponsorpakket');
  assert.equal(f.body.kantineCenten, 700, 'de kantinebon uit de kassa');
  assert.equal(f.body.kampKostenCenten, 1800000, 'en de bevestigde kampkosten');
});

test('9. momenten voor de socials, en het ene sportbord voor alle leden', async () => {
  const m = await api(base, '/api/sport/moment/maak', { tekst: 'RTG O17 wint het jeugdtoernooi!', beeld: '🏆' }, club);
  assert.equal(m.status, 200);
  const bord = await api(base, '/api/member/sport/bord', {}, lid);
  assert.equal(bord.status, 200);
  assert.ok(bord.body.wedstrijden.some(w => w.uitslag === '3 - 1'), 'de uitslagen staan op het bord');
  assert.ok(bord.body.momenten.some(x => /jeugdtoernooi/.test(x.tekst)), 'het moment staat in de Sport-app');
  const stand = await api(base, '/api/member/sport/stand', { club: 'FCRTG' }, lid);
  assert.ok(stand.body.tabel.length >= 6, 'en de stand is voor iedereen te zien');
});

test('10. de poorten: een gewone zaak komt niet in het clubkantoor, een gast niet aan een ticket', async () => {
  const ander = await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' })
  }).then(r => r.json());
  assert.equal((await api(base, '/api/sport/cockpit', {}, ander.token)).status, 403, 'alleen de sportclub zelf');
  const gast = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) }).then(r => r.json());
  assert.equal((await api(base, '/api/member/sport/ticket/koop', { club: 'FCRTG', wedstrijdId, vak: 'noord' }, gast.token)).status, 403, 'tickets zijn voor leden');
  assert.equal((await api(base, '/api/sport/cockpit', {})).status, 401, 'zonder inloggen helemaal niets');
});
