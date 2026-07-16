/* De verblijf-laag (toren hotel): boeken met datums, het receptiebord en de
   check-in/check-out-keten. De logies gaan bij check-in automatisch als
   kamerlast op de rekening; de kassa-check-out int alles in een keer en pas
   daarna sluit het verblijf. Draai los:
   node --experimental-sqlite --test test/verblijf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lid, hotel;               // lid-token en hotelmanager-token
let kamer;                    // een kamer van HOSHI
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verblijf-'));
const dagPlus = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  const roster = await api('supplier/roster', { code: 'HOSHI' });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  const login = await (await fetch(base + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'HOSHI', staffId: manager.id, pin: '1234' })
  })).json();
  hotel = login.token;
  kamer = ((login.state.supplier || {}).rooms || login.state.rooms || [])[0];
  assert.ok(lid && hotel && kamer, 'het lid en de receptie zijn binnen en er is een kamer');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let vid; // het verblijf dat de keten doorloopt

test('boeken met datums: nachten en totaal kloppen, rare datums ketsen af', async () => {
  const r = await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: dagPlus(0), vertrek: dagPlus(2), personen: 2 }, lid);
  assert.equal(r.status, 200);
  vid = r.body.verblijf.id;
  assert.equal(r.body.verblijf.nachten, 2);
  assert.equal(r.body.verblijf.totaal, Math.round(kamer.price * 2 * 100) / 100, 'nachten maal kamerprijs');
  assert.equal(r.body.verblijf.status, 'aangevraagd');
  assert.equal((await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: dagPlus(3), vertrek: dagPlus(3) }, lid)).status, 400, 'vertrek moet na aankomst');
  assert.equal((await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: '2020-01-01', vertrek: dagPlus(1) }, lid)).status, 400, 'niet in het verleden');
  assert.equal((await api('verblijf', { supplierCode: 'HOSHI', roomId: 'bestaat-niet', aankomst: dagPlus(1), vertrek: dagPlus(2) }, lid)).status, 404);
});

test('het receptiebord ziet de aanvraag; bevestigen sluit de kamer voor overlap', async () => {
  const bord = (await api('supplier/receptie', {}, hotel)).body;
  assert.ok(bord.aanvragen.some(v => v.id === vid), 'de aanvraag staat op het bord');
  assert.equal((await api('supplier/verblijf/beslis', { id: vid, actie: 'bevestig' }, hotel)).status, 200);
  // dezelfde kamer, overlappende periode: de aanvraag ketst af met de vrije datum
  const clash = await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: dagPlus(1), vertrek: dagPlus(4) }, lid);
  assert.equal(clash.status, 409);
  assert.match(clash.body.error, new RegExp(dagPlus(2)), 'de eerstvolgende vrije datum staat in de melding');
  // een periode erna kan gewoon
  assert.equal((await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: dagPlus(2), vertrek: dagPlus(4) }, lid)).status, 200);
});

test('check-in: de kamer gaat op bezet en de logies staan als kamerlast klaar', async () => {
  assert.equal((await api('supplier/verblijf/checkin', { id: vid }, hotel)).status, 200);
  const st = (await api('supplier/state', {}, hotel)).body.state;
  const rm = st.rooms.find(x => x.id === kamer.id);
  assert.equal(rm.hk.status, 'bezet', 'housekeeping ziet de kamer als bezet');
  const bord = (await api('supplier/receptie', {}, hotel)).body;
  const gast = bord.inHuis.find(v => v.id === vid);
  assert.ok(gast, 'de gast staat in huis');
  assert.equal(gast.openLast, gast.totaal, 'de logies staan open op de kamerrekening');
  assert.equal(bord.bezetting.bezet >= 1, true);
});

test('check-out kan pas als de rekening leeg is; de kassa int alles in een keer', async () => {
  // roomservice erbij: nog een kamerlast
  await api('supplier/pos/sale', { total: 24, method: 'kamer', room: kamer.name, desc: 'Roomservice ontbijt' }, hotel);
  const dicht = await api('supplier/verblijf/checkout', { id: vid }, hotel);
  assert.equal(dicht.status, 409, 'eerst de rekening');
  assert.match(dicht.body.error, /kassa/);
  // de kassa-check-out int logies plus roomservice in een keer (contant)
  const kas = await api('supplier/pos/checkout', { room: kamer.name, method: 'contant' }, hotel);
  assert.equal(kas.status, 200);
  assert.equal(kas.body.sale.total, Math.round((kamer.price * 2 + 24) * 100) / 100, 'logies en roomservice samen');
  // nu sluit het verblijf en staat de kamer op vuil voor housekeeping
  assert.equal((await api('supplier/verblijf/checkout', { id: vid }, hotel)).status, 200);
  const st = (await api('supplier/state', {}, hotel)).body.state;
  assert.equal(st.rooms.find(x => x.id === kamer.id).hk.status, 'vuil');
  const mijn = (await api('verblijf/mijn', {}, lid)).body.verblijven;
  assert.equal(mijn.find(v => v.id === vid).status, 'uitgecheckt');
});

test('de kamerkalender: geboekte nachten kleuren, de rest is vrij om te verkopen', async () => {
  const login = await (await fetch(base + '/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'HOSHI', staffId: (await api('supplier/roster', { code: 'HOSHI' })).body.staff.find(x => x.role === 'manager').id, pin: '1234' }) })).json();
  const kamer2 = (login.state.rooms || [])[1] || kamer;
  const v = await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer2.id, aankomst: dagPlus(1), vertrek: dagPlus(4) }, lid);
  await api('supplier/verblijf/beslis', { id: v.body.verblijf.id, actie: 'bevestig' }, hotel);
  const p = (await api('supplier/kamerplanning', {}, hotel)).body;
  assert.equal(p.dagen.length, 14, 'veertien dagen vooruit');
  const rij = p.kamers.find(k => k.id === kamer2.id);
  assert.equal(rij.dagen[0].status, 'vrij', 'vandaag is de kamer nog vrij');
  assert.equal(rij.dagen[1].status, 'bevestigd', 'de geboekte nachten kleuren');
  assert.equal(rij.dagen[3].status, 'bevestigd');
  assert.equal(rij.dagen[4].status, 'vrij', 'de vertrekdag is weer te verkopen');
});

test('keyless: de ingecheckte gast opent zijn kamerdeur met de app, daarna niet meer', async () => {
  // SAKURA heeft slimme deuren; de kamer "Casa Mar, zeezijde" hoort bij deur "Casa Mar"
  const roster = await api('supplier/roster', { code: 'SAKURA' });
  const beheer = roster.body.staff.find(x => x.role === 'manager');
  const villa = await (await fetch(base + '/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'SAKURA', staffId: beheer.id, pin: '1234' }) })).json();
  const casa = villa.state.rooms.find(r => /casa mar/i.test(r.name));
  const v = await api('verblijf', { supplierCode: 'SAKURA', roomId: casa.id, aankomst: dagPlus(0), vertrek: dagPlus(1) }, lid);
  await api('supplier/verblijf/beslis', { id: v.body.verblijf.id, actie: 'bevestig' }, villa.token);
  // voor de check-in doet de sleutel het nog niet
  assert.equal((await api('verblijf/deur', { supplierCode: 'SAKURA', welke: 'kamer' }, lid)).status, 409);
  const inn = await api('supplier/verblijf/checkin', { id: v.body.verblijf.id }, villa.token);
  assert.equal(inn.body.verblijf.deurId, 'd2', 'de kamerdeur is aan het verblijf gekoppeld');
  const deur = await api('verblijf/deur', { supplierCode: 'SAKURA', welke: 'kamer' }, lid);
  assert.equal(deur.status, 200);
  assert.equal(deur.body.door.name, 'Casa Mar', 'de eigen kamerdeur gaat open');
  const entree = await api('verblijf/deur', { supplierCode: 'SAKURA', welke: 'entree' }, lid);
  assert.match(entree.body.door.name, /Voordeur/, 'de entree kan ook');
  // na de check-out is de digitale sleutel weg
  await api('supplier/pos/checkout', { room: casa.name, method: 'contant' }, villa.token);
  await api('supplier/verblijf/checkout', { id: v.body.verblijf.id }, villa.token);
  assert.equal((await api('verblijf/deur', { supplierCode: 'SAKURA', welke: 'kamer' }, lid)).status, 409);
});

test('housekeeping-prioriteit en de hotelcijfers in de shift-samenvatting', async () => {
  // de eerste kamer staat op vuil (check-out) en er komt vandaag alweer een gast
  const v = await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: dagPlus(0), vertrek: dagPlus(1) }, lid);
  await api('supplier/verblijf/beslis', { id: v.body.verblijf.id, actie: 'bevestig' }, hotel);
  const bord = (await api('supplier/receptie', {}, hotel)).body;
  assert.ok(bord.hkEerst.includes(kamer.name), 'de vuile kamer met een aankomst vandaag staat bovenaan voor housekeeping');
  // na de check-in tellen de hotelcijfers mee in de shift-samenvatting
  await api('supplier/room/hk', { id: kamer.id, status: 'schoon' }, hotel);
  await api('supplier/verblijf/checkin', { id: v.body.verblijf.id }, hotel);
  const shift = (await api('supplier/shift', {}, hotel)).body;
  assert.ok(shift.verblijf, 'het hotelblok staat in de shift');
  assert.ok(shift.verblijf.bezet >= 1, 'de bezetting telt');
  assert.ok(shift.verblijf.aankomsten >= 1, 'de check-in van vandaag telt');
  assert.equal(shift.verblijf.adr, Math.round(kamer.price * 100) / 100, 'ADR is de gemiddelde kamerprijs van wie er slaapt');
});

test('annuleren en no-show: het lid trekt terug, de receptie meldt wie niet kwam', async () => {
  // annuleren: een nieuwe aanvraag, meteen weer ingetrokken
  const a = await api('verblijf', { supplierCode: 'HOSHI', roomId: kamer.id, aankomst: dagPlus(10), vertrek: dagPlus(12) }, lid);
  assert.equal((await api('verblijf/annuleer', { id: a.body.verblijf.id }, lid)).status, 200);
  // no-show: bevestigd voor vandaag, maar de gast komt niet (op een vrije kamer)
  const st = (await api('supplier/state', {}, hotel)).body.state;
  const vrijeKamer = st.rooms.find(r => r.available && r.id !== kamer.id);
  const b = await api('verblijf', { supplierCode: 'HOSHI', roomId: vrijeKamer.id, aankomst: dagPlus(0), vertrek: dagPlus(1) }, lid);
  await api('supplier/verblijf/beslis', { id: b.body.verblijf.id, actie: 'bevestig' }, hotel);
  assert.equal((await api('supplier/verblijf/noshow', { id: b.body.verblijf.id }, hotel)).status, 200);
  const bord = (await api('supplier/receptie', {}, hotel)).body;
  assert.ok(!bord.aankomsten.some(v => v.id === b.body.verblijf.id), 'de no-show staat niet meer bij de aankomsten');
});
