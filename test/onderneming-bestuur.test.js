/* Ronde: het bestuur -- wie beslist, wie bezit, en wie er als UBO uit volgt.

   Vijf beweringen:

   1. DIT BESTAAT ALLEEN WAAR HET ECHT BESTAAT. Een eenmanszaak heeft geen
      bestuur. Een leeg register zou lezen als "u moet dit nog invullen", en dan
      verzint iemand een bestuur voor een bedrijf dat er geen kan hebben.
   2. HET VERBOD WINT, OOK HIER. Een stichting kent geen aandelen, en dat komt
      uit dezelfde `verboden` als de capslijst -- niet uit een tweede lijstje
      rechtsvormen dat hier apart wordt bijgehouden.
   3. DE UBO WORDT AFGELEID EN NIET INGEVULD. Boven de 25% is een regel; er is
      dan ook geen route die hem zet. Een aangevinkte UBO blijft staan als de
      aandelen verschuiven.
   4. GEEN BELANGHEBBENDE BOVEN DE DREMPEL BETEKENT DE BESTUURDERS. Dat heet een
      pseudo-UBO en is niet minder geldig.
   5. AFTREDEN IS GEEN WISSEN. Wie er ooit bestuurder was, was dat -- en juist
      die geschiedenis is waar een aansprakelijkheidsvraag over gaat.

   Draai los: node --experimental-sqlite --test test/onderneming-bestuur.test.js */
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
const BST = require('../server/kern/onderneming/bestuur');

function stubKern() {
  const data = { ondernemingen: [], suppliers: [], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {}, vacatures: {}, applications: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: () => null, ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) }
  });
}

function ond(K, rechtsvorm) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (rechtsvorm) K.ondernemingRechtsvorm(o, rechtsvorm);
  return o;
}

/* ---------------- bestaat het wel ---------------- */

test('zonder rechtsvorm komt er geen register maar de vraag', () => {
  const K = stubKern();
  const b = K.ondernemingBestuur(ond(K));
  assert.equal(b.stand, 'geen-rechtsvorm');
  assert.ok(b.uitleg.includes('misschien niet mag bestaan'));
  assert.equal(b.bestuurders, undefined, 'en geen lege lijsten die op invullen lijken');
});

test('een eenmanszaak heeft geen bestuur, en zegt dat', () => {
  const K = stubKern();
  const o = ond(K, 'eenmanszaak');
  const b = K.ondernemingBestuur(o);
  assert.equal(b.stand, 'niet-van-toepassing');
  assert.ok(b.uitleg.includes('U bent de onderneming'));
  assert.ok(b.let.includes('leeg register'));

  const poging = K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  assert.equal(poging.status, 409, 'en er valt ook niets in te zetten');
});

test('een B.V. heeft een bestuur en aandeelhouders', () => {
  const K = stubKern();
  const b = K.ondernemingBestuur(ond(K, 'bv'));
  assert.equal(b.stand, 'bestaat');
  assert.equal(b.magAandelen, true);
  assert.deepEqual(b.bestuurders, []);
  assert.equal(b.aandelenGeweerd, null);
});

/* ---------------- het verbod wint ---------------- */

test('een stichting kent geen aandelen, en dat komt uit de verboden', () => {
  const K = stubKern();
  const o = ond(K, 'stichting');
  const b = K.ondernemingBestuur(o);
  assert.equal(b.stand, 'bestaat', 'een stichting heeft wel een bestuur');
  assert.equal(b.magAandelen, false);
  assert.ok(b.aandelenGeweerd.includes('geen aandelen'));
  assert.equal(b.verdeeld, null, 'en dus ook geen verdeling van iets dat niet bestaat');

  const poging = K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 100 });
  assert.equal(poging.status, 409);
  assert.ok(poging.uitleg.includes('eigenschap van de rechtsvorm'));

  /* En de grendel zit in de rechtsvorm-as, niet hier: geen tweede lijstje. */
  const bron = require('fs').readFileSync('server/kern/onderneming/bestuur.js', 'utf8');
  assert.ok(!/stichting|vereniging/.test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
    'nergens een lijst rechtsvormen in de code: dat zou een tweede waarheid zijn');
});

/* De grendel moet ook winnen van een ANDERE as. Dit is het geval waarvoor
   `verboden` apart van `caps` bestaat: zou een werkvorm de cap meebrengen, dan
   zette die de knop er alsnog neer. Zonder deze toets was de aftrek in
   ./bestuur.js decoratie -- een mutatie die hem weghaalde liet niets zakken. */
test('een werkvorm die aandeelhouders meebrengt, wint het niet van het verbod', () => {
  const zaak = { code: 'STG', name: 'Stichting Proef', type: 'fonds', staff: [{ id: 1 }],
    services: [], boekingen: [], orders: [] };
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {}, vacatures: {}, applications: {}, thuisHuizen: {},
    /* Een werkvorm die de cap wél draagt. Verzonnen voor deze toets, en dat mag:
       het gaat om de vraag of het verbod wint van welke andere as dan ook. */
    supplierTypes: { fonds: { label: 'Fonds', caps: ['aandeelhouders', 'aandelen', 'bestuur'] } } };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (c) => (c === 'STG' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => [],
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) }
  });
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  K.ondernemingKoppel(o, 'STG', MIJN_ZAAK);
  K.ondernemingRechtsvorm(o, 'stichting');

  assert.ok(db.capsVan(zaak).includes('aandeelhouders'), 'de werkvorm brengt hem echt mee');
  const b = K.ondernemingBestuur(o);
  assert.equal(b.magAandelen, false,
    'wat verboden is wint altijd -- anders zet de eerste as die hem meebrengt de knop er alsnog neer');
  assert.equal(K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 10 }).status, 409);
  assert.ok(K.ondernemingBeeld(o).geweerd.some(g => g.cap === 'aandelen'),
    'en het scherm kan uitleggen waarom de knop er niet staat');
});

/* ---------------- de UBO ---------------- */

test('boven de 25 procent is iemand uiteindelijk belanghebbende', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 40 });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.ubo.soort, 'belang');
  assert.deepEqual(b.ubo.personen.map(p => p.codenaam), ['Reiger', 'Zilverspar']);
  assert.equal(BST.UBO_DREMPEL, 25);
});

test('precies 25 procent is niet boven de drempel', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  /* Codenamen van twee tekens of meer: eennaam-letters worden al op de lengte
     geweigerd, en dan zou deze toets slagen zonder ooit een aandeelhouder te
     hebben gehad -- precies wat een mutatie op de drempel blootlegde. */
  for (const n of ['Reiger', 'Zilverspar', 'Marter', 'Otter']) {
    assert.equal(K.ondernemingAandeelZet(o, { codenaam: n, percentage: 25 }).ok, true);
  }
  K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.ubo.soort, 'pseudo',
    'meer dan 25% is de wet, niet 25% of meer -- die grens is niet onze afronding');
  assert.deepEqual(b.ubo.personen.map(p => p.codenaam), ['Reiger']);
  assert.ok(b.ubo.let.includes('pseudo-UBO'));
});

test('zonder belang en zonder bestuurder is er geen UBO, met de reden', () => {
  const K = stubKern();
  const b = K.ondernemingBestuur(ond(K, 'bv'));
  assert.equal(b.ubo.soort, 'geen');
  assert.deepEqual(b.ubo.personen, []);
  assert.ok(b.ubo.let.includes('Elke rechtspersoon heeft er een'));
});

test('een commissaris en een adviseur tellen niet mee als pseudo-UBO', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  K.ondernemingBestuurderZet(o, { codenaam: 'Toezicht', rol: 'commissaris' });
  K.ondernemingBestuurderZet(o, { codenaam: 'Denker', rol: 'adviseur' });
  assert.equal(K.ondernemingBestuur(o).ubo.soort, 'geen',
    'zij vertegenwoordigen de onderneming niet');

  K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.ubo.soort, 'pseudo');
  assert.deepEqual(b.ubo.personen.map(p => p.codenaam), ['Reiger']);
  assert.equal(b.bestuurders.length, 3, 'ze staan wel gewoon in het register');
});

test('de UBO verschuift mee als de aandelen verschuiven', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  assert.equal(K.ondernemingBestuur(o).ubo.soort, 'pseudo');

  K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 51 });
  const na = K.ondernemingBestuur(o);
  assert.equal(na.ubo.soort, 'belang');
  assert.deepEqual(na.ubo.personen.map(p => p.codenaam), ['Zilverspar'],
    'afgeleid en niet aangevinkt: een aangevinkte UBO was blijven staan');
});

test('er is geen route en geen functie die de UBO zet', () => {
  const K = stubKern();
  assert.ok(!Object.keys(K).some(k => /ubo/i.test(k)), 'de kern biedt er geen');
  const route = require('fs').readFileSync('server/routes/member/onderneming-bestuur.js', 'utf8');
  assert.ok(!/\/ubo/.test(route), 'en de routes ook niet');
});

/* ---------------- de verdeling ---------------- */

test('boven de honderd procent uitkomen kan niet', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 70 });
  const r = K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 40 });
  assert.equal(r.status, 409);
  assert.equal(r.ruimte, 30, 'met de ruimte die er nog is erbij');
  assert.equal(K.ondernemingBestuur(o).aandelen.length, 1);
});

test('een belang van nul of meer dan honderd wordt geweigerd', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  assert.equal(K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 0 }).status, 400);
  assert.equal(K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 101 }).status, 400);
  assert.equal(K.ondernemingAandeelZet(o, { codenaam: 'Reiger' }).status, 400);
  /* En de codenaam zelf, zodat het bovenstaande niet slaagt op de lengte. */
  assert.equal(K.ondernemingAandeelZet(o, { codenaam: 'A', percentage: 10 }).status, 400);
  assert.equal(K.ondernemingBestuur(o).aandelen.length, 0);
});

test('een niet volledig verdeeld kapitaal is een melding en geen fout', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.verdeeld.totaal, 60);
  assert.equal(b.verdeeld.open, 40);
  assert.ok(b.verdeeld.melding.includes('Tijdens een oprichting is dat normaal'),
    'een register dat rood kleurt terwijl er niets mis is, leert iemand rood te negeren');

  K.ondernemingAandeelZet(o, { codenaam: 'Zilverspar', percentage: 40 });
  assert.equal(K.ondernemingBestuur(o).verdeeld.melding, null);
});

test('een bestaand belang wijzigen telt niet dubbel', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 60 });
  assert.equal(K.ondernemingAandeelZet(o, { codenaam: 'Reiger', percentage: 90 }).ok, true,
    'zijn eigen 60 mag niet meetellen als bezet');
  assert.equal(K.ondernemingBestuur(o).verdeeld.totaal, 90);
  assert.equal(K.ondernemingBestuur(o).aandelen.length, 1);
});

/* ---------------- het bestuur zelf ---------------- */

test('aftreden is geen wissen', () => {
  const K = stubKern();
  const o = ond(K, 'stichting');
  K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'voorzitter' });
  const id = K.ondernemingBestuur(o).bestuurders[0].id;

  const na = K.ondernemingBestuurderAf(o, id);
  assert.equal(na.ok, true);
  assert.equal(na.bestuurders.length, 0);
  assert.equal(na.afgetreden.length, 1, 'wie er ooit bestuurder was, was dat');
  assert.ok(na.afgetreden[0].tot, 'met de datum erbij');
});

test('dezelfde persoon staat maar een keer in het zittende bestuur', () => {
  const K = stubKern();
  const o = ond(K, 'stichting');
  K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'voorzitter' });
  assert.equal(K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'secretaris' }).status, 409);

  const id = K.ondernemingBestuur(o).bestuurders[0].id;
  K.ondernemingBestuurderAf(o, id);
  assert.equal(K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'secretaris' }).ok, true,
    'maar wie is afgetreden kan wel terugkomen');
});

test('een onbekende rol wordt geweigerd met de lijst erbij', () => {
  const K = stubKern();
  const r = K.ondernemingBestuurderZet(ond(K, 'bv'), { codenaam: 'Reiger', rol: 'baas' });
  assert.equal(r.status, 400);
  assert.ok(r.rollen.includes('bestuurder'));
});

/* ---------------- codenamen ---------------- */

test('het register draagt codenamen en zegt dat het niet de KvK-opgave is', () => {
  const K = stubKern();
  const o = ond(K, 'bv');
  K.ondernemingBestuurderZet(o, { codenaam: 'Reiger', rol: 'bestuurder' });
  const b = K.ondernemingBestuur(o);
  assert.equal(b.bestuurders[0].codenaam, 'Reiger');
  assert.ok(b.voorbehoud.includes('niet de UBO-opgave'),
    'een register dat zich voordoet als de officiele opgave, is er een die niemand meer indient');
  assert.ok(b.voorbehoud.includes('codenaam'));
});
