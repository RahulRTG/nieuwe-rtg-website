/* DE BRONNEN ACHTER DE RATELS DIE IN NORM.json KWAMEN (6 oktober 2026).

   Drie modules die de ratelmigratie uit scripts/check.js en uit losse constanten
   heeft gehaald: scripts/lib/normwaarde.js (waar een ratel zijn getal leest),
   scripts/lib/handrotatie.js (keuringsregel 75) en scripts/lib/ondertitelbesluit.js
   (keuringsregel 49). In check.js draaiden ze alleen als subproces en telden hun
   takken nergens mee; als module laadt scripts/norm.js ze in-process, en dan horen
   hun weigerpaden net zo goed beproefd te zijn als hun goede pad. Een meter die
   alleen op de echte boom wordt gedraaid, bewijst nooit dat hij een fout ZIET.

   Elke toets hieronder draait op een wegwerpboom waarin de fout er met opzet in
   staat, naast een toets op de echte boom die moet kloppen met NORM.json. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { normwaarde, NORMBESTAND } = require('../scripts/lib/normwaarde');
const { plekken, isHandrotatie } = require('../scripts/lib/handrotatie');
const ob = require('../scripts/lib/ondertitelbesluit');

const WORTEL = path.join(__dirname, '..');
const boom = (bestanden) => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'ratelbron-'));
  for (const [rel, inhoud] of Object.entries(bestanden)) {
    fs.mkdirSync(path.dirname(path.join(map, rel)), { recursive: true });
    fs.writeFileSync(path.join(map, rel), inhoud);
  }
  return map;
};

test('1. normwaarde leest een getal en weigert met naam en plek in elk ander geval', () => {
  assert.equal(typeof normwaarde('adressenKapot'), 'number', 'de echte NORM.json draagt de ratel');
  assert.ok(fs.existsSync(NORMBESTAND));
  const map = boom({
    'goed.json': JSON.stringify({ meters: { x: 7 } }),
    'tekst.json': JSON.stringify({ meters: { x: '7' } }),
    'oneindig.json': JSON.stringify({ meters: { x: null } }),
    'zonder.json': JSON.stringify({ andere: {} }),
    'kapot.json': '{ niet json'
  });
  const v = (f) => path.join(map, f);
  assert.equal(normwaarde('x', v('goed.json')), 7);
  assert.throws(() => normwaarde('y', v('goed.json')), /normwaarde\(y\): deze ratel staat niet onder `meters`/);
  assert.throws(() => normwaarde('x', v('zonder.json')), /staat niet onder `meters`/);
  assert.throws(() => normwaarde('x', v('tekst.json')), /"7" en dat is geen getal/);
  assert.throws(() => normwaarde('x', v('oneindig.json')), /null en dat is geen getal/);
  assert.throws(() => normwaarde('x', v('kapot.json')), /is niet te lezen/);
  assert.throws(() => normwaarde('x', v('bestaat-niet.json')), /is niet te lezen/);
});

test('2. handrotatie herkent elke schrijfwijze en telt alleen buiten bearercode', () => {
  for (const r of ['x.rotatie + 1', 'x.rotatie+1', '(u.toegang.rotatie||1)+1', '(t.rotatie || 0) + 1'])
    assert.equal(isHandrotatie(r), true, r);
  for (const r of ['x.rotatie + 10', 'rotatie = 1', 'x.rotatieTeller', '// geen rotatie hier'])
    assert.equal(isHandrotatie(r), false, r);
  const map = boom({
    'server/a.js': 'const a = 1;\nst.rotatie = (st.rotatie || 0) + 1;\n',
    'server/kern/bearercode-v2.js': 'b.rotatie = b.rotatie + 1;\n',
    'server/data/x.js': 'c.rotatie + 1\n',
    'server/node_modules/y.js': 'c.rotatie + 1\n',
    'server/z.md': 'c.rotatie + 1\n'
  });
  assert.deepEqual(plekken(map), ['server/a.js:2'], 'bearercode, data, node_modules en niet-js tellen niet');
  assert.equal(plekken(WORTEL).length, normwaarde('rotatieMetDeHand'), 'de echte telling is de ratel');
});

test('3. ondertitelbesluit op de echte boom: geen klacht, en open is de ratel', () => {
  const u = ob.meet(WORTEL);
  assert.deepEqual(u.klachten, []);
  assert.equal(u.open.length, normwaarde('mediaOndertitelOpen'));
  assert.ok(u.metSpraak.length > 0 && u.metBaan.length > 0, 'gesprekken met een spraakanker en een tekstbaan');
  assert.equal(Object.values(u.perUitkomst).reduce((a, b) => a + b, 0), u.gevonden.size);
});

test('4. ondertitelbesluit ziet elke soort fout op een wegwerpboom', () => {
  /* Drie elementen op de plek van een echt register: ondertiteld, gesprek met
     spraakanker, spiegel. Geen van hun ankers bestaat hier, de spiegel is niet
     stil, en er staat een element zonder besluit en een uit JavaScript naast. */
  const reg = [...ob.REGISTER.keys()].find(k => k.endsWith('#3'));
  const rel = reg.split('#')[0];
  const map = boom({
    [rel]: '<video></video>\n<video></video>\n<video></video>\n',
    'public/nieuw.html': '<audio id="los"></audio>\n',
    'public/maak.js': 'const v = document.createElement("video");\n',
    'public/stil.js': 'const a = new Audio(); a.muted = true;\n'
  });
  /* Twee verzonnen besluiten voor de twee vormfouten die het echte register
     niet bevat; ze gaan er na de toets weer uit. */
  ob.REGISTER.set('public/nieuw.html#los', ['bestaatniet', 'een reden die lang genoeg is om iets te zeggen']);
  ob.REGISTER.set('public/stil.js#js1', ['spiegel', 'kort']);
  try {
    const u = ob.meet(map);
    const k = u.klachten.join('\n');
    assert.match(k, /public\/maak\.js#js1 is een media-element zonder besluit/);
    assert.match(k, /soort "bestaatniet", en die soort bestaat niet/);
    assert.match(k, /public\/stil\.js#js1 heeft geen reden die iets zegt/);
    assert.match(k, new RegExp(reg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' staat als spiegel \\(stil\\) maar is niet meer muted'));
    assert.match(k, /het anker .* bestaat niet meer|draagt ".*" niet meer -- de weg naar tekst/);
    assert.match(k, /meeluister\.js is weg/);
    assert.match(k, /staat in het register maar bestaat niet \(meer\)/);
    assert.equal(u.metSpraak.length, 0, 'zonder anker geen spraak');
    assert.ok(u.open.length >= 1, 'een gesprek zonder geldig spraakanker staat open');
    assert.equal(u.perUitkomst.gesprek >= 1, true);
  } finally {
    ob.REGISTER.delete('public/nieuw.html#los');
    ob.REGISTER.delete('public/stil.js#js1');
  }
  assert.deepEqual(ob.meet(WORTEL).klachten, [], 'de verzonnen besluiten zijn weer weg');
});
