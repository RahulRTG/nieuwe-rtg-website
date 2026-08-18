/* Ronde: werkvormen + de staatskamers van RTG Kantoren.
   1. Werkvormen worden afgeleid, niet aangezet: een zzp'er die taxi rijdt
      krijgt de rittools EN de zzp-tools, een taxibedrijf met personeel krijgt
      er de werkgeverstools bij, en de kassa hoort altijd bij iedereen.
   2. Het Regeringskantoor: het landsbeeld, de ochtendbriefing en besluiten
      met vier ogen (wie tekent, tekent niet zelf mee).
   3. Opvang & migratie (AZC/COA): locaties, dossiers op nummer (nooit op
      naam) en de doorstroom vooruit door de keten.
   4. Elke afdeling zijn eigen hotel: het komt er vanzelf, boeken kan, en
      dubbelboeken van hetzelfde kamertype wordt geweigerd.
   Draai los: node --test test/werkvormen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

/* ---------- 1. de afleiding, puur (geen server nodig) ---------- */
const { vormenVan, capsVan, haakAan } = require('../server/kern/werkvormen');

function stubDb(suppliers) {
  return haakAan({ data: {
    suppliers,
    supplierTypes: {
      zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] },
      taxi: { label: 'Taxibedrijf', caps: ['rides', 'fleet'] },
      restaurant: { label: 'Restaurant', caps: ['menu', 'orders', 'reservations'] },
      hotel: { label: 'Hotel', caps: ['bookings', 'doors'] }
    },
    thuisHuizen: {}
  } });
}

test('een zzp-taxi krijgt allebei de gereedschapskisten, zonder dat iemand iets aanzet', () => {
  const zaak = { code: 'TAXI1', name: 'Karim Rijdt', type: 'zzp', staff: [{ id: 1 }],
    fleet: [{ id: 'A', kenteken: 'XX-01-XX' }] };
  const db = stubDb([zaak]);
  const ids = db.vormenVan(zaak).map(v => v.id).sort();
  assert.deepEqual(ids, ['kassa', 'vervoer', 'zelfstandig'],
    'de vloot maakt hem vervoerder, het zzp-type maakt hem zelfstandige');
  const caps = db.capsVan(zaak).sort();
  assert.ok(caps.includes('rides') && caps.includes('fleet'), 'de rittools staan er');
  assert.ok(caps.includes('services') && caps.includes('agenda'), 'de zzp-tools staan er ook');
  assert.ok(!caps.includes('personeel'), 'in zijn eentje is hij geen werkgever');
});

test('zonder auto geen rittools; zet hij er morgen een in, dan staan ze er', () => {
  const zaak = { code: 'KNIP', name: 'Kapper aan huis', type: 'zzp', staff: [{ id: 1 }] };
  const db = stubDb([zaak]);
  assert.deepEqual(db.vormenVan(zaak).map(v => v.id).sort(), ['kassa', 'zelfstandig']);
  zaak.fleet = [{ id: 'B' }];
  assert.ok(db.vormenVan(zaak).some(v => v.id === 'vervoer'), 'de afleiding kijkt live mee, er is geen schakelaar');
});

test('een taxibedrijf met personeel wordt werkgever; de kassa hoort bij iedereen', () => {
  const zaak = { code: 'TAXI2', name: 'Ibiza Cars', type: 'taxi', staff: [{ id: 1 }, { id: 2 }, { id: 3 }],
    fleet: [{ id: 'C' }, { id: 'D' }] };
  const db = stubDb([zaak]);
  const ids = db.vormenVan(zaak).map(v => v.id).sort();
  assert.deepEqual(ids, ['kassa', 'vervoer', 'werkgever']);
  const caps = db.capsVan(zaak);
  assert.ok(caps.includes('payroll') && caps.includes('personeel'), 'loonrun en rooster horen bij een werkgever');
  assert.ok(caps.includes('kassa'), 'elke zaak heeft een kassa');
  assert.ok(caps.includes('location') && caps.includes('pricing'), 'op de kaart staan hoort er altijd bij');
});

test('een restaurant dat huizen verhuurt onder de zaakvlag krijgt de verblijftools erbij', () => {
  const zaak = { code: 'KIKU', name: 'Sal de Mar', type: 'restaurant', staff: [{ id: 1 }],
    menu: [{ id: 1, naam: 'Tortilla' }] };
  const db = stubDb([zaak]);
  assert.ok(!db.vormenVan(zaak).some(v => v.id === 'verblijf'), 'nog geen huizen, dus geen verblijftools');
  db.data.thuisHuizen = { H1: { id: 'H1', host: 'zaak:KIKU' }, H2: { id: 'H2', host: 'IEMAND-ANDERS' } };
  const na = db.vormenVan(zaak).map(v => v.id);
  assert.ok(na.includes('verblijf'), 'een huis onder de zaakvlag opent de kamer-/keyless-tools');
  assert.ok(na.includes('horeca'), 'het menu blijft gewoon meetellen');
  assert.ok(db.capsVan(zaak).includes('doors'), 'keyless hoort bij verblijf');
});

test('het kantoor kan een werkvorm handmatig bijzetten via settings.extraVormen', () => {
  const zaak = { code: 'HAND', name: 'Handmatig', type: 'restaurant', staff: [{ id: 1 }],
    settings: { extraVormen: ['tickets'] } };
  const db = stubDb([zaak]);
  const t = db.vormenVan(zaak).find(v => v.id === 'tickets');
  assert.ok(t, 'de bijgezette vorm telt mee');
  assert.equal(t.handmatig, true, 'en is herkenbaar als handmatig');
  assert.ok(db.capsVan(zaak).includes('tickets'));
});

test('de pure functies werken ook zonder db-haak en zonder zaak', () => {
  assert.deepEqual(capsVan({ data: {} }, null), [], 'geen zaak, geen caps');
  assert.deepEqual(vormenVan({ data: {} }, null), []);
  const kaal = { data: { supplierTypes: {} } };
  assert.deepEqual(vormenVan(kaal, { code: 'X', type: 'onbekend' }).map(v => v.id), ['zelfstandig', 'kassa'],
    'een onbekend type zonder personeel is een eenmanszaak met een kassa, nooit een lege app');
});

/* ---------- 2. end-to-end: kantoor + leverancier ---------- */
let BASE, child, officeToken, managerToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkv-'));

const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  officeToken = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  managerToken = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een zaak ziet haar eigen werkvormen, met de bijbehorende apps erbij', async () => {
  const r = await api('/api/supplier/werkvormen', {}, managerToken);
  assert.equal(r.status, 200);
  assert.ok(r.body.vormen.length, 'er staat minstens één werkvorm');
  assert.ok(r.body.vormen.some(v => v.id === 'kassa'), 'de kassa hoort bij iedereen');
  assert.ok(r.body.vormen.every(v => v.label && v.app), 'elke vorm noemt zijn app in mensentaal');
  assert.ok(r.body.caps.includes('location'), 'de caps komen mee');
  assert.equal((await api('/api/supplier/werkvormen', {})).status, 401, 'niet zonder inlog');
});

test('het Regeringskantoor: het landsbeeld en de ochtendbriefing staan er', async () => {
  const s = await api('/api/office/regering', {}, officeToken);
  assert.equal(s.status, 200);
  assert.ok(s.body.bevolking.zaken > 0, 'de zaken tellen mee in het beeld');
  assert.ok(s.body.economie && s.body.economie.landen > 100, 'de Regelwacht houdt de hele wereld bij');
  assert.equal(s.body.veiligheid.opgeschaald, false, 'er staat niets opgeschaald in een verse omgeving');
  assert.ok(/nooit op wapensystemen/.test(s.body.defensie.opmerking));
  assert.ok(s.body.aandacht.length, 'er is altijd een eerste punt voor de MP');

  const b = await api('/api/office/regering/briefing', {}, officeToken);
  assert.equal(b.status, 200);
  assert.ok(b.body.regels.length >= 5, 'de briefing loopt alle poten langs');
  assert.ok(/tweede handtekening/.test(b.body.slot));
  assert.equal((await api('/api/office/regering', {})).status, 401, 'niet zonder kantoor-inlog');
});

test('een besluit vraagt vier ogen: wie het neemt, tekent het niet zelf mee', async () => {
  assert.equal((await api('/api/office/regering/besluit',
    { naam: 'MP', titel: '', portefeuille: 'wonen' }, officeToken)).status, 400, 'zonder titel geen besluit');
  assert.equal((await api('/api/office/regering/besluit',
    { naam: 'MP', titel: 'Iets', portefeuille: 'verzonnen' }, officeToken)).status, 400, 'onbekende portefeuille');

  const mk = await api('/api/office/regering/besluit',
    { naam: 'MP', titel: 'Tienduizend woningen vrijmaken', portefeuille: 'wonen',
      toelichting: 'Statushouders uit de opvang naar een eigen woning.' }, officeToken);
  assert.equal(mk.status, 200);
  const id = mk.body.besluit.id;
  assert.equal(mk.body.besluit.status, 'voorgenomen');
  assert.equal(mk.body.besluit.portefeuilleNaam, 'Volkshuisvesting');

  const zelf = await api('/api/office/regering/teken', { naam: 'mp', id }, officeToken);
  assert.equal(zelf.status, 403, 'zelf meetekenen mag niet, ook niet met andere hoofdletters');
  assert.match(zelf.body.error, /Vier ogen/);

  const mee = await api('/api/office/regering/teken', { naam: 'Minister van Wonen', id }, officeToken);
  assert.equal(mee.status, 200);
  assert.equal(mee.body.besluit.status, 'genomen');
  assert.equal(mee.body.besluit.medeondertekend, 'Minister van Wonen');
  assert.equal((await api('/api/office/regering/teken', { naam: 'Nog Iemand', id }, officeToken)).status, 409,
    'een genomen besluit wordt niet nog eens getekend');
  assert.equal((await api('/api/office/regering/teken', { naam: 'X', id: 'KB-BESTAATNIET' }, officeToken)).status, 404);

  const lijst = await api('/api/office/regering/besluiten', { portefeuille: 'wonen' }, officeToken);
  assert.ok(lijst.body.besluiten.some(x => x.id === id));
  assert.equal(lijst.body.open, 0, 'niets wacht meer op een handtekening');
});

test('Opvang & migratie: locaties, dossiers op nummer en de doorstroom vooruit', async () => {
  assert.equal((await api('/api/office/opvang/locatie', { locatie: { naam: 'Zonder plaats' } }, officeToken)).status, 400);

  const loc = await api('/api/office/opvang/locatie',
    { locatie: { naam: 'De Werf', plaats: 'Utrecht', soort: 'azc', capaciteit: 4,
      diensten: ['school', 'huisarts', 'verzonnen'] } }, officeToken);
  assert.equal(loc.status, 200);
  const locId = loc.body.locatie.id;
  assert.equal(loc.body.locatie.soortLabel, 'Asielzoekerscentrum');
  assert.deepEqual(loc.body.locatie.diensten, ['school', 'huisarts'], 'onbekende diensten vallen weg');
  assert.equal(loc.body.locatie.vrij, 4);

  const dos = await api('/api/office/opvang/dossier',
    { dossier: { locatie: locId, personen: 3, kinderen: 2, taal: 'Arabisch', bijzonder: 'Kind met astma' } }, officeToken);
  assert.equal(dos.status, 200);
  const nummer = dos.body.dossier.nummer;
  assert.match(nummer, /^DOS-[0-9A-F]{6}$/);
  assert.equal(dos.body.dossier.fase, 'aangemeld');
  const velden = Object.keys(dos.body.dossier);
  for (const verboden of ['naam', 'achternaam', 'nationaliteit', 'geboortedatum', 'gebdatum'])
    assert.ok(!velden.includes(verboden), 'een dossier draagt geen ' + verboden);

  const tevol = await api('/api/office/opvang/dossier', { dossier: { locatie: locId, personen: 3 } }, officeToken);
  assert.equal(tevol.status, 409, 'meer mensen dan plekken wordt geweigerd');
  assert.match(tevol.body.error, /niet genoeg plek/);

  assert.equal((await api('/api/office/opvang/fase', { nummer, fase: 'gehuisvest' }, officeToken)).status, 200,
    'vooruit door de keten mag');
  assert.equal((await api('/api/office/opvang/fase', { nummer, fase: 'opvang' }, officeToken)).status, 409,
    'terug in de keten niet');
  assert.equal((await api('/api/office/opvang/fase', { nummer: 'DOS-XXXXXX', fase: 'opvang' }, officeToken)).status, 404);
  assert.equal((await api('/api/office/opvang/dienst', { nummer, dienst: 'taalles' }, officeToken)).body.diensten.includes('taalles'), true);
  assert.equal((await api('/api/office/opvang/dienst', { nummer, dienst: 'raar' }, officeToken)).status, 400);

  const bord = await api('/api/office/opvang', {}, officeToken);
  assert.equal(bord.status, 200);
  assert.equal(bord.body.totaal.capaciteit, 4);
  assert.equal(bord.body.totaal.bezet, 0, 'wie gehuisvest is, bezet geen plek meer');
  assert.match(bord.body.privacy, /dossiernummer/);

  const dl = await api('/api/office/opvang/dossiers', { fase: 'gehuisvest' }, officeToken);
  assert.ok(dl.body.dossiers.some(x => x.nummer === nummer));
  assert.equal((await api('/api/office/opvang', {})).status, 401, 'niet zonder kantoor-inlog');
});

test('elke afdeling heeft een eigen hotel: het staat er vanzelf, en vol is vol', async () => {
  const kamer = 'techniek';
  const ov = await api('/api/office/afdelingshotel', { kamer }, officeToken);
  assert.equal(ov.status, 200);
  assert.equal(ov.body.hotel.open, true);
  assert.equal(ov.body.eenheden, 9, 'vier kamertypen, negen eenheden om mee te openen');
  assert.match(ov.body.verrekening, /intern verrekend/);

  const van = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const tot = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);
  assert.equal((await api('/api/office/afdelingshotel/boek',
    { kamer, soort: 'gezinskamer', van: tot, tot: van, voor: 'ORCHIDEE' }, officeToken)).status, 400,
    'van moet voor tot liggen');
  assert.equal((await api('/api/office/afdelingshotel/boek',
    { kamer, soort: 'gezinskamer', van, tot }, officeToken)).status, 400, 'voor wie is de kamer?');
  assert.equal((await api('/api/office/afdelingshotel/boek',
    { kamer, soort: 'penthouse', van, tot, voor: 'ORCHIDEE' }, officeToken)).status, 404, 'dat kamertype bestaat hier niet');

  const b = await api('/api/office/afdelingshotel/boek',
    { kamer, soort: 'gezinskamer', van, tot, voor: 'ORCHIDEE', reden: 'Gastonderzoeker met gezin' }, officeToken);
  assert.equal(b.status, 200);
  assert.equal(b.body.boeking.status, 'geboekt');
  assert.equal(b.body.boeking.soortNaam, 'Gezinskamer');

  const vol = await api('/api/office/afdelingshotel/boek',
    { kamer, soort: 'gezinskamer', van, tot, voor: 'IEMAND' }, officeToken);
  assert.equal(vol.status, 409, 'de enige gezinskamer is die nachten bezet');

  assert.equal((await api('/api/office/afdelingshotel/annuleer', { kamer, ref: b.body.boeking.ref }, officeToken)).status, 200);
  assert.equal((await api('/api/office/afdelingshotel/annuleer', { kamer, ref: b.body.boeking.ref }, officeToken)).status, 409,
    'twee keer annuleren kan niet');
  assert.equal((await api('/api/office/afdelingshotel/boek',
    { kamer, soort: 'gezinskamer', van, tot, voor: 'IEMAND' }, officeToken)).status, 200,
    'na de annulering is de kamer weer vrij');

  assert.equal((await api('/api/office/afdelingshotel/zet', { kamer, naam: 'Techniekhuis', kamerSoort: 'rustkamer', aantal: 6 }, officeToken)).status, 200);
  const na = await api('/api/office/afdelingshotel', { kamer }, officeToken);
  assert.equal(na.body.hotel.naam, 'Techniekhuis');
  assert.equal(na.body.eenheden, 13, 'de afdeling zet zelf kamers bij');

  const alle = await api('/api/office/afdelingshotel', {}, officeToken);
  assert.ok(alle.body.huizen.some(h => h.kamer === kamer), 'de boardroom ziet alle afdelingshuizen naast elkaar');
});
