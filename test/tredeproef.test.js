/* DE TREDEPROEF -- en of hij werkelijk iets onderscheidt.

   scripts/tredeproef.js beantwoordt de vraag waar de hele livegangsstrategie op
   rust: kan trede 0 zelfstandig bestaan? Hij geeft daar TWEE uitslagen op die
   nooit worden opgeteld -- zuiver (de beslissing, over alle routes) en beproefd
   (de bedrading, over een steekproef) -- en de eerste ronde liet meteen zien
   waarom: de beslissing zei dat /api/betaal/webhook dicht was en de webhook
   antwoordde 200. Een proef met alleen de zuivere kant had dat groen gemeld.

   Deze toetsen dekken de pure kant. De proef zelf start een server en klopt
   zestig routes aan; dat hoort niet in een toetssuite.

   Draai los: node --test test/tredeproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../scripts/tredeproef');
const { FASES, OP_ID } = require('../server/functies/register');

test('1. de indeling laat geen route in het niets vallen', () => {
  /* Een route die in de verkeerde bak valt, wordt nooit beproefd -- en dat is
     stil. Daarom telt deze toets of de drie bakken samen het geheel zijn. */
  const routes = [
    { methode: 'GET', pad: '/api/member/x' },
    { methode: 'POST', pad: '/api/supplier/y' },
    { methode: 'GET', pad: '/api/health' }
  ];
  const functieVoorPad = p => p.startsWith('/api/member') ? { id: 'member' }
    : p.startsWith('/api/supplier') ? { id: 'supplier' } : null;
  const d = T.indeling({ routes, functieVoorPad, aan: new Set(['member']) });
  assert.equal(d.inTrede.length, 1);
  assert.equal(d.buiten.length, 1);
  assert.equal(d.zonderFunctie.length, 1);
  assert.equal(d.inTrede.length + d.buiten.length + d.zonderFunctie.length, routes.length);
  assert.equal(d.buiten[0].functie, 'supplier', 'de functie hoort mee, anders is een lek niet te duiden');
});

test('2. de steekproef is gespreid en niet de eerste N', () => {
  /* De routelijst is op pad gesorteerd. Wie de eerste zestig neemt, beproeft
     zestig routes uit hetzelfde domein en meldt daarna iets over het geheel. */
  const lijst = Array.from({ length: 100 }, (_, i) => i);
  const s = T.steekproef(lijst, 10);
  assert.equal(s.length, 10);
  assert.ok(s[s.length - 1] > 80, 'de laatste hoort uit de staart te komen, niet uit de kop');
  assert.deepEqual(T.steekproef([1, 2, 3], 10), [1, 2, 3], 'een korte lijst gaat er heel doorheen');
});

test('3. wat voor de schakelaar hangt, staat er MET een reden', () => {
  /* Een uitzondering die je niet ziet is een lek. Deze toets houdt vast dat
     elke uitzondering een route en een reden draagt -- een lege reden zou de
     lijst tot een stille skiplijst maken. */
  assert.ok(T.VOOR_DE_SCHAKELAAR.length, 'de lijst hoort te bestaan');
  for (const [route, reden] of T.VOOR_DE_SCHAKELAAR) {
    assert.match(route, /^[A-Z]+ \/api\//, 'een uitzondering noemt een echte route: ' + route);
    assert.ok(reden && reden.length > 30, 'en draagt een reden die iets uitlegt: ' + route);
  }
  assert.equal(T.isVoorDeSchakelaar('POST /api/betaal/webhook'), true);
  assert.equal(T.isVoorDeSchakelaar('POST /api/bank/overzicht'), false,
    'de lijst mag niet op iets anders passen dan wat er letterlijk op staat');
});

test('3b. elke stap van de rondgang beproeft een functie die IN trede 0 zit', () => {
  /* Een rondgang die iets beproeft wat de trede niet belooft, meet de verkeerde
     trede -- en hij zou dan ook zakken zodra die functie ergens anders wordt
     uitgezet. Deze toets houdt de stappen vast aan FASE_START. */
  const start = FASES.find(f => f.id === 'start');
  for (const stap of T.RONDGANG) {
    assert.ok(OP_ID[stap.functie], 'de stap noemt een bestaande functie: ' + stap.functie);
    /* Een stap zonder `vanaf` hoort bij trede 0; een stap MET `vanaf` hoort bij
       de trede die hij noemt, en die trede moet bestaan. Zo kan de rondgang
       meegroeien zonder dat iemand een stap aan een verzonnen trede hangt. */
    if (stap.vanaf) {
      const trede = FASES.find(f => f.id === stap.vanaf);
      assert.ok(trede, 'de stap noemt een bestaande trede: ' + stap.vanaf + ' (' + stap.route + ')');
      assert.ok(!trede.aan || trede.aan.includes(stap.functie),
        'en die trede opent die functie ook echt: ' + stap.functie + ' in ' + stap.vanaf);
      continue;
    }
    assert.ok(start.aan.includes(stap.functie),
      'een stap zonder vanaf hoort bij trede 0: ' + stap.functie + ' (' + stap.route + ')');
    assert.match(stap.route, /^(GET|POST) \/api\//, 'een stap noemt een echte route: ' + stap.route);
    assert.ok(stap.wat && stap.wat.length > 5, 'en zegt wat een MENS doet, niet hoe de route heet');
  }
  assert.ok(T.RONDGANG.some(s => s.levertToken), 'er is precies een stap die de sessie oplevert');
});

test('3c. een stap die gegevens doorgeeft, zegt ook waar ze vandaan komen', () => {
  /* De ketenstappen (zaak vinden -> kaart -> bestellen -> betalen) leunen op
     elkaar. Een stap met lijfUit heeft een voorganger met bewaar nodig; zonder
     die voorganger meldt de proef altijd 'onvoltooid' en lijkt de ladder kapot
     terwijl de rondgang zichzelf niet kan voeden. */
  const metBewaar = T.RONDGANG.filter(s => s.bewaar).length;
  const metLijfUit = T.RONDGANG.filter(s => s.lijfUit).length;
  assert.ok(metLijfUit > 0, 'er zijn ketenstappen');
  assert.ok(metBewaar > 0, 'en er is minstens een stap die iets bewaart');
  /* En een stap die MEER dan een lijf aanbiedt, moet kunnen zeggen wanneer hij
     klaar is -- anders probeert hij er vijfentwintig en merkt niets. */
  for (const stap of T.RONDGANG) {
    if (!stap.lijfUit) continue;
    const uit = stap.lijfUit({ zaken: ['A', 'B'], zaak: 'A', gerecht: 'g', ref: 'r' });
    if (Array.isArray(uit) && uit.length > 1) {
      assert.ok(typeof stap.klaar === 'function',
        'een stap met meerdere pogingen draagt een klaar(): ' + stap.route);
    }
    assert.equal(stap.lijfUit({}), null, 'en levert null als zijn voeding ontbreekt: ' + stap.route);
  }
});

test('3d. de drie uitkomsten van een stap lopen niet door elkaar', () => {
  /* Deze toets bestaat omdat een mutatie die 'onvoltooid' als geslaagd liet
     tellen GEEN enkele toets liet zakken: het oordeel zat in meet(), en meet()
     start een server. Nu staat het apart en puur. */
  const o = T.oordeelStap;
  assert.deepEqual(o({ aanInTrede: true, status: 200 }), { geslaagd: true, onvoltooid: false });
  assert.deepEqual(o({ aanInTrede: true, status: 403 }), { geslaagd: false, onvoltooid: false });
  assert.deepEqual(o({ aanInTrede: false, status: 503 }), { geslaagd: true, onvoltooid: false },
    'een functie die uit staat HOORT 503 te geven, en dat is geslaagd');
  assert.deepEqual(o({ aanInTrede: false, status: 200 }), { geslaagd: false, onvoltooid: false },
    'maar een 200 op een uitgezette functie is een lek');
  assert.deepEqual(o({ aanInTrede: false, status: 404 }), { geslaagd: false, onvoltooid: false },
    'en een 404 betekent dat de poort omzeild is, niet gepasseerd');
  /* De voeding, en het verschil dat de mutatie liet zien. */
  assert.deepEqual(o({ aanInTrede: true, voedingMist: true, status: null }), { geslaagd: false, onvoltooid: true },
    'zijn functie staat aan maar hij kon niet draaien: onvoltooid, en NIET geslaagd');
  assert.deepEqual(o({ aanInTrede: false, voedingMist: true, status: null }), { geslaagd: true, onvoltooid: false },
    'staat de functie toch al uit, dan is er niets aan de hand');
  /* En een stap die antwoordt maar niet opleverde wat de volgende nodig heeft. */
  assert.deepEqual(o({ aanInTrede: true, status: 200, klaar: false }), { geslaagd: false, onvoltooid: false });

  /* HET TWEEDE SLOT: geld. Onder trede 4 hoort een betaalactie fail-closed te
     weigeren met 503 EN code 'betalingen-uit' (RTG_BETALEN_UIT=1). Twee
     weigeringen met dezelfde statuscode die iets anders zeggen -- wie alleen
     naar 503 kijkt, kan de belofte van trede 3 niet nakijken. */
  assert.deepEqual(o({ aanInTrede: true, geldUit: true, status: 503, code: 'betalingen-uit' }),
    { geslaagd: true, onvoltooid: false }, 'de betaalstop weigert zoals beloofd');
  assert.deepEqual(o({ aanInTrede: true, geldUit: true, status: 503, code: 'iets-anders' }),
    { geslaagd: false, onvoltooid: false }, 'een 503 zonder die code is een ANDERE weigering en bewijst de belofte niet');
  assert.deepEqual(o({ aanInTrede: true, geldUit: true, status: 200 }),
    { geslaagd: false, onvoltooid: false }, 'en een geslaagde betaling onder trede 4 is precies wat niet mag');
});

test('4. elke trede noemt bestaande functies, en trede 0 is de kleinste', () => {
  /* De catalogus toetst dit al bij het laden; hier staat het als de aanname die
     de proef MAAKT. Zakt deze toets, dan meet de proef een trede die niet
     bestaat. */
  const start = FASES.find(f => f.id === 'start');
  assert.ok(start && Array.isArray(start.aan) && start.aan.length, 'trede 0 bestaat en noemt functies');
  for (const id of start.aan) assert.ok(OP_ID[id], 'trede 0 noemt een bestaande functie: ' + id);
  for (const f of FASES) if (f.aan) assert.ok(f.aan.length >= start.aan.length,
    'geen enkele trede is kleiner dan trede 0: ' + f.id);
});
