#!/usr/bin/env node
'use strict';

const path = require('path');

const waarde = naam => {
  const gelijk = process.argv.find(a => a.startsWith('--' + naam + '='));
  return gelijk ? gelijk.slice(naam.length + 3) : null;
};

try {
  const root = path.resolve(waarde('root') || path.join(__dirname, '..'));
  const commit = require('./lib/productie-vrijgave').eisSchoneReleasebron(root);
  require('./lib/live-kandidaat').controleerBron(root, commit);
  process.stdout.write(commit + '\n');
} catch (e) { console.error('[live-kandidaat] ' + e.message); process.exitCode = 1; }
