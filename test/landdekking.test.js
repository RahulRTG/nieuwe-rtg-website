/* DE LANDDEKKING (scripts/landdekking.js, LANDDEKKING.json).

   WAT DEZE TOETS BEWAAKT, en wat met opzet niet. Hij zegt niets over of RTG naar
   een land MOET -- dat is een besluit van de eigenaar. Hij bewaakt de vier dingen
   die wel machinaal te handhaven zijn:

     1 DE RATEL. `landenVolledig` mag alleen omhoog en `landenZonderEnige` alleen
       omlaag. Dat is de reden dat dit bestand bestaat: een meetbestand in de
       wortel dat aan geen enkele ratel hangt, groeit stilletjes de verkeerde
       kant op (scripts/lib/metingen.js). De grondwaarden staan hieronder, met
       hun datum.

     2 HET REGISTER KLOPT MET EEN VERSE METING. Een register dat niet is
       hergedraaid, is een bewering over het verleden -- die les kostte
       MENSNETWERK.md zeven "gezakte" routes die allang gerepareerd waren.

     3 DE INDELING IS GETELD EN NIET INGETIKT. Een as heet ondergrens omdat hij
       voor ELK land aanstaat, en dat wordt nagerekend. In de eerste versie van
       de meter stond het per as met de hand, en het stond meteen verkeerd
       (BEWIJSMACHINE.md par. 6a: een proef kan een geldige uitslag geven en toch
       het verkeerde experiment zijn uitgevoerd).

     4 GEEN GETAL ZONDER GRAAD. Elke huisbrede as draagt een bewijsgraad, want
       een nul zonder bron is een vermoeden dat als meting leest.

   WAT HIER NIET IN ZIT: een oordeel over de kwaliteit van de landgegevens. Deze
   toets telt gevulde cellen; hij beoordeelt geen btw-tarief. Dezelfde grens als
   kern/taaldekking.js over zijn 114 talen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { meet, ASSEN, DOEL } = require('../scripts/landdekking');

const WORTEL = path.join(__dirname, '..');

/* DE GRONDWAARDEN, met de datum waarop ze zijn gezet. Ze verschuiven alleen met
   de hand en dan staat het in de historie -- precies zoals NORM.json dat doet. */
const GROND = {
  gezet: '2026-09-14',
  landenVolledig: 0,      // mag alleen OMHOOG
  landenZonderEnige: 156  // mag alleen OMLAAG
};

const vers = meet();

test('0. het ingecheckte register klopt met een verse meting', () => {
  assert.ok(fs.existsSync(DOEL), 'LANDDEKKING.json ontbreekt -- draai npm run landdekking:vast');
  const vast = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
  assert.deepEqual(vast.telling.perAs, vers.telling.perAs,
    'LANDDEKKING.json loopt achter op de code. Een register dat niet is hergedraaid is een bewering ' +
    'over het verleden -- draai npm run landdekking:vast.');
  assert.equal(vast.telling.landenVolledig, vers.telling.landenVolledig);
  assert.equal(vast.telling.landenZonderEnige, vers.telling.landenZonderEnige);
});

test('1. RATEL: landenVolledig mag alleen omhoog', () => {
  assert.ok(vers.telling.landenVolledig >= GROND.landenVolledig,
    'landenVolledig zakte van ' + GROND.landenVolledig + ' naar ' + vers.telling.landenVolledig +
    ' -- er is uitvoeringsdekking voor een land WEGgehaald. Herstel het, of verlaag de grondwaarde ' +
    'in deze toets met de hand, zodat het als besluit in de historie staat.');
});

test('2. RATEL: landenZonderEnige mag alleen omlaag', () => {
  assert.ok(vers.telling.landenZonderEnige <= GROND.landenZonderEnige,
    'landenZonderEnige steeg van ' + GROND.landenZonderEnige + ' naar ' + vers.telling.landenZonderEnige +
    ' -- er zijn landen bijgekomen waar RTG alleen kennis heeft en niets kan uitvoeren, of er is ' +
    'uitvoering weggevallen. Dit getal hoort te dalen doordat er pakketten bijkomen.');
});

test('3. de indeling ondergrens/onderscheidend is GETELD en niet ingetikt', () => {
  const n = vers.telling.landen;
  for (const a of vers.assen) {
    const telling = vers.telling.perAs[a.id];
    const hoortOnderscheidend = telling < n;
    assert.equal(a.onderscheidend, hoortOnderscheidend,
      'as ' + a.id + ' staat als ' + (a.onderscheidend ? 'onderscheidend' : 'ondergrens') +
      ' terwijl hij op ' + telling + ' van ' + n + ' landen staat -- de indeling van een meting ' +
      'is zelf een bewering en hoort uit de telling te komen.');
  }
  assert.equal(vers.telling.onderscheidendeAssen + vers.telling.ondergrensAssen, ASSEN.length,
    'elke as is of onderscheidend of ondergrens; er kan er geen tussenuit vallen');
});

test('4. het kopgetal telt alleen onderscheidende assen', () => {
  const ondergrens = vers.assen.filter(a => !a.onderscheidend).map(a => a.id);
  for (const l of vers.perLand) {
    for (const o of ondergrens) {
      assert.ok(!l.mist.includes(o),
        'land ' + l.code + ' mist de ondergrens-as ' + o + ' -- een as die voor elk land aanstaat ' +
        'hoort niet in het kopgetal, anders leest kennis als dekking');
    }
  }
});

test('5. elke huisbrede as draagt een bewijsgraad en een bron', () => {
  const graden = ['onbekend', 'vermoed', 'gemeten', 'bewezen'];
  assert.ok(vers.huisbreed.length > 0, 'er is geen enkele huisbrede as -- dan meet dit niets');
  for (const h of vers.huisbreed) {
    assert.ok(graden.includes(h.graad), 'as ' + h.as + ' draagt graad "' + h.graad + '", niet een van ' + graden.join('/'));
    assert.ok(h.bron && h.bron.length > 3, 'as ' + h.as + ' draagt geen bron -- een nul zonder bron is een vermoeden');
    assert.ok(h.waarom && h.waarom.length > 30, 'as ' + h.as + ' zegt niet waarom zijn getal is wat het is');
  }
});

test('6. de meter leest de code en niet zichzelf', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/landdekking.js'), 'utf8');
  /* Een landenlijst in dit script zou betekenen dat het register iets beweert
     dat naast de code leeft. De landen komen uit kern/fiscaal/landen.js en de
     pakketten uit de mappen zelf; wie hier een lijst intikt, maakt de 78ste
     semantische botsing (BEWIJSMACHINE.md). */
  assert.ok(/require\(path\.join\(WORTEL, 'server\/kern\/fiscaal\/landen'\)\)/.test(bron),
    'de meter leest de landen niet meer uit kern/fiscaal/landen.js');
  const eigenLijst = /const\s+[A-Z_]*LANDEN[A-Z_]*\s*=\s*\[/.test(bron);
  assert.ok(!eigenLijst, 'scripts/landdekking.js draagt een eigen landenlijst -- dan meet hij zichzelf');
});
