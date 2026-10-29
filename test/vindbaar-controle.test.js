'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('vindbaar --controle schrijft ook op een schone boom geen register', () => {
  const script = path.resolve(__dirname, '../scripts/vindbaar.js');
  const laad = createRequire(script);
  const mod = { exports: {} };
  let writes = 0, writeChecks = 0;
  const req = (naam) => {
    if (naam === 'fs') return { ...fs, writeFileSync() { writes++; } };
    if (naam === './lib/stempel') return {
      stempel: () => ({ commit: 'test', boomVuil: false }),
      eisSchoneBoom: () => { writeChecks++; return true; }, magSchrijven: () => true
    };
    return laad(naam);
  };
  req.main = mod;
  const ctx = { require: req, module: mod, __dirname: path.dirname(script),
    console: { log() {}, error() {} },
    process: { argv: [process.execPath, script, '--controle'], exit: (code) => {
      assert.equal(code, 1, 'een vloerbreuk mag nog steeds de controle laten falen');
    } } };
  vm.runInNewContext('(function(){' + fs.readFileSync(script, 'utf8').replace(/^#![^\n]*\n/, '') + '\n})()', ctx);
  assert.equal(writes, 0, 'controleren verandert nooit het gemeten register');
  assert.equal(writeChecks, 0, 'controlestand vraagt geen toestemming voor schrijven');
});
