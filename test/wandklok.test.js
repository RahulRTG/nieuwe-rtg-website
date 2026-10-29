/* DE RATEL OP DE WANDKLOK (scripts/lib/wandklok.js, keuringsregel 77).

   Een regel die niets kan vinden is erger dan geen regel (LAT.md regel 9).
   Hier wordt een nep-server neergezet met een getHours(), een uitzondering met
   en zonder reden, en een UTC-"vandaag", en de telling moet ze precies zo zien.
   De echte server staat daarna op nul.

   Draai los: node --test test/wandklok.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { wandklok, utcVandaag, UTC_VANDAAG_MAX } = require('../scripts/lib/wandklok');

function nepHuis(bestanden) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wandklok-'));
  for (const [rel, inhoud] of Object.entries(bestanden)) {
    const vol = path.join(root, rel);
    fs.mkdirSync(path.dirname(vol), { recursive: true });
    fs.writeFileSync(vol, inhoud);
  }
  return root;
}

test('een lokale getter in server/ wordt gevonden; kern/tijdzone.js en de UTC-vorm niet', () => {
  const root = nepHuis({
    'server/kern/groet.js': "const u = new Date().getHours();\nconst d = x.getUTCDay();\n",
    'server/kern/tijdzone.js': "const u = new Date().getHours();\n",
    'server/kern/duur.js': "d.setMonth(d.getMonth() + 1);\n"
  });
  assert.deepEqual(wandklok(root), ['server/kern/duur.js:1', 'server/kern/groet.js:1']);
});

test('een uitzondering telt alleen met een reden, op de regel zelf of erboven', () => {
  const root = nepHuis({
    'server/a.js': "// tijd-uitzondering: logregel in serverzone, nooit voor een lid\nconst u = d.getHours();\n",
    'server/b.js': "const u = d.getHours(); // tijd-uitzondering:\n",
    'server/c.js': "// alleen commentaar over getHours() hoort er niet bij\n * en d.getDay() in een blok ook niet\n"
  });
  assert.deepEqual(wandklok(root), ['server/b.js:1']);
});

test('"vandaag" als UTC-datum wordt geteld', () => {
  const root = nepHuis({
    'server/a.js': "const v = new Date().toISOString().slice(0, 10);\nconst w = klok.datum().toISOString().slice(0,10);\nconst x = r.at.slice(0, 10);\n"
  });
  assert.equal(utcVandaag(root), 2);
});

test('de echte server leest nergens de wandklok, en de UTC-vandaag-ratel klopt', () => {
  const root = path.join(__dirname, '..');
  assert.deepEqual(wandklok(root), []);
  assert.equal(utcVandaag(root), UTC_VANDAAG_MAX);
});
