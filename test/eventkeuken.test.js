/* ============================================================================
   DE EVENTKEUKEN -- 8 endpoints achter de leverancier-inlog.

   Deze acht wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   catering, allergy, allergy/alt, mep, checkin, runsheet, runsheet/done en
   runsheet/ai. Het event zelf (aanmaken, publiceren) werd wel beproefd, maar
   alles wat er in de keuken mee gebeurt niet.

   WAT ER OP HET SPEL STAAT

   Hier staat een allergenenlijst, en die is niet administratief. Voor elk
   allergeen hoort er een vervangend gerecht te komen EN een taak in de mise
   en place die zegt dat er gescheiden gewerkt wordt: aparte pan, aparte
   snijplank, aparte uitgifte. Valt die taak weg, dan staat er nog steeds een
   nette allergenenlijst in het scherm terwijl in de keuken niemand het weet.
   Dat is precies het soort stilte waar dit huis vaker tegenaan liep.

   De tweede regel die hier vastligt: opnieuw laten organiseren mag geen
   dubbele taken opleveren. Een draaiboek dat elke klik langer wordt, wordt op
   de werkvloer niet meer gelezen.

   Draai los: node --experimental-sqlite --test test/eventkeuken.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, chef, kok, lid, lidKey;
let eventId = null, allergieId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eventkeuken-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const ev = (pad, body, token) => api('/api/supplier/event' + pad, body, token);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const man = roster.body.staff.find(x => x.role === 'manager');
  const staf = roster.body.staff.find(x => x.role === 'staff');
  chef = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  kok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: staf.id, pin: '5678' })).body.token;

  const u = String(Date.now()).slice(-8);
  const reg = await api('/api/auth/register', { name: 'Gast Eventman', email: 'ev' + u + '@voorbeeld.test',
    password: 'eventgeheim12', geboortedatum: '1988-03-03', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  lidKey = (await api('/api/state', {}, lid)).body.state.user.codename;
  assert.ok(chef && kok && lid, 'chef, kok en lid staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een event met een eventkeuken: het vaste menu komt uit de eigen kaart', async () => {
  const mk = await ev('', { action: 'add', event: { name: 'Kersteditie', date: '2027-12-18', time: '19:00', capacity: 40, price: 95 } }, chef);
  assert.equal(mk.status, 200);
  eventId = mk.body.events[0].id;

  const kaart = (await api('/api/supplier/state', {}, chef)).body.state.menu || [];
  assert.ok(kaart.length >= 2, 'de zaak heeft een kaart om uit te kiezen');
  const gangen = kaart.slice(0, 2).map(m => m.id);

  const cat = await ev('/catering', { id: eventId, mode: 'menu', itemIds: gangen.concat(['bestaatniet']), note: 'Vier gangen, wijnarrangement apart.' }, chef);
  assert.equal(cat.status, 200);
  assert.deepEqual(cat.body.event.catering.itemIds, gangen, 'gerechten die niet op de kaart staan vallen eruit');
  assert.equal((await ev('/catering', { id: 'bestaatniet', mode: 'menu' }, chef)).status, 404);
  assert.equal((await ev('/catering', { id: eventId, mode: 'menu' }, kok)).status, 403, 'de eventkeuken instellen is van de manager');
});

test('2. de allergenenlijst: eenmaal per allergeen, met een aantal erbij', async () => {
  assert.equal((await ev('/allergy', { id: eventId, action: 'add', allergen: '  ' }, chef)).status, 400, 'een leeg allergeen is geen allergeen');

  const noten = await ev('/allergy', { id: eventId, action: 'add', allergen: 'Noten', count: 3 }, chef);
  assert.equal(noten.status, 200);
  const a = noten.body.event.allergies.find(x => x.allergen === 'noten');
  assert.ok(a, 'het allergeen staat er in kleine letters in');
  assert.equal(a.count, 3);
  assert.equal(a.alternative, null, 'er is nog geen vervangend gerecht');
  allergieId = a.id;

  assert.equal((await ev('/allergy', { id: eventId, action: 'add', allergen: 'noten' }, chef)).status, 409, 'twee keer hetzelfde allergeen kan niet');
  assert.equal((await ev('/allergy', { id: eventId, action: 'poets' }, chef)).status, 400, 'een onbekende actie doet niets');
  assert.equal((await ev('/allergy', { id: eventId, action: 'add', allergen: 'gluten', count: 2 }, chef)).status, 200);

  // en weghalen kan ook weer
  const weg = await ev('/allergy', { id: eventId, action: 'add', allergen: 'schaaldieren' }, chef);
  const schaalId = weg.body.event.allergies.find(x => x.allergen === 'schaaldieren').id;
  const na = await ev('/allergy', { id: eventId, action: 'remove', allergyId: schaalId }, chef);
  assert.ok(!na.body.event.allergies.some(x => x.id === schaalId), 'het allergeen is weg');
  assert.equal(na.body.event.allergies.length, 2, 'noten en gluten blijven staan');
});

test('3. een vervangend gerecht, ook zonder AI-sleutel', async () => {
  assert.equal((await ev('/allergy/alt', { id: eventId, allergyId: 'bestaatniet' }, chef)).status, 404);
  const alt = await ev('/allergy/alt', { id: eventId, allergyId: allergieId }, kok);
  assert.equal(alt.status, 200, 'de kok mag dit ook: het is keukenwerk');
  assert.ok(alt.body.alternative.name && alt.body.alternative.name.length > 3, 'er komt een naam terug');
  assert.match(alt.body.alternative.name + ' ' + alt.body.alternative.desc, /noten/i, 'het allergeen staat erin');
  assert.equal(alt.body.ai, false, 'zonder sleutel komt het uit de vaste ideeenlijst');
});

test('4. de mise en place: per allergeen een taak die gescheiden werken afdwingt', async () => {
  const mep = await ev('/mep', { id: eventId }, kok);
  assert.equal(mep.status, 200);
  assert.ok(mep.body.added >= 6, 'er komt een echt takenlijstje uit');
  const taken = mep.body.event.runsheet.filter(x => x.mep);
  assert.equal(taken.length, mep.body.added);

  for (const allergeen of ['noten', 'gluten']) {
    const raak = taken.filter(t => String(t.text).toLowerCase().includes(allergeen));
    assert.ok(raak.length >= 2, 'er staan taken voor ' + allergeen + ' in het draaiboek');
    assert.ok(raak.some(t => /gescheiden|apart/i.test(t.text)),
      'voor ' + allergeen + ' staat er een taak die gescheiden werken afdwingt');
  }
  // de vervanger van toets 3 wordt bij naam genoemd, niet alleen het allergeen
  assert.ok(taken.some(t => /variant zonder noten|vervangend gerecht/i.test(t.text)), 'de vervanger staat in de keuken op de lijst');

  /* Opnieuw organiseren mag geen dubbels geven: de vorige automatische taken
     gaan eruit voordat de nieuwe erin komen. Een draaiboek dat bij elke klik
     langer wordt, leest niemand meer. */
  const nogmaals = await ev('/mep', { id: eventId }, kok);
  assert.equal(nogmaals.body.event.runsheet.filter(x => x.mep).length, taken.length, 'even lang als daarvoor');
});

test('5. het draaiboek met de hand: regels erbij, afvinken en weghalen', async () => {
  assert.equal((await ev('/runsheet', { id: eventId, action: 'add', item: { text: '   ' } }, chef)).status, 400);
  const bij = await ev('/runsheet', { id: eventId, action: 'add', item: { time: '17:30', station: 'bediening', text: 'Tafelschikking nalopen met de gastvrouw' } }, chef);
  assert.equal(bij.status, 200);
  const regel = bij.body.event.runsheet.find(x => x.text.startsWith('Tafelschikking'));
  assert.ok(regel, 'de regel staat in het draaiboek');
  assert.equal((await ev('/runsheet', { id: eventId, action: 'add', item: { text: 'iets' } }, kok)).status, 403, 'het draaiboek vullen is van de manager');

  // afvinken mag de kok wel, en er komt een naam bij te staan
  const af = await ev('/runsheet/done', { id: eventId, itemId: regel.id }, kok);
  assert.equal(af.status, 200);
  const naAf = af.body.event.runsheet.find(x => x.id === regel.id);
  assert.equal(naAf.done, true);
  assert.ok(naAf.doneBy, 'er staat bij wie het afvinkte');
  const terug = await ev('/runsheet/done', { id: eventId, itemId: regel.id }, kok);
  assert.equal(terug.body.event.runsheet.find(x => x.id === regel.id).done, false, 'per ongeluk afvinken is te herstellen');
  assert.equal((await ev('/runsheet/done', { id: eventId, itemId: 'bestaatniet' }, kok)).status, 404);

  const weg = await ev('/runsheet', { id: eventId, action: 'remove', itemId: regel.id }, chef);
  assert.ok(!weg.body.event.runsheet.some(x => x.id === regel.id), 'de regel is weg');
  assert.equal((await ev('/runsheet', { id: eventId, action: 'poets' }, chef)).status, 400);
});

test('6. het draaiboek uit de AI-hulp draait ook zonder sleutel', async () => {
  const voor = (await ev('/runsheet', { id: eventId, action: 'add', item: { text: 'anker' } }, chef)).body.event.runsheet.length;
  const sug = await ev('/runsheet/ai', { id: eventId, mode: 'suggest' }, chef);
  assert.equal(sug.status, 200);
  assert.ok(sug.body.event.runsheet.length > voor, 'er komen regels bij');
  assert.equal((await ev('/runsheet/ai', { id: 'bestaatniet' }, chef)).status, 404);
  assert.equal((await ev('/runsheet/ai', { id: eventId }, kok)).status, 403, 'ook dit is van de manager');
});

test('7. inchecken aan de deur: alleen een gast die op de lijst staat', async () => {
  await ev('', { action: 'publish', id: eventId }, chef);
  const rsvp = await api('/api/event/rsvp', { supplierCode: 'KIKUNOI', eventId, qty: 2 }, lid);
  assert.equal(rsvp.status, 200, 'het lid meldt zich aan');

  assert.equal((await ev('/checkin', { eventId: 'bestaatniet', key: 'x' }, chef)).status, 404);
  assert.equal((await ev('/checkin', { eventId, key: 'iemand-anders' }, chef)).status, 404, 'wie niet op de lijst staat, checkt niet in');

  const gast = (await api('/api/supplier/state', {}, chef)).body.state.events.find(x => x.id === eventId).guests[0];
  const inc = await ev('/checkin', { eventId, key: gast.key }, kok);
  assert.equal(inc.status, 200, 'de deur mag dit zonder manager te zijn');
  assert.equal(inc.body.event.guests.find(g => g.key === gast.key).checkedIn, true);
  const uit = await ev('/checkin', { eventId, key: gast.key }, kok);
  assert.equal(uit.body.event.guests.find(g => g.key === gast.key).checkedIn, false, 'per ongeluk inchecken is te herstellen');
});
