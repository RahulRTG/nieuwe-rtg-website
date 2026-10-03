'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RATELS, controleer } = require('../scripts/registerratels');

// Elke mutation verandert een werkelijk dragende claim, niet alleen een label.
const MUTANTEN = {
  'SLO.json': [r => { r.minimumVerzoeken = 0; }, r => { r.doelen[0].streef--; }, r => { r.reizen.find(x => x.pad === '/api/auth/login').verwacht = [200]; }],
  'SUITE.json': [r => { r.gemeten.groen = true; }, r => { r.gemeten.groen = true; r.gemeten.afsluitcode = 0; }, r => { r.gemeten.geslaagdeTests++; }],
  'HANDELINGPROEF.json': [r => { r.gemeten.ketenOk = false; }, r => { r.perRoute.find(x => x.audit === 'bewezen').status = 403; }, r => { r.perRoute[0] = structuredClone(r.perRoute[1]); }],
  'KERNHERKOMST.json': [r => { r.perNaam[0].herkomsten = []; }, r => { r.perNaam[0].herkomsten.push({ bestand: 'server/andere-herkomst.js', hoe: 'toewijzing' }); }, r => { r.onopgelost.pop(); }, r => { r.onopgelost[0].reden = ''; }],
  'SCHRIJFANALYSE.json': [r => {
    const rij = r.perRoute.find(x => x.route === r.veto[0].route);
    rij.schrijft = 'nee'; r.gemeten.ja--; r.gemeten.nee++;
  }, r => { r.veto[0].bestand = 'server/verkeerde-bron.js'; }, r => { r.perRoute.find(x => x.schrijft === 'onbekend').schrijft = 'veilig'; }],
  'WAAROM.json': [r => {
    Object.values(r.perRoute).find(x => x.soort === 'bereikt').status = 403;
  }, r => { r.soorten.pop(); }, r => { r.zonderRol[0].aantal--; }],
  'VERTROUWEN.json': [r => {
    const rij = Object.values(r.perRoute).find(x => x.staat === 'verzwakt');
    rij.staat = 'bewezen'; r.telling.verzwakt--; r.telling.bewezen++;
  }, r => {
    const rij = Object.values(r.perRoute)[0]; rij.defect = ['AUTH']; r.soorten.defect++;
  }, r => { r.soorten.ontbrekend--; }],
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

test('SUITE: alleen volledige ononderbroken PASS mag groen heten; eerlijke mislukkingen blijven leesbaar', () => {
  const r = { gemeten: { volledig: true, bestanden: 1, afsluitcode: 0, groen: true,
    tapVolledig: true, tests: 1, geslaagdeTests: 1, mislukt: 0, geannuleerd: 0, overgeslagen: 0, todo: 0 } };
  assert.doesNotThrow(() => controleer('SUITE.json', r));
  for (const veld of ['mislukt', 'geannuleerd', 'overgeslagen', 'todo']) {
    const fout = structuredClone(r);
    fout.gemeten.geslaagdeTests = 0; fout.gemeten[veld] = 1;
    assert.throws(() => controleer('SUITE.json', fout), veld + ' kan niet als PASS tellen, ook niet met sluitende totalen');
    fout.gemeten.groen = false; fout.gemeten.afsluitcode = 1;
    assert.doesNotThrow(() => controleer('SUITE.json', fout), 'de ratel maskeert de eerlijke fout niet');
  }
  for (const veld of ['volledig', 'tapVolledig']) {
    const fout = structuredClone(r); fout.gemeten[veld] = false;
    assert.throws(() => controleer('SUITE.json', fout));
  }
});

test('VERTROUWEN: de opgeslagen conclusie kan niet boven haar eigen bewijsgronden uitstijgen', () => {
  const r = { routes: 1, ouderdomDagen: 1, halfwaardetijdDagen: 30, onreproduceerbaar: [],
    telling: { bewezen: 1, verschaald: 0, verzwakt: 0, geschorst: 0, ongemeten: 0 },
    soorten: { defect: 0, ontbrekend: 0, verouderd: 0, verouderdVermoed: 0, vervalOnbekend: 0 },
    perRoute: { 'GET /fixture': { staat: 'bewezen', reden: 'synthetische volledige celset', heropent: 'hermeting bij verval' } } };
  assert.doesNotThrow(() => controleer('VERTROUWEN.json', r));
  for (const verander of [x => { x.ouderdomDagen = 31; }, x => { delete x.ouderdomDagen; },
    x => { x.onreproduceerbaar = ['vuile-fixture.json']; },
    x => { x.perRoute['GET /fixture'].verouderd = ['AUTH']; x.soorten.verouderd = 1; }]) {
    const fout = structuredClone(r); verander(fout);
    assert.throws(() => controleer('VERTROUWEN.json', fout));
  }
});
