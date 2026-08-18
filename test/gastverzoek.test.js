/* WAT EEN GAST VRAAGT IN PLAATS VAN BESTELT.

   De gastkant kon bestellen en afrekenen, maar niet zeggen "kunt u even
   komen". Dat betekende in de praktijk: zwaaien. Deze toetsen bewaken de
   grenzen die van een knop iets anders maken dan een belofte:

   1. EEN VERZOEK KOST NIETS. Er komt geen regel op de rekening en het bedrag
      verandert niet. Een "verzoekje" waar stilletjes een flesje water uit
      volgt, is een bestelling met een vriendelijke naam.
   2. TWEE KEER DRUKKEN IS EEN KEER VRAGEN. Anders is de wachtrij van de zaak
      onleesbaar precies wanneer het druk is, en lijdt de gast die een keer
      drukte onder de gast die tien keer drukte.
   3. HET STAAT OP DE WACHTRIJ VAN DE ZAAK, MET ZIJN LEEFTIJD. Een verzoek dat
      niemand ziet is erger dan geen knop: wie op een knop drukt die niets
      doet, wacht langer dan wie meteen zwaait.
   4. ER WORDT GEEN TIJD BELOOFD. Nergens staat "iemand is er binnen twee
      minuten". Dat weten we niet.
   5. HET IS JOUW TAFEL OF HET IS NIETS. Zonder tafelsleutel geen verzoek, en
      andermans verzoek is niet in te trekken.

   Draai los: node --test test/gastverzoek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, ZAAK;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verzoek-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  ZAAK = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(ZAAK, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
// een eigen tafel per toets: per tafel is er hooguit een open rekening
async function aanTafel(naam) {
  const tafel = naam || ('Verzoek ' + (++teller));
  const qr = await post('/api/supplier/horeca/gast/qr', { tafel }, ZAAK);
  const aan = await post('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Gast' });
  assert.equal(aan.status, 200, 'aanschuiven aan ' + tafel);
  return { sleutel: aan.body.sleutel, tafel, rekeningId: aan.body.rekening.id };
}
const wachtrij = () => post('/api/supplier/horeca/verzoeken', {}, ZAAK).then(r => r.body);

test('1. een verzoek zet niets op de rekening en verandert geen bedrag', async () => {
  const t = await aanTafel();
  const voor = (await post('/api/gast/rekening', { sleutel: t.sleutel })).body;
  const v = await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'water' });
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 140));
  const na = (await post('/api/gast/rekening', { sleutel: t.sleutel })).body;
  assert.deepEqual(na.rekening.regels, voor.rekening.regels, 'geen enkele regel erbij');
  assert.deepEqual(na.rekening.totaal, voor.rekening.totaal, 'en geen cent verschil');
});

test('2. twee keer op dezelfde knop is een keer vragen', async () => {
  const t = await aanTafel();
  const a = await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'bediening' });
  const b = await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'bediening' });
  assert.equal(b.status, 200);
  assert.equal(b.body.alGevraagd, true, 'de tweede zegt dat het al openstond');
  assert.equal(b.body.verzoek.id, a.body.verzoek.id, 'en het is hetzelfde verzoek');
  const rij = await wachtrij();
  assert.equal(rij.verzoeken.filter(x => x.tafel === t.tafel).length, 1, 'de zaak ziet er een, niet twee');
});

test('3. een ander soort is wel een tweede verzoek', async () => {
  const t = await aanTafel();
  await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'bediening' });
  await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'rekening' });
  const mijn = (await post('/api/gast/verzoek/soorten', { sleutel: t.sleutel })).body.mijne;
  assert.equal(mijn.length, 2, 'twee verschillende dingen zijn twee verzoeken');
});

test('4. een verzonnen soort komt er niet in, met de keuzes erbij', async () => {
  const t = await aanTafel();
  const r = await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'champagne-gratis' });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'soort');
  const soorten = (await post('/api/gast/verzoek/soorten', { sleutel: t.sleutel })).body.soorten;
  assert.ok(soorten.length >= 5, 'de lijst komt van de server');
  assert.ok(soorten.every(s => s.sleutel && s.naam), 'met een naam per soort');
});

test('5. zonder tafelsleutel geen verzoek', async () => {
  const r = await post('/api/gast/verzoek', { sleutel: 'niet-bestaand-1234567890abcdef', soort: 'bediening' });
  assert.equal(r.status, 401, '"kunt u komen bij tafel 12" is geen knop voor iedereen op straat');
});

test('6. de zaak ziet het verzoek met zijn leeftijd, en nergens een beloofde tijd', async () => {
  const t = await aanTafel();
  await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'hulp', tekst: 'Er zit een haar in de soep' });
  const rij = await wachtrij();
  const v = rij.verzoeken.find(x => x.tafel === t.tafel);
  assert.ok(v, 'het staat op de wachtrij van de zaak');
  assert.equal(v.tekst, 'Er zit een haar in de soep');
  assert.equal(typeof v.minuten, 'number', 'met hoeveel minuten het open staat');
  assert.ok(v.door, 'en met wie het vroeg, op zijn handle');
  /* Nergens een toezegging. Deze toets kijkt naar de HELE uitvoer en niet naar
     een veld: een belofte kan overal insluipen, ook in een `let`-zin. */
  const alles = JSON.stringify(rij);
  assert.ok(!/binnen \d+ minuten|komt eraan|is onderweg|verwachte wachttijd/i.test(alles),
    'er wordt geen tijd beloofd: ' + alles.slice(0, 200));
});

test('7. op de rekening staat een handle en nooit een echte naam', async () => {
  const qr = await post('/api/supplier/horeca/gast/qr', { tafel: 'Verzoek privacy' }, ZAAK);
  await post('/api/gast/aanschuiven', { token: qr.body.token, naam: 'Jamie de Vries' })
    .then(a => post('/api/gast/verzoek', { sleutel: a.body.sleutel, soort: 'bediening' }));
  const rij = await wachtrij();
  const v = rij.verzoeken.find(x => x.tafel === 'Verzoek privacy');
  /* De handle die de gast zelf opgaf mag er staan -- dat is wat hij aan tafel
     ook zegt. Wat er NIET mag staan is een ledensleutel of een sessieafdruk. */
  const ruw = JSON.stringify(v);
  assert.ok(!/hash|sleutel|key|customerKey/i.test(ruw), 'geen sleutel of afdruk in beeld: ' + ruw);
});

test('8. oud staat bovenaan, niet tafel 1', async () => {
  /* De sortering is het halve punt van dit scherm: een lijst op zaalvolgorde
     laat de tafel die het langst wacht onderaan staan als hij toevallig hoog
     genummerd is, en dat is precies de tafel waar het misgaat. */
  const laag = require('../server/kern/gast/verzoek');
  const opslag = { data: { horeca: {} } };
  const schoon = (v, n) => String(v == null ? '' : v).slice(0, n);
  const horeca = require('../server/kern/horeca')({ db: opslag, save() {}, crypto: require('crypto'), schoon });
  const v = laag({ save() {}, schoon, horeca });
  const rek = (id, tafel) => ({ id, tafel });
  v.vraag('X', rek('r1', 'Tafel 1'), { handle: 'A' }, { soort: 'water' });
  v.vraag('X', rek('r2', 'Tafel 24'), { handle: 'B' }, { soort: 'hulp' });
  // tafel 24 vroeg om HULP en staat dus eerder oud (3 minuten) dan water (10)
  const doos = opslag.data.horeca.X.verzoeken;
  doos.find(x => x.tafel === 'Tafel 24').at = new Date(Date.now() - 4 * 60000).toISOString();
  const rij = v.wachtrij('X');
  assert.equal(rij.verzoeken[0].tafel, 'Tafel 24', 'wat te lang staat komt bovenaan');
  assert.equal(rij.verzoeken[0].oud, true);
  assert.equal(rij.oud, 1, 'en de zaak ziet hoeveel er te lang staan');
  assert.equal(rij.verzoeken[1].oud, false, 'een servetje van net is niet oud');
});

test('9. "oud" hangt aan de soort: een servetje mag wachten, een klacht niet', async () => {
  const laag = require('../server/kern/gast/verzoek');
  const opslag = { data: { horeca: {} } };
  const schoon = (v, n) => String(v == null ? '' : v).slice(0, n);
  const horeca = require('../server/kern/horeca')({ db: opslag, save() {}, crypto: require('crypto'), schoon });
  const v = laag({ save() {}, schoon, horeca });
  v.vraag('Y', { id: 'r1', tafel: 'T' }, { handle: 'A' }, { soort: 'bestek' });
  v.vraag('Y', { id: 'r2', tafel: 'T' }, { handle: 'A' }, { soort: 'hulp' });
  const vier = new Date(Date.now() - 4 * 60000).toISOString();
  for (const x of opslag.data.horeca.Y.verzoeken) x.at = vier;
  const rij = v.wachtrij('Y');
  const bestek = rij.verzoeken.find(x => x.soort === 'bestek');
  const hulp = rij.verzoeken.find(x => x.soort === 'hulp');
  assert.equal(hulp.oud, true, 'na vier minuten is "er is iets niet goed" te lang');
  assert.equal(bestek.oud, false, 'en bestek nog niet');
});

test('10. oppakken en afronden zijn twee stappen', async () => {
  const t = await aanTafel();
  const gevraagd = await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'rekening' });
  const id = gevraagd.body.verzoek.id;

  const op = await post('/api/supplier/horeca/verzoeken/zet', { verzoek: id, stand: 'opgepakt' }, ZAAK);
  assert.equal(op.status, 200);
  assert.equal(op.body.verzoek.stand, 'opgepakt');
  assert.ok(op.body.verzoek.opgepaktDoor, 'met wie het oppakte, zodat een collega niet ook gaat');

  const klaar = await post('/api/supplier/horeca/verzoeken/zet', { verzoek: id, stand: 'klaar' }, ZAAK);
  assert.equal(klaar.body.verzoek.stand, 'klaar');
  const rij = await wachtrij();
  assert.equal(rij.verzoeken.find(x => x.id === id), undefined, 'afgehandeld verdwijnt uit de wachtrij');

  const nog = await post('/api/supplier/horeca/verzoeken/zet', { verzoek: id, stand: 'klaar' }, ZAAK);
  assert.equal(nog.status, 409, 'en er wordt niet twee keer afgerond');
});

test('11. intrekken kan, maar niet als er al iemand onderweg is', async () => {
  const t = await aanTafel();
  const a = (await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'water' })).body.verzoek;
  const weg = await post('/api/gast/verzoek/intrekken', { sleutel: t.sleutel, verzoek: a.id });
  assert.equal(weg.status, 200, 'per ongeluk aangeraakt mag je terugnemen');

  const b = (await post('/api/gast/verzoek', { sleutel: t.sleutel, soort: 'bediening' })).body.verzoek;
  await post('/api/supplier/horeca/verzoeken/zet', { verzoek: b.id, stand: 'opgepakt' }, ZAAK);
  const laat = await post('/api/gast/verzoek/intrekken', { sleutel: t.sleutel, verzoek: b.id });
  assert.equal(laat.status, 409, 'er loopt iemand: intrekken is dan een mededeling, geen knop');
  assert.equal(laat.body.code, 'onderweg');
});

test('12. andermans verzoek is niet in te trekken', async () => {
  const a = await aanTafel();
  const b = await aanTafel();
  const van_a = (await post('/api/gast/verzoek', { sleutel: a.sleutel, soort: 'water' })).body.verzoek;
  const stiekem = await post('/api/gast/verzoek/intrekken', { sleutel: b.sleutel, verzoek: van_a.id });
  assert.equal(stiekem.status, 404, 'een andere tafel kent dit verzoek niet');
  const nog = (await post('/api/gast/verzoek/soorten', { sleutel: a.sleutel })).body.mijne;
  assert.ok(nog.some(x => x.id === van_a.id && x.stand === 'open'), 'en het staat er gewoon nog');
});
