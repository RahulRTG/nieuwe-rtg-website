#!/usr/bin/env node
'use strict';

/* LOKALE VOORPOORT VOOR EEN ENKELE, SCHONE PUSH.

   Dit is bewust geen lokale vervanging van het mergebewijs. De voorpoort
   vangt goedkope contractdrift en draait de aantoonbaar geraakte toetsen voor
   de commit voordat een cloudronde wordt gestart. Is de impact onbegrensd of
   te breed, dan zegt hij eerlijk CI_FULL_REQUIRED en laat hij de volledige,
   schone CI beslissen. Zo voorkomt hij herstelpushes zonder een laptop tot
   bewijsautoriteit te verheffen. */
const { spawnSync, execFileSync } = require('child_process');
const path = require('path');
const planner = require('./plan');
const evidence = require('./evidence');

const WORTEL = path.join(__dirname, '..');
const LIMIET = Number(process.env.RTG_PR_READY_LIMIT || 80);

function geraakteSelectie(plan) {
  const gekozen = plan.toetsen.filter((t) => t.geraakt > 0 || t.status === 'UNKNOWN');
  return {
    unit: gekozen.filter((t) => t.toets.endsWith('.test.js')).map((t) => path.basename(t.toets)),
    e2e: gekozen.filter((t) => t.toets.endsWith('.e2e.js')).map((t) => path.basename(t.toets)),
    totaal: gekozen.length
  };
}

function trackedWerkboomSchoon() {
  try {
    return execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      cwd: WORTEL, encoding: 'utf8' }).trim() === '';
  } catch (e) { return false; }
}

function draai(naam, script, args) {
  process.stdout.write('\n[pr:ready] ' + naam + '\n');
  const r = spawnSync(process.execPath, [path.join(WORTEL, script), ...(args || [])], {
    cwd: WORTEL, stdio: 'inherit', env: process.env
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(naam + ' zakte met exitcode ' + r.status);
}

function main() {
  const args = process.argv.slice(2);
  const droog = args.includes('--dry-run');
  if (!trackedWerkboomSchoon() && !args.includes('--dirty-ok')) {
    throw new Error('de gevolgmeting leest commits; commit eerst alle gevolgde wijzigingen ' +
      '(of gebruik alleen voor ontwikkeling --dirty-ok)');
  }

  if (!droog) {
    draai('CI-contract', 'scripts/ci-keten.js');
    draai('documentfitness', 'scripts/document-fitness.js');
    draai('codeafspraken en registers', 'scripts/check.js');
  }

  const plan = planner.plan();
  const selectie = geraakteSelectie(plan);
  const teBreed = !plan.impact.volledig || plan.bewijsMachineGewijzigd || selectie.totaal > LIMIET;

  console.log('\n[pr:ready] ' + plan.baan.toUpperCase() + ' · ' + plan.besluit.code);
  console.log('[pr:ready] geraakt: ' + selectie.unit.length + ' unit · ' +
    selectie.e2e.length + ' browser · limiet ' + LIMIET);

  if (teBreed) {
    console.log('[pr:ready] CI_FULL_REQUIRED: ' + (!plan.impact.volledig
      ? 'de impact is niet begrensd'
      : plan.bewijsMachineGewijzigd
        ? 'de bewijsmachine is zelf gewijzigd'
        : 'de geraakte set is groter dan de lokale snelheidsgrens'));
    console.log('[pr:ready] de goedkope poorten zijn groen; alleen de schone CI mag dit mergebewijs afgeven');
    return;
  }
  if (droog) return;

  if (selectie.unit.length) {
    draai('geraakte unittests', 'scripts/test-runner.js', ['--bestanden=' + selectie.unit.join(',')]);
  }
  if (selectie.e2e.length) {
    draai('browser uit de lockfile', 'scripts/browserinstall.js');
    draai('geraakte browsertests', 'scripts/e2e.js', ['--bestanden=' + selectie.e2e.join(',')]);
  }
  console.log('\n[pr:ready] LOKALE VOORPOORT GROEN: het mergebewijs blijft server-authoritair in CI');
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('[pr:ready] ' + e.message); process.exitCode = 1; }
}

module.exports = { geraakteSelectie, trackedWerkboomSchoon, LIMIET };
