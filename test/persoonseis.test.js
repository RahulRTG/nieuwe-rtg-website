/* ============================================================================
   DE PERSOONSEIS: DE ZAAK WERD GECONTROLEERD, DE MENS NIET.

   WAAROM DIT BESTAAT

   Acht genres hielden de ZAAK tegen tot een medewerker een vergunning had
   gezien (kern/aanmeldingen/bewijs.js). Daarna kwam iedereen die zaak binnen
   met dezelfde vier cijfers -- de nanny bij een kinderopvang, de bewaker op
   post, de balie van een huisartsenpraktijk. En omdat kern/zorgketen/keten.js
   toetste of de ZAAK een huisarts was en niet of de MENS mocht voorschrijven,
   stuurde die balie een recept naar een apotheek.

   WAT ER WORDT VASTGELEGD

   1. Een genre zonder eis verandert niet: 55 van de 73 genres vragen niets
      extra's, en dat moet zo blijven.
   2. Een werk-eis houdt de sessie tegen, ook voor de manager.
   3. Een handeling-eis houdt de HANDELING tegen en laat het werk staan.
   4. Een ingediend stuk is geen bewijs: pas een aftekening telt.
   5. Een verlopen stuk telt niet meer -- en dat is de hele reden dat er een
      einddatum is.
   6. Een wijziging aan een afgetekend stuk wist de aftekening.
   7. Elke handeling in het register wordt ergens ECHT geweigerd.
   8. Elk genre in het register bestaat ook werkelijk.
   9. Het bedrijfsbewijs verloopt en komt op de herkeuringslijst.

   DE VIER MUTATIES DIE ZIJN GEDAAN, EN WAT ER VAN ZAKTE
   Staan aan het slot van dit bestand. Een toets die je niet hebt zien zakken is
   geen toets (LAT-regel 2).

   Puur, dus zonder server: de modules krijgen hun bronnen als parameter mee.
   Draai los: node --test test/persoonseis.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const persoonseisMod = require('../server/kern/persoonseis');
const vakbewijsMod = require('../server/kern/vakbewijs');
const { GENRES } = require('../server/seed/genres');
const bewijsMod = require('../server/kern/aanmeldingen/bewijs');

/* Een miniwereld: een database van niets, een klok die stilstaat op een dag die
   we zelf kiezen (anders hangt "verlopen" af van wanneer je de toets draait),
   en een identiteitslezer die we per lid kunnen zetten. */
const VANDAAG = '2026-08-17';
function bouw(opties) {
  const o = opties || {};
  const db = { data: {} };
  const store = vakbewijsMod({ db, save() {}, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    tijdVandaag: () => o.vandaag || VANDAAG });
  const identiteiten = o.identiteiten || {};
  const eis = persoonseisMod({
    vakbewijsHeeft: store.vakbewijsHeeft,
    sleutelLid: store.sleutelLid,
    identiteitVan: (p) => identiteiten[p.lid] || { geverifieerd: false, stand: 'none' }
  });
  return { db, store, eis, identiteiten,
    persoon: (lid) => ({ lid, sleutel: store.sleutelLid(lid) }) };
}

/* Een mens met alles op orde voor een genre: identiteit gezien, en elk gevraagd
   stuk ingediend EN afgetekend. */
function inOrde(K, lid, soorten, tot) {
  K.identiteiten[lid] = { geverifieerd: true, stand: 'verified' };
  for (const s of soorten) {
    K.store.vakbewijsZet(K.store.sleutelLid(lid), { wat: s, nummer: '12345', tot: tot || '2030-01-01' });
    K.store.vakbewijsTeken(K.store.sleutelLid(lid), s, 'M. de Vries (RTG)');
  }
}

test('1. een genre zonder eis verandert niet', () => {
  const K = bouw();
  // een restaurant hoort geen papieren te vragen aan zijn afwasser
  assert.equal(K.eis.magWerkenHier('restaurant', K.persoon(7)).ok, true);
  assert.equal(K.eis.magWerkenHier('hotel', null).ok, true,
    'zelfs zonder gekoppeld lid: een genre zonder eis vraagt niets');
  /* En de tegenproef in dezelfde toets, anders bewijst hij alleen dat de functie
     "ja" kan zeggen: een genre MET eis hoort hier wel op nee te staan. */
  assert.equal(K.eis.magWerkenHier('kinderopvang', K.persoon(7)).ok, false);
});

test('2. een werk-eis houdt de sessie tegen, ook voor de manager', () => {
  const K = bouw();
  const nee = K.eis.magWerkenHier('kinderopvang', K.persoon(7));
  assert.equal(nee.ok, false);
  assert.equal(nee.reden, 'persoonseis');
  assert.ok(/identiteit|VOG|Verklaring/i.test(nee.error), 'de weigering noemt wat er ontbreekt: ' + nee.error);

  /* De manager komt er niet met een vrijstelling doorheen. persoonVanActor kent
     geen managervlag, en dat is de hele bedoeling: juist de vrijstelling voor de
     baas is de deur waar een fraudeur op mikt. */
  const alsManager = K.eis.persoonVanActor({ manager: true, lid: 7 });
  assert.equal(K.eis.magWerkenHier('kinderopvang', alsManager).ok, false);

  inOrde(K, 7, ['vog']);
  assert.equal(K.eis.magWerkenHier('kinderopvang', K.persoon(7)).ok, true);
});

test('3. een handeling-eis houdt de handeling tegen en laat het werk staan', () => {
  const K = bouw();
  K.identiteiten[9] = { geverifieerd: true, stand: 'verified' };   // de balie: identiteit rond, geen BIG

  assert.equal(K.eis.magWerkenHier('huisarts', K.persoon(9)).ok, true,
    'een praktijk heeft een balie, en die balie hoort gewoon te kunnen werken');
  const nee = K.eis.magHandeling('huisarts', 'voorschrijven', K.persoon(9));
  assert.equal(nee.ok, false);
  assert.ok(/BIG/.test(nee.error), 'de weigering noemt het stuk: ' + nee.error);

  inOrde(K, 9, ['big']);
  assert.equal(K.eis.magHandeling('huisarts', 'voorschrijven', K.persoon(9)).ok, true);
  /* En de arts van de ene praktijk is geen apotheker: dezelfde mens, andere
     handeling, ander stuk. Zonder deze regel zou een BIG-nummer alles openen. */
  assert.equal(K.eis.magHandeling('apotheek', 'uitreiken', K.persoon(9)).ok, false,
    'een BIG-registratie is geen farmaceutische bevoegdheid');
});

test('4. een ingediend stuk is geen bewijs; pas de aftekening telt', () => {
  const K = bouw();
  K.identiteiten[3] = { geverifieerd: true, stand: 'verified' };
  const sl = K.store.sleutelLid(3);

  K.store.vakbewijsZet(sl, { wat: 'vog', nummer: 'A-1', tot: '2030-01-01' });
  const nee = K.eis.magWerkenHier('kinderopvang', K.persoon(3));
  assert.equal(nee.ok, false, 'zelf een VOG opschrijven is geen VOG hebben');
  assert.equal(nee.missend[0].reden, 'niet-gezien');

  /* Aftekenen zonder naam is geen aftekenen. */
  const zonderNaam = K.store.vakbewijsTeken(sl, 'vog', '   ');
  assert.equal(zonderNaam.status, 400);
  assert.equal(K.eis.magWerkenHier('kinderopvang', K.persoon(3)).ok, false);

  assert.equal(K.store.vakbewijsTeken(sl, 'vog', 'M. de Vries (RTG)').ok, true);
  assert.equal(K.eis.magWerkenHier('kinderopvang', K.persoon(3)).ok, true);

  // en een tweede keer aftekenen is geen tweede aftekening
  assert.equal(K.store.vakbewijsTeken(sl, 'vog', 'Iemand anders').status, 409);
});

test('5. een verlopen stuk telt niet meer, en een ingetrokken stuk ook niet', () => {
  const K = bouw();
  inOrde(K, 4, ['vog'], '2026-08-16');            // gisteren afgelopen
  const nee = K.eis.magWerkenHier('kinderopvang', K.persoon(4));
  assert.equal(nee.ok, false);
  assert.equal(nee.missend[0].reden, 'verlopen');
  assert.ok(/verlopen/i.test(nee.error), nee.error);

  // dezelfde rij, een dag eerder gelezen: dan is hij nog geldig
  const gisteren = bouw({ vandaag: '2026-08-15' });
  inOrde(gisteren, 4, ['vog'], '2026-08-16');
  assert.equal(gisteren.eis.magWerkenHier('kinderopvang', gisteren.persoon(4)).ok, true,
    'de geldigheid hangt aan de datum en niet aan een opgeslagen vlag');

  // intrekken werkt zonder op de einddatum te wachten
  const K2 = bouw();
  inOrde(K2, 5, ['vog']);
  assert.equal(K2.eis.magWerkenHier('kinderopvang', K2.persoon(5)).ok, true);
  K2.store.vakbewijsIntrek(K2.store.sleutelLid(5), 'vog', 'RTG', 'ingetrokken door de gemeente');
  const weg = K2.eis.magWerkenHier('kinderopvang', K2.persoon(5));
  assert.equal(weg.ok, false);
  assert.equal(weg.missend[0].reden, 'ingetrokken');
});

test('6. een wijziging aan een afgetekend stuk wist de aftekening', () => {
  const K = bouw();
  inOrde(K, 6, ['vog'], '2027-01-01');
  assert.equal(K.eis.magWerkenHier('kinderopvang', K.persoon(6)).ok, true);

  /* De goedkoopste fraude die er is: het gezien-vinkje laten staan en er een
     andere einddatum of een ander nummer onder schuiven. */
  K.store.vakbewijsZet(K.store.sleutelLid(6), { wat: 'vog', nummer: 'ANDER', tot: '2035-01-01' });
  const nee = K.eis.magWerkenHier('kinderopvang', K.persoon(6));
  assert.equal(nee.ok, false, 'een ander stuk is niet gezien, ook al staat er hetzelfde woord boven');
  assert.equal(nee.missend[0].reden, 'niet-gezien');
});

test('7. elke handeling uit het register wordt ergens ECHT geweigerd', () => {
  /* Dit is de toets die voorkomt dat het register rust geeft die niemand heeft
     verdiend: een handeling erbij zetten zonder hem aan te sluiten, laat deze
     zakken. De weigering wordt gemeten aan de ECHTE kernfunctie, niet aan een
     tekstzoektocht door de broncode -- een meter die tekst voor code aanziet is
     hier al drie keer misgegaan (LAT-regel 10). */
  const gedekt = {
    voorschrijven: (Z, actor) => Z.receptMaak('HUIS', { apotheek: 'APO', middel: 'iets' }, actor),
    verwijzen: (Z, actor) => Z.verwijsMaak('HUIS', { naar: 'SPEC', reden: 'controle' }, actor),
    uitreiken: (Z, actor) => Z.receptZet('APO', 'onbekend-id', 'klaar', actor)
  };
  const alle = Object.keys(persoonseisMod.HANDELINGEN);
  assert.deepEqual(alle.sort(), Object.keys(gedekt).sort(),
    'elke handeling in het register heeft hier een proef; voeg hem toe of sluit hem aan');

  const K = bouw();
  const zaken = { HUIS: { code: 'HUIS', type: 'huisarts' }, APO: { code: 'APO', type: 'apotheek' },
    SPEC: { code: 'SPEC', type: 'specialist' } };
  const Z = require('../server/kern/zorgketen')({
    db: { data: {} }, save() {}, crypto: require('crypto'),
    findSupplier: (c) => zaken[String(c || '').toUpperCase()] || null,
    persoonseis: K.eis
  }).zorgketen;

  K.identiteiten[11] = { geverifieerd: true, stand: 'verified' };   // werkt er, geen vakbewijs
  const actor = { lid: 11, manager: true };
  for (const h of alle) {
    const r = gedekt[h](Z, actor);
    assert.equal(r.status, 403, 'handeling "' + h + '" hoort geweigerd te worden zonder stuk');
    assert.ok(r.persoonseis, 'handeling "' + h + '" hoort te zeggen WELK stuk ontbreekt');
  }

  /* De tegenproef, anders bewijst het bovenstaande alleen dat er iets 403 geeft:
     mét de stukken moet dezelfde aanroep er wel doorheen. */
  inOrde(K, 11, ['big', 'farmacie']);
  assert.equal(Z.receptMaak('HUIS', { apotheek: 'APO', middel: 'iets' }, actor).ok, true);
  assert.equal(Z.verwijsMaak('HUIS', { naar: 'SPEC', reden: 'controle' }, actor).ok, true);
  /* uitreiken komt nu voorbij de persoonspoort en valt op het onbekende recept:
     404 en niet 403 is precies het bewijs dat de poort open is. */
  assert.equal(Z.receptZet('APO', 'onbekend-id', 'klaar', actor).status, 404);
});

test('7b. de gedeelde bedrijfsinlog is smal herkend, en niemand anders valt eronder', () => {
  /* server.js laat EEN actor langs de poort: de demo-bedrijfsinlog, die geen
     personeelsrij en geen lidnummer draagt. Die uitzondering is alleen veilig
     zolang de VORM smal blijft -- wordt hij breder, dan glipt er personeel
     doorheen. Vandaar deze toets op de vorm zelf; de `DEMO`-voorwaarde ernaast
     staat in server.js en is daar een enkel woord dat je kunt zien staan. */
  const K = bouw();
  assert.equal(K.eis.isGedeeldeInlog({ name: 'Beheer', role: 'manager', manager: true,
    staffId: null, lid: null }), true, 'de bedrijfsinlog zelf');

  assert.equal(K.eis.isGedeeldeInlog({ name: 'Hanna', manager: true, staffId: 3, lid: null }), false,
    'een personeelslid draagt een staffId en is dus geen gedeelde inlog');
  assert.equal(K.eis.isGedeeldeInlog({ name: 'Eigenaar', manager: true, staffId: null, lid: 42 }), false,
    'de eigenaar met zijn eigen RTG-account is een mens en wordt gewoon getoetst');
  assert.equal(K.eis.isGedeeldeInlog({ name: 'Ines', manager: false, staffId: null, lid: null }), false,
    'zonder managervlag valt er niets onder de uitzondering');
  assert.equal(K.eis.isGedeeldeInlog(null), false);
});

test('8. elk genre in het register bestaat werkelijk', () => {
  /* Een eis op een genre dat niet bestaat, bewaakt niets en is niet te zien.
     Andersom is ook een bewering: de acht bewijs-genres van de bedrijfskant
     horen allemaal ook een persoonskant te hebben, want juist daar is de zaak
     wel gecontroleerd en de mens niet. */
  for (const g of persoonseisMod.GENRES_MET_EIS) {
    assert.ok(GENRES[g], 'genre "' + g + '" staat in de persoonseis maar niet in het register');
  }
  for (const g of bewijsMod.EISEN_IDS) {
    assert.ok(persoonseisMod.EISEN[g],
      'genre "' + g + '" vraagt bewijs van de zaak maar niets van de mens; dat was precies het gat');
  }
});

test('9. het bedrijfsbewijs verloopt en komt op de herkeuringslijst', () => {
  const B = bewijsMod({ save() {}, kap: (t, n) => String(t == null ? '' : t).trim().slice(0, n || 200),
    nu: () => '2026-08-17T12:00:00.000Z' });
  const a = { id: 'a1', bedrijf: { type: 'kinderopvang', naam: 'Nido', bewijsNodig: true } };

  B.bewijsIndien(a, { soort: 'LRK', nummer: '123', geldigTot: '2026-08-16' });
  B.bewijsTeken(a, 'M. de Vries');
  assert.equal(B.bewijsStand(a).stand, 'verlopen', 'een afgetekend stuk kan aflopen');
  assert.equal(B.bewijsKlaar(a), false, 'en zet dan geen zaak klaar');
  assert.equal(B.bewijsHerkeuring([a], 60).length, 1);
  assert.equal(B.bewijsHerkeuring([a], 60)[0].verlopen, true);

  // met een datum in de toekomst is hij gewoon gezien en zet hij de zaak klaar
  const b = { id: 'a2', bedrijf: { type: 'kinderopvang', naam: 'Nido 2', bewijsNodig: true } };
  B.bewijsIndien(b, { soort: 'LRK', nummer: '124', geldigTot: '2030-01-01' });
  B.bewijsTeken(b, 'M. de Vries');
  assert.equal(B.bewijsStand(b).stand, 'gezien');
  assert.equal(B.bewijsKlaar(b), true);
  assert.equal(B.bewijsHerkeuring([b], 60).length, 0, 'ver weg hoort niet op de lijst');
  assert.equal(B.bewijsHerkeuring([b], 5000).length, 1, 'met een ruimer venster wel');

  // en een stuk zonder einddatum loopt door, zoals een inschrijving in een register
  const c = { id: 'a3', bedrijf: { type: 'apotheek', naam: 'Apotheek', bewijsNodig: true } };
  B.bewijsIndien(c, { soort: 'inschrijving', nummer: '9' });
  B.bewijsTeken(c, 'M. de Vries');
  assert.equal(B.bewijsKlaar(c), true);
  assert.equal(B.bewijsHerkeuring([c], 5000).length, 0);
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   1. RAAK. In kern/zorgketen/keten.js de regel `const p = persoonMag(code,
      'voorschrijven', actor)` plus zijn weigering weggehaald -- de oude stand,
      waarin alleen het genre werd getoetst.
      -> toets 7 zakte: "handeling voorschrijven hoort geweigerd te worden
         zonder stuk" (403 verwacht, ok:true gekregen).

   2. RAAK. In kern/vakbewijs.js `if (anders) { v.afgetekend = null; ... }`
      vervangen door niets, zodat een wijziging de aftekening laat staan.
      -> toets 6 zakte: "een ander stuk is niet gezien, ook al staat er
         hetzelfde woord boven".

   3. RAAK. In kern/vakbewijs.js geldigOp() de regel `if (v.tot && v.tot < dag)
      return false` weggehaald.
      -> toets 5 zakte op de eerste bewering (verlopen VOG gaf ok:true).
      Let op: toets 9 bleef staan, want die meet de BEDRIJFSkant -- twee
      verschillende verlooppaden, en dat ze niet samen omvallen is zelf een
      bevinding.

   4. RAAK. In kern/persoonseis.js bij magWerkenHier de regel `if (!eis || !eis
      .werk || !eis.werk.length) return { ok: true }` verbreed naar `return {
      ok: true }` (alles open).
      -> toetsen 1, 2, 4, 5 en 6 zakten. Dat is een grove mutatie en bewijst dus
         weinig meer dan dat de poort bestaat; hij staat hier omdat een mutatie
         die ALLES laat zakken zelf een uitkomst is (te grof), en niet omdat hij
         iets fijns aantoont.

   5. RAAK. In kern/persoonseis.js isGedeeldeInlog() verbreed van "geen staffId
      EN geen lid EN manager" naar alleen "manager" -- de vorm waarin de
      demo-uitzondering ook echt personeel zou laten passeren.
      -> toets 7b zakte: "een personeelslid draagt een staffId en is dus geen
         gedeelde inlog".

   AFGESLAGEN, EN INMIDDELS OPGELOST (het spoor blijft staan, want de bevinding
   was echt):
   - In routes/vakbewijs.js de soortcontrole bij /api/vakbewijs/zet weggehaald.
     Geen enkele toets in DIT bestand zakte -- die controle zit op de route en
     dit bestand is puur. Hij hing dus alleen op mensenwerk.
     Dat gat is gedicht: test/vakbewijs-routes.test.js loopt dezelfde keten over
     echte HTTP, en daar is precies deze mutatie RAAK (toets 2). Wat hier een
     afgeslagen mutatie was, is daar een toets die zakt.
   ========================================================================== */
