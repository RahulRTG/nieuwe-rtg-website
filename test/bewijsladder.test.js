/* ============================================================================
   DE BEWIJSLADDER -- levert dit huis nog elk soort bewijs, en waar?

   Twee beweringen worden hier hard gemaakt, en ze zijn allebei een ANDERE dan
   die van test/ci-lokaal.test.js (dat gaat over pariteit per poort):

     1. de restbak is leeg. Elke poort die de keten draait, hoort op een sport
        van de ladder. Een nieuw soort bewijs dat nergens past, verdwijnt
        anders uit het beeld terwijl het beeld groen blijft -- en dan meet de
        ladder zijn eigen lijst in plaats van de keten.
     2. de stand van een sport komt uit de FEITEN en niet uit een mening:
        mechanisme aanwezig, aan beide kanten, met een gestempeld register.

   Elke bewering is zien zakken met een mutatie -- eerst het verboden geval,
   dan het toegestane.
   ========================================================================== */

const test = require('node:test');
const assert = require('node:assert/strict');

const { meet, standVan, bewijsVan, LADDER } = require('../scripts/bewijsladder');

test('de stand van een sport komt uit drie feiten, en niet uit een mening', () => {
  const vol = [{ lokaal: true, keten: ['ci.yml'], register: 'X.json', stempel: true }];
  assert.equal(standVan(vol).stand, 'staat');

  /* Zonder mechanisme: dit soort bewijs bestaat niet. */
  assert.equal(standVan([]).stand, 'jaren');

  /* Wel een mechanisme, maar het draait maar aan een kant -- dat is precies de
     scheiding die lokaal en keten twee kwaliteitswerelden maakt. */
  const alleenKeten = [{ lokaal: false, keten: ['ci.yml'], register: 'X.json', stempel: true }];
  assert.equal(standVan(alleenKeten).stand, 'stap');
  assert.match(standVan(alleenKeten).waarom, /alleen in de keten/);
  const alleenLokaal = [{ lokaal: true, keten: [], register: 'X.json', stempel: true }];
  assert.match(standVan(alleenLokaal).waarom, /alleen lokaal/);

  /* En het geval waar het bij deze laag om draait: het draait overal, maar het
     laat niets achter dat bij een commit hoort. Dat is geen bewijs. */
  const zonderStempel = [{ lokaal: true, keten: ['ci.yml'], register: 'X.json', stempel: false }];
  assert.equal(standVan(zonderStempel).stand, 'stap');
  assert.match(standVan(zonderStempel).waarom, /geen gestempeld register/);

  /* Een register dat hier niet eens staat (stempel === null) telt evenmin --
     ATTRIBUTIE.json is precies dat geval. */
  assert.equal(standVan([{ lokaal: true, keten: ['ci.yml'], register: 'X.json', stempel: null }]).stand, 'stap');
});

/* EEN REGISTER DAT JE LEEST IS GEEN BEWIJS DAT JE AFLEGT. De eerste versie van
   deze meter schreef BEGROTING.json op naam van samenhang.js, dat hem alleen
   leest -- en NORM.json op naam van drie meters tegelijk. */
test('een mechanisme krijgt alleen het register dat het zelf SCHRIJFT', () => {
  const gluur = bewijsVan('scripts/gluurronde.js');
  assert.equal(gluur.register, 'GLUURRONDE.json');
  assert.equal(gluur.grond, 'schrijft');

  const samen = bewijsVan('scripts/samenhang.js');
  assert.notEqual(samen.register, 'BEGROTING.json');

  /* En een doel dat hier niet bestaat levert geen register op in plaats van een
     gok. */
  assert.deepEqual(bewijsVan('scripts/bestaat-niet-echt.js'), { register: null, stempel: null });
});

test('elke poort die de keten draait, staat op een sport van de ladder', () => {
  const uit = meet();
  assert.deepEqual(uit.zonderTrede.map(z => z.doel), [],
    'deze poorten draaien in de keten en de ladder kent ze niet; geef ze een sport in scripts/bewijsladder.js');
});

test('de ladder meet de keten, niet zichzelf', () => {
  const uit = meet();
  assert.ok(uit.telling.mechanismen > 30,
    'de keten hoort tientallen bewijsmechanismen te draaien, gemeten: ' + uit.telling.mechanismen);
  assert.equal(uit.sporten.length, LADDER.length);
  for (const sport of uit.sporten) {
    assert.ok(['staat', 'stap', 'jaren'].includes(sport.stand), sport.id + ' heeft een onbekende stand');
    assert.ok(sport.waarom && sport.waarom.length > 10, sport.id + ' zegt niet waarom hij die stand heeft');
    for (const m of sport.mechanismen) {
      assert.equal(typeof m.lokaal, 'boolean', m.doel + ' zegt niet of hij hier draait');
      assert.ok(Array.isArray(m.keten), m.doel + ' zegt niet in welke werkstroom hij draait');
    }
  }
});

/* DE PARITEIT IS DE HELE REDEN DAT DEZE METER BESTAAT. Zolang dit getal boven
   nul staat, zijn lokaal en keten twee kwaliteitswerelden -- en dat hoort
   zichtbaar te zijn in plaats van weggerekend. */
test('wat alleen in de keten draait, wordt geteld en niet verzwegen', () => {
  const uit = meet();
  const alleenKeten = uit.sporten.flatMap(s => s.mechanismen.filter(m => !m.lokaal).map(m => m.doel));
  assert.equal(uit.telling.alleenKeten, alleenKeten.length);
  for (const doel of alleenKeten) assert.ok(doel, 'een mechanisme zonder naam telt niet mee');
});
