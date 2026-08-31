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

  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' } }, 'toets');
  const halve = gift.standZet({ stand: 'open' }, 'toets');
  assert.equal(halve.status, 409, 'met alleen een ontvanger ging de knop al open');
  assert.match(halve.error, /giftvormen/i);

  gift.standZet({ vormen: ['eenmalig'] }, 'toets');
  assert.equal(gift.standZet({ stand: 'open' }, 'toets').stand, 'open');
});

test('de ontvanger is een wallet, en een wallet zonder code bestaat niet', () => {
  const { gift } = bouw();
  const leeg = gift.standZet({ ontvanger: { soort: 'wallet', code: '' } }, 'toets');
  assert.equal(leeg.status, 400);
  const anders = gift.standZet({ ontvanger: { soort: 'bankrekening', aanduiding: 'NL00' } }, 'toets');
  assert.equal(anders.status, 400,
    'een andere ontvangersoort werd aangenomen -- de stichting krijgt een wallet zoals een leverancier, en betaalt zichzelf daarvandaan uit');
  assert.ok(gift.standZet({ ontvanger: { soort: 'wallet', code: 'rtf-wallet' } }, 'toets').ontvanger.code === 'RTF-WALLET',
    'de walletcode hoort genormaliseerd te worden');
});

test('"aangevraagd" leest anders dan nee, onbekend en ja -- en belooft niets', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');

  gift.standZet({ anbi: 'aangevraagd' }, 'toets');
  const r = gift.voorbereid({ euro: 25 });
  assert.equal(r.voornemen.aftrekbaar, false, 'een lopende aanvraag is geen ANBI-status');
  assert.equal(r.voornemen.stuk, 'ontvangstbevestiging');
  const zin = r.zegt.join(' ');
  assert.match(zin, /aanvraag loopt/i, 'de gever hoort te lezen dat de aanvraag loopt');
  assert.match(zin, /zeggen wij niet toe/i,
    'een lopende aanvraag mag geen aftrekbaarheid suggereren -- dat hangt af van de beschikking');

  // en de vier standen geven vier verschillende zinnen
  const zinnen = new Set();
  for (const stand of ['onbekend', 'nee', 'aangevraagd', 'ja']) {
    gift.standZet(stand === 'ja' ? { anbi: 'ja', rsin: '123456789' } : { anbi: stand }, 'toets');
    zinnen.add(gift.voorbereid({ euro: 25 }).zegt.join(' '));
  }
  assert.equal(zinnen.size, 4, 'twee ANBI-standen leverden dezelfde tekst op');
});

test('onbekende ANBI-status levert geen giftbewijs op', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');

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
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');
  assert.equal(gift.standZet({ anbi: 'ja', rsin: '123' }, 'toets').status, 400);

  gift.standZet({ anbi: 'ja', rsin: '123456789' }, 'toets');
  const r = gift.voorbereid({ euro: 25 });
  assert.equal(r.voornemen.stuk, 'giftbewijs');
  assert.equal(r.voornemen.aftrekbaar, true);
});

test('een tegenprestatie maakt er sponsoring van, met een factuur', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' }, vormen: ['eenmalig'],
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
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');

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
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');
  const r = gift.voorbereid({ euro: 10, vorm: 'periodiek' });
  assert.equal(r.status, 409);
  const g = gift.voorbereid({ euro: 10, vorm: 'geoormerkt' });
  assert.equal(g.status, 409, 'geoormerkt kon terwijl alleen eenmalig openstond');
});

test('een geoormerkte gift wijst een project aan', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' },
    vormen: ['eenmalig', 'geoormerkt'], stand: 'open' }, 'toets');
  assert.equal(gift.voorbereid({ euro: 50, vorm: 'geoormerkt' }).status, 400);
  assert.ok(gift.voorbereid({ euro: 50, vorm: 'geoormerkt', project: 'Huiswerkklas' }).ok);
});

test('het voornemen zegt zelf dat er niets is gebeurd', () => {
  const { gift } = bouw();
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' }, vormen: ['eenmalig'], stand: 'open' }, 'toets');
  const r = gift.voorbereid({ euro: 25 });
  assert.match(r.nietGedaan, /niets betaald/i,
    'een scherm dat dit veld overslaat, moet het antwoord zelf nog kunnen tonen');
});

test('geld beweegt in precies EEN bestand, en de giftlaag blijft binnen het eigen domein', () => {
  /* COMMENTAAR EN TEKST TELLEN NIET MEE, en dat is geen versoepeling. De eerste
     versie hiervan zakte op de zin "een positie in RTG Pay of een bankrekening"
     -- een uitlegregel voor de eigenaar. Een toets die op woorden in
     schermteksten zakt, leert je teksten verbuigen in plaats van code.

     ALLE DRIE DE BESTANDEN, want de logica is bij het opknippen verhuisd. Een
     toets die na een splitsing op het oude bestand blijft kijken, is groen om
     de verkeerde reden. */
  /* DE INVARIANT IS VERSCHOVEN EN NIET VERZWAKT. Toen hier alleen werd
     klaargezet, gold: geen van de bestanden raakt geld aan. Nu er een
     bevestigde gift is, geldt: geld beweegt in PRECIES EEN bestand
     (gift-betalen.js, met zijn eigen toets hieronder) en de andere drie blijven
     schoon. Dat is de vorm die je wilt kunnen nalopen -- een laag waarin drie
     van de vier bestanden niets met geld doen, is te overzien. */
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
  for (const deel of delen.concat('gift-betalen.js')) {
    const ruw = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', deel), 'utf8');
    for (const m of ruw.match(/require\((['"])([^'"]+)\1\)/g) || []) {
      const pad = m.replace(/require\(['"]|['"]\)/g, '');
      assert.match(pad, /^\.\/(gift-vormen|gift-voornemen|gift-betalen|herkomst)$/,
        deel + ' haalt ' + pad + ' binnen; de giftlaag hoort binnen kern/rtfos te blijven -- de betaallaag komt via de ctx en niet via een require');
    }
  }
});

/* ---------------------------------------------------------------------------
   DE BEVESTIGDE GIFT -- de enige plek in deze laag waar geld beweegt.

   Met een NAGEBOOTSTE betaallaag, en dat is hier de juiste keuze: wat getoetst
   wordt is de orkestratie (wordt er opnieuw gerekend, gaat het naar de goede
   wallet, ontstaat de bron na de boeking), niet of kern/pay kan boeken -- dat
   heeft zijn eigen toetsen. De echte weg is met de hand nagelopen: EUR 25 van
   lid:... naar partner:RTF-WALLET, min 35 cent betaaldienstkosten.
   --------------------------------------------------------------------------- */
function bouwMetPay(payAntwoord) {
  const geboekt = [];
  const bronnen = [];
  const db = { data: {} };
  const save = () => {};
  const ctx = require('../server/kern/rtfos/basis')({ db, save, crypto: require('crypto'),
    boardroomWie: () => null, magBoardroom: () => false });
  Object.assign(ctx, { db, save, crypto: require('crypto') });
  if (payAntwoord !== null) {
    ctx.pay = { partnerIn: async (b) => { geboekt.push(b); return payAntwoord || { ok: true, centen: b.centen, kosten: 35 }; } };
  }
  ctx.bronUitGift = (b) => { const r = Object.assign({ id: 'B' + bronnen.length }, b); bronnen.push(r); return r; };
  const gift = require('../server/kern/rtfos/gift')(ctx);
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' },
    vormen: ['eenmalig', 'geoormerkt', 'periodiek'], anbi: 'aangevraagd', stand: 'open' }, 'toets');
  return { gift, geboekt, bronnen };
}

test('de gift gaat naar de wallet uit de stand, met de codenaam uit de sessie', async () => {
  const { gift, geboekt } = bouwMetPay();
  const r = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 25 });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 160));
  assert.equal(geboekt.length, 1);
  assert.equal(geboekt[0].supplierCode, 'RTF-WALLET');
  assert.equal(geboekt[0].codenaam, 'Poolvos 1BE9');
  assert.equal(geboekt[0].centen, 2500);
  assert.equal(geboekt[0].soort, 'gift');
});

test('wat de browser meestuurt over de uitkomst, telt niet mee', async () => {
  const { gift } = bouwMetPay();
  const r = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 25,
    aftrekbaar: true, stuk: 'giftbewijs', soort: 'donatie', tegenprestatie: true });
  /* tegenprestatie is INVOER (die mag de gever opgeven), maar aftrekbaar en
     stuk zijn UITKOMST en worden opnieuw gerekend. */
  assert.equal(r.soort, 'sponsoring', 'de meegestuurde soort werd overgenomen');
  assert.equal(r.stuk, 'factuur', 'de meegestuurde stuknaam werd overgenomen');
});

test('zonder betaallaag gebeurt er niets, en dat wordt gezegd', async () => {
  const { gift, bronnen } = bouwMetPay(null);   // geen ctx.pay
  const r = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 25 });
  assert.equal(r.status, 503);
  assert.match(r.error, /niets afgeschreven/i, 'de gever hoort te weten dat er niets is gebeurd');
  assert.equal(bronnen.length, 0, 'er ontstond een bron zonder dat er geld bewoog');
});

test('mislukt de boeking, dan ontstaat er geen bron', async () => {
  const { gift, bronnen } = bouwMetPay({ status: 400, error: 'Te weinig saldo.' });
  const r = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 25 });
  assert.equal(r.status, 400);
  assert.equal(bronnen.length, 0,
    'een bron zonder geld is een belofte in de boekhouding van de stichting');
});

test('de bron ontstaat na de boeking, met de codenaam als gever', async () => {
  const { gift, bronnen } = bouwMetPay();
  await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 40, vorm: 'geoormerkt', project: 'Taalcafe' });
  assert.equal(bronnen.length, 1);
  assert.equal(bronnen[0].gever, 'Poolvos 1BE9', 'de gever hoort een codenaam te zijn');
  assert.equal(bronnen[0].centen, 4000);
  assert.equal(bronnen[0].soort, 'donatie');
});

test('een gift boven de drempel meldt vooraf dat hij eerst beoordeeld wordt', async () => {
  const { gift } = bouwMetPay();
  const drempel = require('../server/kern/rtfos/herkomst').DREMPEL_CENTEN / 100;
  const r = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: drempel });
  assert.equal(r.beoordeeldVooraf, true);
  assert.ok(r.zegt.some(z => /eerst beoordeeld/i.test(z)));
});

test('de transactiekosten worden gemeld en niet verzwegen', async () => {
  const { gift } = bouwMetPay();
  const r = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 25 });
  assert.equal(r.kosten, 35,
    'de kosten komen van de ontvanger af; een scherm dat "100% gaat naar" beweert, zou liegen');
});

test('de betaallaag wordt op precies een manier aangeroepen', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', 'gift-betalen.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const aanroepen = (bron.match(/pay\.[a-zA-Z]+/g) || []).filter((x, i, a) => a.indexOf(x) === i);
  assert.deepEqual(aanroepen.sort(), ['pay.partnerIn'],
    'de giftlaag roept meer van de betaallaag aan dan partnerIn -- een tweede weg naar hetzelfde geld');
  assert.ok(!/uitbetaal|sepa|iban/i.test(bron),
    'uitbetalen naar de bank doet de stichting zelf langs /api/pay/zaak/uitbetalen; hier hoort geen tweede pad');
});
