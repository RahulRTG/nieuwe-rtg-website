/* HET BEREIK VAN EEN APP -- de klasse die wordt GEREKEND en nooit gezet.

   Een keurmerk is de duurste vorm van LAT-regel 6: een lid dat "zonder bereik"
   leest, gedraagt zich ernaar. Wat deze toets vastlegt:

     1. De klasse volgt uit de machtigingen, en loopt van geen naar meest.
     2. Een onbekende machtiging valt naar de ZWAARSTE klasse, niet naar de
        veiligste. Een bevoegdheid die niemand kent, mag nooit als 'geen bereik'
        langskomen -- dat is het gat waar zo'n classificatie doorheen lekt.
     3. Er is geen weg om de klasse te ZETTEN: het manifest kent er geen veld
        voor, en een uitgever die het toch probeert wordt geweigerd.
     4. Netwerk is een kanaalfeit en geen appfeit: het staat NIET in de klasse.
        Een badge die per app verschilt, zou suggereren dat er apps zijn die het
        internet wel kunnen bereiken.
     5. Elke machtiging die bestaat, is ingedeeld. Een nieuwe machtiging zonder
        klasse laat deze toets zakken.

   Draai los: node --test test/appstore-bereik.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { bereik, KLASSEN, KANAALFEITEN, KLASSE_VAN_MACHTIGING } = require('../server/kern/appstore/bereik');
const { MACHTIGINGEN } = require('../server/kern/appstore/machtigingen');
const { lees, SLEUTELS } = require('../server/kern/appstore/manifest');

test('1. de klasse volgt uit de machtigingen', () => {
  assert.equal(bereik([]).klasse, 'zonder-bereik');
  assert.equal(bereik([]).bruggen, 0);
  assert.equal(bereik(['opslag.eigen']).klasse, 'eigen-potje');
  assert.equal(bereik(['opslag.eigen', 'profiel.basis']).klasse, 'met-identiteit');
  assert.equal(bereik(['profiel.basis', 'bericht.klaarzetten']).klasse, 'met-bakje');
  assert.equal(bereik(['profiel.basis', 'bericht.klaarzetten']).bruggen, 2);
});

test('2. een onbekende machtiging valt naar de zwaarste klasse', () => {
  const { klasseVan } = require('../server/kern/appstore/bereik');
  const zwaarste = KLASSEN[KLASSEN.length - 1].sleutel;
  assert.equal(klasseVan(['verzonnen.recht']).sleutel, zwaarste);
  /* En hij telt niet mee als brug: bereik() laat wat niet bestaat vallen, want
     een app krijgt hem ook niet. De KLASSE blijft wel zwaar -- dat is het punt. */
  assert.equal(bereik(['verzonnen.recht']).bruggen, 0);
});

test('3. de klasse is nergens te zetten', () => {
  assert.ok(!SLEUTELS.includes('bereik'), 'het manifest kent geen veld bereik');
  const r = lees({ sleutel: 'proef-app', naam: 'Proef', versie: '1.0.0',
    uitleg: 'Een app die probeert zijn eigen keurmerk te zetten, wat niet kan.',
    categorie: 'spelen', bereik: 'zonder-bereik' });
  assert.equal(r.ok, false);
  assert.ok(r.fouten.some(f => f.veld === 'bereik'), 'een gezet bereik wordt geweigerd');
});

test('4. netwerk is een kanaalfeit en geen appfeit', () => {
  for (const k of KLASSEN) {
    assert.ok(!/netwerk|internet/i.test(k.label), k.sleutel + ' claimt netwerk in zijn label');
  }
  const netwerk = KANAALFEITEN.find(f => f.feit === 'geen netwerk');
  assert.ok(netwerk && netwerk.bron, 'het kanaalfeit draagt de plek waar het wordt afgedwongen');
  /* Het geldt voor ELKE klasse, ook de zwaarste -- anders is het geen kanaalfeit. */
  assert.deepEqual(bereik(['bericht.klaarzetten']).kanaal, KANAALFEITEN);
});

test('5. elke bestaande machtiging is ingedeeld', () => {
  for (const m of MACHTIGINGEN) {
    assert.ok(Object.prototype.hasOwnProperty.call(KLASSE_VAN_MACHTIGING, m.id),
      'machtiging ' + m.id + ' heeft geen klasse in bereik.js');
  }
});
