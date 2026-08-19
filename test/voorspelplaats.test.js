/* ============================================================================
   DE VOORSPELLER LEERT PLAATS -- of preciezer: hij LEERT er niets van, en dat
   is het ontwerp (PLAATS.md fase 3).

   De voorspeller leerde uitsluitend uit het grootboek: hij weet WANNEER en WAT,
   nooit WAAR. Daardoor was "je bestelt meestal om 19:00" het maximum, terwijl
   "je bestelt om 19:00 als je thuis bent, en je bent nu onderweg" het verschil
   is tussen een aardige suggestie en iets wat klopt.

   WAT PLAATS HIER NIET DOET, EN NIET KAN: leren. De plaatslaag houdt geen spoor
   (PLAATS.md grens 1), dus er valt uit plaats geen patroon over tijd af te
   leiden. Plaats spreekt alleen over NU.

   DRIE UITKOMSTEN, EN DE DERDE IS HIER HET EIGENLIJKE ONDERWERP:

     bevestigd nabij       je bent er nu in de buurt        -> naar voren
     niet gemeten          er keek niemand                  -> ongemoeid
     bevestigd niet nabij  je bent aantoonbaar elders       -> naar achteren

   Zou "niet gemeten" hetzelfde doen als "niet nabij", dan wordt elk lid dat zijn
   locatie uit laat staan stilletjes slechter bediend -- een boete op een keuze
   die vrij hoort te zijn. Toets 2 en 4 houden ze uit elkaar.

   EN HET DOEL IS 'nadering' EN NIET 'dienst' (toets 5). Een waarneming die is
   gemaakt om je aanwezigheid op je werk te bevestigen mag geen aanbeveling
   voeden: grens 2 van PLAATS.md, en precies waarvoor een hek zijn doel draagt.

   Draai los: node --experimental-sqlite --test test/voorspelplaats.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const IK = 'Proef Kraanvogel 0002';
const ZAAK_A = 'AAA', ZAAK_B = 'BBB';

/* Zaak A heeft MEER geschiedenis dan B, en dat is met opzet: zonder verschil in
   zekerheid valt er geen volgorde te bewaken, en dan zegt een toets over
   rangschikking niets. Nu is A van zichzelf de sterkste verwachting, en moet
   plaats hem opzij kunnen zetten om iets te bewijzen. */
function boekingen(nu) {
  const rij = [];
  for (let i = 1; i <= 8; i++) {
    rij.push({ van: 'lid:' + IK, naar: 'partner:' + ZAAK_A, centen: 2500,
      at: new Date(nu - i * 3 * 86400000).toISOString() });
  }
  for (let i = 1; i <= 3; i++) {
    rij.push({ van: 'lid:' + IK, naar: 'partner:' + ZAAK_B, centen: 2500,
      at: new Date(nu - i * 3 * 86400000).toISOString() });
  }
  return rij;
}

/* De echte plaatslaag, met een nagemaakte navPoi zodat beide zaken een hek
   hebben. Bewust niet gestubd: deze toets gaat over de naad tussen twee lagen,
   en een nagemaakte plaatslaag zou precies die naad wegnemen. */
function maak() {
  const nu = Date.now();
  const db = { data: { payBoekingen: boekingen(nu), verblijven: [], reserveringen: [] } };
  const navPoi = (lagen) => ({ status: 200, lagen: Object.fromEntries(lagen.map(l =>
    [l, l === 'leverancier'
      ? [{ naam: 'Zaak A', code: ZAAK_A, lat: 38.91, lng: 1.43 },
         { naam: 'Zaak B', code: ZAAK_B, lat: 38.92, lng: 1.44 }]
      : []])) });
  const plaats = require('../server/kern/plaats')({ db, save: () => {}, crypto,
    weefsel: null, navPoi }).plaats;
  const v = require('../server/kern/voorspel').maakVoorspel({
    db, findSupplier: (c) => ({ code: c, name: 'Zaak ' + c }), plaats }).voorspel;
  return { v, plaats, db };
}
const codes = (r) => r.verwachtingen.map(x => x.code);

test('1. zonder plaatslaag verandert er niets aan de voorspeller', () => {
  const db = { data: { payBoekingen: boekingen(Date.now()), verblijven: [], reserveringen: [] } };
  const v = require('../server/kern/voorspel').maakVoorspel({
    db, findSupplier: (c) => ({ code: c, name: 'Zaak ' + c }) }).voorspel;
  const r = v.voorLid(IK, null);
  assert.equal(r.verwachtingen.length, 2, 'de twee gewoonten staan er');
  /* Elke verwachting draagt de derde stand, ook zonder laag: "er keek niemand"
     is een antwoord, en het ontbreken van een veld is dat niet. */
  for (const w of r.verwachtingen) {
    assert.deepEqual(w.nabij, { bevestigd: false, gemeten: false });
  }
});

test('2. niets gemeten laat de volgorde met rust', () => {
  const { v } = maak();
  const r = v.voorLid(IK, null);
  /* De volgorde is die van de zekerheid, precies zoals zonder plaatslaag. Dit
     moet op een ECHT verschil worden gemeten: bij gelijke zekerheid zou elke
     rangschikking deze toets halen, ook een verkeerde. */
  assert.deepEqual(codes(r), [ZAAK_A, ZAAK_B], 'de sterkste gewoonte staat vooraan');
  for (const w of r.verwachtingen) {
    assert.equal(w.nabij.gemeten, false, 'zonder venster meet niemand iets');
    assert.ok(!/in de buurt|ergens anders/.test(w.waarom),
      'en dan zegt het waarom er ook niets over: ' + w.waarom);
  }
});

test('3. wie in de buurt is, komt naar voren -- met de reden erbij', () => {
  const { v, plaats } = maak();
  plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'toets' });
  plaats.plaatsWaarneem(IK, { doel: 'nadering', hek: 'leverancier:' + ZAAK_B, wat: 'binnen' });
  const r = v.voorLid(IK, null);
  /* B is van zichzelf de ZWAKSTE verwachting (drie bezoeken tegen acht). Dat hij
     nu toch vooraan staat, kan alleen doordat plaats meespeelt. */
  assert.equal(r.verwachtingen[0].code, ZAAK_B, 'de zaak waar je nu bent staat vooraan');
  assert.deepEqual(r.verwachtingen[0].nabij, { bevestigd: true, gemeten: true });
  assert.match(r.verwachtingen[0].waarom, /je bent nu in de buurt/,
    'Rahul noemt zijn bron: een verwachting die om een onzichtbare reden stijgt, is niet na te rekenen');
  /* En de zekerheid is NIET opgeblazen. Die staat voor een geleerde frequentie;
     er nabijheid bij optellen zou het getal iets anders laten betekenen. */
  const zonder = require('../server/kern/voorspel').gewoontenUit(
    boekingen(Date.now()), 'lid:' + IK).find(g => g.code === ZAAK_B);
  assert.equal(r.verwachtingen[0].zekerheid, zonder.zekerheid,
    'nabijheid verandert de volgorde, niet het getal');
});

test('4. aantoonbaar elders zakt onder wat niemand mat -- maar valt niet weg', () => {
  const { v, plaats } = maak();
  plaats.plaatsVensterOpen(IK, { doel: 'nadering', bron: 'toets' });
  plaats.plaatsWaarneem(IK, { doel: 'nadering', hek: 'leverancier:' + ZAAK_A, wat: 'buiten' });
  const r = v.voorLid(IK, null);
  assert.equal(r.verwachtingen.length, 2, 'er valt niets weg');
  /* HIER ZIT HET HELE VERSCHIL TUSSEN DE TWEEDE EN DE DERDE STAND. A is de
     sterkste gewoonte en staat aantoonbaar elders; B is zwakker en er is niets
     over gemeten. "Niet gemeten" hoort dan te winnen van "aantoonbaar elders" --
     zou het gelijk staan, dan werd elk lid dat zijn locatie uit laat staan
     stilletjes even hard afgestraft als iemand die er echt niet is. */
  assert.deepEqual(codes(r), [ZAAK_B, ZAAK_A],
    'wat niemand mat gaat voor wat aantoonbaar elders is');
  assert.equal(r.verwachtingen[r.verwachtingen.length - 1].code, ZAAK_A, 'en A zakt naar achteren');
  assert.match(r.verwachtingen[r.verwachtingen.length - 1].waarom, /je bent nu ergens anders/);
  /* Klaarzetten is het werkwoord: iets verbergen omdat je er nu niet bent, zou
     een lid zijn eigen gewoonte kunnen afnemen. */
  assert.ok(codes(r).includes(ZAAK_A), 'de gewoonte staat er gewoon nog');
});

test('5. een waarneming voor je DIENST voedt geen aanbeveling', () => {
  const { v, plaats } = maak();
  /* Grens 2 van PLAATS.md: een waarneming draagt het doel waarvoor ze is
     gemaakt, en is buiten dat doel onbruikbaar. Hier staat de medewerker
     aantoonbaar BINNEN het hek van zaak A -- maar dat is vastgesteld om zijn
     aanwezigheid op het werk te bevestigen, niet om hem iets aan te raden. */
  plaats.plaatsBron('werkplek', 'dienst', () => [{ id: 'leverancier:' + ZAAK_A,
    naam: 'Zaak A', soort: 'punt', punten: [{ lat: 38.91, lng: 1.43 }] }]);
  plaats.plaatsVensterOpen(IK, { doel: 'dienst', bron: 'dienstrooster' });
  plaats.plaatsWaarneem(IK, { doel: 'dienst', hek: 'leverancier:' + ZAAK_A, wat: 'binnen' });

  const r = v.voorLid(IK, null);
  for (const w of r.verwachtingen) {
    assert.equal(w.nabij.gemeten, false,
      'de voorspeller ziet de dienst-waarneming niet, en hoort dat ook niet te doen');
  }
});

test('6. het stille seintje zwijgt als je aantoonbaar ergens anders bent', () => {
  const { v, plaats } = maak();
  const rijp = { verwachtingen: [{ code: ZAAK_A, rijp: 1, zekerheid: 0.9, soort: 'gewoonte',
    wat: 'Zaak A rond 19:00', waarom: '5 eerdere bezoeken' }] };
  assert.ok(v.seintjeVoor(rijp), 'een rijpe verwachting fluistert mee');

  /* Het seintje is indringender dan een lijst: het komt ongevraagd. "Rond deze
     tijd, als u wilt: uw gebruikelijke bezoek" terwijl je dertig kilometer
     verderop staat, is precies het meepraten waardoor iemand het hele systeem
     niet meer gelooft. */
  const elders = { verwachtingen: [{ ...rijp.verwachtingen[0], nabij: { bevestigd: false, gemeten: true } }] };
  assert.equal(v.seintjeVoor(elders), null, 'aantoonbaar elders: hij zwijgt');

  /* Maar NIET bij "niet gemeten". Dan weten we het niet, en een lid dat zijn
     locatie uit laat staan hoort niet stilletjes minder te krijgen. */
  const stil = { verwachtingen: [{ ...rijp.verwachtingen[0], nabij: { bevestigd: false, gemeten: false } }] };
  assert.ok(v.seintjeVoor(stil), 'niets gemeten: hij praat gewoon mee');
  void plaats;
});
