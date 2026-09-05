#!/usr/bin/env node
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');
const kandidaat = require('./lib/live-kandidaat');
const waarde = naam => {
  const v = process.argv.find(a => a.startsWith('--' + naam + '='));
  return v ? v.slice(naam.length + 3) : '';
};

try {
  if (process.argv.includes('--runtime-bewijs')) {
    const rapport = kandidaat.schrijfRuntime(ROOT, { commit: waarde('commit'),
      verwachteImageId: waarde('verwachte-image-id'), imageId: waarde('image-id'),
      imageVerwijzing:waarde('image-verwijzing'), imageDigest:waarde('image-digest'),
      inhoudSha256: waarde('inhoud-sha256') });
    console.log('Runtimebewijs geschreven voor ' + rapport.imageId);
    return;
  }
  if (!process.argv.includes('--maak')) throw new Error('Gebruik --maak met commit, registrydigests en beide image-id’s.');
  const rapport = kandidaat.maak(ROOT, { commit: waarde('commit'),
    imageVerwijzing:waarde('image-verwijzing'), imageDigest:waarde('image-digest'),
    imageId: waarde('image-id'), backupVerwijzing:waarde('backup-verwijzing'),
    backupDigest:waarde('backup-digest'), backupId: waarde('backup-id') });
  console.log('Kandidaatbewijs geschreven voor ' + rapport.commit + ' · ' + rapport.image.id);
} catch (e) { console.error('[live-kandidaat] ' + e.message); process.exitCode = 1; }
