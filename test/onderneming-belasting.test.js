/* Ronde: de belastingreservering.

   Vier beweringen, en ze gaan alle vier over het verschil tussen een HARD
   getal en een INDICATIE:

   1. DE BTW IS GEEN SCHATTING. Wat u in rekening bracht min uw voorbelasting
      is een optelsom uit uw eigen facturen. Alleen dat getal levert een actie
      op het dagbeeld op.
   2. VOOR EEN RECHTSPERSOON WORDT ER NIETS UITGEREKEND. zzpBerekening is de
      inkomstenbelasting van een IB-ondernemer; datzelfde sommetje op een B.V.
      geeft een getal dat er goed uitziet en het niet is.
   3. EXTRAPOLATIE HEET EXTRAPOLATIE, en staat naast de reservering op wat er
      nu al staat.
   4. DE AANNAMES STAAN IN HET ANTWOORD, en waar wij iets niet weten kiezen we
      de kant die de reservering HOGER maakt.

   Draai los: node --test test/onderneming-belasting.test.js */
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
const BEL = require('../server/kern/onderneming/belasting');
const { zzpBerekening } = require('../server/kern/fiscaal');

/* Halverwege het jaar: 1 juli 2026 is dag 182 van 365. */
const NU = Date.parse('2026-07-01T12:00:00Z');

function factuur(over) {
  return Object.assign({
    id: 'f' + Math.random().toString(16).slice(2, 8), nummer: 'V-1',
    verkoper: { code: 'GLAS', naam: 'Glas' },
    koper: { supplierCode: null, codenaam: 'Reiger' },
    subtotaal: 1000, btwBedrag: 210, totaal: 1210,
    datum: '2026-03-01', at: '2026-03-01T10:00:00.000Z', betaald: true
  }, over || {});
}
const inkoopFactuur = (over) => factuur(Object.assign({
  verkoper: { code: 'LEV', naam: 'Groothandel' },
  koper: { supplierCode: 'GLAS' }
}, over || {}));

function stubKern(facturen) {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' }, services: [{ id: 's', name: 'R', price: 1 }],
    boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [],
    facturen: facturen || [], werkruimtes: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => (code === 'GLAS' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => zaak.boekingen,
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
}

function ond(K, rechtsvorm, uren) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  K.ondernemingKoppel(o, 'GLAS', MIJN_ZAAK);
  if (rechtsvorm) K.ondernemingRechtsvorm(o, rechtsvorm);
  if (uren !== undefined) K.ondernemingIntakeZet(o, { persoon: { urenPerWeek: uren } });
  return o;
}

/* ---------------- de btw: hard ---------------- */

test('de btw is een optelsom uit de eigen facturen, geen schatting', () => {
  const K = stubKern([
    factuur({ subtotaal: 1000, btwBedrag: 210 }),
    factuur({ subtotaal: 2000, btwBedrag: 420 }),
    inkoopFactuur({ subtotaal: 500, btwBedrag: 105 })
  ]);
  const b = K.ondernemingBelasting(ond(K), NU);
  assert.equal(b.btw.gefactureerd, 630);
  assert.equal(b.btw.voorbelasting, 105);
  assert.equal(b.btw.afTeDragen, 525);
  assert.equal(b.btw.zeker, true);
  assert.ok(b.btw.uitleg.includes('nooit van u geweest'));
});

test('facturen van een ander jaar of een andere zaak tellen niet mee', () => {
  const K = stubKern([
    factuur({ btwBedrag: 210, datum: '2025-12-31' }),
    factuur({ btwBedrag: 420, verkoper: { code: 'ANDER' } }),
    factuur({ btwBedrag: 100, datum: '2026-02-02' })
  ]);
  const b = K.ondernemingBelasting(ond(K), NU);
  assert.equal(b.jaar, 2026);
  assert.equal(b.btw.gefactureerd, 100);
  assert.equal(b.btw.facturenUit, 1);
});

test('alleen de btw levert een actie op, en alleen als er iets af te dragen is', () => {
  const niks = stubKern([inkoopFactuur({ btwBedrag: 500 })]);   // meer voorbelasting dan omzet-btw
  const b1 = niks.ondernemingBelasting(ond(niks), NU);
  assert.ok(b1.btw.afTeDragen < 0, 'u krijgt terug in plaats van dat u moet afdragen');
  assert.equal(BEL.belastingOpvolging(b1), null, 'dan is er niets opzij te zetten');

  const K = stubKern([factuur({ btwBedrag: 630 })]);
  const v = BEL.belastingOpvolging(K.ondernemingBelasting(ond(K), NU));
  assert.ok(v.kop.includes('630'));
  assert.ok(v.waarom.includes('nooit van u geweest'));
});

/* ---------------- de rechtsvorm ---------------- */

test('voor een B.V. wordt er niets uitgerekend, met de reden erbij', () => {
  const K = stubKern([factuur({ subtotaal: 40000, btwBedrag: 8400 })]);
  const b = K.ondernemingBelasting(ond(K, 'bv'), NU);
  assert.equal(b.reservering.kan, false);
  assert.ok(b.reservering.reden.includes('vennootschapsbelasting'));
  assert.ok(b.reservering.reden.includes('erger dan geen getal'));
  assert.equal(b.reservering.nu, undefined, 'en er staat geen bedrag');
  assert.equal(b.btw.afTeDragen, 8400, 'de btw geldt wel gewoon: die hangt niet aan de rechtsvorm');
});

test('een stichting krijgt haar eigen reden', () => {
  const K = stubKern([factuur({ subtotaal: 40000 })]);
  const b = K.ondernemingBelasting(ond(K, 'stichting'), NU);
  assert.equal(b.reservering.kan, false);
  assert.ok(!b.reservering.reden.includes('vennootschapsbelasting'),
    'een stichting is geen vpb-plichtige vennootschap');
});

test('een eenmanszaak krijgt wel een reservering', () => {
  const K = stubKern([factuur({ subtotaal: 40000 })]);
  const b = K.ondernemingBelasting(ond(K, 'eenmanszaak'), NU);
  assert.equal(b.reservering.kan, true);
  assert.ok(b.reservering.nu.bedrag > 0);
});

/* ---------------- de winst en de reservering ---------------- */

test('de winst is omzet min inkoop, allebei zonder btw', () => {
  const K = stubKern([
    factuur({ subtotaal: 10000, btwBedrag: 2100 }),
    inkoopFactuur({ subtotaal: 4000, btwBedrag: 840 })
  ]);
  const b = K.ondernemingBelasting(ond(K, 'eenmanszaak'), NU);
  assert.equal(b.winst.omzet, 10000);
  assert.equal(b.winst.inkoop, 4000);
  assert.equal(b.winst.winst, 6000, 'de btw hoort niet in de winst');
});

test('op verlies of zonder winst valt er niets te reserveren', () => {
  const verlies = stubKern([factuur({ subtotaal: 1000 }), inkoopFactuur({ subtotaal: 5000 })]);
  const b1 = verlies.ondernemingBelasting(ond(verlies, 'eenmanszaak'), NU);
  assert.equal(b1.reservering.kan, false);
  assert.ok(b1.reservering.reden.includes('verlies'));

  const leeg = stubKern([]);
  const b2 = leeg.ondernemingBelasting(ond(leeg, 'eenmanszaak'), NU);
  assert.equal(b2.reservering.kan, false);
  assert.ok(b2.reservering.reden.includes('nog geen winst'));
});

test('de reservering is de bestaande berekening, niet een tweede', () => {
  const K = stubKern([factuur({ subtotaal: 30000 })]);
  const b = K.ondernemingBelasting(ond(K, 'eenmanszaak'), NU);
  const eigen = zzpBerekening('NL', 30000, { urencriterium: true, starter: false });
  assert.equal(b.reservering.nu.percentage, eigen.reserveerPct,
    'hetzelfde percentage als kern/fiscaal geeft; hier wordt niets opnieuw uitgerekend');
  assert.equal(b.reservering.nu.belastingIndicatie, eigen.belasting);
});

test('de reservering dekt de berekende belasting, dankzij de marge in het percentage', () => {
  /* Dit is een eigenschap van kern/fiscaal en geen grendel van deze module:
     reserveerPct is het tarief plus vijf punten, met een bodem van 20%. De
     toets staat er zodat het opvalt als die marge ooit verdwijnt -- dan klopt
     het woord "reservering" hier niet meer. */
  for (const winst of [5000, 30000, 90000, 200000]) {
    const K = stubKern([factuur({ subtotaal: winst })]);
    const r = K.ondernemingBelasting(ond(K, 'eenmanszaak', 32), NU).reservering.nu;
    assert.ok(r.bedrag >= Math.round(r.belastingIndicatie),
      'bij winst ' + winst + ' dekt de reservering (' + r.bedrag + ') de belasting (' + r.belastingIndicatie + ') niet');
  }
  const laag = stubKern([factuur({ subtotaal: 30000 })]);
  const bl = laag.ondernemingBelasting(ond(laag, 'eenmanszaak', 32), NU).reservering.nu;
  assert.equal(bl.belastingIndicatie, 0, 'op deze winst valt de belasting weg tegen de aftrekken');
  assert.equal(bl.bedrag, 6000, 'en dan houdt de bodem van 20% de reservering overeind');
});

/* ---------------- de aannames ---------------- */

test('de aannames staan in het antwoord, en de startersaftrek telt niet mee', () => {
  const K = stubKern([factuur({ subtotaal: 60000 })]);
  const b = K.ondernemingBelasting(ond(K, 'eenmanszaak'), NU);
  const a = b.reservering.aannames;
  const starter = a.find(x => x.naam === 'startersaftrek meegerekend');
  assert.equal(starter.waarde, false);
  assert.ok(starter.uitleg.includes('te laag'),
    'wat wij niet weten, kiezen we zo dat de reservering hoger uitvalt');

  /* En de tegenproef, want anders toetst de regel hierboven een constante:
     mét startersaftrek zou de berekende belasting LAGER uitvallen. Dat die
     aftrek er niet in zit, is dus een keuze met gevolg en geen vlaggetje. */
  const zonder = zzpBerekening('NL', b.winst.winst, { urencriterium: true, starter: false });
  const met = zzpBerekening('NL', b.winst.winst, { urencriterium: true, starter: true });
  assert.ok(met.belasting <= zonder.belasting, 'de startersaftrek verlaagt de belasting');
  assert.equal(b.reservering.nu.belastingIndicatie, zonder.belasting,
    'en wij rekenen met de stand zonder die aftrek');
});

test('het urencriterium wordt afgeleid uit de opgegeven uren', () => {
  const K = stubKern([factuur({ subtotaal: 30000 })]);
  const weinig = K.ondernemingBelasting(ond(K, 'eenmanszaak', 10), NU);
  assert.equal(weinig.reservering.aannames[0].waarde, false, '10 uur per week haalt de 1225 uur niet');

  const K2 = stubKern([factuur({ subtotaal: 30000 })]);
  const veel = K2.ondernemingBelasting(ond(K2, 'eenmanszaak', 32), NU);
  assert.equal(veel.reservering.aannames[0].waarde, true);
  assert.ok(veel.reservering.nu.belastingIndicatie < weinig.reservering.nu.belastingIndicatie,
    'zonder zelfstandigenaftrek is de belasting hoger');
  /* Bij deze winst dekt de bodem van 20% allebei de gevallen af, dus het
     RESERVERINGSBEDRAG is gelijk. Dat is de bedoeling van die bodem, en het
     hoort hier vast te staan zodat niemand hem later per ongeluk weghaalt. */
  assert.equal(veel.reservering.nu.bedrag, weinig.reservering.nu.bedrag);
  assert.ok(veel.reservering.nu.bedrag >= weinig.reservering.nu.belastingIndicatie,
    'en de reservering dekt de berekende belasting in beide gevallen');
});

test('zonder opgegeven uren nemen we de gunstige stand aan, en zeggen dat', () => {
  const K = stubKern([factuur({ subtotaal: 30000 })]);
  const a = K.ondernemingBelasting(ond(K, 'eenmanszaak'), NU).reservering.aannames[0];
  assert.equal(a.waarde, true);
  assert.ok(a.uitleg.includes('wij nemen aan van wel'));
  assert.ok(a.uitleg.includes('omhoog'), 'met wat het betekent als het niet klopt');
});

/* ---------------- de grenzen ---------------- */

test('het voorbehoud noemt wat wij niet zien', () => {
  const K = stubKern([factuur()]);
  const b = K.ondernemingBelasting(ond(K, 'eenmanszaak'), NU);
  assert.ok(b.voorbehoud.includes('alleen wat via RTG is gefactureerd'));
  assert.ok(b.voorbehoud.includes('geen aangifte'));
  assert.equal(b.winst.basis, 'alleen facturen via RTG');
});

test('zonder zaak is er geen belastingbeeld', () => {
  const K = stubKern([]);
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'P' }).onderneming.id);
  assert.equal(K.ondernemingBelasting(o, NU), null);
});

test('het dagbeeld zet de btw na de facturen en voor de contractklok', () => {
  const K = stubKern([factuur({ btwBedrag: 500 })]);
  const d = K.ondernemingDagbeeld(ond(K, 'eenmanszaak'), NU);
  assert.ok(d.belasting, 'het beeld hangt aan het dagbeeld');
  assert.ok(d.acties.some(a => a.id === 'btw'), 'en de btw staat op de lijst');
});
