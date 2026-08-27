/* DE GEDEELDE REKENKERN VAN DE VIER ONTWERPBANKEN.

   hash, kies en palet stonden byte voor byte gelijk in kern/architect/bank.js,
   kern/atelier/bank.js, kern/hardwarelab/bank.js en kern/studio/bank.js. Ze
   wonen nu in kern/ontwerpbank.js. Twee dingen moeten daarbij waar blijven, en
   ze trekken tegengesteld:

     SAMENVOEGEN WAT ECHT HETZELFDE IS. De vier bleven niet toevallig gelijk --
     ze waren gekopieerd, en een kopie loopt uiteen zodra iemand er een van
     aanraakt. Toets 4 pint de uitkomst vast, zodat "even iets aanpassen" in de
     rekenkern zichtbaar wordt in plaats van stil vier domeinen te verschuiven.

     NIET SAMENVOEGEN WAT ALLEEN ZO HEET. De vier PALETTEN zijn verschillend --
     zestien tinten per domein, waarvan er twee door alle vier gedeeld worden.
     Toets 3 zakt zodra iemand ze alsnog samentrekt. Dat is de fout die
     PLATFORM.md met Cercle en Entourage al een keer heeft voorkomen, en die
     DEVELOPERCLOUD.md par. 2 bij `Asset` opnieuw vond.

   Draai los: node --test test/ontwerpbank.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../server/kern/ontwerpbank');

const BANKEN = {
  architect: require('../server/kern/architect/bank'),
  atelier: require('../server/kern/atelier/bank'),
  hardwarelab: require('../server/kern/hardwarelab/bank'),
  studio: require('../server/kern/studio/bank')
};

test('1. hash is deterministisch en hangt aan de tekst', () => {
  /* Vastgepind, niet herberekend: als iemand FNV-1a vervangt door iets anders,
     verandert elk bestaand concept van elk lid. Dat mag, maar niet stil. */
  assert.equal(O.hash('proef|x|y'), 3847283328);
  assert.equal(O.hash(''), 2166136261);
  assert.equal(O.hash('a'), O.hash('a'), 'dezelfde tekst geeft hetzelfde getal');
  assert.notEqual(O.hash('a'), O.hash('b'), 'een andere tekst een ander getal');
  assert.equal(O.hash(42), O.hash('42'), 'niet-tekst wordt tekst');
  assert.ok(O.hash('willekeurig lang stuk tekst') >= 0, 'nooit negatief');
});

test('2. kies levert n verschillende leden, en nooit meer dan er zijn', () => {
  const arr = ['a', 'b', 'c', 'd', 'e'];
  const drie = O.kies(arr, 12345, 3);
  assert.equal(drie.length, 3);
  assert.equal(new Set(drie).size, 3, 'geen dubbelen');
  for (const x of drie) assert.ok(arr.includes(x), 'alleen leden uit de lijst');
  assert.equal(O.kies(arr, 12345, 99).length, arr.length, 'meer vragen dan er zijn, geeft alles');
  assert.deepEqual(O.kies(arr, 12345, 0), [], 'nul vragen geeft niets');
  assert.deepEqual(O.kies([], 1, 3), [], 'een lege lijst loopt niet vast');
  assert.deepEqual(O.kies(arr, 12345, 3), drie, 'dezelfde seed geeft dezelfde keuze');

  /* De tegenproef. Zonder deze regel blijft deze toets ook groen bij een kies()
     die altijd de eerste n teruggeeft, en dan meet hij opmaak in plaats van
     gedrag. */
  const andere = O.kies(arr, 777, 3);
  assert.notDeepEqual(andere, drie, 'een andere seed geeft een andere keuze');
});

test('3. het palet blijft van het domein', () => {
  /* De vier paletten zijn NIET samengevoegd, en dat is een besluit. Zakt deze
     toets, dan is er een gedeelde kleurenlijst gekomen en zijn architect,
     atelier, hardwarelab en studio hun eigen gezicht kwijt. */
  const seed = O.hash('zelfde opdracht');
  const eerste = {};
  for (const [naam, bank] of Object.entries(BANKEN)) {
    const p = bank.palet(seed, 3);
    assert.equal(p.length, 3, naam + ' levert drie kleuren');
    for (const k of p) {
      assert.ok(/^#[0-9A-Fa-f]{6}$/.test(k.hex), naam + ': ' + k.naam + ' heeft een hex');
      assert.equal(bank.PALET[k.naam], k.hex, naam + ': de hex komt uit het eigen palet');
    }
    eerste[naam] = p.map(k => k.naam).join(',');
  }
  const uniek = new Set(Object.values(eerste));
  assert.equal(uniek.size, 4, 'vier domeinen, vier verschillende uitkomsten: ' + JSON.stringify(eerste));

  /* En de paletten zelf delen bijna niets -- gemeten, niet aangenomen. */
  const namen = Object.values(BANKEN).map(b => new Set(Object.keys(b.PALET)));
  const gedeeld = [...namen[0]].filter(n => namen.every(s => s.has(n)));
  assert.ok(gedeeld.length <= 4,
    'de vier paletten delen hoogstens een handvol tinten, nu: ' + gedeeld.join(', '));
});

test('4. de vier banken rekenen door dezelfde kern', () => {
  /* Ze deden dat al -- byte voor byte dezelfde code, vier keer overgetypt. Nu
     is dat een afhankelijkheid in plaats van toeval. Deze toets pint dat vast
     op de functie zelf, niet op de kopie. */
  const seed = O.hash('gelijke rekensom');
  const arr = ['een', 'twee', 'drie', 'vier', 'vijf'];
  for (const [naam, bank] of Object.entries(BANKEN)) {
    assert.equal(bank.hash('proef|x|y'), O.hash('proef|x|y'), naam + ' deelt hash');
    assert.deepEqual(bank.kies(arr, seed, 3), O.kies(arr, seed, 3), naam + ' deelt kies');
    assert.deepEqual(bank.palet(seed, 2), O.paletUit(bank.PALET, seed, 2), naam + ' deelt palet');
  }
});

test('5. paletUit valt niet om op een leeg of ontbrekend palet', () => {
  assert.deepEqual(O.paletUit({}, 1, 3), []);
  assert.deepEqual(O.paletUit(null, 1, 3), []);
  assert.deepEqual(O.paletUit({ ivoor: '#F2EBDD' }, 1, 5), [{ naam: 'ivoor', hex: '#F2EBDD' }]);
});
