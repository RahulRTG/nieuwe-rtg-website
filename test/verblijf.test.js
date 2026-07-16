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

test('het hoteldorp: negen afdelingen met dezelfde motor, elk een eigen keten', async () => {
  const dorp = (await api('supplier/dorp', {}, hotel)).body;
  assert.equal(dorp.afdelingen.length, 17, 'het hele dorp: van front office tot watersport');
  const keys = dorp.afdelingen.map(a => a.key);
  for (const k of ['frontoffice', 'guest', 'relations', 'concierge', 'parking', 'security', 'gym', 'spa', 'amenities', 'patissier', 'klussen', 'it', 'sales', 'events', 'florist', 'kidsclub', 'watersport']) {
    assert.ok(keys.includes(k), 'afdeling ' + k + ' bestaat');
  }
  // guest relations volgt een signaal tot en met het nabellen
  const klacht = await api('supplier/dorp/post', { afdeling: 'relations', waar: 'Garden kamer', tekst: 'Klacht over geluid van de poolbar' }, hotel);
  assert.equal(klacht.body.post.status, 'gemeld');
  assert.equal((await api('supplier/dorp/verder', { id: klacht.body.post.id }, hotel)).body.post.status, 'in gesprek');
  assert.equal((await api('supplier/dorp/verder', { id: klacht.body.post.id }, hotel)).body.post.status, 'opgelost');
  assert.equal((await api('supplier/dorp/verder', { id: klacht.body.post.id }, hotel)).body.post.status, 'nagebeld');
  // de patissier heeft de langste keten: besteld -> in de maak -> klaar -> geserveerd
  const taart = await api('supplier/dorp/post', { afdeling: 'patissier', waar: '19:00, Sea-view suite', tekst: 'Verjaardagstaart voor acht' }, hotel);
  assert.equal(taart.body.post.status, 'besteld');
  assert.equal((await api('supplier/dorp/verder', { id: taart.body.post.id }, hotel)).body.post.status, 'in de maak');
  assert.equal((await api('supplier/dorp/verder', { id: taart.body.post.id }, hotel)).body.post.status, 'klaar');
  assert.equal((await api('supplier/dorp/verder', { id: taart.body.post.id }, hotel)).body.post.status, 'geserveerd');
  // amenities: gevraagd -> onderweg -> op de kamer
  const badjas = await api('supplier/dorp/post', { afdeling: 'amenities', waar: 'Garden kamer', tekst: 'Badjassen maat L en kussenmenu' }, hotel);
  assert.equal(badjas.body.post.status, 'gevraagd');
  assert.equal((await api('supplier/dorp/verder', { id: badjas.body.post.id }, hotel)).body.post.status, 'onderweg');
  assert.equal((await api('supplier/dorp/verder', { id: badjas.body.post.id }, hotel)).body.post.status, 'op de kamer');
  // de klusjesman: post erbij, en de keten open -> bezig -> klaar
  const klus = await api('supplier/dorp/post', { afdeling: 'klussen', waar: 'Terras', tekst: 'Lamp bij tafel 4 vervangen' }, hotel);
  assert.equal(klus.status, 200);
  assert.equal(klus.body.post.status, 'open');
  assert.equal((await api('supplier/dorp/verder', { id: klus.body.post.id }, hotel)).body.post.status, 'bezig');
  assert.equal((await api('supplier/dorp/verder', { id: klus.body.post.id }, hotel)).body.post.status, 'klaar');
  assert.equal((await api('supplier/dorp/verder', { id: klus.body.post.id }, hotel)).status, 409, 'klaar is klaar');
  // parking heeft zijn eigen keten: geparkeerd -> voorrijden -> staat voor
  const auto = await api('supplier/dorp/post', { afdeling: 'parking', waar: 'P2-14', tekst: 'Blauwe Defender, Sea-view suite' }, hotel);
  assert.equal(auto.body.post.status, 'geparkeerd');
  assert.equal((await api('supplier/dorp/verder', { id: auto.body.post.id }, hotel)).body.post.status, 'voorrijden');
  // het dorpsplein telt: parking heeft een open post, klussen is klaar
  const na = (await api('supplier/dorp', {}, hotel)).body;
  assert.equal(na.afdelingen.find(a => a.key === 'parking').openAantal, 1);
  assert.equal(na.afdelingen.find(a => a.key === 'klussen').openAantal, 0);
  assert.ok(na.afdelingen.find(a => a.key === 'klussen').klaar.length >= 1, 'de afgeronde klus blijft even zichtbaar');
  assert.ok(na.totaalOpen >= 1);
  // een onbekende afdeling en een lege post ketsen af
  assert.equal((await api('supplier/dorp/post', { afdeling: 'casino', tekst: 'x' }, hotel)).status, 400);
  assert.equal((await api('supplier/dorp/post', { afdeling: 'spa', tekst: '' }, hotel)).status, 400);
});

test('afdelingen praten met elkaar: een post reist door met het spoor erbij', async () => {
  // guest relations vangt een klacht over een kapotte kraan; die wordt een klus
  const klacht = await api('supplier/dorp/post', { afdeling: 'relations', waar: 'Sea-view suite', tekst: 'Kraan badkamer lekt' }, hotel);
  const r = await api('supplier/dorp/stuurdoor', { id: klacht.body.post.id, naar: 'klussen' }, hotel);
  assert.equal(r.status, 200);
  assert.equal(r.body.post.afdeling, 'klussen', 'de post staat nu bij de klusjesman');
  assert.equal(r.body.post.status, 'open', 'en begint daar vooraan in de keten');
  assert.deepEqual(r.body.post.via, ['Guest relations'], 'het spoor reist mee');
  // en door naar IT kan ook weer, het spoor groeit
  const r2 = await api('supplier/dorp/stuurdoor', { id: klacht.body.post.id, naar: 'it' }, hotel);
  assert.deepEqual(r2.body.post.via, ['Guest relations', 'Klusjesman']);
  // naar dezelfde afdeling of naar onzin ketst af
  assert.equal((await api('supplier/dorp/stuurdoor', { id: klacht.body.post.id, naar: 'it' }, hotel)).status, 409);
  assert.equal((await api('supplier/dorp/stuurdoor', { id: klacht.body.post.id, naar: 'casino' }, hotel)).status, 400);
});

test('specialistische tools: elke afdeling het bord dat bij het vak past', async () => {
  // front office: de dagstaat telt (er slaapt nog iemand uit de shift-test)
  const dagstaat = (await api('supplier/dorp/tools', { afdeling: 'frontoffice' }, hotel)).body;
  assert.equal(dagstaat.soort, 'dagstaat');
  assert.ok(dagstaat.dagstaat.inHuis >= 1 && dagstaat.dagstaat.totaal >= 1);
  // parking: de voorrijd-wachtrij (de Defender staat sinds de dorptest op voorrijden)
  const wachtrij = (await api('supplier/dorp/tools', { afdeling: 'parking' }, hotel)).body;
  assert.equal(wachtrij.soort, 'wachtrij');
  assert.ok(wachtrij.voorrijden.some(p => /Defender/.test(p.tekst)), 'de auto staat in de wachtrij');
  // security: de rondeklok, met een direct afgeronde logpost
  assert.equal((await api('supplier/dorp/post', { afdeling: 'security', tekst: 'Poolronde gelopen', directKlaar: true }, hotel)).body.post.status, 'afgehandeld');
  const ronde = (await api('supplier/dorp/tools', { afdeling: 'security' }, hotel)).body;
  assert.ok(ronde.laatsteRonde && ronde.laatsteRonde.minuten <= 1, 'de klok weet wanneer er gelopen is');
  // gym: de druktemeter
  assert.equal((await api('supplier/dorp/drukte', { stand: 'druk' }, hotel)).status, 200);
  assert.equal((await api('supplier/dorp/tools', { afdeling: 'gym' }, hotel)).body.drukte.stand, 'druk');
  assert.equal((await api('supplier/dorp/drukte', { stand: 'vol' }, hotel)).status, 400);
  // kids club: de presentielijst weet wie er binnen is
  const kind = await api('supplier/dorp/post', { afdeling: 'kidsclub', waar: 'Garden kamer', tekst: 'Mia (6), tot 16:00' }, hotel);
  await api('supplier/dorp/verder', { id: kind.body.post.id }, hotel);
  const presentie = (await api('supplier/dorp/tools', { afdeling: 'kidsclub' }, hotel)).body;
  assert.ok(presentie.binnen.some(p => /Mia/.test(p.tekst)), 'Mia is binnen');
  // watersport: het op-het-water-bord met de tijd erbij
  const board = await api('supplier/dorp/post', { afdeling: 'watersport', waar: 'Sea-view suite', tekst: 'Twee paddleboards' }, hotel);
  await api('supplier/dorp/verder', { id: board.body.post.id }, hotel);
  const buiten = (await api('supplier/dorp/tools', { afdeling: 'watersport' }, hotel)).body;
  assert.ok(buiten.buiten.some(p => /paddleboards/.test(p.tekst) && p.minuten >= 0 && !p.teLang));
  // sales: de funnel telt per fase
  await api('supplier/dorp/post', { afdeling: 'sales', waar: 'Bedrijf X', tekst: 'Uitje twintig personen' }, hotel);
  const funnel = (await api('supplier/dorp/tools', { afdeling: 'sales' }, hotel)).body;
  assert.equal(funnel.funnel.find(f => f.fase === 'lead').aantal, 1);
  // klussen: de brug naar housekeeping (defecte kamer = werkvoorraad)
  const st = (await api('supplier/state', {}, hotel)).body.state;
  const defectKamer = st.rooms.find(r => r.available);
  await api('supplier/room/hk', { id: defectKamer.id, status: 'defect', note: 'Airco tikt' }, hotel);
  const defecten = (await api('supplier/dorp/tools', { afdeling: 'klussen' }, hotel)).body;
  assert.ok(defecten.defecten.some(d => d.kamer === defectKamer.name && /Airco/.test(d.note)));
  await api('supplier/room/hk', { id: defectKamer.id, status: 'schoon' }, hotel); // netjes terug
  // guest relations: wie opgelost is, staat op de nabellijst
  const signaal = await api('supplier/dorp/post', { afdeling: 'relations', waar: 'Sea-view suite', tekst: 'Trage roomservice gisteravond' }, hotel);
  await api('supplier/dorp/verder', { id: signaal.body.post.id }, hotel);
  await api('supplier/dorp/verder', { id: signaal.body.post.id }, hotel);
  const herstel = (await api('supplier/dorp/tools', { afdeling: 'relations' }, hotel)).body;
  assert.ok(herstel.nabellen.some(p => /roomservice/.test(p.tekst)), 'nabellen staat klaar');
  // amenities en patissier hebben snelknoppen
  assert.ok((await api('supplier/dorp/tools', { afdeling: 'amenities' }, hotel)).body.knoppen.includes('Kussenmenu'));
  assert.ok((await api('supplier/dorp/tools', { afdeling: 'patissier' }, hotel)).body.knoppen.includes('Verjaardagstaart'));
});

test('de buurt op het conciergescherm: partners om de hoek, op afstand gesorteerd', async () => {
  const r = await api('supplier/dorp/buurt', {}, hotel);
  assert.equal(r.status, 200);
  assert.ok(r.body.buurt.length >= 3, 'er ligt genoeg om de hoek');
  assert.ok(!r.body.buurt.some(b => b.code === 'HOSHI'), 'het hotel staat niet in zijn eigen buurt');
  const salDeMar = r.body.buurt.find(b => b.naam === 'Sal de Mar');
  assert.ok(salDeMar, 'het restaurant om de hoek staat erin');
  assert.ok(salDeMar.km >= 0 && salDeMar.km <= 30, 'met een afstand in kilometers');
  for (let i = 1; i < r.body.buurt.length; i++) assert.ok(r.body.buurt[i].km >= r.body.buurt[i-1].km, 'gesorteerd op afstand');
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
