/* Ronde: het oprichtingsproject en de aanvraag van de zaak -- het laatste stuk
   van de reis, van vastgelegd plan naar draaiende onderneming.

   De twee beweringen die hier het zwaarst wegen:

   1. ZONDER RECHTSVORM GEEN LIJST. De helft van de stappen hangt van de
      rechtsvorm af. Een lijst die doet alsof dat niet zo is, laat iemand langs
      de notaris fietsen en oogt intussen compleet.
   2. ER IS GEEN TWEEDE DEUR. Een zaak aanmaken is partner worden, en dat besluit
      is mensenwerk. Het Ondernemers-OS maakt daarom geen supplier maar een
      gewone aanmelding; wie dat pad afsnijdt, bouwt precies de deur waar geen
      mens meer voor staat.

   Draai los: node --experimental-sqlite --test test/onderneming-oprichting.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const maakOnderneming = require('../server/kern/onderneming');
const OPR = require('../server/kern/onderneming/oprichting');
const RV = require('../server/kern/onderneming/rechtsvorm');

/* Een nagemaakte aanmeldingsstroom: hij onthoudt wat hij binnenkreeg, zodat we
   kunnen nakijken WAT er wordt doorgegeven en niet alleen DAT er iets gebeurt. */
function stubAanmeldingen() {
  const bak = [];
  return {
    ontvangen: bak,
    aanvraag(b, aanvragerId) {
      const a = { id: 'aan_' + (bak.length + 1), pas: b.pas, naam: b.naam, contact: b.contact,
        bedrijf: b.bedrijf, status: 'in behandeling', besluit: null, gezaakt: null, accountId: aanvragerId };
      bak.push(a);
      return { ok: true, aanmelding: a };
    },
    een(id) {
      const a = bak.find(x => x.id === id);
      return a ? { ok: true, aanmelding: a } : { status: 404, error: 'weg' };
    }
  };
}

function stubKern(opties) {
  const o = opties || {};
  const zaken = o.suppliers || [];
  const data = { ondernemingen: [], suppliers: zaken,
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const aanm = o.aanmeldingen || stubAanmeldingen();
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    /* De ECHTE ondernemerpoort, met de echte salonregel erachter. Een
       nagemaakte poort zou hier precies datgene wegnemen wat we willen meten:
       dat de eerste-klant-lijst de bestaande poort LEEST. */
    ondernemerpoort: require('../server/opzet/salonregel')({ data: { posts: [] } }).ondernemerpoort,
    findSupplier: (code) => zaken.find(z => z.code === code) || null,
    ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: aanm
  });
  K._aanm = aanm; K._zaken = zaken;
  return K;
}

const GEZOND = {
  persoon: { urenPerWeek: 32, ervaringJaren: 8, startkapitaal: 15000, verkoopervaring: true, samen: 'alleen' },
  idee: { branche: 'restaurant', wat: 'Klein buurtrestaurant', doelgroep: 'De buurt', plaats: 'Haarlem',
    onderscheid: 'Eén menu per dag, alles vers', verkoopmodel: 'eenmalig',
    prijs: 40, kostprijs: 12, verwachtPerMaand: 400, vasteLasten: 6000 }
};

function klaarVoorOprichting(K, intake) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  K.ondernemingIntakeZet(o, intake || GEZOND);
  return o;
}

/* ---------------- 1. de lijst ---------------- */

test('zonder rechtsvorm komt er geen halve lijst maar een vraag', () => {
  const K = stubKern();
  const p = K.ondernemingOprichting(klaarVoorOprichting(K));
  assert.equal(p.stand, 'geen-rechtsvorm');
  assert.deepEqual(p.stappen, [], 'geen enkele stap, want de helft hangt van die keuze af');
  assert.equal(p.totaal, 0);
  assert.ok(p.vraag.includes('rechtsvorm'));
});

test('de lijst komt uit drie bronnen en noemt per stap welke', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  K.ondernemingRechtsvorm(o, 'bv');
  const p = K.ondernemingOprichting(o);
  const bronnen = new Set(p.stappen.map(s => s.bron));
  assert.deepEqual([...bronnen].sort(), ['branche', 'rechtsvorm', 'situatie']);

  const jur = p.stappen.filter(s => s.bron === 'rechtsvorm').map(s => s.stap);
  assert.deepEqual(jur, RV.RECHTSVORMEN.bv.oprichting,
    'de juridische stappen worden uit rechtsvorm.js gelezen, niet overgetypt');
  assert.ok(p.stappen.some(s => s.stap.includes('Alcoholvergunning')),
    'en een restaurant krijgt zijn eigen vergunningen erbij');
});

test('de rechtsvorm wisselen verandert de lijst mee', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  const zzp = K.ondernemingOprichting(o).stappen.map(s => s.stap);
  K.ondernemingRechtsvorm(o, 'stichting');
  const st = K.ondernemingOprichting(o).stappen.map(s => s.stap);
  assert.ok(!zzp.some(s => s.includes('notaris')), 'een eenmanszaak gaat niet langs de notaris');
  assert.ok(st.some(s => s.includes('notaris')), 'een stichting wel');
  assert.ok(st.some(s => s.includes('bestuur')), 'en heeft een bestuur nodig');
});

test('de situatie-stappen verschijnen alleen als het plan ze oproept', () => {
  const K = stubKern();
  const alleen = klaarVoorOprichting(K);
  K.ondernemingRechtsvorm(alleen, 'eenmanszaak');
  assert.ok(!K.ondernemingOprichting(alleen).stappen.some(s => s.id === 'situatie:samen'),
    'wie alleen begint, krijgt geen samenwerkingsafspraken');

  const samen = JSON.parse(JSON.stringify(GEZOND));
  samen.persoon.samen = 'team';
  const K2 = stubKern();
  const o2 = klaarVoorOprichting(K2, samen);
  K2.ondernemingRechtsvorm(o2, 'eenmanszaak');
  const ids = K2.ondernemingOprichting(o2).stappen.map(s => s.id);
  assert.ok(ids.includes('situatie:samen'), 'wie samen begint wel');
  assert.ok(ids.includes('situatie:personeel'), 'en krijgt de werkgeversplichten erbij');
});

test('zonder startkapitaal komt de bufferstap op, met startkapitaal niet', () => {
  const K = stubKern();
  const arm = JSON.parse(JSON.stringify(GEZOND));
  arm.persoon.startkapitaal = 0;
  const o = klaarVoorOprichting(K, arm);
  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  assert.ok(K.ondernemingOprichting(o).stappen.some(s => s.id === 'situatie:buffer'));

  K.ondernemingIntakeZet(o, { persoon: { startkapitaal: 20000 } });
  assert.ok(!K.ondernemingOprichting(o).stappen.some(s => s.id === 'situatie:buffer'),
    'de lijst leest live mee: er is geen schakelaar');
});

test('de lijst zegt zelf dat hij niet volledig is', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  K.ondernemingRechtsvorm(o, 'bv');
  const p = K.ondernemingOprichting(o);
  assert.ok(p.voorbehoud.includes('geen juridisch volledige checklist'),
    'wie een lijst afvinkt die zich compleet voordoet, controleert daarna niets meer');
  assert.ok(p.voorbehoud.includes('gemeente'));
});

/* ---------------- 2. afvinken ---------------- */

test('afvinken telt, en een verzonnen stap wordt geweigerd', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  const eerste = K.ondernemingOprichting(o).stappen[0];

  const na = K.ondernemingOprichtingZet(o, eerste.id, true);
  assert.equal(na.gedaan, 1);
  assert.equal(na.stappen.find(s => s.id === eerste.id).klaar, true);
  assert.ok(na.stappen.find(s => s.id === eerste.id).at, 'met de datum erbij');

  assert.equal(K.ondernemingOprichtingZet(o, 'rechtsvorm:iets-verzonnen', true).status, 404,
    'een id uit het lichaam is geen bewijs dat de stap bestaat');
  assert.equal(K.ondernemingOprichting(o).gedaan, 1, 'en er is niets bijgekomen');

  assert.equal(K.ondernemingOprichtingZet(o, eerste.id, false).gedaan, 0, 'weer afvinken kan ook');
});

test('afvinken kan niet zonder rechtsvorm', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  assert.equal(K.ondernemingOprichtingZet(o, 'rechtsvorm:van-alles', true).status, 409);
});

test('alles afgevinkt geeft de status compleet', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  for (const s of K.ondernemingOprichting(o).stappen) K.ondernemingOprichtingZet(o, s.id, true);
  const p = K.ondernemingOprichting(o);
  assert.equal(p.stand, 'compleet');
  assert.equal(p.gedaan, p.totaal);
});

/* ---------------- 3. de aanvraag: geen tweede deur ---------------- */

function tot(K, o) {   // tot en met de inschrijving
  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  const v = K.ondernemingVerkenning(o);
  K.ondernemingPlanVastleggen(o, v.plan, v.stress, { tochDoorzetten: true });
  K.ondernemingIngeschreven(o, '12345678');
}

test('de aanvraag maakt GEEN zaak maar een aanmelding voor een mens', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  tot(K, o);
  const r = K.ondernemingAanvraag(o, 'user-1', { naam: 'Aisha', contact: 'a@b.nl' });
  assert.ok(r.ok);
  assert.equal(K._zaken.length, 0, 'er is geen enkele supplier aangemaakt');
  assert.equal(K._aanm.ontvangen.length, 1, 'wel een aanmelding');
  assert.equal(K._aanm.ontvangen[0].status, 'in behandeling');
  assert.equal(K._aanm.ontvangen[0].accountId, 'user-1', 'met het account uit de sessie');
  assert.ok(r.uitleg.includes('kennen zelf geen toegang toe'));
  assert.equal(K.ondernemingBeeld(o).zaak, null, 'en de onderneming heeft nog geen zaak');
});

test('de aanvraag draagt de intake en de openstaande stappen mee', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  tot(K, o);
  K.ondernemingAanvraag(o, 'user-1', { naam: 'Aisha' });
  const b = K._aanm.ontvangen[0].bedrijf;
  assert.equal(b.type, 'restaurant', 'de branche uit de intake');
  assert.equal(b.plaats, 'Haarlem');
  assert.equal(b.naam, 'Proef');
  assert.ok(b.behoeften.length > 0 && b.behoeften.length <= 8,
    'de nog openstaande oprichtingsstappen gaan mee als wensen voor de nieuwe zaak');
  assert.ok(b.behoeften.some(x => x.includes('Alcoholvergunning')));
});

test('de aanvraag weigert zolang er geen vastgelegd plan is, en dubbel aanvragen kan niet', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  assert.equal(K.ondernemingAanvraag(o, 'u', {}).status, 409, 'zonder plan geen aanvraag');
  assert.equal(K._aanm.ontvangen.length, 0);

  tot(K, o);
  assert.ok(K.ondernemingAanvraag(o, 'u', { naam: 'A' }).ok);
  assert.equal(K.ondernemingAanvraag(o, 'u', { naam: 'A' }).status, 409, 'en niet twee keer');
  assert.equal(K._aanm.ontvangen.length, 1);
});

test('zodra de zaak echt bestaat, koppelt de stand hem aan de onderneming', () => {
  const K = stubKern();
  const o = klaarVoorOprichting(K);
  tot(K, o);
  K.ondernemingAanvraag(o, 'u', { naam: 'A' });

  assert.equal(K.ondernemingAanvraagStand(o).stand, 'in behandeling');
  assert.equal(K.ondernemingBeeld(o).zaak, null);

  // het personeel accepteert en de bestaande provisioning zet de zaak klaar
  K._zaken.push({ code: 'PROEF', name: 'Proef', type: 'restaurant', staff: [{ id: 1 }] });
  K._aanm.ontvangen[0].status = 'geaccepteerd';
  K._aanm.ontvangen[0].gezaakt = { code: 'PROEF' };

  const stand = K.ondernemingAanvraagStand(o);
  assert.equal(stand.stand, 'gekoppeld');
  assert.equal(K.ondernemingBeeld(o).zaak.code, 'PROEF');
  assert.equal(K.ondernemingNaam(o), 'Proef', 'en vanaf nu is de zaak de naam');
});

/* ---------------- 4. de poort op de routes ---------------- */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-opr-'));
let BASE, child;
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
});

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de oprichting en de aanvraag van een ander zijn niet te bereiken', async () => {
  const reg = async (naam, email) => (await (await post('/api/auth/register', {
    name: naam, email, phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg' })).json()).token;
  const a = await reg('Bram', 'bram.opr@example.com');
  const b = await reg('Chloe', 'chloe.opr@example.com');
  const mijne = (await (await post('/api/onderneming/nieuw', { naam: 'Bram Bouwt' }, a)).json()).onderneming;

  const eigen = await post('/api/onderneming/oprichting', { id: mijne.id }, a);
  assert.equal(eigen.status, 200, 'de eigenaar komt erbij, anders bewijst de 404 hieronder niets');

  for (const pad of ['/api/onderneming/oprichting', '/api/onderneming/oprichting/zet',
    '/api/onderneming/aanvraag', '/api/onderneming/aanvraag/stand']) {
    const r = await post(pad, { id: mijne.id, stap: 'x', naam: 'C' }, b);
    assert.equal(r.status, 404, pad + ' laat een vreemde erbij');
  }
});
