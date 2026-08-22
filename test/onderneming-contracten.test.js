/* Ronde: de contractklok op het dagbeeld.

   Vier beweringen:

   1. ER WORDT GEEN TWEEDE REGISTER GEBOUWD. RTG Werk OS heeft de
      contractbibliotheek al; deze laag LEEST hem en schrijft niets. Ook de klok
      is gedeeld (server/bedrijf/contractklok.js) en niet overgetypt.
   2. GEEN WERKRUIMTE IS EEN EIGEN STAND, GEEN LEGE LIJST. Wie niets koppelde,
      heeft geen "nul contracten" maar een register dat wij niet zien -- en dat
      verschil hoort zichtbaar te zijn, anders leest het als "alles in orde".
   3. DE LAATSTE OPZEGDAG WORDT UITGEREKEND. Uit de einddatum en de
      opzegtermijn; hij staat nergens overgetypt.
   4. EEN GEMISTE OPZEGDAG GAAT VOOR EEN NADERENDE. De eerste is al gebeurd en
      kost een jaar; de tweede is nog te halen.

   Draai los: node --test test/onderneming-contracten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

const maakOnderneming = require('../server/kern/onderneming');
const CON = require('../server/kern/onderneming/contracten');
const KLOK = require('../server/bedrijf/contractklok');

const VANDAAG = '2026-06-15';
const DAG = 86400000;
const dag = (n) => new Date(Date.parse(VANDAAG) + n * DAG).toISOString().slice(0, 10);

function contract(over) {
  return Object.assign({
    id: 'c' + Math.random().toString(16).slice(2, 8), titel: 'Verzekering',
    wederpartij: 'Assurantie Noord', soort: 'verzekering', status: 'actief',
    eindigt: dag(60), opzegtermijnDagen: 30, stilzwijgend: true
  }, over || {});
}

function stubKern(contracten, werkruimteCode) {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'R', price: 1 }],
    boekingen: [], orders: [] };
  const wr = {};
  if (werkruimteCode !== null) {
    wr[werkruimteCode || 'WAB12'] = { code: werkruimteCode || 'WAB12', naam: 'Glas BV',
      contracten: Object.fromEntries((contracten || []).map(c => [c.id, c])) };
  }
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: wr,
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => (code === 'GLAS' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => zaak.boekingen,
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
  K._db = db;
  return K;
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  K.ondernemingKoppel(o, 'GLAS', MIJN_ZAAK);
  if (koppel) K.ondernemingWerkruimte(o, koppel);
  return o;
}

/* ---------------- geen tweede register ---------------- */

test('de klok is gedeeld met RTG Werk OS en niet overgetypt', () => {
  const bron = require('fs').readFileSync('server/bedrijf/contract.js', 'utf8');
  assert.ok(bron.includes("require('./contractklok')"), 'het Werk OS gebruikt de gedeelde klok');
  assert.ok(!/function klok\s*\(c\)\s*\{/.test(bron), 'en heeft geen eigen berekening meer');

  const eigen = require('fs').readFileSync('server/kern/onderneming/contracten.js', 'utf8');
  assert.ok(eigen.includes("require('../../bedrijf/contractklok')"), 'het Ondernemers-OS ook');
  assert.ok(!/laatsteOpzegdag\s*=/.test(eigen), 'en rekent de opzegdag niet zelf uit');
});

test('deze laag schrijft geen contracten', () => {
  const eigen = require('fs').readFileSync('server/kern/onderneming/contracten.js', 'utf8');
  for (const woord of ['contracten[', '.contracten =', 'delete w.contracten']) {
    assert.ok(!eigen.includes(woord), 'contracten worden hier niet geschreven: ' + woord);
  }
});

/* ---------------- geen werkruimte ---------------- */

test('zonder gekoppelde werkruimte is er een eigen stand, geen lege lijst', () => {
  const K = stubKern([contract()]);
  const c = K.ondernemingContracten(ond(K), VANDAAG);
  assert.equal(c.stand, 'geen-werkruimte');
  assert.equal(c.aantal, null, 'null en niet 0: wij weten het niet');
  assert.ok(c.let.includes('geen bevestiging dat er niets loopt'));
  assert.deepEqual(CON.contractenOpvolging(c), [], 'en zonder zicht geen beweringen op het dagbeeld');
});

test('een werkruimte die niet bestaat wordt geweigerd', () => {
  const K = stubKern([contract()]);
  const o = ond(K);
  assert.equal(K.ondernemingWerkruimte(o, 'WZZZZ').status, 404,
    'een code uit het lichaam is geen bewijs dat er iets achter zit');
  assert.equal(K.ondernemingContracten(o, VANDAAG).stand, 'geen-werkruimte');

  assert.equal(K.ondernemingWerkruimte(o, 'WAB12').ok, true);
  assert.equal(K.ondernemingContracten(o, VANDAAG).stand, 'gekoppeld');
  assert.equal(K.ondernemingWerkruimte(o, '').werkruimte, null, 'loskoppelen kan ook');
});

test('een werkruimte die verdwijnt geeft een eigen melding', () => {
  const K = stubKern([contract()], 'WAB12');
  const o = ond(K, 'WAB12');
  delete K._db.data.werkruimtes.WAB12;
  const c = K.ondernemingContracten(o, VANDAAG);
  assert.equal(c.stand, 'werkruimte-weg');
  assert.equal(c.aantal, null, 'ook hier: niet weten is geen nul');
});

/* ---------------- de klok ---------------- */

test('de laatste opzegdag wordt uitgerekend uit einddatum en opzegtermijn', () => {
  const K = stubKern([contract({ eindigt: dag(60), opzegtermijnDagen: 30 })], 'WAB12');
  const r = K.ondernemingContracten(ond(K, 'WAB12'), VANDAAG).contracten[0];
  assert.equal(r.laatsteOpzegdag, dag(30), '60 dagen tot het eind, 30 dagen opzegtermijn');
  assert.equal(r.dagenTotOpzegdag, 30);
  assert.equal(r.dagenTotEinde, 60);
  assert.equal(r.stand, 'opzegtermijn loopt af', 'precies op de grens van 30 dagen');
});

test('de standen volgen de datum', () => {
  const K = stubKern([
    contract({ id: 'a', eindigt: dag(365), opzegtermijnDagen: 30 }),   // loopt
    contract({ id: 'b', eindigt: dag(20), opzegtermijnDagen: 30 }),    // opzegdag voorbij
    contract({ id: 'c', eindigt: dag(-5), opzegtermijnDagen: 30 })     // verlopen
  ], 'WAB12');
  const c = K.ondernemingContracten(ond(K, 'WAB12'), VANDAAG);
  const per = Object.fromEntries(c.contracten.map(x => [x.id, x.stand]));
  assert.equal(per.a, 'loopt');
  assert.equal(per.b, 'stilzwijgend verlengd (opzegdag voorbij)');
  assert.equal(per.c, 'verlopen');
  assert.equal(c.verlopen, 1);
});

test('een contract zonder einddatum wordt apart geteld en niet als "loopt"', () => {
  const K = stubKern([contract({ eindigt: null })], 'WAB12');
  const c = K.ondernemingContracten(ond(K, 'WAB12'), VANDAAG);
  assert.equal(c.zonderEinddatum, 1);
  assert.equal(c.contracten[0].stand, 'zonder einddatum');
  assert.equal(c.binnenkortOpzeggen.length, 0);
  assert.equal(c.opzegdagVoorbij.length, 0);
});

test('alleen actieve contracten leveren aandacht op', () => {
  const K = stubKern([
    contract({ id: 'a', status: 'concept', eindigt: dag(20), opzegtermijnDagen: 30 }),
    contract({ id: 'b', status: 'opgezegd', eindigt: dag(20), opzegtermijnDagen: 30 })
  ], 'WAB12');
  const c = K.ondernemingContracten(ond(K, 'WAB12'), VANDAAG);
  assert.equal(c.opzegdagVoorbij.length, 0, 'een concept verlengt niet stilzwijgend');
  assert.equal(c.binnenkortOpzeggen.length, 0);
  assert.equal(c.aantal, 2, 'maar ze staan er wel');
});

test('de drie emmers sluiten elkaar uit', () => {
  const K = stubKern([
    contract({ id: 'voorbij', eindigt: dag(10), opzegtermijnDagen: 30 }),
    contract({ id: 'nadert', eindigt: dag(50), opzegtermijnDagen: 30 }),
    contract({ id: 'ver', eindigt: dag(400), opzegtermijnDagen: 30 })
  ], 'WAB12');
  const c = K.ondernemingContracten(ond(K, 'WAB12'), VANDAAG);
  assert.deepEqual(c.opzegdagVoorbij.map(x => x.id), ['voorbij']);
  assert.deepEqual(c.binnenkortOpzeggen.map(x => x.id), ['nadert']);
  const ids = c.opzegdagVoorbij.concat(c.binnenkortOpzeggen).map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, 'een contract staat in precies een emmer');
});

/* ---------------- de opvolging ---------------- */

test('een gemiste opzegdag gaat voor een naderende', () => {
  const K = stubKern([
    contract({ id: 'nadert', titel: 'Licentie', eindigt: dag(50), opzegtermijnDagen: 30 }),
    contract({ id: 'voorbij', titel: 'Verzekering', eindigt: dag(10), opzegtermijnDagen: 30 })
  ], 'WAB12');
  const v = CON.contractenOpvolging(K.ondernemingContracten(ond(K, 'WAB12'), VANDAAG));
  assert.equal(v.length, 2);
  assert.equal(v[0].id, 'opzegdag-voorbij', 'wat al gebeurd is en een jaar kost, staat boven');
  assert.ok(v[0].waarom.includes('Verzekering'));
  assert.equal(v[1].id, 'opzegdag-nadert');
  assert.ok(v[1].waarom.includes('20 dagen'), 'met hoeveel tijd er nog is');
});

test('rustige contracten leveren geen opvolging op', () => {
  const K = stubKern([contract({ eindigt: dag(400), opzegtermijnDagen: 30 })], 'WAB12');
  assert.deepEqual(CON.contractenOpvolging(K.ondernemingContracten(ond(K, 'WAB12'), VANDAAG)), []);
});

test('het dagbeeld zet de contractklok na het geld en voor de gewone opvolging', () => {
  const K = stubKern([contract({ id: 'voorbij', eindigt: dag(10), opzegtermijnDagen: 30 })], 'WAB12');
  K._db.data.suppliers[0].boekingen = [{ customerCodename: 'A', status: 'aangevraagd', at: VANDAAG }];
  const d = K.ondernemingDagbeeld(ond(K, 'WAB12'), Date.parse(VANDAAG + 'T12:00:00Z'));
  const iCon = d.acties.findIndex(a => a.id === 'contract:opzegdag-voorbij');
  const iOpv = d.acties.findIndex(a => a.id === 'opvolging:aanvragen');
  assert.ok(iCon >= 0 && iOpv >= 0, 'allebei staan er');
  assert.ok(iCon < iOpv, 'een gemiste opzegdag is niet meer te repareren, een klant terugbellen wel');
  assert.ok(d.contracten, 'en het beeld hangt aan het dagbeeld');
});

/* ---------------- de gedeelde klok, puur ---------------- */

test('de klok is te zetten, zodat hij te toetsen is', () => {
  const c = { eindigt: '2026-12-31', opzegtermijnDagen: 60, stilzwijgend: true };
  assert.equal(KLOK.klok(c, '2026-01-01').laatsteOpzegdag, '2026-11-01');
  assert.equal(KLOK.klok(c, '2026-11-02').stand, 'stilzwijgend verlengd (opzegdag voorbij)');
  assert.equal(KLOK.klok(c, '2027-01-01').stand, 'verlopen');
  assert.equal(KLOK.klok({}, '2026-01-01').stand, 'zonder einddatum');
});
