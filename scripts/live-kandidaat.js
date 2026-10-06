#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const kandidaat = require('./lib/live-kandidaat');
const waarde = naam => {
  const v = process.argv.find(a => a.startsWith('--' + naam + '='));
  return v ? v.slice(naam.length + 3) : '';
};

try {
  if (process.argv.includes('--controle-bootstrap')) {
    const commit = waarde('commit');
    const rapport = kandidaat.controleerBootstrap(ROOT, commit);
    process.stdout.write([rapport.image.immutable, rapport.image.id,
      rapport.backup.immutable, rapport.backup.id, rapport.bewijsSha256].join('\n') + '\n');
    return;
  }
  if (process.argv.includes('--owner-readback-bewijs')) {
    const attestatiePad = path.resolve(waarde('attestatie-bestand'));
    const gelezen = JSON.parse(fs.readFileSync(attestatiePad, 'utf8'));
    const rapport = kandidaat.maakOwnerReadback(ROOT, { commit:waarde('commit'),
      nonce:waarde('nonce'), readback:gelezen,
      bootstrap:process.argv.includes('--bootstrap'),
      imageVerwijzing:waarde('image-verwijzing'), imageDigest:waarde('image-digest'),
      imageId:waarde('image-id') });
    console.log('Eigenaars-readbackbewijs geschreven voor ' + rapport.commit + ' · ' + rapport.imageId);
    return;
  }
  if (process.argv.includes('--owner-kandidaatbinding')) {
    const binding = kandidaat.ownerKandidaatBinding(ROOT, { commit:waarde('commit'),
      imageVerwijzing:waarde('image-verwijzing'), imageDigest:waarde('image-digest'),
      imageId:waarde('image-id') });
    process.stdout.write(binding.kandidaatBewijsSha256 + '\n');
    return;
  }
  if (process.argv.includes('--runtime-bewijs')) {
    const rapport = kandidaat.schrijfRuntime(ROOT, { commit: waarde('commit'),
      verwachteImageId: waarde('verwachte-image-id'), imageId: waarde('image-id'),
      imageVerwijzing:waarde('image-verwijzing'), imageDigest:waarde('image-digest'),
      inhoudSha256: waarde('inhoud-sha256') });
    console.log('Runtimebewijs geschreven voor ' + rapport.imageId);
    return;
  }
  if (process.argv.includes('--maak-bootstrap')) {
    const rapport = kandidaat.maakBootstrap(ROOT, { commit: waarde('commit'),
      imageVerwijzing:waarde('image-verwijzing'), imageDigest:waarde('image-digest'),
      imageId: waarde('image-id'), backupVerwijzing:waarde('backup-verwijzing'),
      backupDigest:waarde('backup-digest'), backupId: waarde('backup-id') });
    console.log('Bootstrapkandidaatbewijs geschreven voor ' + rapport.commit + ' · ' + rapport.image.id);
    return;
  }
  if (!process.argv.includes('--maak')) throw new Error('Gebruik --maak met commit, registrydigests en beide image-id’s.');
  const rapport = kandidaat.maak(ROOT, { commit: waarde('commit'),
    imageVerwijzing:waarde('image-verwijzing'), imageDigest:waarde('image-digest'),
    imageId: waarde('image-id'), backupVerwijzing:waarde('backup-verwijzing'),
    backupDigest:waarde('backup-digest'), backupId: waarde('backup-id') });
  console.log('Kandidaatbewijs geschreven voor ' + rapport.commit + ' · ' + rapport.image.id);
} catch (e) { console.error('[live-kandidaat] ' + e.message); process.exitCode = 1; }
