#!/usr/bin/env node
'use strict';
// Controleer de oorspronkelijke PG-bytes waarop de volledige suite berust.
// Voer geen nieuwe proef uit: die zou het al vastgepinde bewijs vervangen.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

function controleer(root, commit) {
  if (!/^[a-f0-9]{40}$/.test(String(commit || '')))
    throw Error('PostgreSQL-bewijs vereist de volledige kandidaatcommit.');
  const bytes = fs.readFileSync(path.join(root, '.release/pg-bewijs.json'));
  const bewijs = JSON.parse(bytes);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const suite = JSON.parse(fs.readFileSync(path.join(root, 'SUITE.json')));
  require('./lib/suite-pg').telling(bewijs, commit);
  if (suite.stempel?.commit !== commit || suite.stempel?.boomVuil !== false ||
      suite.postgres?.pad !== '.release/pg-bewijs.json' ||
      suite.postgres?.sha256 !== sha256)
    throw Error('PostgreSQL-bewijs wijkt af van de volledige suite.');
  return { bytes, bewijs, sha256 };
}

if (require.main === module) controleer(process.cwd(), process.env.GITHUB_SHA);
module.exports = { controleer };
