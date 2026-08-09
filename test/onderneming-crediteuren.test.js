/* Ronde: de crediteuren -- wat er nog uit moet, en wanneer.

   Vier beweringen:

   1. HET REKENWERK IS GEDEELD, DE TEKSTEN NIET. Debiteuren en crediteuren
      gebruiken dezelfde ouderdomsgrenzen (kern/onderneming/ouderdom.js), maar
      het advies verschilt: bij een debiteur bel je de klant, bij een crediteur
      dreigt de levering stil te vallen.
   2. HET IS DE SPIEGEL, OP DEZELFDE FACTUREN. Wat aan de ene kant uitgaand is,
      is aan de andere kant inkomend -- uit een en dezelfde factuurlijst.
   3. DE VOORUITBLIK IS EEN OPTELSOM, GEEN PROGNOSE. Alleen wat er nu ligt, en
      alleen met een vervaldatum.
   4. DE ASYMMETRIE STAAT ERBIJ. Alleen de verkoper boekt af; de koper kan zijn
      eigen post niet wegstrepen. Dat is ongemakkelijk, en het staat in het
      antwoord in plaats van dat iemand denkt dat de lijst kapot is.

   Draai los: node --experimental-sqlite --test test/onderneming-crediteuren.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakOnderneming = require('../server/kern/onderneming');
const CRED = require('../server/kern/onderneming/crediteuren');
const DEB = require('../server/kern/onderneming/debiteuren');
const OUD = require('../server/kern/onderneming/ouderdom');

const DAG = 86400000;
const NU = Date.parse('2026-06-15T12:00:00Z');
const dag = (n) => new Date(NU + n * DAG).toISOString().slice(0, 10);

/* Een factuur die MIJN zaak heeft ontvangen (ik ben de koper). */
function inkomend(over) {
  return Object.assign({
    id: 'f' + Math.random().toString(16).slice(2, 8), nummer: 'L-001',
    verkoper: { code: 'LEV', naam: 'Groothandel Noord' },
    koper: { supplierCode: 'GLAS', codenaam: null, naam: 'Glas' },
    totaal: 200, datum: dag(-30), at: new Date(NU - 30 * DAG).toISOString(),
    betaald: false, betaaltermijn: 14, vervaldatum: dag(-16)
  }, over || {});
}

/* Een factuur die MIJN zaak heeft verstuurd (ik ben de verkoper). */
function uitgaand(over) {
  return Object.assign({
    id: 'g' + Math.random().toString(16).slice(2, 8), nummer: 'V-001',
    verkoper: { code: 'GLAS', naam: 'Glas' },
    koper: { supplierCode: null, codenaam: 'Reiger', naam: 'Klant' },
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
  if (koppel !== false) K.ondernemingKoppel(o, 'GLAS');
  return o;
}

/* ---------------- de spiegel ---------------- */

test('dezelfde factuurlijst levert aan beide kanten iets anders op', () => {
  const K = stubKern([inkomend({ totaal: 200 }), uitgaand({ totaal: 100 })]);
  const o = ond(K);
  const d = K.ondernemingDebiteuren(o, NU);
  const c = K.ondernemingCrediteuren(o, NU);
  assert.equal(d.aantal, 1); assert.equal(d.bedrag, 100, 'wat ik nog moet krijgen');
  assert.equal(c.aantal, 1); assert.equal(c.bedrag, 200, 'wat ik nog moet betalen');
  assert.equal(c.posten[0].leverancier, 'Groothandel Noord', 'aan deze kant is de tegenpartij de leverancier');
});

test('facturen waar ik noch koper noch verkoper ben tellen nergens mee', () => {
  const vreemd = inkomend({ koper: { supplierCode: 'ANDER' }, totaal: 999 });
  const K = stubKern([vreemd]);
  const o = ond(K);
  assert.equal(K.ondernemingCrediteuren(o, NU).aantal, 0);
  assert.equal(K.ondernemingDebiteuren(o, NU).aantal, 0);
});

test('de geschiedenis telt ook hier als betaald', () => {
  const oud = { id: 'o1', nummer: 'L-oud', verkoper: { code: 'LEV', naam: 'Lev' },
    koper: { supplierCode: 'GLAS' }, totaal: 4000, datum: '2019-01-01' };  // geen `betaald`
  const K = stubKern([oud]);
  assert.equal(K.ondernemingCrediteuren(ond(K), NU).aantal, 0,
    'anders springt alles wat ooit is ingekocht in een keer op de lijst');
});

/* ---------------- gedeeld rekenwerk, eigen teksten ---------------- */

test('de groepsgrenzen zijn aan beide kanten dezelfde', () => {
  const K = stubKern([
    inkomend({ vervaldatum: dag(5), totaal: 10 }),
    inkomend({ vervaldatum: dag(-3), totaal: 20 }),
    inkomend({ vervaldatum: dag(-20), totaal: 30 }),
    inkomend({ vervaldatum: dag(-45), totaal: 40 }),
    inkomend({ vervaldatum: dag(-200), totaal: 50 })
  ]);
  const g = Object.fromEntries(K.ondernemingCrediteuren(ond(K), NU).groepen.map(x => [x.id, x]));
  assert.deepEqual([g.loopt.aantal, g.net.aantal, g.lang.aantal, g.zeer.aantal, g.oud.aantal], [1, 1, 1, 1, 1]);
  // en de kern die dat doet is er maar een
  assert.equal(DEB.groepVan, OUD.groepVan, 'de debiteuren gebruiken dezelfde functie');
  assert.equal(OUD.groepVan(15), 'lang');
});

test('de teksten verschillen wel, want het advies is een ander', () => {
  const K = stubKern([inkomend({ vervaldatum: dag(-45) })]);
  const c = K.ondernemingCrediteuren(ond(K), NU);
  const zeer = c.groepen.find(g => g.id === 'zeer');
  assert.ok(zeer.wat.includes('levering stilvalt'), 'bij een crediteur dreigt de levering');
  assert.ok(DEB.TEKSTEN.zeer.wat.includes('regeling') && !DEB.TEKSTEN.zeer.wat.includes('levering stilvalt'),
    'bij een debiteur gaat het over incasseren');
  assert.notEqual(CRED.TEKSTEN.net.wat, DEB.TEKSTEN.net.wat);
});

/* ---------------- de vooruitblik ---------------- */

test('de vooruitblik telt alleen op wat er nu ligt, met een vervaldatum', () => {
  const K = stubKern([
    inkomend({ vervaldatum: dag(3), totaal: 100 }),    // deze week
    inkomend({ vervaldatum: dag(20), totaal: 200 }),   // deze maand
    inkomend({ vervaldatum: dag(60), totaal: 400 }),   // later
    inkomend({ vervaldatum: dag(-10), totaal: 50 }),   // al te laat: telt in beide
    inkomend({ vervaldatum: null, totaal: 999 })       // onbekend: telt nergens
  ]);
  const v = K.ondernemingCrediteuren(ond(K), NU).vooruit;
  assert.equal(v.week.aantal, 2, 'deze week: de post van over 3 dagen en de al vervallen post');
  assert.equal(v.week.bedrag, 150);
  assert.equal(v.maand.aantal, 3);
  assert.equal(v.maand.bedrag, 350, 'de post van over 60 dagen valt erbuiten');
});

test('een post zonder vervaldatum wordt apart geteld en niet ingedeeld', () => {
  const K = stubKern([inkomend({ vervaldatum: null, totaal: 999 })]);
  const c = K.ondernemingCrediteuren(ond(K), NU);
  assert.equal(c.zonderVervaldatum, 1);
  assert.equal(c.aantal, 1, 'hij staat wel open');
  assert.equal(c.vervallenAantal, 0);
  assert.equal(c.groepen.find(g => g.id === 'loopt').aantal, 0, 'niets weten is geen "loopt nog"');
});

/* ---------------- de asymmetrie ---------------- */

test('de koper kan zijn eigen post niet wegstrepen, en dat staat erbij', () => {
  const { maakFacturatie } = require('../server/kern/facturatie');
  const f = inkomend({ id: 'f1' });
  const data = { facturen: [f], factuurTeller: 1, suppliers: [] };
  const F = maakFacturatie({ db: { data }, save: () => {}, crypto: require('crypto'),
    findSupplier: () => null, schoon: (v, n) => String(v == null ? '' : v).slice(0, n) });

  assert.equal(F.factuurBetaald('f1', 'GLAS', true).status, 403,
    'GLAS is hier de KOPER; alleen de verkoper ziet of het geld binnen is');
  assert.equal(data.facturen[0].betaald, false);
  assert.equal(F.factuurBetaald('f1', 'LEV', true).ok, true, 'de leverancier kan het wel');

  const K = stubKern([inkomend()]);
  assert.ok(K.ondernemingCrediteuren(ond(K), NU).voorbehoud.includes('afgeboekt door de verkoper'),
    'de lijst legt zelf uit waarom een betaalde post er nog staat');
});

/* ---------------- het dagbeeld ---------------- */

test('binnenkomend geld gaat voor uitgaand geld op het dagbeeld', () => {
  const K = stubKern([
    uitgaand({ vervaldatum: dag(-40) }),   // zij zijn mij te laat
    inkomend({ vervaldatum: dag(-40) })    // ik ben hen te laat
  ]);
  const d = K.ondernemingDagbeeld(ond(K));
  const iDeb = d.acties.findIndex(a => a.id === 'debiteuren');
  const iCred = d.acties.findIndex(a => a.id === 'crediteuren');
  assert.ok(iDeb >= 0 && iCred >= 0, 'allebei staan er');
  assert.ok(iDeb < iCred, 'wat binnenkomt betaalt wat eruit moet');
  assert.ok(d.crediteuren, 'en het beeld hangt aan het dagbeeld');
});

test('wat netjes loopt is geen actie', () => {
  const K = stubKern([inkomend({ vervaldatum: dag(10) })]);
  const c = K.ondernemingCrediteuren(ond(K), NU);
  assert.equal(c.aantal, 1, 'de post staat wel open');
  assert.equal(CRED.crediteurenOpvolging(c), null, 'maar op tijd betalen is de gewone gang van zaken');
  assert.ok(!K.ondernemingDagbeeld(ond(K)).acties.some(a => a.id === 'crediteuren'));
});

test('zonder zaak zijn er geen crediteuren, en geen lege lijst', () => {
  const K = stubKern([]);
  assert.equal(K.ondernemingCrediteuren(ond(K, false), NU), null);
});
