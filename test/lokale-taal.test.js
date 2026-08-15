'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { samenvat, actiepunten, reactiesSamenvatting, beantwoordUitTekst } = require('../server/lib/lokale-taal');

test('lokale samenvatting kiest besluiten en termijnen boven beleefdheidsruis', () => {
  const bron = 'Goedemorgen allemaal. Dank voor de fijne bijeenkomst gisteren. ' +
    'We hebben besloten dat Noor vrijdag het definitieve draaiboek naar het team stuurt. ' +
    'De begroting blijft maximaal 12.000 euro. Kunnen jullie de allergenenlijst nog controleren? ' +
    'Daarna spreken we elkaar weer.';
  const uit = samenvat(bron, { maxZinnen: 3 });
  assert.match(uit, /besloten.*Noor.*vrijdag/i);
  assert.match(uit, /12\.000 euro/i);
  assert.doesNotMatch(uit, /Goedemorgen allemaal/);
  assert.doesNotMatch(uit, /niet bekend|waarschijnlijk|mogelijk/i, 'de motor verzint geen onzekerheid');
});

test('actiepunten komen uitsluitend uit concrete zinnen en dragen eigenaar en termijn', () => {
  const uit = actiepunten('Mila stuurt maandag de offerte. Wij controleren voor 20 augustus de aantallen. Het was een prettige dag.');
  assert.equal(uit.length, 2);
  assert.equal(uit[0].wie, 'Mila');
  assert.match(uit[0].wanneer, /maandag/i);
  assert.match(uit[1].wanneer, /20 augustus/i);
  assert.ok(uit.every(x => x.wat && !/prettige dag/i.test(x.wat)));
});

test('reacties worden lokaal in gewone taal geduid zonder individuele mensen te wegen', () => {
  const uit = reactiesSamenvatting([
    'Ibis: Prachtig plan, dit ziet er goed uit.',
    'Vos: Hoe laat begint het diner?',
    'Ster: Mooi, maar ik maak me zorgen over de toegankelijkheid.'
  ]);
  assert.match(uit, /gemengd|positief/i);
  assert.match(uit, /vraag/i);
  assert.match(uit, /Hoe laat begint het diner/i);
  assert.doesNotMatch(uit, /Ibis|Vos|Ster/, 'de samenvatting weegt de inhoud, niet de mensen');
});

test('een feitelijke vraag krijgt alleen bronzinnen met een duidelijke woordmatch', () => {
  const artikel = 'De nieuwe lounge opent op 4 september. Leden kunnen vanaf augustus reserveren. De tuin blijft deze zomer gesloten.';
  assert.match(beantwoordUitTekst(artikel, 'Wanneer opent de nieuwe lounge?'), /4 september/);
  assert.equal(beantwoordUitTekst(artikel, 'Wie heeft het gebouw ontworpen?'), '',
    'zonder bronmatch doet de lokale laag geen gok');
});
