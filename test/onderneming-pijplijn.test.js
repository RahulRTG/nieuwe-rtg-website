/* Ronde: de pijplijn -- wat er nog kan worden, en wat het waard is.

   Vijf beweringen:

   1. ER KOMT GEEN TWEEDE OFFERTESTROOM. De pijplijn leest db.data.vakOffertes
      en schrijft er niets in. Een eigen tabel ernaast loopt binnen een maand
      uiteen met wat de klant werkelijk ziet.
   2. EEN AANVRAAG HEEFT GEEN BEDRAG. Er staat nog geen prijs op, en wij
      verzinnen er geen -- ook niet uit eerdere klussen. Dat zou een
      omzetverwachting zijn die de ondernemer nooit heeft uitgesproken.
   3. DE SCORINGSKANS IS EEN METING OF HIJ IS ER NIET. Onder vijf afgeronde
      offertes staat er null met de reden, en geen vrolijke 50%.
   4. WAT DE ZAAK ZELF AFWEES, IS GEEN VERLOREN VERKOOP. Een keuze en een
      verlies bij elkaar optellen laat een volle agenda lezen als een slecht
      verkoopjaar.
   5. ALLES OP CODENAAM. Een verkooppijplijn is precies de plek waar de
      codenaam-regel stilletjes zou sneuvelen.

   Draai los: node --experimental-sqlite --test test/onderneming-pijplijn.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakOnderneming = require('../server/kern/onderneming');
const PIJ = require('../server/kern/onderneming/pijplijn');

const DAG = 86400000;
const NU = Date.parse('2026-06-01T08:00:00Z');
const isoTerug = (n) => new Date(NU - n * DAG).toISOString();

let teller = 0;
function offerte(over) {
  teller += 1;
  return Object.assign({
    id: 'OF-' + teller, supplierCode: 'GLAS', supplierName: 'Glas',
    customerKey: 'k' + teller, customerTier: 'rtg', customerCodename: 'Reiger',
    omschrijving: 'De ramen van het hele pand wassen',
    wens: null, status: 'aangevraagd', at: isoTerug(3)
  }, over || {});
}
/* Een uitgebrachte offerte: prijs plus het moment waarop hij is uitgebracht. */
const aangeboden = (prijs, dagenGeleden, over) => offerte(Object.assign({
  status: 'aangeboden', prijs, at: isoTerug(dagenGeleden + 2), antwoordAt: isoTerug(dagenGeleden)
}, over || {}));

function stubKern(offertes) {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' },
    services: [{ id: 's', name: 'Klus', price: 100, duurMin: 60 }], boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: offertes || [],
    facturen: [], werkruimtes: {}, vacatures: {}, applications: {},
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
  K._data = data;
  return K;
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (koppel !== false) K.ondernemingKoppel(o, 'GLAS');
  return o;
}
const stadium = (p, id) => p.stadia.find(s => s.id === id);

/* Een geschiedenis van beslissingen: `gewonnen` akkoord, `weg` ingetrokken. */
function geschiedenis(gewonnen, weg) {
  const uit = [];
  for (let i = 0; i < gewonnen; i++) uit.push(offerte({ status: 'akkoord', prijs: 500, at: isoTerug(60) }));
  for (let i = 0; i < weg; i++) uit.push(offerte({ status: 'ingetrokken', prijs: 500, at: isoTerug(60) }));
  return uit;
}

/* ---------------- geen tweede stroom ---------------- */

test('de pijplijn leest de bestaande offertestroom en schrijft er niets in', () => {
  const offertes = [offerte(), aangeboden(1000, 3)];
  const K = stubKern(offertes);
  const voor = JSON.stringify(offertes);
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(JSON.stringify(K._data.vakOffertes), voor, 'de stroom is onaangeroerd');
  assert.equal(p.zaak, 'GLAS');
  assert.equal(stadium(p, 'aangevraagd').aantal, 1);
  assert.equal(stadium(p, 'aangeboden').aantal, 1);

  const bron = require('fs').readFileSync('server/kern/onderneming/pijplijn.js', 'utf8');
  assert.ok(!/db\.data\.vakOffertes\s*=/.test(bron), 'nergens een schrijfactie op de offertestroom');
});

test('zonder zaak is er geen pijplijn, en geen lege pijplijn', () => {
  const K = stubKern([]);
  assert.equal(K.ondernemingPijplijn(ond(K, false), NU), null,
    'nul offertes zou lezen als "u verkoopt niets", en dat is iets anders dan "u heeft nog geen zaak"');
});

/* ---------------- een aanvraag heeft geen bedrag ---------------- */

test('op het stadium "bij u" staat geen bedrag, met de reden erbij', () => {
  const K = stubKern([offerte(), offerte(), aangeboden(1000, 1)]);
  const p = K.ondernemingPijplijn(ond(K), NU);
  const a = stadium(p, 'aangevraagd');
  assert.equal(a.aantal, 2);
  assert.equal(a.bedrag, null, 'geen euro, ook geen schatting uit eerdere klussen');
  assert.ok(a.bedragUitleg.includes('nooit heeft uitgesproken'));
  assert.equal(a.bal, 'zaak', 'de bal ligt bij de ondernemer');
});

test('alleen uitgebrachte offertes tellen mee in het openstaande bedrag', () => {
  const K = stubKern([offerte(), aangeboden(1000, 1), aangeboden(2500, 4),
    offerte({ status: 'akkoord', prijs: 9000 })]);
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(p.open.uitgebracht, 2);
  assert.equal(p.open.bedrag, 3500, 'gewonnen werk staat niet meer open');
  assert.equal(p.open.aanvragen, 1);
});

/* ---------------- de scoringskans ---------------- */

test('onder vijf afgeronde offertes is er geen scoringskans en dus geen verwachting', () => {
  const K = stubKern(geschiedenis(2, 1).concat([aangeboden(4000, 1)]));
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(p.scoringskans.percentage, null);
  assert.equal(p.scoringskans.beslist, 3);
  assert.ok(p.scoringskans.reden.includes('eerder een indruk'));
  assert.equal(p.verwacht.bedrag, null, 'en dan ook geen gewogen bedrag');
  assert.ok(p.verwacht.reden.includes('afgerond'));
  assert.equal(PIJ.MIN_BESLIST, 5);
});

test('vanaf vijf beslissingen komt de kans uit de eigen geschiedenis', () => {
  const K = stubKern(geschiedenis(3, 2).concat([aangeboden(4000, 1)]));
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(p.scoringskans.percentage, 60, 'drie van de vijf');
  assert.equal(p.verwacht.bedrag, 2400, '60% van 4000');
  assert.equal(p.verwacht.over, 4000);
  assert.ok(p.verwacht.let.includes('geen toezegging'));
});

test('wat de zaak zelf afwees telt niet als verloren verkoop', () => {
  /* Vijf beslissingen (3 gewonnen, 2 ingetrokken) plus tien eigen weigeringen.
     Zouden die meetellen, dan zakte de kans van 60% naar 20%. */
  const afgewezen = [];
  for (let i = 0; i < 10; i++) afgewezen.push(offerte({ status: 'afgewezen', at: isoTerug(70) }));
  const K = stubKern(geschiedenis(3, 2).concat(afgewezen, [aangeboden(1000, 1)]));
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(p.scoringskans.percentage, 60);
  assert.equal(p.scoringskans.beslist, 5);
  assert.equal(stadium(p, 'afgewezen').aantal, 10, 'ze worden wel apart geteld');
  assert.ok(p.scoringskans.grondslag.includes('geen verloren verkoop'));
});

/* ---------------- wat er stil ligt ---------------- */

test('een offerte die te lang bij de klant ligt, wordt geteld en gemeld', () => {
  const K = stubKern([aangeboden(1200, 14), aangeboden(800, 12), aangeboden(500, 2)]);
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(PIJ.STIL_DAGEN, 10);
  assert.equal(p.stil.aantal, 2, 'de offerte van twee dagen oud ligt niet stil');
  assert.equal(p.stil.rijen[0].dagen, 14, 'de langst liggende bovenaan');

  const v = PIJ.pijplijnOpvolging(p);
  const stil = v.find(x => x.id === 'stil');
  assert.ok(stil.kop.includes('14 dagen'));
  assert.ok(stil.waarom.includes('2000 euro'), 'met het bedrag dat staat te verdampen erbij');
});

test('de wachttijd van een uitgebrachte offerte loopt vanaf de prijs, niet vanaf de aanvraag', () => {
  /* Aangevraagd 40 dagen geleden, prijs pas 3 dagen geleden gegeven. De klant
     denkt drie dagen na en niet veertig. */
  const K = stubKern([offerte({ status: 'aangeboden', prijs: 900, at: isoTerug(40), antwoordAt: isoTerug(3) })]);
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(p.stil.aantal, 0);
  assert.equal(p.rijen[0].dagen, 3);
});

test('een lage scoringskans wordt gemeld, maar nooit op te weinig beslissingen', () => {
  const weinig = stubKern(geschiedenis(0, 3).concat([aangeboden(1000, 1)]));
  assert.equal(PIJ.pijplijnOpvolging(weinig.ondernemingPijplijn(ond(weinig), NU))
    .some(x => x.id === 'scoringskans'), false,
  'een verwijt op basis van drie offertes is geen bevinding');

  const genoeg = stubKern(geschiedenis(1, 9).concat([aangeboden(1000, 1)]));
  const v = PIJ.pijplijnOpvolging(genoeg.ondernemingPijplijn(ond(genoeg), NU));
  const s = v.find(x => x.id === 'scoringskans');
  assert.ok(s.kop.includes('10%'));
  assert.ok(s.waarom.includes('10 afgeronde'));
});

/* ---------------- de doorlooptijd ---------------- */

test('de doorlooptijd naar een prijs is een mediaan over wat er echt gemeten is', () => {
  const K = stubKern([
    offerte({ status: 'akkoord', prijs: 100, at: isoTerug(60), antwoordAt: isoTerug(59) }),   // 1 dag
    offerte({ status: 'akkoord', prijs: 100, at: isoTerug(50), antwoordAt: isoTerug(48) }),   // 2 dagen
    offerte({ status: 'akkoord', prijs: 100, at: isoTerug(40), antwoordAt: isoTerug(10) }),   // 30 dagen
    offerte({ status: 'akkoord', prijs: 100, at: isoTerug(30) })                              // geen antwoordAt
  ]);
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(p.doorlooptijd.naarPrijs, 2,
    'de mediaan van 1, 2 en 30; een gemiddelde (11) zou de hele zaak traag laten lijken');
});

test('zonder een beantwoorde offerte is er geen doorlooptijd, en geen nul', () => {
  const K = stubKern([offerte(), offerte()]);
  const p = K.ondernemingPijplijn(ond(K), NU);
  assert.equal(p.doorlooptijd.naarPrijs, null);
  assert.ok(p.doorlooptijd.uitleg.includes('Nog geen'));
});

/* ---------------- codenamen ---------------- */

test('er komt geen enkele echte naam of sleutel in het antwoord', () => {
  const K = stubKern([offerte({ customerCodename: 'Reiger', customerKey: 'GEHEIM-SLEUTEL' }),
    aangeboden(900, 1, { customerCodename: 'Zilverspar', customerKey: 'OOK-GEHEIM' })]);
  const tekst = JSON.stringify(K.ondernemingPijplijn(ond(K), NU));
  assert.ok(tekst.includes('Reiger') && tekst.includes('Zilverspar'), 'codenamen wel');
  assert.ok(!tekst.includes('GEHEIM'), 'sleutels niet');
  assert.ok(!tekst.includes('customerKey'));
});

/* ---------------- het dagbeeld ---------------- */

test('het dagbeeld draagt de pijplijn en zet zijn opvolging voor die van de relaties', () => {
  const K = stubKern([aangeboden(1500, 20), offerte()]);
  const d = K.ondernemingDagbeeld(ond(K), NU);
  assert.ok(d.pijplijn, 'de pijplijn hangt in het dagbeeld');
  const ids = d.acties.map(a => a.id);
  const pi = ids.indexOf('pijplijn:stil');
  const rel = ids.findIndex(x => x.startsWith('opvolging:'));
  assert.ok(pi >= 0, 'de stille offerte staat als actie');
  assert.ok(rel >= 0 && pi < rel,
    'uitgebracht werk dat staat te verdampen gaat voor een aanvraag waar nog niets in zit');
});
