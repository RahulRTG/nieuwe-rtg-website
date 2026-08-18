/* Ronde: de debiteuren -- wat er nog open staat, en hoe lang al.

   Vier beweringen:

   1. DE GESCHIEDENIS TELT ALS BETAALD. Facturen van voor deze laag dragen geen
      betaalstatus. Zou "geen veld" als open gelden, dan stond morgen alles wat
      ooit gefactureerd is op de debiteurenlijst -- een alarm dat niets betekent
      en daarom binnen een week niet meer gelezen wordt.
   2. DE GROEPEN ZIJN GETELD, NIET GEWOGEN. Er komt geen risicoscore uit: wij
      zien alleen deze zaak, niet het betaalgedrag van die klant elders.
   3. ALLEEN DE VERKOPER BOEKT AF. Een koper die zijn eigen factuur op betaald
      zet, is geen betaling maar een bewering.
   4. WAT NOG LOOPT IS GEEN ACTIE. Alleen vervallen posten komen op het
      dagbeeld; een lopende factuur is de normale gang van zaken.

   Draai los: node --test test/onderneming-debiteuren.test.js */
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
const DEB = require('../server/kern/onderneming/debiteuren');

const DAG = 86400000;
const NU = Date.parse('2026-06-15T12:00:00Z');
const dag = (n) => new Date(NU + n * DAG).toISOString().slice(0, 10);

/* Een factuur zoals de facturatie-motor hem neerzet. */
function factuur(over) {
  return Object.assign({
    id: 'f' + Math.random().toString(16).slice(2, 8), nummer: '2026-001',
    verkoper: { code: 'GLAS', naam: 'Glas' },
    koper: { codenaam: 'Reiger', naam: 'Klant' },
    totaal: 100, datum: dag(-30), at: new Date(NU - 30 * DAG).toISOString(),
    betaald: false, betaaltermijn: 14, vervaldatum: dag(-16)
  }, over || {});
}

function stubKern(facturen) {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'R', price: 1 }],
    boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [],
    facturen: facturen || [],
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
  K._zaak = zaak;
  return K;
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (koppel !== false) K.ondernemingKoppel(o, 'GLAS', MIJN_ZAAK);
  return o;
}

/* ---------------- de grandfathering ---------------- */

test('facturen zonder betaalstatus tellen als betaald en niet als open', () => {
  const oud = { id: 'oud1', nummer: '2019-1', verkoper: { code: 'GLAS' }, koper: { codenaam: 'X' },
    totaal: 5000, datum: '2019-01-01', at: '2019-01-01T00:00:00.000Z' };  // geen `betaald`
  const K = stubKern([oud]);
  const d = K.ondernemingDebiteuren(ond(K), NU);
  assert.equal(d.aantal, 0, 'anders stond morgen alles wat ooit gefactureerd is op de lijst');
  assert.equal(d.bedrag, 0);
});

test('alleen facturen die uitdrukkelijk onbetaald zijn tellen mee', () => {
  const K = stubKern([factuur({ betaald: false, totaal: 100 }), factuur({ betaald: true, totaal: 900 })]);
  const d = K.ondernemingDebiteuren(ond(K), NU);
  assert.equal(d.aantal, 1);
  assert.equal(d.bedrag, 100);
});

test('facturen van een andere zaak tellen niet mee', () => {
  const K = stubKern([factuur(), factuur({ verkoper: { code: 'ANDER' }, totaal: 999 })]);
  assert.equal(K.ondernemingDebiteuren(ond(K), NU).bedrag, 100);
});

/* ---------------- de ouderdomsgroepen ---------------- */

test('elke post valt in precies een groep, op dagen over de vervaldatum', () => {
  const K = stubKern([
    factuur({ vervaldatum: dag(5), totaal: 10 }),     // loopt nog
    factuur({ vervaldatum: dag(-3), totaal: 20 }),    // 3 dagen over
    factuur({ vervaldatum: dag(-20), totaal: 30 }),   // 20 dagen over
    factuur({ vervaldatum: dag(-45), totaal: 40 }),   // 45 dagen over
    factuur({ vervaldatum: dag(-200), totaal: 50 })   // 200 dagen over
  ]);
  const d = K.ondernemingDebiteuren(ond(K), NU);
  const g = Object.fromEntries(d.groepen.map(x => [x.id, x]));
  assert.deepEqual([g.loopt.aantal, g.net.aantal, g.lang.aantal, g.zeer.aantal, g.oud.aantal], [1, 1, 1, 1, 1]);
  assert.equal(g.oud.bedrag, 50);
  assert.equal(d.aantal, 5, 'alles staat open');
  assert.equal(d.vervallenAantal, 4, 'maar wat nog loopt is niet vervallen');
  assert.equal(d.vervallenBedrag, 140);
});

test('de grensgevallen vallen aan de goede kant', () => {
  assert.equal(DEB.groepVan(0), 'loopt', 'op de vervaldag zelf loopt hij nog');
  assert.equal(DEB.groepVan(1), 'net');
  assert.equal(DEB.groepVan(14), 'net');
  assert.equal(DEB.groepVan(15), 'lang');
  assert.equal(DEB.groepVan(30), 'lang');
  assert.equal(DEB.groepVan(31), 'zeer');
  assert.equal(DEB.groepVan(60), 'zeer');
  assert.equal(DEB.groepVan(61), 'oud');
});

test('een factuur zonder vervaldatum wordt apart geteld, niet in de jongste groep gegooid', () => {
  const K = stubKern([factuur({ vervaldatum: null, totaal: 70 })]);
  const d = K.ondernemingDebiteuren(ond(K), NU);
  assert.equal(d.zonderVervaldatum, 1);
  assert.equal(d.groepen.find(g => g.id === 'loopt').aantal, 0,
    'niets weten is iets anders dan "loopt nog"');
  assert.equal(d.vervallenAantal, 0);
  assert.equal(d.aantal, 1, 'hij staat wel gewoon open');
});

test('de oudste post wordt apart genoemd', () => {
  const K = stubKern([
    factuur({ vervaldatum: dag(-5), totaal: 10 }),
    factuur({ vervaldatum: dag(-90), totaal: 20 }),
    factuur({ vervaldatum: dag(-30), totaal: 30 })
  ]);
  const d = K.ondernemingDebiteuren(ond(K), NU);
  assert.equal(d.oudste.dagenOver, 90, 'een klein bedrag van drie maanden oud zegt meer dan het totaal');
  assert.equal(d.posten[0].dagenOver, 90, 'en de lijst staat op ouderdom');
});

test('de post draagt de codenaam en niet de naam', () => {
  const K = stubKern([factuur({ koper: { codenaam: 'Reiger', naam: 'Jan Jansen' } })]);
  const p = K.ondernemingDebiteuren(ond(K), NU).posten[0];
  assert.equal(p.klant, 'Reiger', 'de debiteurenlijst is bij uitstek de plek waar een echte naam zou opduiken');
});

test('zonder zaak zijn er geen debiteuren, en geen lege lijst', () => {
  const K = stubKern([]);
  assert.equal(K.ondernemingDebiteuren(ond(K, false), NU), null);
});

/* ---------------- de opvolging ---------------- */

test('wat nog loopt is geen actie; wat vervallen is wel', () => {
  const loopt = stubKern([factuur({ vervaldatum: dag(5) })]);
  assert.equal(DEB.debiteurenOpvolging(loopt.ondernemingDebiteuren(ond(loopt), NU)), null,
    'een lopende factuur is de normale gang van zaken');

  const K = stubKern([factuur({ vervaldatum: dag(-40), totaal: 250 })]);
  const v = DEB.debiteurenOpvolging(K.ondernemingDebiteuren(ond(K), NU));
  assert.equal(v.aantal, 1);
  assert.ok(v.kop.includes('250 euro'));
  assert.ok(v.waarom.includes('40 dagen'));
});

test('het dagbeeld zet vervallen facturen boven de rest van de opvolging', () => {
  const K = stubKern([factuur({ vervaldatum: dag(-40) })]);
  K._zaak.boekingen = [{ customerCodename: 'A', status: 'aangevraagd', at: new Date(NU).toISOString() }];
  const d = K.ondernemingDagbeeld(ond(K));
  const iDeb = d.acties.findIndex(a => a.id === 'debiteuren');
  const iOpv = d.acties.findIndex(a => a.id === 'opvolging:aanvragen');
  assert.ok(iDeb >= 0 && iOpv >= 0, 'allebei staan er');
  assert.ok(iDeb < iOpv, 'al verdiend geld gaat voor werk dat nog moet komen');
  assert.ok(d.debiteuren, 'en het beeld hangt aan het dagbeeld');
});

/* ---------------- afboeken ---------------- */

test('alleen de verkoper kan een factuur afboeken', () => {
  const { maakFacturatie } = require('../server/kern/facturatie');
  const data = { facturen: [factuur({ id: 'f1' })], factuurTeller: 1, suppliers: [] };
  const F = maakFacturatie({ db: { data }, save: () => {}, crypto: require('crypto'),
    findSupplier: () => null, schoon: (v, n) => String(v == null ? '' : v).slice(0, n) });

  assert.equal(F.factuurBetaald('f1', 'ANDER', true).status, 403,
    'een koper die zijn eigen factuur op betaald zet, is geen betaling maar een bewering');
  assert.equal(data.facturen[0].betaald, false, 'en er is niets gewijzigd');

  const ok = F.factuurBetaald('f1', 'GLAS', true);
  assert.equal(ok.ok, true);
  assert.equal(data.facturen[0].betaald, true);
  assert.ok(data.facturen[0].betaaldAt, 'met het moment erbij');

  assert.equal(F.factuurBetaald('f1', 'GLAS', true).ongewijzigd, true, 'nogmaals afboeken is een no-op');
  assert.equal(F.factuurBetaald('f1', 'GLAS', false).betaald, false, 'terugdraaien mag: een vergissing hoort herstelbaar');
  assert.equal(data.facturen[0].betaaldAt, null);
  assert.equal(F.factuurBetaald('bestaatniet', 'GLAS', true).status, 404);
});
