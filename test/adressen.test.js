/* DE ADRESRATEL (scripts/adressen.js).

   Vijf documenten wezen naar een risicomotor onder kern/command/ die per geval
   hand/assist/auto uitrekent. Dat bestand heeft daar nooit bestaan -- de motor
   woont op `kern/frictie/motor.js` en zegt in zijn eigen kop dat hij uit
   command/ is verhuisd.

   LET OP BIJ HET WIJZIGEN VAN DEZE KOP: hij wordt letterlijk overgenomen in het
   gegenereerde BEWIJS.md, dus een verzonnen pad tussen accenten wordt daar een
   echt kapot adres -- en dan zakt deze toets op zijn eigen kop. Die is precies
   een keer gemaakt. Niemand merkte het, want een verkeerd adres in proza ziet er
   identiek uit aan een goed. Deze toets is de handhaver die dat vasthoudt.

   HIJ BEVRIEST HET REGISTER NIET. ADRESSEN.json verandert bij elke documentregel
   die een pad noemt, en een toets die op gelijkheid staat zou dan bij elke
   commit zakken om een reden die niets met adressen te maken heeft. Wat hier
   geratelde wordt is het getal dat ertoe doet: `kapot` mag niet boven de
   grondwaarde in het script komen.

   DRIE DINGEN, en de tweede is de belangrijkste:

     1 DE RATEL  een nieuw kapot adres laat de bouw zakken.
     2 DE ZELFIJKING  de meter vindt een met opzet verzonnen adres nog steeds.
       Zonder deze zou een meter die stilletjes niets meer ziet, groen staan --
       en dat is precies de faalvorm die dit huis het vaakst heeft gehad.
     3 DE GRENS  een kale bestandsnaam wordt GETELD en niet BEOORDEELD. Wie die
       grens oprekt, laat het getal dalen door de meter te verruimen in plaats
       van door een adres te repareren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { meet, beoordeel } = require('../scripts/adressen');

const WORTEL = path.join(__dirname, '..');

/* De grondwaarde staat in het script zelf en niet hier: twee plekken met
   dezelfde waarheid is regel 4 van de lat. */
const KAPOT_MAX = Number(
  /const KAPOT_MAX = (\d+)/.exec(fs.readFileSync(path.join(WORTEL, 'scripts/adressen.js'), 'utf8'))[1]
);

function metDocument(inhoud, fn) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'adressen-'));
  try {
    fs.writeFileSync(path.join(map, 'PROEF.md'), inhoud);
    return fn(meet(map));
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
}

test('1. DE RATEL: geen nieuw kapot adres in de documenten', () => {
  const u = meet(WORTEL);
  assert.ok(u.kapot.length <= KAPOT_MAX,
    'kapotte adressen: ' + u.kapot.length + ', ratel staat op ' + KAPOT_MAX + '. Nieuw: ' +
    u.kapot.map(r => r.doc + ':' + r.regel + ' ' + r.pad).join(', ') +
    ' -- repareer het adres, of verzet de ratel MET de reden.');
});

test('2. ZELFIJKING: de meter vindt een verzonnen adres, en laat een echt met rust', () => {
  metDocument('Verzonnen: `kern/dit/bestaat/niet.js`. Echt: `kern/frictie/motor.js`.', u => {
    assert.deepEqual(u.kapot.map(r => r.pad), ['kern/dit/bestaat/niet.js'],
      'de meter ziet een verzonnen adres niet meer -- dan staat hij groen zonder iets te bewaken');
    assert.equal(u.klopt, 1, 'het echte adres hoort gewoon te kloppen');
  });
});

test('3. DE GRENS: een kale bestandsnaam wordt geteld, niet beoordeeld', () => {
  metDocument('Zie `check.js` en `index.js`.', u => {
    assert.equal(u.onbeoordeeld, 2, 'kale namen horen geteld te worden');
    assert.equal(u.beoordeeld, 0, 'een kale naam is een verkorte verwijzing en geen adres');
    assert.equal(u.kapot.length, 0);
  });
});

test('4. OPGEKNIPT is een eigen uitslag en geen KAPOT', () => {
  /* server/accounts.js is een map geworden: de module bestaat, het adres niet.
     Die twee vragen een andere reparatie en mogen niet op een hoop. */
  assert.equal(beoordeel('server/accounts.js').uitslag, 'opgeknipt');
  assert.equal(beoordeel('server/kern/frictie/motor.js').uitslag, 'klopt');
  assert.equal(beoordeel('kern/dit/bestaat/niet.js').uitslag, 'kapot');
});
