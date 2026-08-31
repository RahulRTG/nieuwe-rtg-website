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

/* Een echt project om aan te oormerken. Het oormerk wees hiervoor nergens op na
   te kijken heen; sinds kern/rtfos/gift-projecten.js moet het een ACTIEF project
   in een OPEN stad zijn, en die twee zet dit hulpje neer. */
function metProject(b, naam) {
  b.ctx.S().steden.push({ id: 'S1', naam: 'Haarlem', status: 'actief' });
  const p = { id: 'P1', stad: 'S1', naam: naam || 'Huiswerkklas', soort: 'huiswerk',
    status: 'actief', doelgroep: 'jongeren' };
  b.ctx.S().projecten.push(p);
  return p;
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

/* HET OORMERK WEES NERGENS OP, EN DAT IS GEMETEN. Tegen een echte server kon
   een lid 25 euro geven aan het project "Bestaat Helemaal Niet", met een
   zelfverzonnen projectId, en het kwam er met 200 doorheen. De bron belandde in
   de boekhouding van de stichting met de belofte "herbestemmen alleen met
   toestemming" over een project dat niet bestond -- terwijl het scherm zei dat
   een geoormerkte gift een project aanwijst.

   De naam kwam uit de browser en het id ook, en geen van beide werd nagekeken.
   Nu kiest de gever een ID uit kern/rtfos/gift-projecten.js en wordt de naam
   daar bij gezocht. */
test('een geoormerkte gift wijst een BESTAAND project aan', () => {
  const b = bouw();
  const { gift } = b;
  gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-WALLET' },
    vormen: ['eenmalig', 'geoormerkt'], stand: 'open' }, 'toets');

  assert.equal(gift.voorbereid({ euro: 50, vorm: 'geoormerkt' }).status, 400);
  /* EEN NAAM IS GEEN AANWIJZING. Dit was precies de tak die doorliet. */
  assert.equal(gift.voorbereid({ euro: 50, vorm: 'geoormerkt', project: 'Huiswerkklas' }).status, 400,
    'een verzonnen projectnaam werd nog steeds geaccepteerd');
  assert.equal(gift.voorbereid({ euro: 50, vorm: 'geoormerkt', projectId: 'VERZONNEN' }).status, 400,
    'een verzonnen projectId werd geaccepteerd');

  const p = metProject(b);
  const ok = gift.voorbereid({ euro: 50, vorm: 'geoormerkt', projectId: p.id, project: 'Iets Anders' });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  /* DE NAAM KOMT VAN DE SERVER: wat de browser meestuurde ('Iets Anders') doet
     niet mee. */
  assert.equal(ok.voornemen.project, 'Huiswerkklas');
  assert.equal(ok.voornemen.projectId, p.id);

  /* EN EEN GEWONE GIFT DRAAGT GEEN PROJECT, ook niet als de browser er een
     meestuurt. Dit gat vond een mutatie: laat je de oude terugval staan
     (`project: project ? project.naam : schoon(b.project)`), dan krijgt een
     niet-geoormerkte gift alsnog een projectnaam uit het verzoek -- en dan
     staat er op het scherm en in de bevestiging dat het geld naar iets
     specifieks ging terwijl er niets is vastgezet. */
  const vrij = gift.voorbereid({ euro: 50, vorm: 'eenmalig', project: 'Iets Verzonnen', projectId: p.id });
  assert.equal(vrij.ok, true);
  assert.equal(vrij.voornemen.project, null,
    'een gewone gift kreeg een projectnaam uit de browser mee');
  assert.equal(vrij.voornemen.projectId, null);
});

test('de lijst om aan te oormerken toont alleen wat echt loopt', () => {
  const b = bouw();
  const p = metProject(b);
  b.ctx.S().projecten.push({ id: 'P2', stad: 'S1', naam: 'Nog een idee', soort: 'overig', status: 'idee' });
  b.ctx.S().steden.push({ id: 'S2', naam: 'Gesloten stad', status: 'voorbereiding' });
  b.ctx.S().projecten.push({ id: 'P3', stad: 'S2', naam: 'Achter de deur', soort: 'huiswerk', status: 'actief' });

  const r = b.gift.projecten.lijst({});
  assert.deepEqual(r.projecten.map(x => x.id), [p.id],
    'een idee of een project in een gesloten stad stond in de keuzelijst');
  /* GEEN BEDRAGEN. Wat een project kost is verantwoording en die hoort in het
     jaarstuk, niet in een keuzemenu. */
  assert.equal(Object.keys(r.projecten[0]).some(k => /budget|besteed|centen/i.test(k)), false);

  /* HET FILTER IS EEN BEELD EN GEEN GRENS: een soort die niets oplevert geeft
     een lege lijst met een zin, en tilt niets op dat anders dicht zou staan. */
  assert.equal(b.gift.projecten.lijst({ soort: 'duurzaam' }).projecten.length, 0);
  assert.match(b.gift.projecten.lijst({ soort: 'duurzaam' }).uitleg, /geen project/);
  assert.equal(b.gift.projecten.vindBruikbaar('P3'), null,
    'een project in een gesloten stad was toch aanwijsbaar');
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
  /* gift-machtiging.js staat hier BEWUST NIET in, en dat is geen gaatje.
     De woordenlijst hieronder verbiedt onder meer 'incasso' en 'sepa', en die
     twee woorden zijn precies het ONDERWERP van dat bestand -- het bestaat om
     op te schrijven dat er geen incasso is. Een woordverbod is daar het
     verkeerde instrument. Wat er wel voor geldt, staat in de lus erna: het mag
     de betaallaag niet AANROEPEN. Dat is de invariant die ertoe doet. */
  const delen = ['gift.js', 'gift-voornemen.js', 'gift-vormen.js', 'gift-periodiek.js'];
  for (const deel of delen) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', deel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""');

    /* MET EEN SLUITENDE WOORDGRENS, en dat is een correctie op mijn eigen toets.
       Zonder die grens zakte gift-periodiek.js op `p.betaald` -- een VELDNAAM
       die zegt dat een termijn voldaan is, niet een aanroep naar de betaallaag.
       Een toets die op zulke woorden zakt, leert je velden hernoemen in plaats
       van code verbeteren. Wat hier telt is een AANROEP: `pay.` haalt zijn
       grens uit de punt erachter, `betaal` uit het ontbreken van een letter. */
    for (const weg of ['pay', 'poort', 'grootboek', 'saldo', 'boeking', 'betaal', 'incasso', 'sepa', 'wallet']) {
      assert.ok(!new RegExp('\\b' + weg + '\\b', 'i').test(code),
        deel + ' reikt naar "' + weg + '" -- klaarzetten is klaarzetten, en betalen hoort langs kern/pay/poort.js met een eigen besluit');
    }
  }

  /* En niets van buiten het domein. De requires staan in de ONGESTRIPTE bron,
     want het pad zit in een tekst. */
  for (const deel of delen.concat('gift-betalen.js', 'gift-machtiging.js')) {
    const ruw = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', deel), 'utf8');
    for (const m of ruw.match(/require\((['"])([^'"]+)\1\)/g) || []) {
      const pad = m.replace(/require\(['"]|['"]\)/g, '');
      /* ../machtiging is de ENIGE uitzondering naar buiten dit domein, en met
         een reden: de regels van een machtiging (geen maximum is een blanco
         cheque, alleen de laatste vier cijfers, een tweede vervangt de eerste)
         stonden al goed opgeschreven in server/school/machtiging.js. Ze hier
         overtikken zou twee registers met dezelfde betekenis onder dezelfde
         naam opleveren -- wat SEMANTIEK.json duur noemt. Het is een REGELmodule
         zonder opslag, zonder routes en zonder sessie; de opslag blijft van elk
         domein zelf. */
      assert.match(pad, /^(\.\/(gift-vormen|gift-voornemen|gift-betalen|gift-periodiek|gift-machtiging|gift-projecten|herkomst)|\.\.\/machtiging)$/,
        deel + ' haalt ' + pad + ' binnen; de giftlaag hoort binnen kern/rtfos te blijven -- de betaallaag komt via de ctx en niet via een require');
    }
  }

  /* EN DE MACHTIGINGSLAAG RAAKT GEEN GELD AAN. Hij mag de woorden gebruiken --
     dat is zijn onderwerp -- maar geen aanroep doen. Een machtiging die zelf
     kan boeken, is precies wat GELD.md verbiedt. */
  {
    const code = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', 'gift-machtiging.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const weg of ['pay\\.', 'boekAsync', 'grootboek', 'partnerIn', 'metIdem']) {
      assert.ok(!new RegExp(weg).test(code),
        'gift-machtiging.js roept de betaallaag aan (' + weg + '); een machtiging legt vast wat er is getekend en boekt niets');
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
  return { gift, geboekt, bronnen, db, ctx };
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
  const b = bouwMetPay();
  const { gift, bronnen } = b;
  const p = metProject(b, 'Taalcafe');
  await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 40, vorm: 'geoormerkt', projectId: p.id });
  assert.equal(bronnen.length, 1);
  assert.equal(bronnen[0].gever, 'Poolvos 1BE9', 'de gever hoort een codenaam te zijn');
  assert.equal(bronnen[0].centen, 4000);
  assert.equal(bronnen[0].soort, 'donatie');
  /* HET OORMERK STAAT OP DE BRON, en het is het id van een BESTAAND project.
     Hier stond eerder een naam uit de browser en een id dat niemand naliep. */
  assert.equal(bronnen[0].projectId, p.id,
    'de bron droeg het oormerk niet, of een ander id dan het gekozen project');
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
    'uitbetalen naar de bank doet de stichting zelf langs /api/supplier/pay/uitbetaal; hier hoort geen tweede pad');
});

/* ---------------------------------------------------------------------------
   HET MEERJARIGE PLAN -- de periodieke gift als afspraak en niet als vinkje.
   --------------------------------------------------------------------------- */
function bouwPlan(anbi) {
  const b = bouwMetPay();
  b.gift.standZet({ anbi: anbi || 'aangevraagd' }, 'toets');
  return b;
}

test('een periodieke gift loopt ten minste vijf jaar, en dat getal staat op een plek', () => {
  const { gift } = bouwPlan();
  const kort = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 4 });
  assert.equal(kort.status, 400);
  const MIN = require('../server/kern/rtfos/gift-vormen').JAREN_MIN;
  assert.match(kort.error, new RegExp('ten minste ' + MIN + ' jaar'),
    'de ondergrens in de melding komt niet uit dezelfde bron als de controle');
  assert.ok(gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: MIN }).ok);
});

test('een voorstel is nog geen overeenkomst, en zegt dat ook', () => {
  const { gift } = bouwPlan();
  const p = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan;
  assert.equal(p.stand, 'voorgesteld');
  assert.equal(p.aftrekbaar, false);
  assert.ok(p.zegt.some(z => /nog een voorstel/i.test(z)));
  assert.ok(p.zegt.some(z => /gewone gift/i.test(z)),
    'tot het vastleggen is elke betaling een gewone gift; dat hoort de gever te weten');
});

test('vastleggen vraagt een vindbaar stuk, en doet de stichting', () => {
  const { gift } = bouwPlan();
  const id = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan.id;
  /* ELK APART, en dat is een correctie na een mutatietoets. Eerst stond hier
     `vastleggen({ id })` voor het kenmerk; haalde je de kenmerk-controle weg,
     dan zakte die aanroep alsnog op de ONTBREKENDE EINDDATUM en bleef de toets
     groen. Een toets die door de volgende grendel wordt gered, toetst de eerste
     niet. */
  const zonderKenmerk = gift.plan.vastleggen({ id, tot: '2031-12-31' }, 'kantoor');
  assert.equal(zonderKenmerk.status, 400, 'vastgelegd zonder kenmerk');
  assert.match(zonderKenmerk.error, /kenmerk/i);
  const zonderDatum = gift.plan.vastleggen({ id, kenmerk: 'RTF-1' }, 'kantoor');
  assert.equal(zonderDatum.status, 400, 'vastgelegd zonder einddatum');
  assert.match(zonderDatum.error, /wanneer/i);
  const ok = gift.plan.vastleggen({ id, kenmerk: 'RTF-1', tot: '2031-12-31' }, 'kantoor');
  assert.equal(ok.plan.stand, 'vastgelegd');
  assert.ok(ok.plan.zegt.some(z => /RTF-1/.test(z)));
});

test('aftrekbaar volgt de ANBI-stand, ook als de overeenkomst is vastgelegd', () => {
  for (const [stand, verwacht] of [['aangevraagd', false], ['nee', false], ['onbekend', false], ['ja', true]]) {
    const { gift } = bouwMetPay();
    gift.standZet(stand === 'ja' ? { anbi: 'ja', rsin: '123456789' } : { anbi: stand }, 'toets');
    const id = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan.id;
    const p = gift.plan.vastleggen({ id, kenmerk: 'RTF-1', tot: '2031-12-31' }, 'kantoor').plan;
    assert.equal(p.aftrekbaar, verwacht,
      'bij ANBI-stand "' + stand + '" stond aftrekbaar op ' + p.aftrekbaar +
      ' -- een vastgelegde overeenkomst maakt een gift niet aftrekbaar, een ANBI-status doet dat');
  }
});

test('elke ANBI-stand geeft een eigen zin, en geen ervan belooft te veel', () => {
  const zinnen = new Set();
  for (const stand of ['onbekend', 'nee', 'aangevraagd', 'ja']) {
    const { gift } = bouwMetPay();
    gift.standZet(stand === 'ja' ? { anbi: 'ja', rsin: '123456789' } : { anbi: stand }, 'toets');
    const p = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan;
    const zin = p.zegt.join(' ');
    zinnen.add(zin);
    if (stand !== 'ja') {
      assert.ok(!/aftrekbaar zonder drempel/.test(zin),
        'bij ANBI-stand "' + stand + '" werd toch "aftrekbaar zonder drempel" beloofd');
    }
  }
  assert.equal(zinnen.size, 4, 'twee ANBI-standen leverden dezelfde tekst op');
});

test('de termijnen worden afgeleid, en een betaalde termijn wijst naar zijn bron', async () => {
  const { gift } = bouwPlan();
  const id = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan.id;
  gift.plan.vastleggen({ id, kenmerk: 'RTF-1', tot: '2031-12-31' }, 'kantoor');

  const voor = gift.plan.mijn('Poolvos 1BE9').plannen[0];
  assert.equal(voor.termijnen.length, 5);
  assert.ok(voor.termijnen.every(t => !t.voldaan));

  const r = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 100, vorm: 'periodiek', planId: id });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 140));
  assert.equal(r.soort, 'donatie',
    'een jaarlijkse termijn kreeg het bronsoort "maandelijkse_donatie" -- dat liegt over de frequentie');

  const na = gift.plan.mijn('Poolvos 1BE9').plannen[0];
  assert.equal(na.termijnen.filter(t => t.voldaan).length, 1);
  assert.ok(na.termijnen[0].bron, 'de voldane termijn wijst niet naar de bron die eruit ontstond');
});

test('een termijn wordt een keer per jaar afgetekend, ook bij twee betalingen', async () => {
  const { gift, db } = bouwPlan();
  const id = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan.id;
  gift.plan.vastleggen({ id, kenmerk: 'RTF-1', tot: '2031-12-31' }, 'kantoor');
  await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 100, vorm: 'periodiek', planId: id, idem: 'a' });
  await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 100, vorm: 'periodiek', planId: id, idem: 'b' });

  const p = gift.plan.mijn('Poolvos 1BE9').plannen[0];
  assert.equal(p.termijnen.filter(t => t.voldaan).length, 1);

  /* EN IN DE OPSLAG ZELF, want in het beeld is dit niet te zien: beeld() zoekt
     per jaar de EERSTE aantekening, dus een dubbele bleef onzichtbaar en de
     mutatietoets liep er groen doorheen. Een rij die stilletjes aangroeit is
     precies wat je later niet meer uit elkaar krijgt. */
  const ruw = db.data.rtfos.giftplannen.find(x => x.id === id);
  assert.equal(ruw.betaald.length, 1,
    'twee betalingen in hetzelfde jaar zetten twee aantekeningen op dezelfde termijn');
});

test('stoppen kan alleen de gever zelf, en belooft niets over de aangifte', () => {
  const { gift } = bouwPlan();
  const id = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan.id;
  assert.equal(gift.plan.stop('Iemand Anders', { id }).status, 403);
  const r = gift.plan.stop('Poolvos 1BE9', { id, reden: 'even niet' });
  assert.equal(r.plan.stand, 'gestopt');
  assert.match(r.melding, /daar gaan wij niet over/i,
    'het systeem deed een uitspraak over wat stoppen betekent voor de aangifte');
  assert.equal(gift.plan.stop('Poolvos 1BE9', { id }).status, 409);
});

test('er wordt nergens automatisch afgeschreven, en dat staat er ook', () => {
  const { gift } = bouwPlan();
  const p = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan;
  assert.ok(p.zegt.some(z => /niets automatisch/i.test(z)));

  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', 'gift-periodiek.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  for (const weg of ['incasso', 'machtiging', 'setInterval', 'cron', 'pay', 'boekAsync']) {
    assert.ok(!new RegExp('\\b' + weg + '\\b', 'i').test(bron),
      'het plan reikt naar "' + weg + '" -- een termijn wordt door de gever bevestigd, niet geïnd');
  }
});

test('alleen de termijn van DIT jaar staat open, en een dubbele betaling meldt er geen', async () => {
  const { gift } = bouwPlan();
  const id = gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 100, jaren: 5 }).plan.id;
  gift.plan.vastleggen({ id, kenmerk: 'RTF-1', tot: '2031-12-31' }, 'kantoor');

  const voor = gift.plan.mijn('Poolvos 1BE9').plannen[0];
  assert.equal(voor.openDitJaar, true);

  const eerste = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 100, vorm: 'periodiek', planId: id, idem: 'a' });
  assert.ok(eerste.termijn, 'de eerste betaling tekende geen termijn af');

  const na = gift.plan.mijn('Poolvos 1BE9').plannen[0];
  assert.equal(na.openDitJaar, false,
    'de knop zou blijven staan terwijl dit jaar al voldaan is -- dan betaalt iemand zonder dat er iets wordt afgetekend');

  const tweede = await gift.bevestig({ codenaam: 'Poolvos 1BE9', euro: 100, vorm: 'periodiek', planId: id, idem: 'b' });
  assert.equal(tweede.ok, true, 'de betaling zelf hoort gewoon door te gaan: het geld is echt gegeven');
  assert.equal(tweede.termijn, null,
    'een tweede betaling in hetzelfde jaar meldde een termijn die niet is afgetekend');
});

/* ---------------------------------------------------------------------------
   DE ANBI-STAND HEEFT EEN EIGENAAR, EN JAARVERSLAG.JS NAM HEM AAN.

   Dat deel opent met "een ANBI moet publiceren", bouwt die publicatieplicht uit
   en hangt het stuk onder /publiek -- terwijl de eigenaar in de giftstand had
   vastgelegd dat de aanvraag nog LOOPT. Twee plekken, een status, en ze lazen
   elkaar niet. kern/rtfos/anbi-grondslag.js is de lezer; dit is de toets dat hij
   NOOIT de gunstige kant kiest als hij het niet weet. */
const grondslagVan = require('../server/kern/rtfos/anbi-grondslag');

test('de grondslag om te publiceren wordt gelezen en nooit aangenomen', () => {
  const beschikt = grondslagVan(() => ({ anbi: 'ja', rsin: '123456789' }))();
  assert.equal(beschikt.grond, 'publicatieplicht');
  assert.equal(beschikt.rsin, '123456789');

  /* AANGEVRAAGD IS GEEN JA. Dit is de stand van vandaag, en juist hier ging het
     mis: publiceren mag, maar niet onder de vlag van een plicht. */
  const loopt = grondslagVan(() => ({ anbi: 'aangevraagd', rsin: '123456789' }))();
  assert.equal(loopt.grond, 'eigen keus');
  assert.equal(loopt.rsin, null, 'een RSIN naast een lopende aanvraag leest als een beschikking');

  /* GEEN LEZER, GEEN AANNAME. Valt de stand weg -- of gooit hij -- dan is de
     uitkomst `onbekend` en niet `ja`. Dezelfde regel als bij de fiscale klassen
     in CLAUDE.md: wat niemand heeft ingedeeld, valt terug op de voorzichtige
     kant en zegt dat het niet is ingedeeld. */
  for (const stuk of [undefined, () => null, () => { throw new Error('weg'); }, () => ({ anbi: 'misschien' })]) {
    const g = grondslagVan(stuk)();
    assert.equal(g.anbi, 'onbekend');
    assert.equal(g.grond, 'eigen keus');
    assert.match(g.zegt, /niet als een ANBI-publicatie/);
  }
});

/* ---------------------------------------------------------------------------
   DE SEPA-MACHTIGING -- besluit van de eigenaar, en wat het eerlijk kan
   betekenen.

   Er is in dit huis GEEN incasso-rail: server/betaal.js kent maakUitbetaling
   (geld eruit) en maakBetaling (een kaartbetaling die de betaler zelf start).
   Geld van de rekening van een ander halen vraagt een bankcontract en een
   incassant-ID. Wat hier staat is de machtiging plus de aankondiging, en elk
   antwoord zegt met geindNu:false dat er niets is afgeschreven -- dezelfde
   halve stap die server/school/machtiging.js bewust nam.

   De REGELS staan op een plek (kern/machtiging.js) en worden door school en
   gift allebei gebruikt. Deze toetsen gaan over wat een GIFT anders maakt. */
function bouwMachtiging() {
  const b = bouwPlan('aangevraagd');
  b.gift.standZet({ ontvanger: { soort: 'wallet', code: 'RTF-W' },
    vormen: ['eenmalig', 'geoormerkt', 'periodiek'] }, 'toets');
  b.gift.standZet({ stand: 'open' }, 'toets');
  const plan = b.gift.plan.voorstel('Poolvos 1BE9', { euroPerJaar: 120, jaren: 5 });
  return { ...b, planId: plan.plan.id };
}

test('een machtiging hangt aan een plan, kent een maximum en int niets', () => {
  const { gift, planId } = bouwMachtiging();

  /* ER WORDT NIETS GEIND, en dat staat in elk antwoord met een reden. */
  const leeg = gift.machtiging.mijn('Poolvos 1BE9');
  assert.equal(leeg.geindNu, false);
  assert.match(leeg.uitleg, /contract met een bank/);

  /* GEEN MAXIMUM, GEEN MACHTIGING -- een open volmacht is een blanco cheque. */
  const zonderMax = gift.machtiging.teken('Poolvos 1BE9', { planId, houder: 'A. Gever', iban: 'NL91ABNA0417164300' });
  assert.equal(zonderMax.status, 400);
  assert.match(zonderMax.error, /blanco cheque/);

  /* EN NIET ONDER HET JAARBEDRAG: dat zou gegarandeerd stuklopen bij de eerste
     incasso, en dat merkt de gever dan pas als het misgaat. */
  const teLaag = gift.machtiging.teken('Poolvos 1BE9',
    { planId, houder: 'A. Gever', iban: 'NL91ABNA0417164300', max: 50 });
  assert.equal(teLaag.status, 400);
  assert.match(teLaag.error, /onder het jaarbedrag/);

  const m = gift.machtiging.teken('Poolvos 1BE9',
    { planId, houder: 'A. Gever', iban: 'NL91 ABNA 0417 1643 00', max: 150, kanaal: 'app' });
  assert.equal(m.ok, true, JSON.stringify(m));
  assert.equal(m.geindNu, false, 'een machtiging tekenen las als "er is geincasseerd"');

  /* HET VOLLEDIGE REKENINGNUMMER WORDT NIET BEWAARD: we innen niet, dus we
     hebben het niet nodig -- en een IBAN naast een codenaam voert die codenaam
     terug naar een mens. */
  assert.equal(m.machtiging.ibanEinde, '4300');
  assert.equal(JSON.stringify(m.machtiging).includes('0417164300'), false,
    'het volledige rekeningnummer staat in het antwoord');

  /* DE TERMIJNEN STAAN OP HET SCHERM EN NIET IN EEN VOETNOOT. */
  assert.equal(m.machtiging.stornoWeken, 8);
  assert.equal(m.machtiging.aankondigingDagen, 14);
  assert.ok(m.zegt.some(z => /8 weken terug laten boeken/.test(z)));

  /* EEN TWEEDE MACHTIGING VERVANGT DE EERSTE: twee geldige naast elkaar is
     precies hoe iemand twee keer wordt afgeschreven. */
  const tweede = gift.machtiging.teken('Poolvos 1BE9',
    { planId, houder: 'A. Gever', iban: 'NL91ABNA0417164300', max: 200 });
  assert.equal(tweede.ok, true);
  assert.deepEqual(tweede.vervangen, [m.machtiging.kenmerk]);
  const mijn = gift.machtiging.mijn('Poolvos 1BE9');
  assert.equal(mijn.machtigingen.filter(x => x.actief).length, 1,
    'er stonden twee geldige machtigingen naast elkaar');
});

test('intrekken stopt de incasso en niet de gift; het plan stoppen doet wel beide', () => {
  const { gift, planId } = bouwMachtiging();
  const m = gift.machtiging.teken('Poolvos 1BE9',
    { planId, houder: 'A. Gever', iban: 'NL91ABNA0417164300', max: 150 });

  /* NIET VAN JOU, NIET INTREKKEN -- en ook niet "bestaat niet", want dan is de
     weigering zelf een antwoord op de vraag of hij bestaat. */
  assert.equal(gift.machtiging.trekIn('IemandAnders 9ZZ9', { id: m.machtiging.id }).status, 403);

  const weg = gift.machtiging.trekIn('Poolvos 1BE9', { id: m.machtiging.id });
  assert.equal(weg.ok, true);
  assert.equal(weg.machtiging.actief, false);
  /* GRENDEL 4: dit zijn twee dingen, en een knop die stilletjes allebei doet
     laat iemand denken dat hij van een vijfjarige afspraak af is. */
  assert.ok(weg.zegt.some(z => /loopt hiermee NIET af/.test(z)),
    'het intrekken zei niet dat de gift zelf doorloopt');
  assert.equal(gift.plan.mijn('Poolvos 1BE9').plannen[0].stand, 'voorgesteld',
    'het intrekken van de machtiging stopte ook het plan');

  /* ANDERSOM WEL: een machtiging zonder plan is een openstaande volmacht
     zonder grond. */
  const m2 = gift.machtiging.teken('Poolvos 1BE9',
    { planId, houder: 'A. Gever', iban: 'NL91ABNA0417164300', max: 150 });
  const stop = gift.plan.stop('Poolvos 1BE9', { id: planId, reden: 'het kan even niet' });
  assert.equal(stop.ok, true);
  assert.deepEqual(stop.vervallenMachtigingen, [m2.machtiging.kenmerk],
    'het gestopte plan liet zijn machtiging staan');
  assert.equal(gift.machtiging.mijn('Poolvos 1BE9').machtigingen.filter(x => x.actief).length, 0);
  assert.match(stop.melding, /vervallen/);
});
