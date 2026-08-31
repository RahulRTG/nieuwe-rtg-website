/* ============================================================================
   DE GIFTSTAND -- de doneerknop die nog dicht staat (kern/rtfos/gift.js).

   Deze toets bewaakt een voorbereiding, en dat is een ander soort toets dan
   gewoonlijk: hij moet vooral vastleggen wat er NIET gebeurt. Zolang de drie
   besluiten uit GIFT.md niet genomen zijn, hoort er geen cent te bewegen en
   hoort er geen woord te staan dat meer belooft dan er is.

   Vier dingen:

   1. DE STAND IS DICHT EN DE WEIGERING IS EEN ZIN. Geen grijze knop, geen lege
      lijst: wie wil geven, hoort te lezen dat het niet kan en waarom.
   2. OPEN KAN NIET ZONDER ONTVANGER EN VORM. Dat zijn besluit 1 en 2, en ze
      zijn niet te omzeilen door de stand als eerste te zetten.
   3. HET VOORNEMEN ZEGT WAT HET IS. Een tegenprestatie maakt er sponsoring van
      met een factuur; boven de drempel wordt er eerst beoordeeld; en zolang de
      ANBI-status onbekend is, heet het stuk geen giftbewijs.
   4. ER BEWEEGT GEEN GELD. Deze module raakt de betaalpoort nergens aan, en
      deze toets zakt als dat verandert.

   Draai los: node --test test/rtfos-gift.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* Op de module en niet door de deur: hier gaat het om de regels zelf, en een
   wegwerpserver zou er alleen HTTP-ruis omheen zetten. De poorten (ledendeur
   voor lezen, boardroom voor de schakelaar) staan op de route en worden in
   test/rtfos-ruil.test.js langs dezelfde weg getoetst. */
function bouw() {
  const db = { data: {} };
  const save = () => {};
  const ctx = require('../server/kern/rtfos/basis')({ db, save, crypto: require('crypto'),
    boardroomWie: () => null, magBoardroom: () => false });
  /* Net als kern/rtfos/index.js: basis() geeft db, save en crypto niet terug,
     die worden er daar bij gezet. Zonder deze regel toetst dit bestand een ctx
     die in het echt niet bestaat -- en dan zakt hij op iets wat niet stuk is. */
  Object.assign(ctx, { db, save, crypto: require('crypto') });
  return { gift: require('../server/kern/rtfos/gift')(ctx), ctx, db };
}

test('de stand staat dicht, en zegt met een zin waarom', () => {
  const { gift } = bouw();
  const s = gift.stand();
  assert.equal(s.stand, 'dicht');
  assert.match(s.uitleg, /geen giften aan/i);
  assert.match(s.uitleg, /geen storing/i, 'een dichte knop moet niet als storing lezen');
  const watMist = s.ontbreekt.map(x => x.wat);
  assert.deepEqual(watMist.sort(), ['anbi', 'ontvanger', 'vormen'],
    'de eigenaar hoort te lezen WELKE besluiten nog openstaan, niet dat het "niet kan"');
});

test('voorbereiden weigert zolang de knop dicht staat', () => {
  const { gift } = bouw();
  const r = gift.voorbereid({ euro: 25 });
  assert.equal(r.status, 409);
  assert.match(r.error, /geen giften aan/i);
  assert.ok(r.ontbreekt.length, 'de weigering noemt niet wat er ontbreekt');
});

test('open kan niet zonder ontvanger en vorm -- ook niet door de stand eerst te zetten', () => {
  const { gift } = bouw();
  const kaal = gift.standZet({ stand: 'open' }, 'toets');
  assert.equal(kaal.status, 409);
  assert.match(kaal.error, /waar landt het geld/i);

  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00 RTFO 0000 0000 00' } }, 'toets');
  const halve = gift.standZet({ stand: 'open' }, 'toets');
  assert.equal(halve.status, 409, 'met alleen een ontvanger ging de knop al open');
  assert.match(halve.error, /giftvormen/i);

  gift.standZet({ vormen: ['eenmalig'] }, 'toets');
  assert.equal(gift.standZet({ stand: 'open' }, 'toets').stand, 'open');
});

test('een ontvanger zonder aanduiding bestaat niet', () => {
  const { gift } = bouw();
  const r = gift.standZet({ ontvanger: { soort: 'positie', aanduiding: '' } }, 'toets');
  assert.equal(r.status, 400);
  const s = gift.standZet({ ontvanger: { soort: 'verzonnen', aanduiding: 'iets' } }, 'toets');
  assert.equal(s.status, 400, 'een ontvangersoort die niet bestaat werd aangenomen');
});

test('onbekende ANBI-status levert geen giftbewijs op', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');

  const r = gift.voorbereid({ euro: 25 });
  assert.equal(r.voornemen.aftrekbaar, false);
  assert.equal(r.voornemen.stuk, 'ontvangstbevestiging');
  assert.ok(r.zegt.some(z => /ligt niet vast/i.test(z)),
    'bij een onbekende status hoort er te staan dat het niet vastligt, niet dat het niet aftrekbaar IS');

  // en "nee" leest anders dan "onbekend"
  gift.standZet({ anbi: 'nee' }, 'toets');
  const nee = gift.voorbereid({ euro: 25 });
  assert.ok(nee.zegt.some(z => /niet aftrekbaar/i.test(z)));
  assert.ok(!nee.zegt.some(z => /ligt niet vast/i.test(z)), '"nee" en "onbekend" lazen hetzelfde');
});

test('ANBI ja vraagt een RSIN van negen cijfers, en dan pas heet het een giftbewijs', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');
  assert.equal(gift.standZet({ anbi: 'ja', rsin: '123' }, 'toets').status, 400);

  gift.standZet({ anbi: 'ja', rsin: '123456789' }, 'toets');
  const r = gift.voorbereid({ euro: 25 });
  assert.equal(r.voornemen.stuk, 'giftbewijs');
  assert.equal(r.voornemen.aftrekbaar, true);
});

test('een tegenprestatie maakt er sponsoring van, met een factuur', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' }, vormen: ['eenmalig'],
    anbi: 'ja', rsin: '123456789', stand: 'open' }, 'toets');

  const r = gift.voorbereid({ euro: 500, tegenprestatie: true });
  assert.equal(r.voornemen.soort, 'sponsoring');
  assert.equal(r.voornemen.aftrekbaar, false, 'sponsoring werd als aftrekbare gift gepresenteerd');
  assert.equal(r.voornemen.stuk, 'factuur',
    'donateur.js belooft bij sponsoring een factuur; dit scherm zei iets anders');
  assert.ok(!r.zegt.some(z => /giftbewijs; de RTFoundation is een ANBI/.test(z)));
});

test('boven de drempel wordt er eerst beoordeeld, en dat staat er vooraf', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');

  const klein = gift.voorbereid({ euro: 25 });
  assert.equal(klein.voornemen.beoordeeldVooraf, false);

  const groot = gift.voorbereid({ euro: 12000 });
  assert.equal(groot.voornemen.beoordeeldVooraf, true);
  assert.ok(groot.zegt.some(z => /eerst beoordeeld/i.test(z)),
    'de gever hoort vooraf te weten dat zijn gift blijft staan');

  /* De drempel komt uit herkomst.js en staat hier niet nog een keer. Verandert
     hij daar, dan hoort dit mee te bewegen -- vandaar deze vergelijking en geen
     hard getal in de toets. */
  const drempel = require('../server/kern/rtfos/herkomst').DREMPEL_CENTEN;
  assert.equal(gift.voorbereid({ euro: (drempel / 100) - 1 }).voornemen.beoordeeldVooraf, false);
  assert.equal(gift.voorbereid({ euro: drempel / 100 }).voornemen.beoordeeldVooraf, true);
});

test('een vorm die niet openstaat, gaat niet alsnog open via het voornemen', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');
  const r = gift.voorbereid({ euro: 10, vorm: 'periodiek' });
  assert.equal(r.status, 409);
  const g = gift.voorbereid({ euro: 10, vorm: 'geoormerkt' });
  assert.equal(g.status, 409, 'geoormerkt kon terwijl alleen eenmalig openstond');
});

test('een geoormerkte gift wijst een project aan', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' },
    vormen: ['eenmalig', 'geoormerkt'], stand: 'open' }, 'toets');
  assert.equal(gift.voorbereid({ euro: 50, vorm: 'geoormerkt' }).status, 400);
  assert.ok(gift.voorbereid({ euro: 50, vorm: 'geoormerkt', project: 'Huiswerkklas' }).ok);
});

test('het voornemen zegt zelf dat er niets is gebeurd', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');
  const r = gift.voorbereid({ euro: 25 });
  assert.match(r.nietGedaan, /niets betaald/i,
    'een scherm dat dit veld overslaat, moet het antwoord zelf nog kunnen tonen');
});

test('de giftlaag raakt geen geld aan, en reikt niet buiten het eigen domein', () => {
  /* COMMENTAAR EN TEKST TELLEN NIET MEE, en dat is geen versoepeling. De eerste
     versie hiervan zakte op de zin "een positie in RTG Pay of een bankrekening"
     -- een uitlegregel voor de eigenaar. Een toets die op woorden in
     schermteksten zakt, leert je teksten verbuigen in plaats van code.

     ALLE DRIE DE BESTANDEN, want de logica is bij het opknippen verhuisd. Een
     toets die na een splitsing op het oude bestand blijft kijken, is groen om
     de verkeerde reden. */
  const delen = ['gift.js', 'gift-voornemen.js', 'gift-vormen.js'];
  for (const deel of delen) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', deel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""');

    for (const weg of ['pay', 'poort', 'grootboek', 'saldo', 'boeking', 'betaal', 'incasso', 'sepa', 'wallet']) {
      assert.ok(!new RegExp('\\b' + weg, 'i').test(code),
        deel + ' reikt naar "' + weg + '" -- klaarzetten is klaarzetten, en betalen hoort langs kern/pay/poort.js met een eigen besluit');
    }
  }

  /* En niets van buiten het domein. De requires staan in de ONGESTRIPTE bron,
     want het pad zit in een tekst. */
  for (const deel of delen) {
    const ruw = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', deel), 'utf8');
    for (const m of ruw.match(/require\((['"])([^'"]+)\1\)/g) || []) {
      const pad = m.replace(/require\(['"]|['"]\)/g, '');
      assert.match(pad, /^\.\/(gift-vormen|gift-voornemen|herkomst)$/,
        deel + ' haalt ' + pad + ' binnen; de giftlaag hoort binnen kern/rtfos te blijven');
    }
  }
});
