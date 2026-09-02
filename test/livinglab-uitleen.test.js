/* APPARATUUR BUITEN HET LAB -- uitlenen met een keten die niemand herschrijft.

   Wat deze toets vastlegt:

     1. De catalogus zegt wat NIET beschikbaar is, met de reden. Weglaten zou
        lijken alsof het apparaat niet bestaat.
     2. Een aanvraag komt van buiten het lab: geen inlog, wel een verantwoordelijke,
        een doel en een periode.
     3. Uitlenen is een besluit van een mens; een afwijzing draagt een reden.
     4. Een apparaat met een openstaande storing gaat niet de deur uit.
     5. Een apparaat met een verlopen ijking ook niet -- die ziet er precies zo
        uit als een geldige.
     6. Bij het meegeven wordt de ijkstand BEVROREN in de keten.
     7. Terugkomen sluit de uitleen niet: eerst herijken, want het apparaat is
        vervoerd en door anderen bediend.
     8. De keten groeit aan en wordt nooit herschreven.

   Draai los: node --test test/livinglab-uitleen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitleen-'));
let srv, base, office, labId, sensorId, kapotId, uitleenId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const overEenMaand = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  labId = (await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office)).body.lab.id;
  const s = await api('/api/lab2/app/maak', { labId, naam: 'Luchtkwaliteitssensor AQ-4', soort: 'sensor',
    plek: 'kast 3', geldigMaanden: 6 }, office);
  sensorId = s.body.apparaat.id;
  await api('/api/lab2/app/kalibratie', { id: sensorId, op: new Date().toISOString().slice(0, 10),
    door: 'Sam van RTG', geldigMaanden: 6, stand: 'binnen tolerantie' }, office);

  const k = await api('/api/lab2/app/maak', { labId, naam: 'Geluidsmeter SL-2', soort: 'sensor',
    plek: 'kast 4', geldigMaanden: 6 }, office);
  kapotId = k.body.apparaat.id;
  await api('/api/lab2/app/kalibratie', { id: kapotId, op: new Date().toISOString().slice(0, 10),
    door: 'Sam van RTG', geldigMaanden: 6, stand: 'binnen tolerantie' }, office);
  /* Een storing MELDEN gaat via onderhoud met soort 'storing'; `storing-op` is
     de tegenhanger die hem weer dichtzet. */
  await api('/api/lab2/app/onderhoud', { id: kapotId, soort: 'storing',
    wat: 'De meter slaat willekeurig uit boven 80 dB.' }, office);
});
test.after(() => stop(srv));

test('1. de catalogus zegt wat niet beschikbaar is, met de reden', async () => {
  const c = await api('/api/lab2/publiek/apparatuur', { labId });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const sensor = c.body.apparatuur.find(a => a.id === sensorId);
  const kapot = c.body.apparatuur.find(a => a.id === kapotId);
  assert.equal(sensor.beschikbaar, true);
  assert.equal(sensor.kalibratie.geldig, true);
  assert.equal(kapot.beschikbaar, false);
  assert.match(kapot.waaromNiet, /storing/);
  assert.match(c.body.let, /Weglaten/);
});

test('2. een aanvraag komt van buiten, met verantwoordelijke, doel en periode', async () => {
  const kaal = await api('/api/lab2/publiek/uitleen-aanvraag', { apparaatId: sensorId, organisatie: 'Basisschool De Vuurtoren' });
  assert.equal(kaal.status, 400);
  assert.match(kaal.body.error, /verantwoordelijke|bereiken/);

  const r = await api('/api/lab2/publiek/uitleen-aanvraag', { apparaatId: sensorId,
    organisatie: 'Basisschool De Vuurtoren', contact: 'meester Bram, 0612345678',
    doel: 'De kinderen meten een week lang de luchtkwaliteit op het schoolplein voor hun project.',
    van: morgen(), tot: overEenMaand() });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  uitleenId = r.body.uitleen.id;
  assert.equal(r.body.uitleen.stand, 'aangevraagd');
  assert.equal(r.body.uitleen.keten.length, 1);
});

test('3. uitlenen is een besluit van een mens, en een afwijzing draagt een reden', async () => {
  const zonderNaam = await api('/api/lab2/uitleen/besluit', { id: uitleenId, besluit: 'toegekend' }, office);
  assert.equal(zonderNaam.status, 400);
  assert.match(zonderNaam.body.error, /naam/);

  const r = await api('/api/lab2/uitleen/besluit', { id: uitleenId, besluit: 'toegekend', door: 'Sam van RTG' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.uitleen.stand, 'toegekend');
});

test('4. een apparaat met een openstaande storing gaat niet mee', async () => {
  const a = await api('/api/lab2/publiek/uitleen-aanvraag', { apparaatId: kapotId,
    organisatie: 'Buurtvereniging Zeewijk', contact: 'Ans, 0612345679',
    doel: 'Wij willen het geluid van de haven een week lang zelf meten in de avonduren.',
    van: morgen(), tot: overEenMaand() });
  await api('/api/lab2/uitleen/besluit', { id: a.body.uitleen.id, besluit: 'toegekend', door: 'Sam van RTG' }, office);
  const mee = await api('/api/lab2/uitleen/meegeven', { id: a.body.uitleen.id, door: 'Sam van RTG' }, office);
  assert.equal(mee.status, 409);
  assert.match(mee.body.error, /storing/);
  assert.match(mee.body.error, /niets waard/);
});

test('5. een verlopen ijking houdt het apparaat binnen', async () => {
  /* Een apparaat waarvan de ijking al is verlopen: gekalibreerd in het verleden,
     met een geldigheid die inmiddels om is. */
  const oud = await api('/api/lab2/app/maak', { labId, naam: 'Oude thermometer T-1', soort: 'sensor',
    plek: 'kast 5', geldigMaanden: 1 }, office);
  const oudId = oud.body.apparaat.id;
  const langGeleden = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10);
  await api('/api/lab2/app/kalibratie', { id: oudId, op: langGeleden, door: 'Sam van RTG',
    geldigMaanden: 1, stand: 'binnen tolerantie' }, office);

  const c = await api('/api/lab2/publiek/apparatuur', { labId });
  const rij = c.body.apparatuur.find(a => a.id === oudId);
  assert.equal(rij.beschikbaar, false);
  assert.match(rij.waaromNiet, /ijking/);

  const a = await api('/api/lab2/publiek/uitleen-aanvraag', { apparaatId: oudId,
    organisatie: 'Basisschool De Vuurtoren', contact: 'meester Bram, 0612345678',
    doel: 'Wij willen de temperatuur in het klaslokaal een maand lang volgen.',
    van: morgen(), tot: overEenMaand() });
  await api('/api/lab2/uitleen/besluit', { id: a.body.uitleen.id, besluit: 'toegekend', door: 'Sam van RTG' }, office);
  const mee = await api('/api/lab2/uitleen/meegeven', { id: a.body.uitleen.id, door: 'Sam van RTG' }, office);
  assert.equal(mee.status, 409);
  assert.match(mee.body.error, /verlopen/);
  assert.match(mee.body.error, /precies zo uit als een geldige/);
});

test('6. meegeven bevriest de ijkstand in de keten', async () => {
  const r = await api('/api/lab2/uitleen/meegeven', { id: uitleenId, door: 'Sam van RTG' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.uitleen.stand, 'meegegeven');
  assert.equal(r.body.uitleen.meegegeven.kalibratie.geldig, true);
  assert.ok(r.body.uitleen.meegegeven.kalibratie.tot, 'de datum tot wanneer de ijking gold, staat vast in de keten');
});

test('7. terugkomen sluit de uitleen niet: eerst herijken', async () => {
  const zonderStaat = await api('/api/lab2/uitleen/terug', { id: uitleenId, door: 'Sam van RTG' }, office);
  assert.equal(zonderStaat.status, 400);
  assert.match(zonderStaat.body.error, /in orde/, 'ook "in orde" is een waarneming en moet worden opgeschreven');

  const t = await api('/api/lab2/uitleen/terug', { id: uitleenId, door: 'Sam van RTG',
    staat: 'In orde, wel een kras op de behuizing.' }, office);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(t.body.uitleen.stand, 'terug', 'nog niet afgerond');
  assert.equal(t.body.uitleen.terug.herijkNodig, true);
  assert.match(t.body.let, /vervoerd en door anderen bediend/);

  /* Herijken kan pas als de kalibratie ook echt opnieuw is vastgelegd -- maar de
     bestaande ijking is nog geldig, dus dit sluit direct. Het punt is dat het een
     EIGEN handeling is en niet vanzelf gebeurt. */
  const h = await api('/api/lab2/uitleen/herijkt', { id: uitleenId, door: 'Sam van RTG' }, office);
  assert.equal(h.status, 200, JSON.stringify(h.body));
  assert.equal(h.body.uitleen.stand, 'afgerond');
});

test('8. de keten groeit aan en wordt nooit herschreven', async () => {
  const l = await api('/api/lab2/uitleen/lijst', { labId }, office);
  const u = l.body.uitleningen.find(x => x.id === uitleenId);
  assert.deepEqual(u.keten.map(k => k.wat), ['aangevraagd', 'toegekend', 'meegegeven', 'terug', 'herijkt']);
  for (const k of u.keten) assert.ok(k.at && k.door, 'elke stap draagt een moment en een naam');
  assert.equal(l.body.perStand.afgerond, 1);
});
