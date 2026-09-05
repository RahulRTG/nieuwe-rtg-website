#!/usr/bin/env node
'use strict';

const { eisSchoneReleasebron, leesProductiestatus } = require('./lib/productie-vrijgave');
const path = require('path');

try {
  const commit = eisSchoneReleasebron();
  leesProductiestatus(commit);
  const promotie = require('./lib/productie-promotie').controleer(path.join(__dirname, '..'), commit);
  const kandidaat = require('./lib/live-kandidaat').controleer(path.join(__dirname, '..'), commit);
  if (promotie.kandidaat.image.immutable !== kandidaat.image.immutable ||
      promotie.kandidaat.backup.immutable !== kandidaat.backup.immutable)
    throw new Error('De ondertekende promotie hoort bij een andere kandidaat.');
  process.stdout.write([commit, kandidaat.image.immutable, kandidaat.image.id,
    kandidaat.backup.immutable, kandidaat.backup.id,
    kandidaat.image.bewijsBestandSha256].join('\n') + '\n');
} catch (e) {
  console.error('[live-vrijgave] ' + e.message);
  process.exitCode = 1;
}
