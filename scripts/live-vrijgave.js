#!/usr/bin/env node
'use strict';

const { eisSchoneReleasebron, leesProductiestatus } = require('./lib/productie-vrijgave');
const path = require('path');

try {
  const commit = eisSchoneReleasebron();
  leesProductiestatus(commit);
  // live.sh vraagt dit zowel vóór Docker als vlak vóór de echte wissel.
  // De read-only G4-lezer herbeoordeelt ook de ondertekende promotie; hij
  // maakt geen status of toestemming en activeert zelf niets.
  const next = require('./lib/experience/qualification-gates').assess(path.join(__dirname, '..'), {gate:'G4'});
  if (next.status !== 'PROVEN' || next.candidateCommit !== commit)
    throw new Error('RTG NEXT G4 blokkeert activatie: ' + next.blockers.join('; '));
  const promotie = require('./lib/productie-promotie').controleer(path.join(__dirname, '..'), commit);
  const kandidaat = require('./lib/live-kandidaat').controleer(path.join(__dirname, '..'), commit);
  if (promotie.kandidaat.image.immutable !== kandidaat.image.immutable ||
      promotie.kandidaat.backup.immutable !== kandidaat.backup.immutable)
    throw new Error('De ondertekende promotie hoort bij een andere kandidaat.');
  // Het kandidaat moet het digest zijn dat de artefactketen getest EN goedgekeurd heeft.
  if (!kandidaat.image.digest || !kandidaat.backup.digest) throw new Error('Kandidaat zonder digest.');
  require('./lib/productie-promotie').eisKetenbesluit(path.join(__dirname, '..'), commit, kandidaat, process.env);
  process.stdout.write([commit, kandidaat.image.immutable, kandidaat.image.id,
    kandidaat.backup.immutable, kandidaat.backup.id,
    kandidaat.image.bewijsBestandSha256].join('\n') + '\n');
} catch (e) {
  console.error('[live-vrijgave] ' + e.message);
  process.exitCode = 1;
}
