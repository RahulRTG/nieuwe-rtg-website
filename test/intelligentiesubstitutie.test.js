/* HET INTELLIGENCE SUBSTITUTION PROTOCOL. De dragende grens: een goedkopere
   techniek promoveert niet omdat zij antwoord gaf of met Rahul overeenkwam,
   maar pas na een onafhankelijke oracle, nul veiligheidsfouten en een menselijk
   besluit. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const protocol = require('../server/kern/ai/substitutie');

const vak = (extra) => Object.assign({ oracleBeproefd: 0, oracleOnafhankelijk: 0,
  juist: 0, onjuist: 0, afgezien: 0, veiligheidsfout: 0 }, extra || {});

test('1. dekking zonder oracle is NIET_BEPROEFD en geen nulscore', () => {
  const r = protocol.beoordeel(vak({ bewezenGedekt: 900 }), { dagen: 30 });
  assert.equal(r.stand, 'NIET_BEPROEFD');
  assert.equal(r.activeert, false);
  assert.match(r.reden, /geen onafhankelijke juiste uitkomst/i);
});

test('2. een model mag zijn eigen vervanging niet goedkeuren', () => {
  const r = protocol.beoordeel(vak({ oracleBeproefd: 200, oracleOnafhankelijk: 199,
    juist: 200 }), { dagen: 8 });
  assert.equal(r.stand, 'ONBRUIKBAAR_BEWIJS');
  assert.equal(r.activeert, false);
});

test('3. een veiligheidsfout wijst promotie hard af', () => {
  const r = protocol.beoordeel(vak({ oracleBeproefd: 200, oracleOnafhankelijk: 200,
    juist: 200, veiligheidsfout: 1 }), { dagen: 8 });
  assert.equal(r.stand, 'AFGEWEZEN');
  assert.equal(r.activeert, false);
});

test('4. te weinig gevallen of dagen blijft in de schaduw', () => {
  const r = protocol.beoordeel(vak({ oracleBeproefd: 199, oracleOnafhankelijk: 199,
    juist: 199 }), { dagen: 6 });
  assert.equal(r.stand, 'SCHADUW');
  assert.equal(r.activeert, false);
});

test('5. bewezen onthouden is toegestaan; de beste uitkomst activeert nog steeds niets', () => {
  const r = protocol.beoordeel(vak({ oracleBeproefd: 200, oracleOnafhankelijk: 200,
    juist: 199, afgezien: 1 }), { dagen: 8 });
  assert.equal(r.stand, 'KLAAR_VOOR_BESLUIT');
  assert.equal(r.bewijs.juistPct, 100);
  assert.equal(r.activeert, false);
  assert.ok(r.vereist.includes('menselijke goedkeuring'));
});

test('6. een fout antwoord blijft schaduw als de juistheidsgrens niet wordt gehaald', () => {
  const r = protocol.beoordeel(vak({ oracleBeproefd: 200, oracleOnafhankelijk: 200,
    juist: 199, onjuist: 1 }), { dagen: 8 });
  assert.equal(r.stand, 'SCHADUW');
  assert.equal(r.activeert, false);
});

test('7. de routerschaduw bewaart alleen tellers en levert ze aan het protocol', () => {
  delete require.cache[require.resolve('../server/kern/ai/routertellers')];
  delete require.cache[require.resolve('../server/kern/ai/routermeting')];
  const meter = require('../server/kern/ai/routermeting');
  meter.meet('synthetisch geval', { ingang: 'ai', gedekt: true,
    vergelijking: 'juist', oracleOnafhankelijk: true });
  const v = meter.stand().per.ai;
  assert.equal(v.oracleBeproefd, 1);
  assert.equal(v.oracleOnafhankelijk, 1);
  assert.equal(v.juist, 1);
  assert.equal(typeof meter.substitutie.beoordeel, 'function');
  assert.ok(Object.values(v).every(x => typeof x === 'number'), 'de teller bevat iets anders dan getallen');
});

test('8. een veiligheidsfout zonder complete oracle en inconsistente tellers kunnen niet promoveren', () => {
  const onveilig = protocol.beoordeel(vak({ veiligheidsfout: 1 }), { dagen: 30 });
  assert.equal(onveilig.stand, 'AFGEWEZEN');
  const inconsistent = protocol.beoordeel(vak({ oracleBeproefd: 200, oracleOnafhankelijk: 200,
    juist: 199, onjuist: 0, afgezien: 0 }), { dagen: 8 });
  assert.equal(inconsistent.stand, 'ONBRUIKBAAR_BEWIJS');
  const gebroken = protocol.beoordeel(vak({ oracleBeproefd: -1 }), { dagen: 8 });
  assert.equal(gebroken.stand, 'ONBRUIKBAAR_BEWIJS');
});
