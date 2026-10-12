/* De groepvorm (scripts/groepvorm.js, GROEPVORM.json) -- de meting waar de
   architectuurkeuze van FoundationOS op rust (GEMEENSCHAP.md par. 5, fase 0.1,
   besluit van de eigenaar van 11 oktober 2026).

   Drie dingen worden hier vastgehouden. De meter KAN uitslaan (een meter die je
   nooit hebt zien uitslaan, is geen meter -- LAT.md regel 10). Het vastgelegde
   bestand is wat de meter vandaag zegt, en draagt een commit. En de conclusie in
   het bestand is afgeleid en niet overgetypt: verandert de uitslag, dan hoort de
   architectuurkeuze te worden heroverwogen en zakt deze toets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { meet, ronde, conclusieVan, RUIM, SMAL } = require('../scripts/groepvorm.js');

const WORTEL = path.join(__dirname, '..');

/* MUTATIE GEZIEN ZAKKEN: in conclusieVan() `geenVorm` altijd true gemaakt --
   dan wordt de verzonnen gedeelde kern hieronder `geen-gedeelde-vorm`. */
test('1. de meter slaat uit op een verzonnen gedeelde vorm', () => {
  const vormen = [
    { module: 'a/x.js', velden: ['id', 'leden', 'rol', 'sinds'] },
    { module: 'b/y.js', velden: ['id', 'leden', 'rol', 'plek'] },
    { module: 'c/z.js', velden: ['id', 'leden', 'kleur', 'maat'] }
  ];
  const lijst = { a: /^a\//, b: /^b\//, c: /^c\// };
  const r = ronde(vormen, new Set(['id']), lijst);
  assert.deepEqual(r.inAlleModellen, ['leden']);
  assert.equal(conclusieVan(r, r).stand, 'gedeelde-kern');
});

/* MUTATIE GEZIEN ZAKKEN: in ronde() de lege modellen laten meetellen in de
   noemer -- dan staat `c` niet meer in modellenLeeg en zakt deze toets. */
test('2. een model zonder vorm telt niet mee en staat er met reden bij', () => {
  const vormen = [
    { module: 'a/x.js', velden: ['id', 'leden', 'rol', 'sinds'] },
    { module: 'b/y.js', velden: ['id', 'leden', 'rol', 'plek'] }
  ];
  const r = ronde(vormen, new Set(['id']), { a: /^a\//, b: /^b\//, c: /^c\// });
  assert.deepEqual(r.modellen, ['a', 'b']);
  assert.equal(r.modellenLeeg.length, 1);
  assert.equal(r.modellenLeeg[0].model, 'c');
  assert.match(r.modellenLeeg[0].reden, /geen enkele objectvorm/);
});

test('3. de lijsten lopen uiteen, en dan is er geen conclusie', () => {
  const ja = { inAlleModellen: ['x'], inMinstensHelft: ['x'] };
  const nee = { inAlleModellen: [], inMinstensHelft: [] };
  assert.equal(conclusieVan(ja, nee).stand, 'verdeeld');
  assert.equal(conclusieVan(nee, nee).stand, 'geen-gedeelde-vorm');
});

test('4. beide lijsten noemen dezelfde modellen', () => {
  assert.deepEqual(Object.keys(RUIM).sort(), Object.keys(SMAL).sort());
});

/* De vastgelegde uitslag is wat de meter vandaag zegt. Het stempel verschilt per
   ronde en blijft buiten de vergelijking. */
test('5. GROEPVORM.json is de verse meting, met een commit', () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GROEPVORM.json'), 'utf8'));
  assert.ok(j.stempel && j.stempel.commit, 'de meting draagt geen commit en is dus niet na te lopen');
  const vers = meet();
  for (const k of ['ruim', 'smal', 'stand', 'conclusie', 'extraBronnen', 'buitenBeschouwing'])
    assert.deepEqual(vers[k], j[k], 'GROEPVORM.json loopt achter op de code bij `' + k +
      '`; draai npm run groepvorm:vast en lees of de architectuurkeuze nog klopt');
});

/* De architectuurkeuze van FoundationOS (GEMEENSCHAP.md fase 0) rust op deze
   uitslag. Slaat hij om, dan is die keuze niet meer gedekt -- dan wordt dit
   bestand niet aangepast maar de architectuur opnieuw bekeken. */
test('6. de architectuurkeuze is gedekt door de meting', () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GROEPVORM.json'), 'utf8'));
  assert.equal(j.stand, 'geen-gedeelde-vorm',
    'GROEPVORM.json vindt nu WEL een gedeelde vorm; de keuze voor een projectie in plaats van een ' +
    'groepstype is daarmee niet meer gedekt. Heroverweeg de architectuur, pas deze toets niet aan.');
  assert.equal(j.ruim.inAlleModellen.length, 0);
  assert.equal(j.smal.inAlleModellen.length, 0);
});
