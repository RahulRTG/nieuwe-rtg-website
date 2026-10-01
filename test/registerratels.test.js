'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RATELS, controleer } = require('../scripts/registerratels');

// Elke mutation verandert een werkelijk dragende claim, niet alleen een label.
const MUTANTEN = {
  'AUDITPROEF.json': [r => { r.gemeten.ketenHeel = false; }, r => { r.gemeten.blindeRondes++; }, r => { r.gemeten.gezakt++; }],
  'MUTATIEBOEK.json': [r => { r.bakken[0].aantal++; }, r => { r.statussen[0].aantal++; }, r => { r.gemeten.mutatiesVerklaard++; }],
  'ONBEWEZEN.json': [r => { r.gemeten.metBewijs++; }, r => { r.bakken[0].aantal++; }],
  'ONDERZOEKSKETEN.json': [r => { r.gemeten.ontbrekendeBestanden.push('server/ontbreekt.js'); }, r => { r.schakels[0].naar = 'verdwenen-station'; }, r => { r.stations.pop(); }],
  'RAILVERGELIJK.json': [r => { r.telling.gelijk++; }, r => { r.telling.overtreding++; }, r => { r.rijen[0].soort = 'GELIJK'; }],
  'ROUTEBRON.json': [r => { r.gemeten.waarvanTegenspraak++; }, r => { r.perRoute.pop(); }, r => { r.gemeten.routerRoutesZonderBestand++; }],
  'SYMBOLEN.json': [r => { r.gemeten.waarvanParsefout++; }, r => { r.perBestand.pop(); }, r => { r.gemeten.waarvanBundeldeel--; }],
  'VERRAAD.json': [r => { r.gemeten.blindeInjecties++; }, r => { r.rondes[0].herhaalbaar = false; }, r => { r.rondes[0].waargenomen = false; }],
  'WERELDSTIJL.json': [r => { r.werelden[0].lijst[0].dragers.wereldschil = false; }, r => { r.werelden[0].lijst.pop(); }, r => { r.werelden[0].telling.schil++; }]
};
assert.deepEqual(Object.keys(MUTANTEN).sort(), Object.keys(RATELS).sort(), 'elke registerratel moet een tegenproef dragen');

for (const naam of Object.keys(RATELS)) {
  test(naam + ': opgeslagen boekhouding en alle negatieve controles', () => {
    const origineel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', naam), 'utf8'));
    assert.doesNotThrow(() => controleer(naam, origineel), 'de echte opgeslagen ronde');
    assert.throws(() => controleer(naam, null), 'ontbrekend bewijs is geen nul');
    assert.throws(() => controleer(naam, {}), 'ontbrekende tellers zijn geen nul');
    for (const mutatie of MUTANTEN[naam]) {
      const fout = structuredClone(origineel);
      mutatie(fout);
      assert.throws(() => controleer(naam, fout), 'een verslechterde claim moet de ratel laten zakken');
    }
    assert.doesNotThrow(() => controleer(naam, origineel), 'de tegenproef mag het register niet wijzigen');
  });
}
test('een onbekend register krijgt geen impliciete toestemming', () => {
  assert.throws(() => controleer('GEFINGEERD.json', { status: 'PASS' }), /onbekende registerratel/);
});
