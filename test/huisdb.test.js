/* DE HUIS-BRIL: kijkt een tweede exemplaar van hetzelfde bureau werkelijk in
   zijn EIGEN la, en langs elke weg dezelfde?

   kern/huisdb.js legt db.data.redactie om naar db.data.redactieRtf, zodat de
   RTFoundation dezelfde bureaumodule kan draaien op eigen inhoud. Zo'n bril is
   pas veilig als hij COMPLEET is: get, has, hasOwnProperty, Object.keys,
   JSON.stringify en de spread horen allemaal hetzelfde huis te tonen. Een halve
   Proxy gaat niet stuk -- hij toont de gegevens van het ene huis onder de naam
   van het andere, en dat is erger.

   Draai los: node --test test/huisdb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { huisDb, RTF_OMLEIDING } = require('../server/kern/huisdb');

const bril = (data) => huisDb({ data }, RTF_OMLEIDING).data;

test('de bril toont de eigen la langs elke weg, en die van het andere huis nergens', () => {
  const d = bril({ redactie: { wie: 'rtg' }, redactieRtf: { wie: 'rtf' }, gewoon: 1 });

  assert.deepEqual(d.redactie, { wie: 'rtf' }, 'get geeft de eigen la');
  assert.equal('redactie' in d, true);
  assert.equal(Object.prototype.hasOwnProperty.call(d, 'redactie'), true);
  assert.deepEqual(Object.keys(d).sort(), ['gewoon', 'redactie']);
  assert.deepEqual(JSON.parse(JSON.stringify(d)), { redactie: { wie: 'rtf' }, gewoon: 1 });
  assert.deepEqual({ ...d }, { redactie: { wie: 'rtf' }, gewoon: 1 });

  /* De la van het ANDERE huis bestaat vanuit deze bril niet -- ook niet onder
     zijn eigen naam. Zou hij zichtbaar zijn, dan staat de inhoud van de
     stichting en die van RTG in hetzelfde beeld. */
  assert.equal('redactieRtf' in d, false);
  assert.equal(Object.prototype.hasOwnProperty.call(d, 'redactieRtf'), false);
  assert.equal(Object.keys(d).includes('redactieRtf'), false);
});

test('een eigen la ZONDER tegenhanger bij het andere huis is gewoon zichtbaar', () => {
  /* De echte productievorm: de stichting heeft haar redactie geopend en RTG
     nog niet. Zonder de ownKeys-val staat de la er dan wel via get, maar zien
     Object.keys en JSON.stringify hem niet -- dan verdwijnt hij uit elke
     uitdraai terwijl hij bestaat. */
  const d = bril({ redactieRtf: { wie: 'rtf' }, gewoon: 1 });

  assert.deepEqual(d.redactie, { wie: 'rtf' });
  assert.deepEqual(Object.keys(d).sort(), ['gewoon', 'redactie']);
  assert.deepEqual(JSON.parse(JSON.stringify(d)), { redactie: { wie: 'rtf' }, gewoon: 1 });
  assert.deepEqual({ ...d }, { redactie: { wie: 'rtf' }, gewoon: 1 });
  assert.equal(Object.prototype.hasOwnProperty.call(d, 'redactie'), true);
});

test('een la die er nog niet is, is afwezig langs elke weg', () => {
  /* DIT IS DE VALSTRIK DIE ERONDER ZAT. hasOwnProperty keek naar de la van RTG
     terwijl get de la van de stichting teruggaf. kijk() in kern/eigencollectie.js
     opent met precies die hasOwnProperty: die zag "hij bestaat", vroeg hem op,
     kreeg undefined, en gooide op de vorm. */
  const d = bril({ redactie: { wie: 'rtg' } });

  assert.equal(d.redactie, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(d, 'redactie'), false,
    'hasOwnProperty spreekt get niet tegen');
  assert.equal('redactie' in d, false);
  assert.deepEqual(Object.keys(d), []);
  assert.deepEqual(JSON.parse(JSON.stringify(d)), {});
});

test('kijk() leest door de bril heen zonder te scheppen, en bak() legt de EIGEN la aan', () => {
  const rauw = { redactie: { artikelen: ['van rtg'] } };
  const d = bril(rauw);
  const eigen = require('../server/kern/eigencollectie')({
    db: { data: d }, domein: 'toets/huisdb', bezit: { redactie: 'kaart' } });

  assert.deepEqual(eigen.kijk('redactie'), {}, 'lezen geeft leeg en gooit niet');
  assert.equal(Object.prototype.hasOwnProperty.call(rauw, 'redactieRtf'), false,
    'en schept niets');
  assert.deepEqual(rauw.redactie, { artikelen: ['van rtg'] }, 'de la van RTG blijft ongemoeid');

  eigen.bak('redactie').artikelen = ['van de stichting'];
  assert.deepEqual(rauw.redactieRtf, { artikelen: ['van de stichting'] },
    'schrijven landt in de eigen la');
  assert.deepEqual(rauw.redactie, { artikelen: ['van rtg'] }, 'en niet in die van RTG');
  assert.deepEqual(eigen.kijk('redactie'), { artikelen: ['van de stichting'] });
});

test('defineProperty landt in de eigen la, net als een gewone toewijzing', () => {
  /* De tegenhanger van getOwnPropertyDescriptor. Een van de twee omleggen en de
     andere niet, is precies de halfheid waar dit bestand aan leed: dan leest de
     bril uit de ene la en schrijft hij in de andere. */
  const rauw = { redactie: { wie: 'rtg' } };
  const d = bril(rauw);
  Object.defineProperty(d, 'redactie', { value: { wie: 'rtf' }, enumerable: true, configurable: true, writable: true });

  assert.deepEqual(rauw.redactieRtf, { wie: 'rtf' }, 'de eigen la is gevuld');
  assert.deepEqual(rauw.redactie, { wie: 'rtg' }, 'en die van RTG is ongemoeid');
});

test('sleutels zonder omleiding lopen gewoon door', () => {
  const rauw = { suppliers: [{ code: 'A' }] };
  const d = bril(rauw);
  assert.deepEqual(d.suppliers, [{ code: 'A' }]);
  assert.equal(Object.prototype.hasOwnProperty.call(d, 'suppliers'), true);
  d.suppliers = [{ code: 'B' }];
  assert.deepEqual(rauw.suppliers, [{ code: 'B' }], 'schrijven landt op dezelfde plek');
});
