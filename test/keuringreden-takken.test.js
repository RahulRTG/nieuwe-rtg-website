'use strict';
/* ============================================================================
   KEURINGREDEN -- DE ZIJPADEN VAN redenen() EN klopt()

   keuringreden.test.js toetst de reden van een keuring via een echt plan.
   Dit bestand voedt redenen() en klopt() met kleine, met de hand gebouwde
   plannen, zodat elk zijpad zijn eigen uitspraak krijgt: een leeg plan, een
   onvolledige impact, gebieden als Map of als object, de cosmetische
   kortsluiting, en de narekening als de gekozen klasse niet de strengste is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../scripts/lib/keuringreden');

test('een leeg plan geeft een graafregel en een modusregel, zonder klasse', () => {
  const r = K.redenen({});
  assert.equal(r.klasse, null);
  assert.deepEqual(r.regels.map((x) => x.regel), ['graaf', 'modus']);
  const graaf = r.regels[0];
  assert.equal(graaf.klasse, 'implementation', 'een onbekend gebied valt op implementation terug');
  assert.deepEqual(graaf.gemeten, { gebied: null, perGebied: {}, geraakt: null });
  const modus = r.regels[1];
  assert.equal(modus.wet, null);
  assert.equal(modus.bron, 'scripts/plan.js modusbesluit()');
  assert.equal(modus.graad, 'gemeten');
  assert.deepEqual(modus.gemeten, { modus: undefined, code: null, reden: null, telling: null });
  assert.equal(r.bereik.gewijzigd, 0);
  assert.equal(r.bereik.geraakt, null);
  assert.deepEqual(r.bereik.bestandenPerGebied, {});
  assert.equal(Object.keys(r.bereik.nietGemeten).length, 3);
  /* graaf draagt implementation, de gekozen klasse is null: dat klopt niet */
  assert.deepEqual(r.klopt, { ja: false, strengste: 'implementation' });
});

test('vormregels: code is vermoed, een pad-soort is gemeten, ontbrekende velden krijgen een standaard', () => {
  const r = K.redenen({
    wijziging: { bestanden: [
      { pad: 'a.js', soort: 'code', klasse: 'money', regels: 3, redenen: ['bedrag'] },
      { pad: 'b.md', klasse: 'documentatie' },
    ] },
    impact: { gebied: 'money', gebieden: new Map([['money', 2], ['algemeen', 1]]), telling: 3 },
    oordeel: { klasse: 'money' },
    gewijzigd: ['a.js', 'b.md'],
  });
  const [a, b] = r.regels;
  assert.equal(a.graad, 'vermoed');
  assert.deepEqual(a.gemeten, { pad: 'a.js', soort: 'code', regels: 3, patronen: ['bedrag'] });
  assert.equal(b.graad, 'gemeten');
  assert.deepEqual(b.gemeten, { pad: 'b.md', soort: null, regels: 0, patronen: [] });
  const graaf = r.regels.find((x) => x.regel === 'graaf');
  assert.equal(graaf.klasse, 'money');
  assert.deepEqual(graaf.gemeten.perGebied, { algemeen: 1, money: 2 }, 'een Map wordt een gesorteerd object');
  assert.equal(r.bereik.gewijzigd, 2);
  assert.equal(r.bereik.geraakt, 3);
  assert.deepEqual(r.klopt, { ja: true, strengste: 'money' });
});

test('gebieden als gewoon object worden ook gesorteerd geteld', () => {
  const r = K.redenen({ impact: { gebied: 'identity', gebieden: { zeta: 1, alfa: 4 } }, oordeel: { klasse: 'authorization' } });
  const graaf = r.regels.find((x) => x.regel === 'graaf');
  assert.equal(graaf.klasse, 'authorization');
  assert.deepEqual(Object.keys(graaf.gemeten.perGebied), ['alfa', 'zeta']);
  assert.equal(r.klopt.ja, true);
});

test('een onvolledige impact is security met graad onbekend, en noemt hoogstens vijf paden', () => {
  const onvolledig = Array.from({ length: 7 }, (_, i) => ({ pad: 'x' + i + '.js' }));
  const r = K.redenen({ impact: { volledig: false, onvolledig }, oordeel: { klasse: 'security' } });
  const regel = r.regels.find((x) => x.regel === 'impact-onvolledig');
  assert.equal(regel.wet, K.WET_ONTBREEKT);
  assert.equal(regel.klasse, 'security');
  assert.equal(regel.graad, 'onbekend');
  assert.equal(regel.gemeten.buitenDeIndex, 7);
  assert.deepEqual(regel.gemeten.paden, ['x0.js', 'x1.js', 'x2.js', 'x3.js', 'x4.js']);
  assert.equal(r.regels.some((x) => x.regel === 'graaf'), false, 'zonder volledige graaf geen graafregel');
  assert.equal(r.klopt.ja, true);
});

test('een onvolledige impact zonder lijst telt nul paden', () => {
  const r = K.redenen({ impact: { volledig: false } });
  const regel = r.regels.find((x) => x.regel === 'impact-onvolledig');
  assert.equal(regel.gemeten.buitenDeIndex, 0);
  assert.deepEqual(regel.gemeten.paden, []);
});

test('de cosmetische kortsluiting gaat alleen af als er gewijzigde bestanden zijn', () => {
  const met = K.redenen({
    wijziging: { bestanden: [{ pad: 'x.js', soort: 'code', klasse: 'cosmetic' }] },
    impact: { gebied: 'money' },
    oordeel: { klasse: 'cosmetic' },
  });
  assert.ok(met.regels.some((x) => x.regel === 'cosmetisch'));
  assert.deepEqual(met.klopt, { ja: true, strengste: 'cosmetic', via: 'cosmetisch' });

  const zonder = K.redenen({ impact: { gebied: 'money' }, oordeel: { klasse: 'cosmetic' } });
  assert.equal(zonder.regels.some((x) => x.regel === 'cosmetisch'), false);
  assert.deepEqual(zonder.klopt, { ja: false, strengste: 'money' }, 'zonder kortsluiting telt de graaf');
});

test('een ontbrekend gegeven in het modusbesluit valt onder de tweede wet', () => {
  for (const code of K.ONTBREKEND) {
    const r = K.redenen({ besluit: { code, reden: 'r' }, mode: 'full', telling: { a: 1 } });
    const modus = r.regels.find((x) => x.regel === 'modus');
    assert.equal(modus.wet, K.WET_ONTBREEKT, code);
    assert.equal(modus.graad, 'onbekend');
    assert.equal('bron' in modus, false, 'een wet heeft geen losse bron');
    assert.deepEqual(modus.gemeten, { modus: 'full', code, reden: 'r', telling: { a: 1 } });
  }
  const gewoon = K.redenen({ besluit: { code: 'iets-anders' } }).regels.find((x) => x.regel === 'modus');
  assert.equal(gewoon.wet, null);
  assert.equal(gewoon.graad, 'gemeten');
});

test('klopt: geen regels met klasse betekent alleen ja als er ook geen klasse gekozen is', () => {
  assert.deepEqual(K.klopt(null, []), { ja: true, strengste: null });
  assert.deepEqual(K.klopt(undefined, [{ regel: 'modus', klasse: null }]), { ja: true, strengste: null });
  assert.deepEqual(K.klopt('money', []), { ja: false, strengste: null });
});

test('klopt: de strengste van meerdere regels wint, en een lichtere keuze klopt niet', () => {
  const regels = [{ regel: 'vorm', klasse: 'implementation' }, { regel: 'vorm', klasse: 'security' }, { regel: 'graaf', klasse: 'money' }];
  assert.deepEqual(K.klopt('security', regels), { ja: true, strengste: 'security' });
  assert.deepEqual(K.klopt('money', regels), { ja: false, strengste: 'security' });
  /* een cosmetische regel en een andere keuze: niet kloppend, maar via cosmetisch */
  assert.deepEqual(K.klopt('money', [{ regel: 'cosmetisch', klasse: 'cosmetic' }, { regel: 'graaf', klasse: 'money' }]),
    { ja: false, strengste: 'cosmetic', via: 'cosmetisch' });
  assert.ok(Array.isArray(K.GEWICHT));
});
