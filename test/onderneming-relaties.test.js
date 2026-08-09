/* Ronde: het klantenboek en de relaties -- het CRM van het Ondernemers-OS.

   Vier beweringen:

   1. ER IS ÉÉN KLANTENBOEK. Het stond in Vakwerk en gold alleen voor de
      vakgenres; het staat nu in kern/klantenboek.js en geldt voor elke zaak.
      Vakwerk gebruikt diezelfde. Twee boeken lopen uiteen (lat-regel 4).
   2. BONNEN TELLEN MEE. Wie bij dezelfde zaak at maar niet boekte, bestond in
      het oude boek niet.
   3. DE SEGMENTEN ZIJN GETELD, NIET GERADEN, en de opvolging rust op dingen
      die er echt staan -- geen enkele regel is een herinnering die wij hebben
      verzonnen.
   4. ALLES OP CODENAAM. Een CRM is precies de plek waar die regel stilletjes
      zou sneuvelen.

   Draai los: node --experimental-sqlite --test test/onderneming-relaties.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakOnderneming = require('../server/kern/onderneming');
const maakKlantenboek = require('../server/kern/klantenboek');
const REL = require('../server/kern/onderneming/relaties');

const DAG = 86400000;
const NU = Date.parse('2026-06-15T12:00:00Z');
const dagenTerug = (n) => new Date(NU - n * DAG).toISOString();

function stubKern(zaken, offertes) {
  const lijst = zaken || [];
  const data = { ondernemingen: [], suppliers: lijst, posts: [],
    vakOffertes: offertes || [], vakKlantNotities: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => lijst.find(z => z.code === code) || null,
    ordersVanZaak: (code) => (lijst.find(z => z.code === code) || {}).orders || [],
    boekingenVanZaak: (code) => (lijst.find(z => z.code === code) || {}).boekingen || [],
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
  K._db = db;
  return K;
}

function zaak(over) {
  return Object.assign({
    code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' },
    services: [{ id: 's', name: 'Ramen', price: 120 }],
    boekingen: [], orders: []
  }, over || {});
}

function ondMet(K, z) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (z) K.ondernemingKoppel(o, z.code);
  return o;
}

/* ---------------- het gedeelde klantenboek ---------------- */

test('het klantenboek telt boekingen EN bonnen, op codenaam', () => {
  const z = zaak({
    boekingen: [{ customerCodename: 'Reiger', status: 'bevestigd', paid: true, price: 100, at: dagenTerug(10) }],
    orders: [{ customerCodename: 'Wilg', paid: true, total: 40, at: dagenTerug(5) }]
  });
  const K = stubKern([z]);
  const r = K.ondernemingRelaties(ondMet(K, z), NU);
  assert.equal(r.totaal, 2, 'wie at maar niet boekte, is ook een klant');
  assert.equal(r.omzetTotaal, 140);
});

test('dezelfde codenaam is een klant, en wachten op betaling telt niet', () => {
  const z = zaak({ boekingen: [
    { customerCodename: 'Reiger', status: 'bevestigd', paid: true, price: 100, at: dagenTerug(30) },
    { customerCodename: 'Reiger', status: 'bevestigd', paid: true, price: 100, at: dagenTerug(10) },
    { customerCodename: 'Els', status: 'wacht-op-betaling', price: 500, at: dagenTerug(2) }
  ] });
  const K = stubKern([z]);
  const r = K.ondernemingRelaties(ondMet(K, z), NU);
  assert.equal(r.totaal, 1, 'een voornemen is geen klant');
  assert.equal(r.top[0].aantal, 2);
  assert.equal(r.top[0].omzet, 200);
  assert.equal(r.top[0].laatste, dagenTerug(10).slice(0, 10), 'de laatste keer is de meest recente');
  assert.equal(r.top[0].eerste, dagenTerug(30).slice(0, 10));
});

test('Vakwerk gebruikt hetzelfde boek en houdt er geen eigen op na', () => {
  const bron = require('fs').readFileSync('server/kern/vakwerk/pro2.js', 'utf8');
  assert.ok(bron.includes("require('../klantenboek')"), 'pro2 haalt het boek op');
  assert.ok(!/function klantenboek\s*\(/.test(bron),
    'en heeft geen eigen implementatie meer -- twee boeken lopen uiteen');
});

test('de notitie hoort bij de codenaam en is te wissen', () => {
  const z = zaak({ boekingen: [{ customerCodename: 'Reiger', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(3) }] });
  const K = stubKern([z]);
  const o = ondMet(K, z);
  assert.equal(K.ondernemingKlantNotitie('GLAS', { codenaam: 'Reiger', tekst: 'Belt liever s ochtends' }).ok, true);
  assert.equal(K.ondernemingRelaties(o, NU).top[0].notitie, 'Belt liever s ochtends');

  K.ondernemingKlantNotitie('GLAS', { codenaam: 'Reiger', tekst: '' });
  assert.equal(K.ondernemingRelaties(o, NU).top[0].notitie, null, 'leeg is wissen');
  assert.equal(K.ondernemingKlantNotitie('GLAS', { tekst: 'x' }).status, 400, 'zonder codenaam geen notitie');
});

/* ---------------- de segmenten ---------------- */

test('nieuw, terugkerend en stilgevallen worden geteld en niet geraden', () => {
  const z = zaak({ boekingen: [
    // eenmalig, recent
    { customerCodename: 'A', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(5) },
    // terugkerend, recent
    { customerCodename: 'B', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(40) },
    { customerCodename: 'B', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(5) },
    // terugkerend, maar lang weg
    { customerCodename: 'C', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(400) },
    { customerCodename: 'C', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(300) }
  ] });
  const K = stubKern([z]);
  const r = K.ondernemingRelaties(ondMet(K, z), NU);
  assert.equal(r.segmenten.nieuw.aantal, 1);
  assert.equal(r.segmenten.terugkerend.aantal, 2);
  assert.equal(r.segmenten.stilgevallen.aantal, 1, 'alleen C is lang weg');
  assert.equal(r.herhaalaandeel, 67, 'twee van de drie kwamen terug');
});

test('een eenmalige klant die lang niet kwam is niet stilgevallen', () => {
  const z = zaak({ boekingen: [
    { customerCodename: 'Eenmalig', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(500) }
  ] });
  const K = stubKern([z]);
  const r = K.ondernemingRelaties(ondMet(K, z), NU);
  assert.equal(r.segmenten.stilgevallen.aantal, 0,
    'bij een eenmalige klant is stilte normaal; dat verwijt slaat nergens op');
  assert.ok(!r.opvolging.some(v => v.id === 'stil'));
});

/* ---------------- de opvolging ---------------- */

test('openstaande aanvragen komen op de opvolging', () => {
  const z = zaak({ boekingen: [
    { customerCodename: 'A', status: 'aangevraagd', at: dagenTerug(1) },
    { customerCodename: 'B', status: 'aangevraagd', at: dagenTerug(2) }
  ] });
  const K = stubKern([z]);
  const v = K.ondernemingRelaties(ondMet(K, z), NU).opvolging.find(x => x.id === 'aanvragen');
  assert.equal(v.aantal, 2);
  assert.ok(v.kop.includes('2 aanvragen'));
});

test('offertes die te lang liggen worden apart genoemd', () => {
  const z = zaak();
  const offertes = [
    { supplierCode: 'GLAS', status: 'aangevraagd', at: dagenTerug(1) },
    { supplierCode: 'GLAS', status: 'aangevraagd', at: dagenTerug(20) },
    { supplierCode: 'GLAS', status: 'beantwoord', at: dagenTerug(30) },
    { supplierCode: 'ANDER', status: 'aangevraagd', at: dagenTerug(30) }
  ];
  const K = stubKern([z], offertes);
  const v = K.ondernemingRelaties(ondMet(K, z), NU).opvolging.find(x => x.id === 'offertes');
  assert.equal(v.aantal, 2, 'alleen de eigen, nog onbeantwoorde offertes');
  assert.ok(v.kop.includes('1 langer dan ' + REL.OFFERTE_DAGEN),
    'en de te oude wordt apart genoemd');
  assert.ok(v.waarom.includes('drie andere'), 'met waarom dat erg is');
});

test('stilgevallen vaste klanten komen met codenaam op de opvolging', () => {
  const z = zaak({ boekingen: [
    { customerCodename: 'C', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(400) },
    { customerCodename: 'C', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(300) }
  ] });
  const K = stubKern([z]);
  const v = K.ondernemingRelaties(ondMet(K, z), NU).opvolging.find(x => x.id === 'stil');
  assert.deepEqual(v.codenamen, ['C'], 'op codenaam, en niet op naam');
});

test('een rustige zaak krijgt geen verzonnen opvolging', () => {
  const z = zaak({ boekingen: [
    { customerCodename: 'A', status: 'bevestigd', paid: true, price: 10, at: dagenTerug(3) }
  ] });
  const K = stubKern([z]);
  assert.deepEqual(K.ondernemingRelaties(ondMet(K, z), NU).opvolging, [],
    'niets te doen is ook een uitkomst; verzonnen herinneringen zijn spam');
});

test('zonder zaak zijn er geen relaties, en geen lege segmenten', () => {
  const K = stubKern();
  assert.equal(K.ondernemingRelaties(ondMet(K), NU), null,
    'lege segmenten lezen als "u heeft geen klanten" in plaats van "u heeft geen zaak"');
});

/* ---------------- het dagbeeld ---------------- */

test('de opvolging gaat voor de Mall-pagina en vervangt de losse aanvragen-actie', () => {
  const z = zaak({ salon: { bio: 'kort' }, photos: [],
    boekingen: [{ customerCodename: 'A', status: 'aangevraagd', at: dagenTerug(1) }] });
  const K = stubKern([z]);
  const d = K.ondernemingDagbeeld(ondMet(K, z));
  const iOpv = d.acties.findIndex(a => a.id === 'opvolging:aanvragen');
  const iMall = d.acties.findIndex(a => a.id === 'mallprofiel');
  assert.ok(iOpv >= 0 && iMall >= 0);
  assert.ok(iOpv < iMall, 'geld dat al binnen handbereik ligt gaat voor een mooiere pagina');
  assert.equal(d.acties.filter(a => /aanvragen/.test(a.id)).length, 1,
    'en de oude losse actie valt weg -- twee keer hetzelfde vragen leest als een storing');
  assert.ok(d.relaties, 'het relatiebeeld hangt aan het dagbeeld');
});
