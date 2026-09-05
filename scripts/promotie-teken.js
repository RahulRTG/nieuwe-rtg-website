#!/usr/bin/env node
'use strict';

const path = require('path');
const { eisSchoneReleasebron } = require('./lib/productie-vrijgave');

try {
  const root = path.join(__dirname, '..');
  const commit = eisSchoneReleasebron(root);
  const document = require('./lib/productie-promotie').schrijf(root, commit);
  console.log('Productiepromotie ondertekend door ' + document.goedgekeurdDoor +
    ' voor ' + document.commit + ' · ' + document.kandidaat.image.digest);
} catch (e) { console.error('[promotie] ' + e.message); process.exitCode = 1; }
