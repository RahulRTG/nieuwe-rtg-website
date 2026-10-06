/* RTMAIL, delegatie op de huiswet (UITVOERINGSPLAN par. 8: rtmail-recht.delegeer,
   REDESIGN FIRST).

   Drie dingen die vroeger niet golden en nu wel:
   - wie doorgeeft, geeft nooit LANGER dan hij zelf heeft (en zonder einde
     krijgt het doorgegeven recht het einde van de gever);
   - een doorgegeven recht is zo sterk als zijn gever NU nog is: trekt de
     eigenaar de gever in, dan valt wat die doorgaf vanzelf weg (A6);
   - een kring telt als niets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakLijn } = require('../server/kern/rtmail-lijn');

const EIG = 'eig@rtmail', A = 'aaa@rtmail', B = 'bbb@rtmail', C = 'ccc@rtmail';
const laag = () => require('../server/kern/rtmail-recht')({ db: { data: {} }, save() {}, crypto });
const dag = (n) => new Date(Date.now() + n * 86400000).toISOString();

test('doorgeven: nooit langer dan de gever, en zonder einde het einde van de gever', () => {
  const r = laag();
  assert.ok(r.delegeer(EIG, { postvak: EIG, aan: A, rechten: ['metadata', 'lezen', 'delegatie'], tot: dag(10) }).ok);
  const later = r.delegeer(A, { postvak: EIG, aan: B, rechten: ['lezen'], tot: dag(20) });
  assert.match(later.error || '', /langer/, 'A gaf B langer dan A zelf had: ' + JSON.stringify(later));
  const zonder = r.delegeer(A, { postvak: EIG, aan: B, rechten: ['lezen'] });
  assert.ok(zonder.ok, JSON.stringify(zonder));
  const vanA = r.opPostvak(EIG).find(x => x.aan === 'aaa').tot;
  assert.equal(zonder.delegatie.tot, vanA, 'B kreeg niet het einde van A');
});

test('een einde in het verleden wordt geweigerd', () => {
  const r = laag();
  const d = r.delegeer(EIG, { postvak: EIG, aan: A, rechten: ['lezen'], tot: dag(-1) });
  assert.match(d.error || '', /achter ons/);
});

test('trekt de eigenaar de gever in, dan valt wat die doorgaf vanzelf weg', () => {
  const r = laag();
  r.delegeer(EIG, { postvak: EIG, aan: A, rechten: ['metadata', 'lezen', 'delegatie'] });
  r.delegeer(A, { postvak: EIG, aan: B, rechten: ['metadata', 'lezen'] });
  assert.equal(r.mag(B, EIG, 'lezen').ok, true);
  assert.ok(r.neemAf(EIG, { postvak: EIG, aan: A }).ok);
  const na = r.mag(B, EIG, 'lezen');
  assert.equal(na.ok, false, 'B las nog nadat de gever was ingetrokken');
  assert.match(na.waarom, /gaf/);
});

test('verliest de gever een recht, dan verliest wat hij doorgaf het ook', () => {
  const r = laag();
  r.delegeer(EIG, { postvak: EIG, aan: A, rechten: ['metadata', 'lezen', 'delegatie'] });
  r.delegeer(A, { postvak: EIG, aan: B, rechten: ['metadata', 'lezen'] });
  r.delegeer(EIG, { postvak: EIG, aan: A, rechten: ['metadata', 'delegatie'] });
  assert.equal(r.mag(B, EIG, 'lezen').ok, false, 'B hield lezen terwijl A het niet meer had');
  assert.equal(r.mag(B, EIG, 'metadata').ok, true, 'wat A nog wel heeft, viel ook weg');
});

test('een kring telt als niets', () => {
  const r = laag();
  r.delegeer(EIG, { postvak: EIG, aan: A, rechten: ['lezen', 'delegatie'] });
  r.delegeer(A, { postvak: EIG, aan: B, rechten: ['lezen', 'delegatie'] });
  r.delegeer(B, { postvak: EIG, aan: A, rechten: ['lezen', 'delegatie'] });
  assert.equal(r.mag(A, EIG, 'lezen').ok, false, 'een kring gaf A rechten');
  assert.equal(r.mag(B, EIG, 'lezen').ok, false, 'een kring gaf B rechten');
});

test('de lijn voegt nooit iets toe, over 10.000 willekeurige ketens', () => {
  const RECHTEN = ['metadata', 'lezen', 'antwoorden', 'delegatie'];
  const lijn = maakLijn({ RECHTEN, geldig: () => true });
  let s = 11;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const kies = () => RECHTEN.filter(() => rnd() < 0.5);
  const mensen = [A, B, C];
  for (let i = 0; i < 10000; i++) {
    const rijen = mensen.map((m, k) => ({ id: 'd' + k, postvak: EIG, aan: m, rechten: kies(),
      door: rnd() < 0.3 ? EIG : mensen[Math.floor(rnd() * 3)] }));
    for (const rij of rijen) {
      const eff = lijn.effectief(rijen, rij, 'nu');
      for (const x of eff) assert.ok(rij.rechten.includes(x), x + ' kwam erbij');
      if (rij.door !== EIG) {
        const ouder = rijen.find(o => o.aan === rij.door);
        const oe = lijn.effectief(rijen, ouder, 'nu');
        for (const x of eff) assert.ok(oe.includes(x) && oe.includes('delegatie'), x + ' kwam niet van de gever');
      }
    }
  }
});
