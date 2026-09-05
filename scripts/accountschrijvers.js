#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { controleer } = require('./lib/accountschrijvers');
const stand = controleer(path.join(__dirname, '..'));

console.log(JSON.stringify(stand));
if (!stand.ok) {
  for (const fout of stand.onbewaakt)
    console.error(`[accountschrijvers] ${fout.bestand}:${fout.regel || '?'} ${fout.sql}`);
  process.exitCode = 1;
}
