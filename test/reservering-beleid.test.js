'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const B = require('../server/kern/reservering/beleid');

const UUR = 3600 * 1000;
const NU = Date.UTC(2026, 6, 23, 12, 0, 0); // vast tijdstip
// een datum/tijd op N uur na NU (voor last-minute-grenzen)
function overNUur(n) {
  const d = new Date(NU + n * UUR);
  return { datum: d.toISOString().slice(0, 10), tijd: d.toISOString().slice(11, 16) };
}

test('gewone reservering ruim vooruit: 24u bedenktijd, nog niet definitief', () => {
  const { datum, tijd } = overNUur(72); // over 3 dagen
  const t = B.beginToestand({ datum, tijd, perDirect: false, nu: NU });
  assert.equal(t.definitief, false);
  assert.equal(t.lastMinute, false);
  assert.equal(t.bedenktijdTot, NU + B.BEDENKTIJD_MS);
  assert.equal(B.annuleerBoeteCenten(t), 0); // gewoon: gratis annuleren
});

test('last-minute (binnen 24u): meteen definitief, gratis annuleren', () => {
  const { datum, tijd } = overNUur(3); // over 3 uur
  const t = B.beginToestand({ datum, tijd, perDirect: false, nu: NU });
  assert.equal(t.lastMinute, true);
  assert.equal(t.definitief, true);
  assert.equal(B.annuleerBoeteCenten(t), 0);
});

test('per direct: meteen definitief, maar annuleren kost de straf', () => {
  const { datum, tijd } = overNUur(72);
  const t = B.beginToestand({ datum, tijd, perDirect: true, nu: NU });
  assert.equal(t.perDirect, true);
  assert.equal(t.definitief, true);
  assert.equal(t.bedenktijdTot, NU); // geen wachttijd
  assert.equal(B.annuleerBoeteCenten(t), B.DIRECT_ANNULEER_BOETE_CENTEN);
  assert.equal(B.DIRECT_ANNULEER_BOETE_CENTEN, 100); // €1
});

test('rijp(): bedenktijd voorbij -> definitief', () => {
  const { datum, tijd } = overNUur(72);
  const t = B.beginToestand({ datum, tijd, perDirect: false, nu: NU });
  assert.equal(B.rijp(t, NU + 1 * UUR), false);      // nog binnen de bedenktijd
  assert.equal(t.definitief, false);
  assert.equal(B.rijp(t, NU + 25 * UUR), true);      // na 24u: rijp
  assert.equal(t.definitief, true);
  assert.equal(B.rijp(t, NU + 26 * UUR), false);     // al definitief: geen wijziging meer
});

test('aanbetaling: wacht tot betaald; zonder aanbetaling meteen "betaald"', () => {
  const { datum, tijd } = overNUur(72);
  const zonder = B.beginToestand({ datum, tijd, nu: NU });
  assert.equal(zonder.aanbetaald, true);
  assert.equal(B.wachtOpAanbetaling(zonder), false);

  const met = B.beginToestand({ datum, tijd, aanbetalingCenten: 2500, nu: NU });
  assert.equal(met.aanbetalingCenten, 2500);
  assert.equal(met.aanbetaald, false);
  assert.equal(B.wachtOpAanbetaling(met), true);
  met.aanbetaald = true;
  assert.equal(B.wachtOpAanbetaling(met), false);
});
