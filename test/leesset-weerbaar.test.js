/* DE LEESSET ONDER ISOLATIE -- zonder meting geen lezer, en een mislukte oproep bewijst niets.

   server/kern/isolatie/leesset.js beslist welk pad onder de stand `isolatie`
   nog mag: alleen een uitgang, een uitzondering met naam, of een pad waarvan
   IDEMPROEF.json (gelezen door proefmeting.js) heeft GEMETEN dat een kale
   oproep werk deed zonder iets te veranderen. Deze toets vervangt de meting
   tijdelijk (fs.readFileSync op precies dat ene bestand) om de randen te raken.

   Wat hier niet mag sneuvelen:
   1. Is de meting niet te lezen, dan is er geen enkele bewezen lezer: alles
      buiten uitgang en uitzondering gaat dicht, met de reden GEEN_METING.
   2. Alleen een kale oproep die SLAAGDE en NIETS bewoog maakt een lezer; een
      404 of een oproep die iets wijzigde niet. Collecties tellen alleen uit
      oproepen die slaagden.
   3. Een gemeten lezer met een effect buiten de opslag (een uitgaande aanroep)
      blijft dicht; een gewone gemeten lezer mag.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - proefmeting.js: `if (!(eerste >= 200 && eerste < 300)) continue;` weg -> toets 2 zakt.
   - proefmeting.js: `if (!bron || !OK(status)) continue;` -> `if (!bron) continue;` -> toets 2 zakt.
   - leesset.js: `if (stout.length) {` -> `if (false) {` -> toets 3 zakt.

   Draai los: node --test test/leesset-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const leesset = require('../server/kern/isolatie/leesset');
const proefmeting = require('../server/kern/isolatie/proefmeting');

const echt = fs.readFileSync;
function metMeting(inhoud, doe) {
  fs.readFileSync = function (p, ...rest) {
    if (String(p) === proefmeting.BRON) {
      if (inhoud instanceof Error) throw inhoud;
      return JSON.stringify(inhoud);
    }
    return echt.call(this, p, ...rest);
  };
  leesset.vergeet();
  try { return doe(); } finally { fs.readFileSync = echt; leesset.vergeet(); }
}

test('1. zonder leesbare meting is er geen enkele lezer', () => {
  for (const inhoud of [new Error('ENOENT'), { geenPerRoute: true }]) {
    metMeting(inhoud, () => {
      const r = leesset.magOnderIsolatie('/api/proef/lees');
      assert.equal(r.mag, false);
      assert.equal(r.grond, 'GEEN_METING');
      assert.match(r.waarom, /alleen over wat met naam is uitgezonderd/);
      assert.match(leesset.stand().ontbreekt, /IDEMPROEF\.json is niet gelezen/);
      assert.equal(proefmeting.collectiesVan('/api/proef/lees'), null);
    });
  }
});

test('2. alleen een geslaagde kale oproep die niets bewoog maakt een lezer', () => {
  metMeting({ perRoute: {
    a: { pad: '/api/proef/lees', statussen: [200], opslag: { a: { notities: 1 } },
      zonderSleutel: { statussen: [200], effect: { notities: 'geen', nietGemeten: 'bestand' } } },
    b: { pad: '/api/proef/mislukt', statussen: [404, 404, 404], opslag: { a: { sessions: 28 }, b: { pay: 1 } },
      zonderSleutel: { statussen: [404], effect: {}, opslag: { d: { mail: 1 } } } },
    c: { pad: '/api/proef/schrijft', zonderSleutel: { statussen: [201, 200], effect: { pay: 'gewijzigd' }, opslag: { e: { pay: 1 } } } },
    d: { pad: '/api/proef/zonder' }
  } }, () => {
    assert.equal(leesset.magOnderIsolatie('/api/proef/lees').grond, 'GEMETEN_LEZER');
    for (const pad of ['/api/proef/mislukt', '/api/proef/schrijft', '/api/proef/zonder', '/api/nooit/gemeten']) {
      const r = leesset.magOnderIsolatie(pad);
      assert.deepEqual([r.mag, r.grond], [false, 'NIET_BEWEZEN_LEZER'], pad);
    }
    assert.deepEqual([...proefmeting.collectiesVan('/api/proef/lees')], ['notities']);
    assert.equal(proefmeting.collectiesVan('/api/proef/mislukt'), null, 'een 404 raakte niets aan');
    assert.deepEqual([...proefmeting.collectiesVan('/api/proef/schrijft')], ['pay']);
    const st = leesset.stand();
    assert.deepEqual([st.routesInDeProef, st.metSuccesGemeten, st.ontbreekt], [4, 2, null]);
  });
});

test('3. een gemeten lezer met een uitgaande aanroep blijft dicht', () => {
  const lezer = { statussen: [200], zonderSleutel: { statussen: [200], effect: {} } };
  metMeting({ perRoute: { a: Object.assign({ pad: '/api/proef/ai/vraag' }, lezer), b: Object.assign({ pad: '/api/proef/lijst' }, lezer) } }, () => {
    const ai = leesset.magOnderIsolatie('/api/proef/ai/vraag');
    assert.deepEqual([ai.mag, ai.grond], [false, 'EFFECT_GESLOTEN']);
    assert.match(ai.waarom, /UITGAANDE_AANROEP/);
    assert.equal(leesset.magOnderIsolatie('/api/proef/lijst').mag, true);
  });
});
