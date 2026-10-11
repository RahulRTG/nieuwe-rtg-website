/* RTG Office: EEN uitgangspoort voor classificatie (OFFICE.md par. 4 grens 4,
   par. 9 fase 1: "met een toets die elke nieuwe uitgang dwingt zich te
   melden").

   Twee helften. De poort zelf: welke uitgang is dicht voor strikt, welke laat
   door met de markering, en een onbekende uitgang GOOIT in plaats van "mag" te
   zeggen. En de dwang: buiten kern/office/uitgangspoort.js (de poort) en
   kern/office/samen.js (de plek waar de eigenaar de classificatie ZET) leest
   niets in server/ de classificatie van een Office-document. Wie een zesde
   uitgang bouwt en zelf `classificatie === 'strikt'` schrijft, laat deze toets
   zakken -- en moet zijn uitgang in UITGANGEN zetten.

   Draai los: node --test test/office-uitgangspoort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { poort, UITGANGEN, classificatieVan } = require('../server/kern/office/uitgangspoort');

const doc = c => ({ beheer: c ? { classificatie: c } : undefined });

test('strikt sluit delen, gezin, meelezen en het model; export en spiegel dragen de markering', () => {
  for (const u of ['delen', 'gezin', 'meelezen', 'model']) {
    const r = poort(doc('strikt'), u);
    assert.equal(r.mag, false, u + ' is dicht voor strikt');
    assert.equal(r.code, 'CLASSIFICATIE_STRIKT');
    assert.ok(r.reden, u + ' zegt waarom');
    assert.equal(poort(doc('vertrouwelijk'), u).mag, true, u + ' blijft open voor vertrouwelijk (tegenproef)');
  }
  for (const u of ['export', 'spiegel']) {
    const r = poort(doc('strikt'), u);
    assert.equal(r.mag, true, u + ' laat strikt door: dat het daar dicht moet, is nooit besloten');
    assert.equal(r.label, 'Strikt', u + ' geeft het label mee om in het bestand te zetten');
  }
});

test('een onbekende uitgang gooit; een document zonder of met onzin-classificatie is intern', () => {
  assert.throws(() => poort(doc('strikt'), 'zoekindex'), /onbekende uitgang/);
  assert.equal(classificatieVan(doc()), 'intern');
  assert.equal(classificatieVan(doc('geheim')), 'intern');
  assert.equal(poort(doc(), 'export').label, 'Intern');
  assert.ok(Object.keys(UITGANGEN).every(u => ['dicht', 'markering'].includes(UITGANGEN[u].strikt)));
});

test('buiten de poort en de beheerplek leest niets in server/ de classificatie van een Office-document', () => {
  const ROOT = path.join(__dirname, '..', 'server');
  const MAG = new Set(['kern/office/uitgangspoort.js', 'kern/office/samen.js']);
  // de drie vormen waarin een uitgang de classificatie zelf leest
  const VORM = [/beheer\s*\.\s*classificatie/, /beheer\s*&&[^;\n]*\.classificatie/, /classificatie\s*[!=]==?\s*'strikt'/];
  const fout = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const vol = path.join(map, naam.name);
      if (naam.isDirectory()) { if (naam.name !== 'data' && naam.name !== 'node_modules') loop(vol); continue; }
      if (!naam.name.endsWith('.js')) continue;
      const rel = path.relative(ROOT, vol).split(path.sep).join('/');
      if (MAG.has(rel)) continue;
      const bron = fs.readFileSync(vol, 'utf8');
      bron.split('\n').forEach((regel, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(regel)) return;   // commentaar is een belofte, geen lezing
        if (VORM.some(re => re.test(regel))) fout.push(rel + ':' + (i + 1) + '  ' + regel.trim());
      });
    }
  })(ROOT);
  assert.deepEqual(fout, [], 'deze plekken lezen de classificatie zelf in plaats van via ' +
    'kern/office/uitgangspoort.js -- zet de uitgang in UITGANGEN en vraag poort(d, uitgang):\n' + fout.join('\n'));
});
