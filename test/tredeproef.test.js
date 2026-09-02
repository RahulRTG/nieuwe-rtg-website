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
    assert.ok(start.aan.includes(stap.functie),
      'en die functie staat in trede 0: ' + stap.functie + ' (' + stap.route + ')');
    assert.match(stap.route, /^(GET|POST) \/api\//, 'een stap noemt een echte route: ' + stap.route);
    assert.ok(stap.wat && stap.wat.length > 5, 'en zegt wat een MENS doet, niet hoe de route heet');
  }
  assert.ok(T.RONDGANG.some(s => s.levertToken), 'er is precies een stap die de sessie oplevert');
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
