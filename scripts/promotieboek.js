#!/usr/bin/env node
/* Zie scripts/lib/promotieboek.js.
     node scripts/promotieboek.js --archiveer --image-id=sha256:.. --backup-id=sha256:.. --pin=<hex>
     node scripts/promotieboek.js --rollback --image-id=sha256:.. --backup-id=sha256:.. --pin=<hex>
   Exitcode 0 is ja; alles anders is nee, met de reden op stderr. */
'use strict';

const path = require('path');
const boek = require('./lib/promotieboek');
const ROOT = path.join(__dirname, '..');
const VLAGGEN = new Set(['archiveer', 'rollback', 'image-id', 'backup-id', 'pin']);
const arg = n => { const v = process.argv.find(a => a.startsWith('--' + n + '=')); return v ? v.slice(n.length + 3) : null; };

try {
  const onbekend = process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')[0]).filter(n => !VLAGGEN.has(n));
  if (onbekend.length) throw new Error('Onbekende vlag: --' + onbekend.join(', --'));
  const doel = { imageId: arg('image-id'), backupId: arg('backup-id'), pin: arg('pin') };
  if (process.argv.includes('--archiveer')) {
    boek.archiveer(ROOT, doel);
    console.log('[promotieboek] ' + doel.imageId + ' gearchiveerd als bewezen rollbackdoel');
  } else if (process.argv.includes('--rollback')) {
    const klachten = boek.controleerRollback(ROOT, doel);
    if (klachten.length) throw new Error('rollback geweigerd: ' + klachten.join(' '));
    console.log('[promotieboek] rollbackdoel ' + doel.imageId + ' is eerder gekwalificeerd en gepromoveerd');
  } else throw new Error('Gebruik --archiveer of --rollback.');
} catch (e) {
  console.error('[promotieboek] ' + e.message);
  process.exitCode = 1;
}
