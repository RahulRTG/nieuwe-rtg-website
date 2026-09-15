/* DE DOORBELASTINGSMETER (scripts/doorbelasting.js, DOORBELASTING.json).

   De dragende toets is nummer 3 en niet de ratel: `onbekend` moet een UITKOMST
   zijn en nooit een aanname. Wie een bedrag zonder bewijs op `derdePartij` zet
   verlaagt de bijdragebasis en dus de vergoeding aan RTG; wie hem op `rtgEigen`
   zet verhoogt hem. Beide fouten zijn onzichtbaar en komen allebei iemand goed
   uit, en precies daarom hoort er een toets op te staan die zakt zodra de
   indeler begint te raden. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { meet, deelIn, KLASSEN, DOEL } = require('../scripts/doorbelasting');

/* GRONDWAARDEN, met de datum. Alleen met de hand te verschuiven. */
const GROND = {
  gezet: '2026-09-15',
  volgbaar: 26,      // geldvormen met een herkomst ernaast -- mag alleen OMHOOG
  nietVolgbaar: 182  // mag alleen OMLAAG
};

const vers = meet();

test('0. het ingecheckte register klopt met een verse meting', () => {
  assert.ok(fs.existsSync(DOEL), 'DOORBELASTING.json ontbreekt -- draai npm run doorbelasting:vast');
  const vast = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
  assert.equal(vast.vorm.geldvormen, vers.vorm.geldvormen,
    'DOORBELASTING.json loopt achter op de code -- draai npm run doorbelasting:vast');
  assert.equal(vast.vorm.volgbaar, vers.vorm.volgbaar);
});

test('1. RATEL: het aantal volgbare geldvormen mag alleen omhoog', () => {
  assert.ok(vers.vorm.volgbaar >= GROND.volgbaar,
    'volgbaar zakte van ' + GROND.volgbaar + ' naar ' + vers.vorm.volgbaar +
    ' -- er is een rij die een bedrag EN een herkomst droeg, en die draagt er nu geen meer. ' +
    'Daarmee is een euro die te volgen was, niet meer te volgen.');
});

test('2. RATEL: het aantal niet-volgbare geldvormen mag alleen omlaag', () => {
  assert.ok(vers.vorm.nietVolgbaar <= GROND.nietVolgbaar,
    'nietVolgbaar steeg van ' + GROND.nietVolgbaar + ' naar ' + vers.vorm.nietVolgbaar +
    ' -- er is een geldvorm bijgekomen zonder herkomst. Dit getal hoort te dalen doordat er ' +
    'herkomst bij komt, niet te stijgen doordat er bedragen bij komen.');
});

test('3. onbekend is een UITKOMST en nooit een aanname', () => {
  /* Elk van deze zes MOET onbekend opleveren. Zodra de indeler er een naar
     rtgEigen of derdePartij duwt, verschuift de bijdragebasis op een manier die
     niemand ziet. */
  const moetOnbekend = [
    [{ totaal: 5000 }, 'bedrag zonder enig herkomstveld'],
    [{ centen: 5000, herkomst: '' }, 'herkomstveld leeg'],
    [{ centen: 5000, herkomst: 'handmatig' }, 'handmatig zegt wie het INVOERDE, niet wie het LEVERDE'],
    [{ centen: 5000, herkomst: 'onbekend' }, 'letterlijk onbekend'],
    [{ centen: 5000, herkomst: 'import' }, 'een herkomst die deze meter niet kent'],
    [{ centen: 'veel', herkomst: 'rtg' }, 'bedrag is geen getal']
  ];
  for (const [rij, waarom] of moetOnbekend) {
    const u = deelIn(rij);
    assert.equal(u.klasse, 'onbekend',
      'deze rij werd ingedeeld als "' + u.klasse + '" terwijl hij onbekend hoort te zijn (' + waarom +
      '). Reden die de indeler gaf: ' + u.reden);
  }
});

test('4. de indeler is PUUR: dezelfde invoer geeft altijd dezelfde klasse', () => {
  /* Dit is de voorwaarde onder stap 3 -- een bijdragebasis die per aanroep kan
     verschillen, is bij een geschil niets waard. */
  const rij = { centen: 12345, herkomst: 'partner' };
  const eerste = deelIn(rij);
  for (let i = 0; i < 25; i++) {
    const u = deelIn({ centen: 12345, herkomst: 'partner' });
    assert.deepEqual(u, eerste, 'de indeler gaf twee keer een ander antwoord op dezelfde rij');
  }
  assert.equal(eerste.klasse, 'derdePartij');
});

test('5. elke indeling draagt een reden', () => {
  const rijen = [{ totaal: 1 }, { centen: -50 }, { btwCenten: 210 },
    { centen: 100, herkomst: 'rtg' }, { centen: 100, herkomst: 'provider' }];
  for (const r of rijen) {
    const u = deelIn(r);
    assert.ok(u.reden && u.reden.length > 5,
      'indeling zonder reden is bij een geschil niets waard: ' + JSON.stringify(r));
    assert.ok(KLASSEN.includes(u.klasse), 'onbekende klasse ' + u.klasse);
  }
});

test('6. een lege noemer leest nooit als volledig geclassificeerd', () => {
  const b = vers.euros;
  if (b.rijen === 0) {
    assert.ok(b.waaromGeen && b.waaromGeen.length > 30,
      'de opslag draagt geen bedragen, en dan hoort er een REDEN te staan -- anders leest een ' +
      'lege uitslag als een schone uitslag');
  }
  assert.ok(!/percentageGeclassificeerd|dekkingPct/.test(JSON.stringify(vers)),
    'de uitslag draagt een samengesteld dekkingspercentage; over een lege noemer is dat fictie');
});

test('7. de meter berekent GEEN bijdragebasis', () => {
  const platte = JSON.stringify(vers);
  for (const verboden of ['bijdragebasis', 'contributionBase', 'vergoedingCenten', 'feeCenten']) {
    assert.ok(!platte.includes(verboden),
      'de uitslag draagt "' + verboden + '". Een basis uitrekenen over een noemer die grotendeels ' +
      'onbekend is, levert een getal op dat er precies zo uitziet als een getal dat klopt. Dat is ' +
      'stap 3 en die mag pas als deze meter laat zien dat de invoer er is.');
  }
});
