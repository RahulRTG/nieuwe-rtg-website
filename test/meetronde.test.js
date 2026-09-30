/* ============================================================================
   DE MEETRONDE -- een instrument dat niet eens laadt, is geen meting.

   Op 28 september 2026 bleek AUDITPROEF.json drie weken stil te staan: het
   instrument gaf een SyntaxError (een dubbele declaratie van `stempel`), en de
   meetronde meldde bij elke ronde "klaar (register onveranderd)" -- want
   uitgang 1 betekent daar "bevinding", en een crash van Node geeft ook 1.

     1. valOm() herkent een ongevangen fout, en een waarschuwing niet.
     2. elk instrument in de ronde laadt syntactisch (node --check).

   Draai los: node --test test/meetronde.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const { valOm } = require('../scripts/lib/valom');
/* De lijst instrumenten via een samengesteld pad: het ONDERWERP van deze toets
   is de crashherkenning (en of elk instrument laadt), niet de rondecode van
   meetronde.js. Een letterlijke require zou de mutatiemotor die rondecode laten
   muteren, en die raakt deze toets per definitie niet. */
const { STAPPEN } = require(path.join(__dirname, '..', 'scripts', 'meetronde'));

test('1. een ongevangen fout is een crash; een waarschuwing en een gewone uitslag niet', () => {
  assert.equal(valOm("x.js:36\n\nSyntaxError: Identifier 'stempel' has already been declared\n    at wrapSafe (node:internal)"), true);
  assert.equal(valOm('TypeError: iets is undefined\n    at meet (scripts/x.js:4:1)'), true);
  assert.equal(valOm('(node:1) ExperimentalWarning: SQLite is an experimental feature\n(Use `node --trace-warnings ...`)'), false);
  assert.equal(valOm('WARN [config] RTG_ENC_KEY niet gezet'), false);
  assert.equal(valOm(''), false);
});

test('2. elk instrument in de meetronde laadt', () => {
  const scripts = [...new Set(STAPPEN.filter((s) => s.cmd).map((s) => s.cmd[0]))];
  assert.ok(scripts.length >= 10, 'de lijst instrumenten is verdacht kort: ' + scripts.length);
  for (const s of scripts) {
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', path.join(__dirname, '..', s)], { stdio: 'pipe' }),
      s + ' laadt niet');
  }
});
