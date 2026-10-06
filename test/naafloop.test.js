/* ============================================================================
   NA AFLOOP ZEGT NIEMAND STIL "GELUKT" (Fase 2, invariant I5).

   Een timer of losse belofte erft de context van het verzoek dat hem startte.
   Vier contexten lieten zo'n schrijver na `finish` gewoon slagen: de handeling
   gaf `true` terwijl de meting al dicht was, de effectmeter hoogde een teller op
   waarvan de kop al verstuurd was, de ai-context bewaarde een herkomstlabel dat
   niemand meer las, en de kostenhaak boekte zonder dat iemand het kon zien.

   Nu weigeren de eerste drie (false, niets veranderd) en meldt de vierde (hij
   boekt nog op dezelfde drager -- werk dat dit verzoek in gang zette is zijn
   kost -- maar telt het). Alle vier tellen in opzet/handeling.js `naAfloop()`.

   Mutatie, met de hand gedaan: haal in elk van de vier bestanden de gesloten-
   controle weg en de bijbehorende toets hier zakt (zie de commit).
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { AsyncResource } = require('node:async_hooks');
const handeling = require('../server/opzet/handeling');
const em = require('../server/effectmeter');
const haak = require('../server/kern/kosten/haak');
const aic = require('../server/ai-context');

/* Een verzoek met alle vier de contexten, gesloten zoals de middleware dat
   doet. `binnen(fn)` draait fn in de context van dat gesloten verzoek. */
function verzoek() {
  const req = { id: 'na-afloop', path: '/na-afloop', method: 'POST', ip: '127.0.0.1' };
  const res = new EventEmitter();
  let binnen, teller;
  em.perVerzoek((t) => {
    teller = t;
    handeling.middleware({ data: () => null, log: () => {} })(req, res, () => {
      aic.inContext({ ip: req.ip, req }, () => {
        haak.binnen(haak.drager('lid', 'na-afloop'), () => { binnen = AsyncResource.bind((fn) => fn()); });
      });
    });
  });
  return { req, res, teller, binnen, sluit: () => res.emit('finish') };
}
const totaal = () => Object.values(handeling.naAfloop()).reduce((a, b) => a + b, 0);

test('zolang het verzoek open is, schrijft alles gewoon', () => {
  const v = verzoek();
  assert.strictEqual(v.binnen(() => handeling.raakt('proef', 2)), true);
  assert.strictEqual(v.binnen(() => em.tel('opslag')), true);
  assert.strictEqual(v.teller.opslag, 1);
  assert.strictEqual(v.binnen(() => aic.noteerUitvoering('lokaal', 'rtg-server')), true);
  assert.strictEqual(v.req.handeling.gemeld.length, 1);
  assert.strictEqual(v.binnen(() => handeling.afgelopen()), false);
});

test('handeling.raakt na afloop: false, niets gemeld, wel geteld', () => {
  const v = verzoek(); v.sluit();
  const voor = totaal();
  assert.strictEqual(v.binnen(() => handeling.raakt('proef', 3)), false);
  assert.strictEqual(v.req.handeling.gemeld.length, 0, 'een gesloten meting krijgt er niets meer bij');
  assert.strictEqual(totaal(), voor + 1);
  assert.ok(handeling.naAfloop()['handeling:proef'] >= 1);
});

test('effectmeter.tel na afloop: de teller beweegt niet, de poging wordt geteld', () => {
  const v = verzoek(); v.sluit();
  const voor = totaal();
  assert.strictEqual(v.binnen(() => em.tel('mail')), false);
  assert.strictEqual(v.teller.mail, 0, 'de effectkop is al weg; ophogen zou een stille teller zijn');
  assert.strictEqual(totaal(), voor + 1);
});

test('ai-context na afloop: geen label meer bewaard, wel geteld', () => {
  const v = verzoek(); v.sluit();
  const voor = totaal();
  assert.strictEqual(v.binnen(() => aic.noteerUitvoering('extern', 'aanbieder')), false);
  assert.deepStrictEqual(v.binnen(() => aic.uitvoeringen()), []);
  assert.strictEqual(totaal(), voor + 1);
});

test('kostenhaak na afloop: boekt op dezelfde drager, en meldt het', () => {
  const geboekt = [];
  haak.zetMeter((m) => { geboekt.push(m); return true; });
  try {
    const v = verzoek(); v.sluit();
    const voor = totaal();
    assert.strictEqual(v.binnen(() => haak.meld('verzoek', 1)), true);
    assert.strictEqual(geboekt.length, 1);
    assert.strictEqual(geboekt[0].drager, 'lid:na-afloop', 'de drager blijft die van het verzoek dat het werk startte');
    assert.strictEqual(totaal(), voor + 1, 'maar niet stil');
    /* Buiten elk verzoek is er niets af te lopen: het huis boekt zonder melding. */
    const n = totaal();
    haak.meld('verzoek', 1);
    assert.strictEqual(totaal(), n);
  } finally { haak.zetMeter(null); }
});
