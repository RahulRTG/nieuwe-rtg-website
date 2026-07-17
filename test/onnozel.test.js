/* Het onnozele-gedrag-harnas: invoer die je niet verwacht maar wel krijgt,
   omdat echte mensen echte mensen zijn. Emoji in schrijfvakken, lege
   spaties, kilometerslange teksten, datums die niet bestaan, bedragen die
   nergens op slaan, "ja" roepen zonder dat er iets openstaat en plakwerk
   met HTML erin. De lat: NOOIT een 5xx, altijd een net antwoord, en wat
   een voorstel belooft is wat de uitvoering waarmaakt.
   Draai los: node --experimental-sqlite --test test/onnozel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onnozel-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  assert.ok(lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('emoji in elk schrijfvak: gewoon onthouden, tonen en verwerken', async () => {
  const r = await api('fluister', { q: 'onthoud dat ik 🍕 met extra 🧀 wil, altijd' }, lid);
  assert.equal(r.status, 200);
  assert.ok(/Onthouden/i.test(r.body.antwoord));
  const prof = (await api('fluister/profiel', {}, lid)).body;
  assert.ok(prof.weetjes.some(w => w.tekst.includes('🍕') && w.tekst.includes('🧀')), 'de emoji overleven de opslag');
  // zoeken op alleen een emoji: een net antwoord, geen ontploffing
  const zoek = await api('fluister', { q: 'zoek 🦞' }, lid);
  assert.equal(zoek.status, 200);
  assert.ok(zoek.body.antwoord.length > 10);
  // het zorgprofiel met emoji-allergenen
  const zorg = await api('zorgprofiel/zet', { allergenen: '🥜 noten, 🦐 schaaldieren', delen: true }, lid);
  assert.equal(zorg.status, 200);
  // een reservering met een feest-notitie
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const res = await api('reserveer', { supplierCode: 'KIKUNOI', datum: morgen, tijd: '19:00', personen: 2, notitie: '🎉🎂🎈 verrassing!' }, lid);
  assert.equal(res.status, 200);
  await api('reservering/annuleer', { id: res.body.reservering.id }, lid);
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('leegte en oneindigheid: spaties, niets en tienduizend tekens', async () => {
  assert.equal((await api('fluister', { q: '   ' }, lid)).status, 400, 'alleen spaties is geen vraag');
  assert.equal((await api('fluister', {}, lid)).status, 400, 'helemaal niets ook niet');
  const lang = await api('fluister', { q: 'onthoud dat ' + 'heel '.repeat(2000) + 'lang' }, lid);
  assert.equal(lang.status, 200, 'een lap van tienduizend tekens crasht niets');
  const prof = (await api('fluister/profiel', {}, lid)).body;
  assert.ok(prof.weetjes.every(w => w.tekst.length <= 200), 'de opslag knipt netjes af');
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('datums die niet bestaan: 99 augustus en een lege dag blijven een nette vraag', async () => {
  const r99 = await api('fluister', { q: 'zet mijn 24 uur op 99 augustus' }, lid);
  assert.equal(r99.status, 200);
  assert.ok(/welke dag/i.test(r99.body.antwoord), 'dag 99 bestaat niet, dus hij vraagt het gewoon');
  const leeg = await api('fluister', { q: 'zet mijn 24 uur op een keer ooit' }, lid);
  assert.ok(/welke dag/i.test(leeg.body.antwoord));
  // en de reserveer-route zelf weigert onzin-datums met een 400, geen 500
  assert.equal((await api('reserveer', { supplierCode: 'KIKUNOI', datum: '0000-00-00', tijd: '20:00' }, lid)).status, 400);
  assert.equal((await api('reserveer', { supplierCode: 'KIKUNOI', datum: 'gisteren ofzo', tijd: '20:00' }, lid)).status, 400);
});

test('geld-onzin: nul euro, miljoenen en minnetjes komen niet langs de motor', async () => {
  const nul = await api('fluister', { q: 'stuur 0 euro naar Noordelijke Ster' }, lid);
  assert.ok(/welk bedrag/i.test(nul.body.antwoord), 'nul euro is geen Tik');
  // een absurd bedrag wordt een voorstel, maar de betaalmotor weigert bij "ja"
  const veel = await api('fluister', { q: 'stuur 9999999 euro naar Noordelijke Ster' }, lid);
  assert.ok(veel.body.voorstel);
  const ja = await api('fluister', { q: 'ja' }, lid);
  assert.ok(!ja.body.gedaan && /lukt niet/i.test(ja.body.antwoord), 'de grens van de betaalmotor houdt stand');
  // een minnetje: het voorstel toont eerlijk wat de motor las, en "nee" is nee
  const min = await api('fluister', { q: 'stuur -50 euro naar Noordelijke Ster' }, lid);
  assert.ok(min.body.voorstel && /50,00/.test(min.body.antwoord), 'het voorstel toont het gelezen bedrag');
  const nee = await api('fluister', { q: 'nee' }, lid);
  assert.ok(/niet door/i.test(nee.body.antwoord));
});

test('"ja" roepen zonder voorstel: drie keer niks, drie keer een net antwoord', async () => {
  for (let i = 0; i < 3; i++) {
    const r = await api('fluister', { q: 'ja' }, lid);
    assert.equal(r.status, 200);
    assert.ok(!r.body.gedaan && /niets open/i.test(r.body.antwoord));
  }
});

test('plakwerk met HTML erin: opgeslagen als onschadelijke tekst', async () => {
  const r = await api('fluister', { q: 'onthoud dat <script>alert(1)</script> mijn lievelingscode is' }, lid);
  assert.equal(r.status, 200);
  const prof = (await api('fluister/profiel', {}, lid)).body;
  const w = prof.weetjes[prof.weetjes.length - 1];
  assert.ok(!w.tekst.includes('<') && !w.tekst.includes('>'), 'punthaken overleven de schoonmaak niet');
  assert.ok(w.tekst.includes('alert(1)'), 'de rest blijft gewoon tekst');
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('focus-tellers met rommel: lege namen, minnetjes, tekst en duizend sleutels', async () => {
  const scores = { '': 5, '   ': 3, mini: -7, tekst: 'NaN', enorm: 1e12 };
  for (let i = 0; i < 1000; i++) scores['kaart' + i] = i;
  assert.equal((await api('fluister/focus', { scores }, lid)).status, 200, 'de motor knipt en klemt zelf');
  const prof = (await api('fluister/profiel', {}, lid)).body;
  assert.ok(prof.top.every(naam => naam.trim().length > 0), 'geen lege namen in de top');
  await api('fluister', { q: 'vergeet alles' }, lid);
});

test('99 sangria bestellen: het voorstel belooft precies wat de uitvoering waarmaakt', async () => {
  const r = await api('fluister', { q: 'bestel 99 sangria bij Sunset Ibiza' }, lid);
  assert.ok(r.body.voorstel);
  assert.ok(/20x Sangria/i.test(r.body.antwoord), 'de parse klemt op dezelfde 20 als de orderfunctie');
  const ja = await api('fluister', { q: 'ja' }, lid);
  assert.ok(ja.body.gedaan);
  const mijn = (await api('orders/mine', {}, lid)).body.orders || [];
  const o = mijn.find(x => x.supplierCode === 'PONTO' && x.paid);
  assert.equal(o.items[0].qty, 20, 'de order zelf is ook 20: belofte en werkelijkheid gelijk');
  // en 0 tickets wordt gewoon 1 ticket, met een eerlijk voorstel
  const t = await api('fluister', { q: 'boek 0 tickets voor de sunset cruise morgen' }, lid);
  assert.ok(/1 ticket/i.test(t.body.antwoord));
  await api('fluister', { q: 'nee' }, lid);
});

test('een zaak van louter emoji en codenamen met sluiptekens: nette vragen terug', async () => {
  const gk = await api('fluister', { q: 'reserveer bij 😀😀 morgen om 20:00' }, lid);
  assert.equal(gk.status, 200);
  assert.ok(/welke zaak/i.test(gk.body.antwoord), 'een onvindbare zaak blijft een vraag, geen fout');
  // zero-width spaces in een codenaam: de betaalmotor kent hem niet en zegt dat
  const zw = await api('fluister', { q: 'stuur 5 euro naar Noorde​lijke Ster' }, lid);
  if (zw.body.voorstel) {
    const ja = await api('fluister', { q: 'ja' }, lid);
    assert.ok(!ja.body.gedaan || /gestuurd/i.test(ja.body.antwoord), 'of hij kent hem niet, of het klopt echt; nooit iets ertussenin');
  }
});
