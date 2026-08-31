/* Een herhaalbare releasepoort: bouw, Rust, statische beveiligingsregels,
   dependency-audit, echte herstelproef en ten slotte het hashmanifest. Met
   --productie komt de omgevings-/papierwerkpoort erbij. */
'use strict';

const cp = require('child_process');
const path = require('path');
const { pak } = require('./afbouw-slot');
const ROOT = path.join(__dirname, '..');
const geefAfbouwSlotVrij = pak(process.argv.includes('--productie') ? 'productiereleasepoort' : 'releasepoort');

const stappen = [
  ['Frontend bouwen', process.execPath, ['scripts/build.js']],
  ['Rust toetsen', 'cargo', ['test', '--release', '--manifest-path', 'motor/Cargo.toml', '--locked']],
  ['Rust bouwen', 'cargo', ['build', '--release', '--manifest-path', 'motor/Cargo.toml', '--locked']],
  ['Sentinel-procesgrens', process.execPath, ['--test', 'test/sentinel.test.js']],
  ['Rust-migratieregister', process.execPath, ['scripts/rust-migraties.js', '--controle']],
  ['Bron- en securityregels', process.execPath, ['scripts/check.js']],
  /* DE MUTATIEPOORT. Besluit van de eigenaar, 30 augustus 2026: geen release
     zolang er een schrijfroute is waarvan dit huis niet weet wat een tweede
     aanroep doet. Hij staat NA check.js, want die controleert of het register
     nog klopt met de code -- een poort op een verouderd register is geen poort. */
  ['Mutatiecontracten', process.execPath, ['scripts/mutatiepoort.js']],
  ['Dependency-audit', 'npm', ['audit', '--audit-level=high']],
  ['Backup en herstel', process.execPath, ['--test', 'test/herstelproef.test.js', 'test/backupvolledig.test.js']],
  ['Releasebewijs maken', process.execPath, ['scripts/release-bewijs.js']],
  ['Releasebewijs terugverifiëren', process.execPath, ['scripts/release-bewijs.js', '--controle']]
];
if (process.argv.includes('--productie')) stappen.splice(6, 0,
  ['Productieconfiguratie en papierwerk', process.execPath, ['scripts/golive.js']]);

for (const [naam, commando, args] of stappen) {
  console.log('\n=== ' + naam + ' ===');
  const r = cp.spawnSync(commando, args, { cwd: ROOT, env: process.env, stdio: 'inherit' });
  if (r.error) { console.error('[release-gate] ' + naam + ': ' + r.error.message); process.exit(r.error.code || 1); }
  if (r.status !== 0) { console.error('[release-gate] gestopt bij: ' + naam); process.exit(r.status || 1); }
}
geefAfbouwSlotVrij();
console.log('\nRELEASEPOORT GROEN: bouw, Rust, security, audit, herstel en inhoudsbewijs zijn geslaagd.');
