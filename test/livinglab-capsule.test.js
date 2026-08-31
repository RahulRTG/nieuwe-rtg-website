/* DE REPRODUCTIECAPSULE EN DE GESCHIEDENIS VAN EEN CONCLUSIE.

   Wat deze toets vastlegt:

     1. De capsule beschrijft de OPZET: hypothese met tegendeel, plan, protocol
        met zijn versie, en de bewijsregels voluit.
     2. De ijkstanden komen uit de metingen zelf -- bevroren op het moment van
        meten -- en niet uit het huidige register.
     3. Er zitten GEEN ruwe waarnemingen en GEEN aliassen in.
     4. Een conclusie draagt een geschiedenis met OORZAKEN: een drager erbij, een
        graad gezet, een herijking.
     5. Elke graadverandering is een versie; wat ertoe leidde staat erbij.

   Draai los: node --test test/livinglab-capsule.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const lijn = require('../server/kern/livinglab/conclusielijn');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-capsule-'));
let srv, base, office, labId, studieId, conclusieId, alias;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  labId = (await api('/api/lab2/lab/maak', { naam: 'Lab IJmuiden', stad: 'IJmuiden' }, office)).body.lab.id;
  studieId = (await api('/api/lab2/studie/maak', { labId, titel: 'Hittestress in woningen',
    soort: 'leefomgeving', vraagstuk: 'Welke woningen lopen risico bij hitte?', doel: 'inzicht' }, office)).body.studie.id;
  await api('/api/lab2/plan/hypothese', { id: studieId,
    tekst: 'Woningen op het noorden koelen s nachts minder af.',
    tegendeel: 'Gelijke nachttemperaturen zouden dit weerleggen.', door: 'Sam van RTG' }, office);
  await api('/api/lab2/plan/zet', { id: studieId, methoden: ['dagboek'], steekproef: 8, meetmomenten: 7,
    doel: 'nachttemperatuur vergelijken', rapportage: 'openbare kaart', door: 'Sam van RTG' }, office);
  await api('/api/lab2/ethiek/klasse', { id: studieId, klasse: 'laag', door: 'Sam van RTG' }, office);
  await api('/api/lab2/ethiek/toestemming', { id: studieId, regime: 'mondeling',
    tekst: 'U doet mee aan een onderzoek naar hitte in woningen; u kunt altijd stoppen.', door: 'Sam van RTG' }, office);
  await api('/api/lab2/protocol/zet', { id: studieId,
    instrumenten: [{ sleutel: 'binnentemp', vraag: 'Hoe warm is het binnen?', soort: 'getal', eenheid: 'graden', min: 0, max: 50 }] }, office);

  /* Een apparaat met een ijking, en een meting die eraan hing. */
  const a = await api('/api/lab2/app/maak', { labId, naam: 'Thermometer T-9', soort: 'sensor', geldigMaanden: 6 }, office);
  await api('/api/lab2/app/kalibratie', { id: a.body.apparaat.id, op: new Date().toISOString().slice(0, 10),
    door: 'Sam van RTG', geldigMaanden: 6, stand: 'binnen tolerantie' }, office);

  const d = await api('/api/lab2/mens/bij', { id: studieId, rol: 'buurtonderzoeker', toestemming: true }, office);
  alias = d.body.deelnemer.alias;
  await api('/api/lab2/mijn/meting', { pas: d.body.deelnemer.pas, antwoorden: { binnentemp: 28.4 },
    apparaatId: a.body.apparaat.id });
  const o = await api('/api/lab2/mijn/observatie', { pas: d.body.deelnemer.pas, wat: 'HET BLEEF WARM TOT DIEP IN DE NACHT.' });
  const c = await api('/api/lab2/bewijs/conclusie', { id: studieId, tekst: 'Woningen op het noorden koelen onvoldoende af.' }, office);
  conclusieId = c.body.conclusie.id;
  await api('/api/lab2/bewijs/koppel', { id: studieId, conclusieId, soort: 'observatie', ref: o.body.observatie.id }, office);
  await api('/api/lab2/bewijs/graad', { id: studieId, conclusieId, graad: 'waarneming' }, office);
});
test.after(() => stop(srv));

test('1. de capsule beschrijft de opzet, met het tegendeel en de bewijsregels', async () => {
  const r = await api('/api/lab2/capsule', { id: studieId }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = r.body.capsule;
  assert.match(c.onderzoek.nummer, /^RTF-IJM-/);
  assert.ok(c.opzet.hypothese.tegendeel, 'het tegendeel staat erin: dat onderscheidt een hypothese van een wens');
  assert.equal(c.opzet.plan.steekproef, 8);
  assert.equal(c.meetprotocol.versie, 1);
  assert.equal(c.meetprotocol.instrumenten[0].eenheid, 'graden');
  assert.deepEqual(c.meetprotocol.metingenPerVersie, { 1: 1 });
  assert.ok(c.bewijsregels.ladder.length >= 5, 'de ladder staat voluit, niet als verwijzing');
  assert.ok(c.software.versie, 'de softwareversie komt uit package.json');
});

test('2. de ijkstanden komen uit de metingen, bevroren op het meetmoment', async () => {
  const c = (await api('/api/lab2/capsule', { id: studieId }, office)).body.capsule;
  assert.equal(c.apparatuur.length, 1);
  assert.equal(c.apparatuur[0].metingen, 1);
  assert.equal(c.apparatuur[0].ijkstanden[0].geldig, true);
  assert.ok(c.apparatuur[0].ijkstanden[0].tot, 'de datum tot wanneer de ijking gold, staat vast');
});

test('3. geen ruwe waarnemingen en geen aliassen', async () => {
  const r = await api('/api/lab2/capsule', { id: studieId }, office);
  const tekst = JSON.stringify(r.body);
  assert.ok(!tekst.includes('HET BLEEF WARM'), 'de tekst van een observatie zit in de capsule');
  assert.ok(!tekst.includes(alias), 'een alias zit in de capsule');
  assert.ok(!tekst.includes('28.4'), 'een ingevulde meetwaarde zit in de capsule');
  assert.ok(r.body.capsule.bevatNiet.ruweWaarnemingen);
  assert.ok(r.body.capsule.bevatNiet.analyse);
});

test('4. een conclusie draagt een geschiedenis met oorzaken', async () => {
  const c = (await api('/api/lab2/capsule', { id: studieId }, office)).body.capsule;
  const con = c.conclusies.find(x => x.id === conclusieId);
  assert.ok(con.versies.length >= 1, 'er is ten minste een versie');
  const laatste = con.versies[con.versies.length - 1];
  assert.equal(laatste.graad, 'waarneming');
  assert.ok(laatste.waardoor.length, 'er staat bij waardoor deze versie ontstond');
  assert.ok(laatste.waardoor.some(w => /observatie/.test(w)), 'de drager die erbij kwam, staat in de oorzaken');
});

test('5. een herijking is een eigen versie: de conclusie zakt zichtbaar', async () => {
  /* De deelnemer trekt zich terug; zijn observatie draagt de conclusie, dus die
     zakt. Dat hoort als eigen versie in de lijn te staan -- niet als stille
     wijziging van de laatste. */
  const deelnemers = (await api('/api/lab2/studie', { id: studieId }, office)).body.studie.deelnemers;
  const weg = await api('/api/lab2/mens/weg', { id: studieId, alias: deelnemers[0].alias }, office);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));

  const c = (await api('/api/lab2/capsule', { id: studieId }, office)).body.capsule;
  const con = c.conclusies.find(x => x.id === conclusieId);
  assert.equal(con.graad, 'aanname', 'zonder drager kan hij zijn graad niet meer dragen');
  assert.ok(con.versies.length >= 2, 'de herijking is een eigen versie');
  const laatste = con.versies[con.versies.length - 1];
  assert.equal(laatste.graad, 'aanname');
  assert.ok(laatste.waardoor.some(w => /plafond/.test(w)), 'er staat bij dat het plafond zakte, en waarom');
});

test('6. de versielijn zelf: elke graadverandering is een versie, de rest leidt ertoe', () => {
  const c = {};
  lijn.noteer(c, { soort: 'gemaakt', naar: 'aanname', oorzaak: 'opgeschreven', at: '1' });
  lijn.noteer(c, { soort: 'drager-erbij', oorzaak: 'een observatie kwam eronder', at: '2' });
  lijn.noteer(c, { soort: 'graad-gezet', van: 'aanname', naar: 'waarneming', oorzaak: 'gezet', at: '3' });
  lijn.noteer(c, { soort: 'drager-erbij', oorzaak: 'nog een observatie', at: '4' });
  const v = lijn.versies(c);
  assert.equal(v.versies.length, 1);
  assert.deepEqual(v.versies[0].waardoor, ['opgeschreven', 'een observatie kwam eronder', 'gezet']);
  assert.deepEqual(v.sindsdien, ['nog een observatie'],
    'wat er na de laatste graadverandering gebeurde, is geen versie maar wat er sindsdien bijkwam');
});
