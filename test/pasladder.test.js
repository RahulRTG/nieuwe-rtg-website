/* ============================================================================
   DE LADDER: vijf treden, elk met een bodem.

   Het besluit van 20 augustus 2026 zet een MKB-laag tussen consument en
   enterprise (Business Lite, 150 euro) en maakt de twee bovenste treden
   contractueel met een "vanaf". De eigenaar wilde vier dingen HARD in code:

     1. er is precies EEN gratis abonnement
     2. Business Lite kost minimaal 150 euro per maand
     3. Business kost minimaal 5.000 euro per maand
     4. Lifestyle kost minimaal 20.000 euro per maand

   Dit bestand is wat die vier regels waarmaakt. De vijfde en zesde regel (AI
   boven de bundel, en "nooit ongemerkt variabele kosten") gaan over verbruik en
   staan hier NIET -- die laag bestaat nog niet, en een toets op een laag die er
   niet is, is een toets die niets meet. PRIJZEN.md zegt wat ze eerst nodig
   hebben.

   DE BEWERING DIE ERTOE DOET staat in toets 5: een bodem mag nooit een prijs
   worden. Dat is dezelfde fout als de 9.075 euro uit de kop van
   server/kern/pasprijs.js, alleen met een nieuw getal.

   Draai los: node --experimental-sqlite --test test/pasladder.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const ladder = require('../server/kern/pasladder');
const { maandCentenVoor, bodemCentenVoor, contractueel } = require('../server/kern/pasprijs');

/* REGEL 1. Niet "is 'gratis' de enige met bodem 0" maar: hoeveel treden staan er
   op nul? Zou iemand een tweede gratis trede toevoegen, dan valt deze toets om
   in plaats van dat de regel stilzwijgend verdwijnt. */
test('1. er is precies EEN gratis abonnement', () => {
  const gratis = ladder.gratisTreden();
  assert.equal(gratis.length, 1, 'twee gratis treden betekent dat "gratis" niets meer zegt; gevonden: ' +
    gratis.map(t => t.id).join(', '));
  assert.equal(ladder.enigeGratis(), 'gratis');
  assert.equal(gratis[0].vast, true, 'en die ene is niet instelbaar, ook niet omhoog');
});

test('2. de gratis app kan niet op een bedrag worden gezet', () => {
  assert.match(ladder.keurCenten('gratis', 100), /kosteloos/, 'gratis blijft gratis');
  assert.match(ladder.keurCenten('gratis', 0), /kosteloos/, 'ook nul is geen geldige zet: er valt niets te zetten');
});

/* REGELS 2, 3 EN 4, met per trede het bedrag er net onder en er net op. Een
   toets die alleen "1 cent" probeert, meet de bodem niet maar het teken. */
test('3. elke betaalde trede heeft zijn bodem, en die houdt', () => {
  const bodems = { 'business-lite': 15000, business: 500000, lifestyle: 2000000 };
  for (const [pas, bodem] of Object.entries(bodems)) {
    assert.equal(bodemCentenVoor(pas), bodem, pas + ' hoort een bodem van ' + bodem + ' centen te hebben');
    assert.ok(ladder.keurCenten(pas, bodem - 1), pas + ': een cent onder de bodem hoort geweigerd te worden');
    assert.ok(ladder.keurCenten(pas, Math.round(bodem / 2)), pas + ': de helft van de bodem hoort geweigerd te worden');
  }
  // en de trede die WEL instelbaar is, accepteert zijn eigen bodem en alles erboven
  assert.equal(ladder.keurCenten('business-lite', 15000), null, '150 euro precies mag');
  assert.equal(ladder.keurCenten('business-lite', 99900), null, 'en meer mag ook');
});

test('4. de RTG Pass houdt zijn 65 euro als bodem en als standaard', () => {
  assert.equal(bodemCentenVoor('rtg'), 6500);
  assert.equal(maandCentenVoor(null, 'rtg'), 6500, 'niet-ingesteld is de standaard, niet nul');
  assert.ok(ladder.keurCenten('rtg', 6499), 'onder 65 euro kan de consumentenpas niet');
});

/* DE BELANGRIJKSTE. Een bodem is een ondergrens voor INVOER en een "vanaf" op
   een prijslijst. Hij mag nooit het bedrag worden dat afgerekend wordt: dan
   staat er 5.000 euro op de factuur van een klant die 12.000 heeft afgesproken,
   of andersom. Vandaar dat maandCentenVoor voor een contractuele trede null
   geeft en de bodem alleen op expliciet verzoek te krijgen is. */
test('5. een bodem is geen prijs: contractuele treden dragen null, niet hun bodem', () => {
  for (const pas of ['business', 'lifestyle']) {
    assert.equal(contractueel(pas), true, pas + ' is contractueel');
    assert.equal(maandCentenVoor(null, pas), null, pas + ': geen afgesproken bedrag is null');
    assert.notEqual(maandCentenVoor(null, pas), bodemCentenVoor(pas),
      pas + ': de bodem mag NOOIT als maandbedrag terugkomen -- dat is de 9.075-euro-fout met een nieuw getal');
    // ook niet als iemand er toch een bedrag in de prijslijst zet
    assert.equal(maandCentenVoor({ [pas]: { maandCenten: 999900 } }, pas), null,
      pas + ': de hoogte staat op het contract, niet in de prijslijst');
  }
});

test('6. de boardroom kan een contractuele trede niet als prijslijst zetten', () => {
  const db = { data: {} };
  const g = require('../server/kern/geldregie').maakGeldregie({ db, save: () => {}, crypto });
  for (const pas of ['business', 'lifestyle']) {
    const r = g.geldPasprijsZet({ pas, euro: 30000 });
    assert.equal(r.status, 400, pas + ' hoort in de prijslijst geweigerd te worden');
    assert.match(r.error, /per klant af/, 'met de reden erbij, niet met "ongeldig"');
  }
});

test('7. de boardroom weigert een bedrag onder de bodem, en neemt het bedrag erop', () => {
  const db = { data: {} };
  const g = require('../server/kern/geldregie').maakGeldregie({ db, save: () => {}, crypto });
  const teLaag = g.geldPasprijsZet({ pas: 'rtg', euro: 40 });
  assert.equal(teLaag.status, 400);
  assert.match(teLaag.error, /minimaal/, 'de invoerder hoort te lezen wat de ondergrens is');
  assert.equal(maandCentenVoor({}, 'rtg'), 6500, 'en de oude prijs staat er nog');

  const mag = g.geldPasprijsZet({ pas: 'rtg', euro: 65 });
  assert.equal(mag.status, 200, JSON.stringify(mag));
  assert.equal(mag.maandCenten, 6500, 'de bodem zelf is een geldige prijs');
});

/* De ladder is de ENIGE lijst treden. Loopt de prijslijst van de regie uiteen
   met de ladder, dan bestaat er weer een tweede antwoord op dezelfde vraag --
   precies waar kern/pasprijs.js voor gemaakt is. */
test('8. de geld-regie serveert exact de ladder, met vanaf en niet met prijs', () => {
  const db = { data: {} };
  const g = require('../server/kern/geldregie').maakGeldregie({ db, save: () => {}, crypto });
  const passen = g.geldPasprijzen().passen;
  assert.deepEqual(Object.keys(passen), ladder.treden().map(t => t.id),
    'dezelfde treden, in dezelfde volgorde');

  for (const t of ladder.treden()) {
    const rij = passen[t.id];
    if (t.contractueel) {
      assert.equal(rij.vanafCenten, t.bodemCenten, t.id + ' toont een vanaf');
      assert.equal(rij.maandCenten, undefined, t.id + ' draagt GEEN maandbedrag');
      assert.equal(rij.rtfVanafCenten, Math.round(t.bodemCenten * 0.30), t.id + ': de 30% hoort ook een vanaf te zijn');
    } else {
      assert.equal(Number.isFinite(rij.maandCenten), true, t.id + ' draagt wel een bedrag');
      assert.equal(rij.vanafCenten, undefined, t.id + ' heeft geen vanaf nodig');
    }
  }
});

/* Business Lite is BESLOTEN maar bestaat nog niet als pas: de toegangsregels,
   de stem per pas en de functieschakelaars kennen hem niet. Zolang dat zo is,
   hoort hij niet als koopbaar product op een prijslijst te verschijnen. Deze
   toets valt om zodra iemand hem beschikbaar zet zonder de rest te bouwen -- en
   dat is precies de bedoeling. */
test('9. Business Lite staat in de ladder maar is nog niet beschikbaar', () => {
  const lite = ladder.trede('business-lite');
  assert.ok(lite, 'de trede bestaat: de prijs is besloten');
  assert.equal(lite.bodemCenten, 15000);
  assert.equal(lite.beschikbaar, false,
    'zet je dit op true, bouw dan eerst de pas zelf (aanmeldingen, stem, functieschakelaars) -- zie PRIJZEN.md');

  /* De omzetstaat van het ledenregister leidt zijn kolommen af uit BESCHIKBAAR,
     dus een niet-uitgerolde trede levert daar geen lege regel met nul euro op. */
  const kolommen = ladder.treden().filter(t => t.beschikbaar).map(t => t.id);
  assert.equal(kolommen.includes('business-lite'), false,
    'de omzetstaat toont geen trede zonder leden');
  assert.deepEqual(kolommen, ['gratis', 'rtg', 'business', 'lifestyle'],
    'en de volgorde volgt de ladder, van licht naar zwaar');
});
