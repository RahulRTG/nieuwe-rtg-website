/* DE GELDKETEN TEGEN DE ECHTE RUST-MOTOR: elke motorboeking draagt een
   economische sleutel, en die sleutel heeft een vorm die de motor aanneemt.

   Vier fouten, alle vier gevonden met de echte motor en geen van alle met een
   nagemaakte (die neemt elke sleutel aan):

   G1  Een door de aanbieder BEVESTIGDE kaartoplading werd in motorstand nooit
       bijgeschreven: kern/pay/oplaadwaarheid.js stuurde `pay-oplaad:BW-<hex>`
       en de motor kent alleen `<soort>:<sha256>` uit een gesloten lijst. 400,
       en de betaling bleef voor altijd BEVESTIGD zonder geld op de wallet.
   G2  boekAsync riep de motor ZONDER sleutel aan voor p2p, klompje, kassa en de
       rest. De ontdubbeling woonde alleen in de JS-idemopslag, en die commit
       NA de motor. Crash ertussen plus de retry met dezelfde idem-sleutel: het
       autoritatieve grootboek boekte twee keer.
   G4  Het slot van verzoekBetaal staat in het geheugen van een proces. Twee
       instanties betaalden hetzelfde betaalverzoek elk met een eigen sleutel,
       en de motor boekte het twee keer.
   G3  (JS-grootboek, geen motor) een crash tussen de bijschrijving en het
       vastleggen van de afhandeling: de herhaalde webhook schreef dezelfde
       oplading nog een keer bij, want boek() gooide de sleutel weg.

   Ontbreekt de motorbinary, dan zakt deze toets (test/lib/echte-motor.js):
   overslaan zou groen staan zonder iets te meten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { startEchteMotor } = require('./lib/echte-motor');

const SERVER = path.join(__dirname, '..', 'server');
const { SOORTEN, SLEUTEL } = require('../server/db/economische-identiteit');

let motor;
test.before(async () => { motor = await startEchteMotor(); });
test.after(() => { if (motor) motor.stop(); });

/* Een echte kern/pay + kern/betaalwaarheid in motorstand, zoals
   server/opzet/kernlaag3.js hem bouwt, met een eigen `db`. De omgeving wordt
   per opbouw gezet en hersteld: kern/pay leest hem bij het bouwen. */
function opbouw({ betaal, spelers, db, motorUrl, betalenUit }) {
  const oud = { a: process.env.RTG_MOTOR_GELD, b: process.env.RTG_MOTOR_GELD_URL, c: process.env.RTG_BETALEN_UIT };
  process.env.RTG_MOTOR_GELD = 'motor';
  process.env.RTG_MOTOR_GELD_URL = motorUrl || motor.url;
  if (betalenUit) process.env.RTG_BETALEN_UIT = '1'; else delete process.env.RTG_BETALEN_UIT;
  try {
    db = db || { data: {} };
    const save = () => {};
    const betaalWaarheid = require('../server/kern/betaalwaarheid')({ d: () => db.data, save, crypto, betaal: betaal || {}, log: null });
    const voegToe = require('../server/kern/pay/loshistorie')(db);
    const haak = { voor: null };
    const { pay } = require('../server/kern/pay')({
      betaalWaarheid, db, save, bijeen: async (w) => w(),
      payBoekingenVoegToe: (rij) => { if (haak.voor) haak.voor(rij); return voegToe(rij); },
      crypto, betaal: betaal || {},
      keyVanCodenaam: (c) => (spelers.includes(c) ? { key: 'proef:' + c } : null),
      sseToCustomer: () => {}, schoon: (x) => String(x || ''), betaaldienstKosten: () => 0,
      betaalOpdrachten: { registreerTeruggang() {}, maak: () => ({ id: 'proef' }), dienIn: async () => ({}) }
    });
    assert.equal(pay.geldModus, 'motor', 'deze proef meet de motorstand');
    return { db, pay, betaalWaarheid, haak };
  } finally {
    if (oud.a === undefined) delete process.env.RTG_MOTOR_GELD; else process.env.RTG_MOTOR_GELD = oud.a;
    if (oud.b === undefined) delete process.env.RTG_MOTOR_GELD_URL; else process.env.RTG_MOTOR_GELD_URL = oud.b;
    if (oud.c === undefined) delete process.env.RTG_BETALEN_UIT; else process.env.RTG_BETALEN_UIT = oud.c;
  }
}
/* Startsaldo rechtstreeks in de motor, met een sleutel die elke motorversie
   kent: zo meet een proef de boeking die hij wil meten en niet het opladen. */
let startTeller = 0;
async function startsaldo(pay, codenaam, centen) {
  const h = crypto.createHash('sha256').update('start:' + (++startTeller) + ':' + Date.now()).digest('hex');
  const r = await motor.boekguard({ van: 'extern:oplaad', naar: 'lid:' + codenaam, centen, soort: 'oplaad',
    oms: 'start', ref: 'start-' + startTeller, idem: 'pay-tegoed:' + h });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await pay.reconcileVanMotor();
}

test('G1: een bevestigde kaartoplading wordt in motorstand precies een keer bijgeschreven', async () => {
  // Stripe bevestigt meteen ('succeeded'), zoals een PaymentIntent met een opgeslagen kaart
  const betaal = { maakBetaling: async (o) => ({ id: 'pi_g1', status: 'succeeded', aanbieder: 'stripe',
    bedrag: o.bedrag, valuta: 'eur', referentie: o.referentie }) };
  const { db, pay, betaalWaarheid } = opbouw({ betaal, spelers: ['OPLADER'] });
  const r = await pay.laadOp({ codenaam: 'OPLADER', centen: 2500, idem: 'top-1' });
  const w = Object.values(db.data.betaalWaarheid)[0];
  assert.equal(r.ok, true, 'de motor moet de oplading aannemen: ' + JSON.stringify(r) + ' ' + w.afhandelingLaatsteFout);
  assert.ok(w.afgehandeldAt, 'de betaling is afgehandeld en niet blijvend BEVESTIGD zonder geld');
  assert.equal(await motor.saldo('lid:OPLADER'), 2500, 'het autoritatieve grootboek heeft het geld');
  assert.equal(pay.saldoVan('lid:OPLADER'), 2500, 'de spiegel volgt de motor');

  /* Herhalingen van buiten: dezelfde knop, de veegronde, en het oude
     settlementpad met hetzelfde betaling-id. Geen ervan schrijft nog iets bij. */
  const nog = await pay.laadOp({ codenaam: 'OPLADER', centen: 2500, idem: 'top-1' });
  assert.equal(nog.ok, true);
  delete w.afgehandeldAt; delete w.geboekt;          // alsof de afhandeling na de boeking verloren ging
  await betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
  assert.ok(w.afgehandeldAt);
  const settle = await pay.oplaadAfronden({ codenaam: 'OPLADER', centen: 2500, ref: w.id });
  assert.equal(settle.ok, true);
  assert.equal(await motor.saldo('lid:OPLADER'), 2500, 'een herhaalde bijschrijving op hetzelfde betaling-id boekt niets');
  assert.equal(pay.saldoVan('lid:OPLADER'), 2500);
});

test('G1: een andere betaling met hetzelfde bedrag is wel een tweede bijschrijving', async () => {
  const { pay } = opbouw({ spelers: ['TWEEMAAL'] });
  assert.equal((await pay.oplaadAfronden({ codenaam: 'TWEEMAAL', centen: 700, ref: 'BW-EEN' })).ok, true);
  assert.equal((await pay.oplaadAfronden({ codenaam: 'TWEEMAAL', centen: 700, ref: 'BW-TWEE' })).ok, true);
  assert.equal(await motor.saldo('lid:TWEEMAAL'), 1400, 'de sleutel hangt aan de betaling, niet aan het bedrag');
});

test('G2: een mislukte JS-commit na de bevestiging van de motor boekt bij de retry niet nog eens', async () => {
  const { pay, haak, db } = opbouw({ spelers: ['GEVER', 'NEMER'] });
  await startsaldo(pay, 'GEVER', 10000);
  /* De motor heeft bevestigd; daarna faalt de JS-kant (een PostgreSQL-commit,
     een volle schijf). Het werk gooit, de idem-sleutel wordt niet vastgelegd. */
  haak.voor = (rij) => { if (rij.soort === 'p2p') { haak.voor = null; throw new Error('JS-commit mislukt'); } };
  await assert.rejects(pay.stuur({ van: 'GEVER', aanCodenaam: 'NEMER', centen: 2500, idem: 'klik-g2' }), /JS-commit mislukt/);
  assert.equal(db.data.payIdem && db.data.payIdem['stuur:GEVER:klik-g2'], undefined, 'de JS-sleutel staat niet vast');
  await pay.reconcileVanMotor();
  const r = await pay.stuur({ van: 'GEVER', aanCodenaam: 'NEMER', centen: 2500, idem: 'klik-g2' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(await motor.saldo('lid:GEVER'), 7500, 'de retry met dezelfde sleutel boekt niet nog eens');
  assert.equal(await motor.saldo('lid:NEMER'), 2500);
  assert.equal(pay.saldoVan('lid:GEVER'), 7500);
  /* En een ANDERE sleutel is een ander verzoek: dat boekt wel. */
  assert.equal((await pay.stuur({ van: 'GEVER', aanCodenaam: 'NEMER', centen: 2500, idem: 'klik-g2b' })).ok, true);
  assert.equal(await motor.saldo('lid:NEMER'), 5000);
});

test('G2: kill -9 tussen de motorbevestiging en de JS-commit, dan dezelfde retry -- een keer geboekt', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-g2-'));
  /* Een eigen motor: dit kind gebruikt vaste codenamen. */
  const eigen = await startEchteMotor();
  try {
    const env = Object.assign({}, process.env, { RTG_STORE: 'sqlite', RTG_DATA_DIR: dir, NODE_ENV: 'test',
      RTG_MOTOR_GELD: 'motor', RTG_MOTOR_GELD_URL: eigen.url, NODE_NO_WARNINGS: '1' });
    const kind = path.join(__dirname, 'lib', 'geld-crashkind.js');
    const heen = spawnSync(process.execPath, [kind, 'motor-stuur', 'heen'], { env, encoding: 'utf8' });
    assert.equal(heen.signal, 'SIGKILL', 'de kill moet echt gevallen zijn: ' + heen.stdout + heen.stderr);
    assert.equal(await eigen.saldo('lid:BETA'), 2500, 'de motor had de boeking al bevestigd');
    const terug = spawnSync(process.execPath, [kind, 'motor-stuur', 'terug'], { env, encoding: 'utf8' });
    assert.equal(terug.status, 0, terug.stdout + terug.stderr);
    const uit = JSON.parse(terug.stdout.trim().split('\n').pop());
    assert.equal(uit.herhaling.ok, true, JSON.stringify(uit));
    assert.deepEqual(uit.motor, { ALFA: 7500, BETA: 2500 }, 'het autoritatieve grootboek boekte een keer');
    assert.deepEqual(uit.spiegel, { ALFA: 7500, BETA: 2500 });
  } finally { eigen.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('P1: kill -9 na de motorboeking, retry met dezelfde idem -- de kaart wordt niet opnieuw belast', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-p1-'));
  const eigen = await startEchteMotor();
  try {
    const env = Object.assign({}, process.env, { RTG_STORE: 'sqlite', RTG_DATA_DIR: dir, NODE_ENV: 'test',
      RTG_MOTOR_GELD: 'motor', RTG_MOTOR_GELD_URL: eigen.url, NODE_NO_WARNINGS: '1' });
    const kind = path.join(__dirname, 'lib', 'geld-crashkind.js');
    const heen = spawnSync(process.execPath, [kind, 'motor-dekking', 'heen'], { env, encoding: 'utf8' });
    assert.equal(heen.signal, 'SIGKILL', 'de kill moet echt gevallen zijn: ' + heen.stdout + heen.stderr);
    assert.equal(await eigen.saldo('lid:BETA'), 2500, 'de motor had de boeking al bevestigd');
    const terug = spawnSync(process.execPath, [kind, 'motor-dekking', 'terug'], { env, encoding: 'utf8' });
    assert.equal(terug.status, 0, terug.stdout + terug.stderr);
    const uit = JSON.parse(terug.stdout.trim().split('\n').pop());
    assert.equal(uit.herhaling.ok, true, JSON.stringify(uit));
    assert.equal(uit.providerAanroepen, 0, 'geen enkele aanroep naar de kaartaanbieder bij een herhaling');
    assert.equal(uit.nieuweBetalingen, 0, 'geen nieuwe betaalwaarheid-record');
    assert.deepEqual(uit.motor, { ALFA: 0, BETA: 2500 }, 'saldo exact: een boeking, geen opwaardering');
  } finally { eigen.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('P1: een echt tekort laadt een keer bij en boekt daarna, met dezelfde sleutel', async () => {
  let aanroepen = 0;
  const betaal = { maakBetaling: async (o) => { aanroepen++; return { id: 'pi_p1_' + aanroepen, status: 'succeeded',
    aanbieder: 'stripe', bedrag: o.bedrag, valuta: 'eur', referentie: o.referentie }; } };
  const { pay } = opbouw({ betaal, spelers: ['KORT', 'ONTV'] });
  await startsaldo(pay, 'KORT', 500);
  const r = await pay.stuur({ van: 'KORT', aanCodenaam: 'ONTV', centen: 2500, idem: 'kort-1' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(aanroepen, 1);
  assert.equal(await motor.saldo('lid:ONTV'), 2500);
  assert.equal(await motor.saldo('lid:KORT'), 500 + r.bijgeladen - 2500);
  const nog = await pay.stuur({ van: 'KORT', aanCodenaam: 'ONTV', centen: 2500, idem: 'kort-1' });
  assert.equal(nog.ok, true);
  assert.equal(aanroepen, 1, 'de herhaling raakt de kaart niet');
  assert.equal(await motor.saldo('lid:ONTV'), 2500);
});

test('G4: twee instanties betalen hetzelfde betaalverzoek met elk een eigen sleutel -- een keer afgeschreven', async () => {
  const spelers = ['VRAGER', 'BETALER'];
  const a = opbouw({ spelers });
  await startsaldo(a.pay, 'BETALER', 10000);
  const mk = await a.pay.verzoekMaak({ van: 'VRAGER', aan: ['BETALER'], totaalCenten: 2500, idem: 'v' });
  const id = mk.verzoeken[0].id;
  /* Instantie B laadt dezelfde gedeelde toestand, zoals uit PostgreSQL. */
  const b = opbouw({ spelers, db: { data: JSON.parse(JSON.stringify(a.db.data)) } });
  const [ra, rb] = await Promise.all([
    a.pay.verzoekBetaal({ codenaam: 'BETALER', verzoekId: id, idem: 'toestel-1' }),
    b.pay.verzoekBetaal({ codenaam: 'BETALER', verzoekId: id, idem: 'toestel-2' })]);
  assert.equal(await motor.saldo('lid:BETALER'), 7500, 'een verzoek van 25 euro kost 25 euro');
  assert.equal(await motor.saldo('lid:VRAGER'), 2500);
  /* Elke instantie ziet het verzoek als betaald, en geen van beide meldt een
     TWEEDE betaling: de tweede is een herhaling van de eerste. */
  for (const [r, inst] of [[ra, a], [rb, b]]) {
    assert.equal(r.ok, true, JSON.stringify(r));
    const v = inst.db.data.payVerzoeken.find(x => x.id === id);
    assert.equal(v.status, 'betaald');
    assert.equal(inst.pay.saldoVan('lid:BETALER'), 7500, 'de spiegel neemt de stand van de motor over');
  }
  assert.equal([ra, rb].filter(r => r.alBetaald).length, 1, 'precies een van de twee heeft betaald, de ander kreeg de herhaling');
  /* En een derde poging op een van beide instanties: 409, er is niets meer open. */
  assert.equal((await b.pay.verzoekBetaal({ codenaam: 'BETALER', verzoekId: id, idem: 'toestel-3' })).status, 409);
});

test('een motorboeking zonder sleutel en buiten een idem-handeling wordt geweigerd, en de motor ziet niets', async () => {
  const { pay } = opbouw({ spelers: ['LOS'] });
  await startsaldo(pay, 'LOS', 5000);
  const voor = await motor.saldi();
  await assert.rejects(pay.boekAsync({ van: 'lid:LOS', naar: 'partner:Z', centen: 100, soort: 'zaak', oms: 'x' }),
    e => e && e.code === 'ECONOMISCHE_SLEUTEL_ONTBREEKT');
  /* Een sleutel in een vorm die de motor niet kent, gaat niet eens de deur uit. */
  for (const fout of ['pay-oplaad:BW-0E110F5CC2524185F291', 'vonk:M1:K:rtg', 'pay-nieuw:' + 'a'.repeat(64)]) {
    await assert.rejects(pay.boekAsync({ van: 'lid:LOS', naar: 'partner:Z', centen: 100, soort: 'zaak', oms: 'x',
      economischeSleutel: fout }), e => e && e.code === 'ECONOMISCHE_SLEUTEL_ONGELDIG', fout);
  }
  /* Een handeling die geld beweegt zonder sleutel van de client weigert in
     motorstand VOOR het werk, dus voordat er iets van een kaart gaat. */
  const r = await pay.huisIn({ vanCodenaam: 'LOS', centen: 100 });
  assert.equal(r.status, 400, JSON.stringify(r));
  assert.equal(r.code, 'IDEMPOTENTIESLEUTEL_VERPLICHT');
  assert.deepEqual(await motor.saldi(), voor, 'geen enkele weigering raakte het grootboek');
});

test('Vonk: elke deelboeking draagt een sleutel die de motor aanneemt', async () => {
  const { pay } = opbouw({ spelers: ['VA', 'VB'] });
  await startsaldo(pay, 'VA', 5000);
  const maakBetaling = require('../server/kern/vonk/payment');
  const m = { id: 'm-motor', a: 'ka', b: 'kb', betaald: {}, status: 'wacht-op-betaling',
    tafel: { supplierCode: 'DATEZ', supplierName: 'Tafel', datum: '2026-10-02', tijd: '20:00', soort: 'diner' } };
  const data = { matches: [m] };
  const betaal = maakBetaling({ d: () => data, save: () => {}, nu: () => new Date().toISOString(),
    geblokkeerd: () => false, codenaamVan: x => (x === 'ka' ? 'VA' : 'VB'), pay,
    reserveerTafel: () => ({ ok: true, reservering: { id: 'r', status: 'aangevraagd' } }), notify: () => {},
    partnerEligible: () => true, PRIJS_CENTEN: 1000, RTG_CENTEN: 400 });
  const r = await betaal('ka', 'm-motor');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(await motor.saldo('lid:VA'), 4000);
  assert.equal(await motor.saldo('partner:DATEZ'), 600);
});

test('pariteit: JS SLEUTEL en de Rust-motor nemen precies dezelfde sleutels aan', async () => {
  /* Statisch: de twee lijsten zijn letterlijk gelijk. */
  const rs = fs.readFileSync(path.join(__dirname, '..', 'motor', 'src', 'pay.rs'), 'utf8');
  const blok = /ECONOMISCHE_SOORTEN:\s*\[&str;\s*\d+\]\s*=\s*\[([^\]]*)\]/.exec(rs);
  assert.ok(blok, 'motor/src/pay.rs draagt ECONOMISCHE_SOORTEN');
  const rust = [...blok[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(rust.slice().sort(), SOORTEN.slice().sort());
  /* Uitgevoerd: elke kandidaat gaat langs SLEUTEL en langs de ECHTE binary.
     De motor zegt "geen vaste hashvorm" (400) precies als SLEUTEL nee zegt. */
  const hex = crypto.createHash('sha256').update('pariteit').digest('hex');
  const kandidaten = [
    ...SOORTEN.map(s => s + ':' + hex),
    ...SOORTEN.map(s => s + ':' + hex.toUpperCase()),
    ...SOORTEN.map(s => s + ':' + hex.slice(1)),
    ...SOORTEN.map(s => s + 'x:' + hex),
    'pay-oplaad:BW-0E110F5CC2524185F291', 'vonk:m1:k:rtg', 'pay-nieuw:' + hex, ':' + hex, hex,
    'payout-terug' + hex, 'pay-kas:' + hex + '0', 'pay:pay-kas:' + hex
  ];
  let i = 0;
  for (const k of kandidaten) {
    const r = await motor.boekguard({ van: 'extern:pariteit', naar: 'lid:PARITEIT', centen: 1, soort: 'pariteit',
      oms: 'p', ref: 'p-' + (++i), idem: k });
    const motorZegtJa = r.status === 200;
    const motorZegtVorm = r.status === 400 && /hashvorm/.test(String(r.body && r.body.error));
    assert.ok(motorZegtJa || motorZegtVorm, k + ' gaf ' + r.status + ' ' + JSON.stringify(r.body));
    assert.equal(motorZegtJa, SLEUTEL.test(k), 'JS en Rust zijn het oneens over ' + k);
  }
});

/* ---------- DE INVARIANTEN VAN DE EIGENAAR, op de oplaadketen met de echte motor ----------
   Een oplading die WACHT (Stripe `processing`), waarna de aanbieder meldt.
   Elke proef bouwt zijn eigen betaling; de motor is de autoriteit en wordt
   na elke stap gelezen, niet de spiegel. */
const stripeMelding = (id, status, bedrag, eventId) => ({ eventId, gebeurtenis: 'payment_intent.' + status,
  aanbieder: 'stripe', providerId: 'pi_' + id, status, referentie: id, bedrag, valuta: 'eur' });
async function wachtendeOplading(codenaam, opties) {
  const betaal = { maakBetaling: async (o) => ({ id: 'pi_' + o.referentie, status: 'processing', aanbieder: 'stripe',
    bedrag: o.bedrag, valuta: 'eur', referentie: o.referentie }) };
  const o = opbouw(Object.assign({ betaal, spelers: [codenaam] }, opties || {}));
  const r = await o.pay.laadOp({ codenaam, centen: 2500, idem: 'w-' + codenaam });
  assert.equal(r.status, 402, 'de oplading wacht op de aanbieder: ' + JSON.stringify(r));
  return Object.assign(o, { betaal, id: r.betalingId });
}

test('(6) out-of-order: succeeded, dan een late processing, dan succeeded opnieuw -- een keer geld', async () => {
  const o = await wachtendeOplading('VOLGORDE');
  await o.betaalWaarheid.providerMelding(stripeMelding(o.id, 'succeeded', 2500, 'evt_v1'));
  await o.betaalWaarheid.providerMelding(stripeMelding(o.id, 'processing', 2500, 'evt_v0'));
  await o.betaalWaarheid.providerMelding(stripeMelding(o.id, 'succeeded', 2500, 'evt_v2'));
  assert.equal(await motor.saldo('lid:VOLGORDE'), 2500);
  const w = o.betaalWaarheid.van(o.id);
  assert.ok(w.afgehandeldAt, 'een late processing zet een afgehandelde betaling niet terug');
});

test('(8) een bedrag dat afwijkt van de aanbieder boekt niets en blijft zichtbaar', async () => {
  const o = await wachtendeOplading('AFWIJKING');
  await o.betaalWaarheid.providerMelding(stripeMelding(o.id, 'succeeded', 2400, 'evt_a1'));
  assert.equal(await motor.saldo('lid:AFWIJKING'), 0, 'geen geld bij een bedrag dat niet klopt');
  const w = o.betaalWaarheid.van(o.id);
  assert.equal(w.afgehandeldAt, undefined);
  assert.notEqual(w.status, 'BEVESTIGD', 'de afwijking staat als eigen stand, niet als betaald: ' + w.status);
});

test('(9)+(12) motor onbereikbaar: niets bijgeschreven, fail-closed; terug bereikbaar: precies een keer', async () => {
  const dood = 'http://127.0.0.1:9';   // discard-poort: er luistert niets
  const o = await wachtendeOplading('ONBEREIK', { motorUrl: dood });
  await o.betaalWaarheid.providerMelding(stripeMelding(o.id, 'succeeded', 2500, 'evt_o1')).catch(() => {});
  const w = o.betaalWaarheid.van(o.id);
  assert.equal(w.afgehandeldAt, undefined, 'onbekende financiele toestand is geen afgehandelde betaling');
  assert.equal(o.pay.saldoVan('lid:ONBEREIK'), 0, 'de spiegel verzint geen saldo');
  assert.equal(await motor.saldo('lid:ONBEREIK'), 0);
  /* Dezelfde toestand (zoals uit de database), nu met een bereikbare motor:
     de herstelronde schrijft hem bij, en een tweede ronde of herhaalde
     webhook doet niets meer. */
  const weer = opbouw({ betaal: o.betaal, spelers: ['ONBEREIK'], db: o.db });
  await weer.betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
  await weer.betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
  await weer.betaalWaarheid.providerMelding(stripeMelding(o.id, 'succeeded', 2500, 'evt_o1'));
  assert.equal(await motor.saldo('lid:ONBEREIK'), 2500);
  assert.ok(weer.betaalWaarheid.van(o.id).afgehandeldAt);
});

test('(11)+(12) betalen uit terwijl de webhook komt: niets geboekt, historie heel; weer aan: een keer', async () => {
  const o = await wachtendeOplading('SCHAKEL');
  await startsaldo(o.pay, 'SCHAKEL', 1000);               // er staat al historie
  const historie = JSON.stringify(o.db.data.payBoekingen || []);
  /* Uitgeschakeld (RTG_BETALEN_UIT) op dezelfde toestand: de bevestiging komt
     binnen, maar er beweegt geen geld en wat er stond blijft staan. */
  const uit = opbouw({ betaal: o.betaal, spelers: ['SCHAKEL'], db: o.db, betalenUit: true });
  await uit.betaalWaarheid.providerMelding(stripeMelding(o.id, 'succeeded', 2500, 'evt_s1')).catch(() => {});
  await uit.betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
  assert.equal(await motor.saldo('lid:SCHAKEL'), 1000, 'uit is uit: geen bijschrijving');
  assert.equal(JSON.stringify(o.db.data.payBoekingen || []), historie, 'uitschakelen raakt de historie niet');
  const w = uit.betaalWaarheid.van(o.id);
  assert.equal(w.status, 'BEVESTIGD', 'de betaling zelf blijft staan, de afhandeling wacht');
  assert.equal(w.afgehandeldAt, undefined);
  /* Weer aan: de wachtende afhandeling loopt een keer; dezelfde melding en een
     tweede ronde doen daarna niets meer. */
  const aan = opbouw({ betaal: o.betaal, spelers: ['SCHAKEL'], db: o.db });
  await aan.betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
  await aan.betaalWaarheid.providerMelding(stripeMelding(o.id, 'succeeded', 2500, 'evt_s1'));
  await aan.betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
  assert.equal(await motor.saldo('lid:SCHAKEL'), 3500);
  assert.ok(aan.betaalWaarheid.van(o.id).afgehandeldAt);
});
