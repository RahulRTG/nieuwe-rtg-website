#!/usr/bin/env node
'use strict';
/* Offline stap VOOR het starten van een artifact dat alleen KV kent.
   Geen servicebesturing: de releaseprocedure moet alle schrijvers stoppen. */
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--writers-stopped' || !fs.statSync(args[1]).isFile()) {
  throw new Error('Gebruik: node scripts/audit-sqlite-rollback.js --writers-stopped /pad/store.db (alle schrijvers eerst stoppen).');
}
const kv = new DatabaseSync(args[1]);
try {
  const result = require('../server/db/audit-compat').materialiseer(kv, require('../server/kluis'));
  kv.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  process.stdout.write(JSON.stringify({ status: 'PASS', ...result }) + '\n');
} finally { kv.close(); }
