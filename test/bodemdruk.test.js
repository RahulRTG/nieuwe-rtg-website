/* GEEN COMMERCIELE DRUK BINNEN DE BODEM -- de meter van eis 5 (SAMENLEVING.md
   par. 6). scripts/bodemdruk.js leidt af welke schermen bij de universele bodem
   horen en telt of daar een uitnodiging om te betalen op staat. De telling zelf
   is een ratel in NORM.json (`bodemDruk`, alleen omlaag); dit bestand bewaakt
   het instrument.

   Een meter die op nul staat, moet kunnen bewijzen dat hij niet blind is --
   anders is nul geen uitslag maar een stilte (BEWIJSMACHINE.md par. 6a). Vandaar
   toets 1 en 3: elke vorm vangt zijn voorbeeld, en een echte upgradetekst
   ELDERS in het huis wordt gevonden.

   Draai los: node --test test/bodemdruk.test.js
   De meting zelf: npm run bodemdruk */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const B = require('../scripts/bodemdruk');
const { zonderCommentaar } = require('../scripts/lib/bron');

test('1. elke vorm van druk vangt zijn voorbeeld, en een gewone zin niet', () => {
  const voorbeelden = {
    'word lid': 'Word lid om verder te leren',
    'upgrade': 'Upgrade naar Lifestyle',
    'met een pas kon het': 'Met RTG Pass kon je dit sneller',
    'ontgrendel': 'Ontgrendel alle leerpaden',
    'voor betalende leden': 'Dit pad is voor betalende leden',
    'koop een pas': 'Koop een pas en ga door'
  };
  assert.deepEqual(Object.keys(voorbeelden).sort(), B.DRUK.map(d => d.vorm).sort(), 'elke vorm heeft een voorbeeld');
  for (const [vorm, zin] of Object.entries(voorbeelden)) {
    assert.ok(B.drukIn(zin).some(d => d.vorm === vorm), vorm + ' ziet "' + zin + '" niet');
  }
  for (const zin of ['Je kring komt erdoor.', 'Helemaal klaar voor vandaag.', 'Dit leerpad is gratis.']) {
    assert.deepEqual(B.drukIn(zin), [], '"' + zin + '" is geen druk');
  }
});

test('2. commentaar telt niet, tekst op het scherm wel', () => {
  const bron = "/* hier stond: word lid */\nconst x = '<p>Word lid</p>';\n// upgrade later\n";
  const gevonden = B.drukIn(zonderCommentaar(bron, { soort: 'js', regelsHeel: true }));
  assert.equal(gevonden.length, 1, 'alleen de zin op het scherm telt: ' + JSON.stringify(gevonden));
  assert.equal(gevonden[0].regel, 2);
});

test('3. de meter is niet blind: een echte upgradetekst BUITEN de bodem wordt gevonden', () => {
  /* De tekst woont sinds de handmatige reisplanner (#432) in het script van het
     scherm en niet meer in de HTML; de meter leest beide, want SCHERMROUTES.json
     noemt ook de scripts. */
  const bestand = path.join(WORTEL, 'public', 'apps', 'reisuitnodiging-client.js');
  const tekst = zonderCommentaar(fs.readFileSync(bestand, 'utf8'), { soort: 'js', regelsHeel: true });
  assert.ok(B.drukIn(tekst).length > 0, 'de reisuitnodiging vraagt om lid te worden, en de meter zag het niet');
  const s = B.meet();
  for (const b of ['public/apps/reisuitnodiging.html', 'public/apps/reisuitnodiging-client.js'])
    assert.ok(!s.schermen.some(x => x.bestand === b),
      b + ' is geen bodemscherm; staat hij erin, dan is de afleiding te ruim');
});

test('4. de afleiding vindt de schermen die er zeker bij horen', () => {
  const s = B.meet();
  assert.ok(s.gemeten.schermen >= 30, 'er zijn bodemschermen gevonden (' + s.gemeten.schermen + ')');
  const bij = (bestand, werkwoord) => {
    const r = s.schermen.find(x => x.bestand === bestand);
    assert.ok(r, bestand + ' staat niet bij de bodemschermen');
    assert.ok(r.werkwoorden.includes(werkwoord), bestand + ' draagt ' + werkwoord + ' niet');
  };
  bij('public/apps/veilig/rust.js', 'rust');
  bij('public/apps/foundation/hulpwijzer.html', 'orienteren');
  bij('public/apps/salon.html', 'verbinden');
});

test('5. BODEMDRUK.json loopt niet achter op een verse meting', () => {
  const pad = path.join(WORTEL, 'BODEMDRUK.json');
  assert.ok(fs.existsSync(pad), 'BODEMDRUK.json bestaat -- draai: npm run bodemdruk:vast');
  const vast = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const vers = B.meet();
  assert.deepEqual(vers.gemeten, vast.gemeten,
    'BODEMDRUK.json loopt achter (' + JSON.stringify(vast.gemeten) + ' vastgelegd, ' +
    JSON.stringify(vers.gemeten) + ' gemeten) -- draai: npm run bodemdruk:vast');
});
