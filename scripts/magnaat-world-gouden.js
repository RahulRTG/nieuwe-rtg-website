#!/usr/bin/env node
/* DE REFERENTIES VAN MAGNAAT WORLD VOOR RONDE A2 SCHRIJVEN.

   Twee momenten, en ze zijn met opzet twee bestanden:

     --voor-a21   World ZOALS HIJ WAS, voor de enige toegestane
                  geldgedragswijziging (A2.1, hele eurocenten). Daarmee is
                  achteraf precies aan te wijzen wat A2.1 veranderde.
                  -> test/fixtures/magnaat-world-voor-a21.json
     --baseline   de WORLD ECONOMIC GOLDEN BASELINE: World NA A2.1. Vanaf hier
                  mogen A2.2 t/m A2.9 de architectuur veranderen maar de
                  speluitkomst niet (MAGNAAT.md).
                  -> test/fixtures/magnaat-world-baseline.json

   Beide weigeren een bestaand bestand te overschrijven zonder --opnieuw: een
   referentie die je na de verbouwing opnieuw uit de nieuwe code schrijft,
   bewijst niets. De baseline weigert bovendien zolang World nog op de oude
   regelversie rekent.

   Draai:  node scripts/magnaat-world-gouden.js --voor-a21 | --baseline [--opnieuw]
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { SCENARIOS, draai } = require('../test/lib/magnaat-world-scenarios');

const WORTEL = path.join(__dirname, '..');
const DOELEN = {
  '--voor-a21': { bestand: 'test/fixtures/magnaat-world-voor-a21.json', regelversie: null },
  '--baseline': { bestand: 'test/fixtures/magnaat-world-baseline.json', regelversie: '2' }
};

if (require.main === module) {
  const soort = Object.keys(DOELEN).find(k => process.argv.includes(k));
  if (!soort) { console.error('[magnaat-world-gouden] kies --voor-a21 of --baseline'); process.exit(2); }
  const doel = DOELEN[soort];
  const pad = path.join(WORTEL, doel.bestand);
  if (fs.existsSync(pad) && !process.argv.includes('--opnieuw')) {
    console.error('[magnaat-world-gouden] ' + doel.bestand + ' bestaat al; overschrijven alleen met --opnieuw.');
    process.exit(2);
  }
  const { WORLD_REGELVERSIE } = require('../server/kern/spellen/magnaat/centen');
  const versie = WORLD_REGELVERSIE || '1';
  if (doel.regelversie && versie !== doel.regelversie) {
    console.error('[magnaat-world-gouden] de baseline hoort bij World-regelversie ' + doel.regelversie + '; World rekent op ' + versie + '.');
    process.exit(2);
  }
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' }).trim();
  const uit = {
    uitleg: soort === '--voor-a21'
      ? 'Magnaat World VOOR ronde A2.1 (regelversie 1: euro\'s met drijvende komma), per stap, gemaakt met scripts/magnaat-world-gouden.js op ' + commit + '. Het bewijs van wat A2.1 veranderde; wordt nooit opnieuw uit nieuwere code geschreven.'
      : 'WORLD ECONOMIC GOLDEN BASELINE: Magnaat World NA ronde A2.1 (regelversie ' + versie + ', hele eurocenten), per stap, gemaakt op ' + commit + '. A2.2 t/m A2.9 moeten hier exact aan gelijk blijven.',
    regelversie: versie, commit,
    scenarios: Object.fromEntries(Object.keys(SCENARIOS).map(n => {
      const r = draai(n);
      return [n, { stappen: r.stappen, eind: r.eind }];
    }))
  };
  fs.writeFileSync(pad, JSON.stringify(uit, null, 1) + '\n');
  console.log('[magnaat-world-gouden] geschreven: ' + doel.bestand);
}
