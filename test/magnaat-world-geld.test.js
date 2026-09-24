/* Het geld van Magnaat World in ronde A2 (MAGNAAT.md).

   1. De World-scenario's raken alle 27 gebeurtenissen van de geldkaart. Dat
      wordt GEMETEN (./lib/magnaat-geldkaart-dekking.js telt de benen die echt
      liepen), niet beweerd.
   2. World rekent stap voor stap gelijk aan de vastgelegde referentie. Voor
      ronde A2.1 is dat World zoals hij was (test/fixtures/magnaat-world-voor-
      a21.json); daarna wordt dat de WORLD ECONOMIC GOLDEN BASELINE. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const kaart = require('../scripts/lib/magnaatgeldkaart');
const { metDekking } = require('./lib/magnaat-geldkaart-dekking');

test('1. de World-scenario\'s raken alle gebeurtenissen van de geldkaart', () => {
  const telling = metDekking(() => {
    const { SCENARIOS, draai } = require('./lib/magnaat-world-scenarios');
    for (const naam of Object.keys(SCENARIOS)) draai(naam);
  });
  const niet = kaart.GEBEURTENISSEN.filter(g => !telling[g.id]).map(g => g.id + ' ' + g.betekenis);
  assert.deepEqual(niet, [], 'gebeurtenissen die geen scenario raakt: ' + niet.join(', '));
});

test('2. World rekent stap voor stap gelijk aan de vastgelegde referentie', () => {
  const { SCENARIOS, draai } = require('./lib/magnaat-world-scenarios');
  const ref = require('./fixtures/magnaat-world-voor-a21.json');
  for (const naam of Object.keys(SCENARIOS)) {
    const uit = draai(naam).stappen;
    const verwacht = ref.scenarios[naam].stappen;
    assert.equal(uit.length, verwacht.length, naam + ': ander aantal stappen');
    for (let i = 0; i < verwacht.length; i++) {
      if (uit[i].hash === verwacht[i].hash) continue;
      const delen = Object.keys(verwacht[i].delen || {}).filter(k => verwacht[i].delen[k] !== uit[i].delen[k]);
      assert.fail(naam + ' stap ' + verwacht[i].stap + ' (' + verwacht[i].soort + ') wijkt af in: ' + delen.join(', '));
    }
  }
});
