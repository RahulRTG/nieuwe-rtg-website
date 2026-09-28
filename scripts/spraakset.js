#!/usr/bin/env node
/* MAAKT DE OPNAMEN VOOR EEN SPRAAKPROEFSET -- met een SYNTHETISCHE stem.
   TOESTEL.md par. 13.

     node scripts/spraakset.js [proefset.json] [uitmap]
     (standaard test/fixtures/proefset-spraak-nl.json en een tijdelijke map)

   Schrijft per zin een WAV met espeak-ng en een set.json met {wav, tekst}, dat
   scripts/spraakproef.js leest via RTG_SPRAAK_SET. De opnamen gaan niet in de
   repo: ze zijn af te leiden uit de tekst, en een robotstem die als meetgegeven
   in git staat wordt na een jaar aangezien voor een opname van een mens.
   Zonder espeak-ng zegt het script NIET GEMETEN (exitcode 2). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const set = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'test', 'fixtures', 'proefset-spraak-nl.json'), 'utf8'));
const uit = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spraakset-'));
const stem = spawnSync('espeak-ng', ['--version'], { encoding: 'utf8' });
if (stem.status !== 0) { console.log('NIET GEMETEN: espeak-ng ontbreekt op deze machine.'); process.exit(2); }
fs.mkdirSync(uit, { recursive: true });
const items = set.zinnen.map((tekst, i) => {
  const wav = path.join(uit, String(i + 1).padStart(2, '0') + '.wav');
  const r = spawnSync('espeak-ng', ['-v', set.taal, '-w', wav, tekst], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('espeak-ng faalde op zin ' + (i + 1) + ': ' + r.stderr);
  return { wav, tekst };
});
const doel = path.join(uit, 'set.json');
fs.writeFileSync(doel, JSON.stringify({ taal: set.taal, stem: 'espeak-ng ' + stem.stdout.trim().split('\n')[0],
  synthetisch: true, items }, null, 2));
console.log(doel);
