/* Een herhaalbare releasepoort: bouw, Rust, statische beveiligingsregels,
   dependency-audit, echte herstelproef en ten slotte het hashmanifest. Met
   --productie komt de omgevings-/papierwerkpoort erbij. */
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { pak } = require('./afbouw-slot');
const ROOT = path.join(__dirname, '..');
const RAPPORT = path.join(ROOT, '.release', 'release-gate-bewijs.json');
const geefAfbouwSlotVrij = pak(process.argv.includes('--productie') ? 'productiereleasepoort' : 'releasepoort');
const begonnen = new Date().toISOString();
try { fs.rmSync(RAPPORT, { force: true }); } catch (e) {}

const stappen = [
  ['Frontend bouwen', process.execPath, ['scripts/build.js']],
  ['Rust toetsen', 'cargo', ['test', '--release', '--manifest-path', 'motor/Cargo.toml', '--locked']],
  ['Rust bouwen', 'cargo', ['build', '--release', '--manifest-path', 'motor/Cargo.toml', '--locked']],
  ['Sentinel-procesgrens', process.execPath, ['--test', 'test/sentinel.test.js']],
  ['Rust-migratieregister', process.execPath, ['scripts/rust-migraties.js', '--controle']],
  ['Bron- en securityregels', process.execPath, ['scripts/check.js']],
  /* De tijdelijke accountsgrendel is alleen betrouwbaar als iedere lokale
     users/staff-write aantoonbaar door die gevel loopt. */
  ['Accountschrijfgrens', process.execPath, ['scripts/accountschrijvers.js']],
  /* Een toestemming zonder echte lezer is geen beveiliging. Dit stond tot nu
     toe alleen als losse controle naast de releaseketen, waardoor een image
     groen kon worden terwijl het lid rechten bevestigde die nergens werden
     afgedwongen. */
  ['Servicebevoegdheden', process.execPath, ['scripts/servicecaps.js', '--controle']],
  /* Een nieuwe bearer-/deelcode-route mag niet buiten de inventaris om stil
     groen worden. Deze poort scant de actuele serverbron, eist classificatie
     en blijft rood zolang een echte credential nog `remaining` is. */
  ['Codecredentialregister', process.execPath, ['scripts/codecredentials.js', '--bewijs']],
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
if (process.argv.includes('--productie')) stappen.splice(9, 0,
  ['Productieconfiguratie en papierwerk', process.execPath, ['scripts/golive.js']]);

const controles = [];
for (const [naam, commando, args] of stappen) {
  console.log('\n=== ' + naam + ' ===');
  const r = cp.spawnSync(commando, args, { cwd: ROOT, env: process.env, stdio: 'inherit' });
  if (r.error) { console.error('[release-gate] ' + naam + ': ' + r.error.message); process.exit(r.error.code || 1); }
  if (r.status !== 0) { console.error('[release-gate] gestopt bij: ' + naam); process.exit(r.status || 1); }
  controles.push({ naam, geslaagd: true });
}
fs.mkdirSync(path.dirname(RAPPORT), { recursive: true, mode: 0o700 });
const bewijs = { formaat: 'rtg-release-gate-v1', begonnen, afgerond: new Date().toISOString(),
  geslaagd: true, productie: process.argv.includes('--productie'),
  bron: require('./lib/stempel').exactStempel(), controles };
const tijdelijk = RAPPORT + '.tmp-' + process.pid;
fs.writeFileSync(tijdelijk, JSON.stringify(bewijs, null, 2) + '\n', { mode: 0o600 });
fs.renameSync(tijdelijk, RAPPORT);
geefAfbouwSlotVrij();
console.log('\nRELEASEPOORT GROEN: bouw, Rust, security, audit, herstel en inhoudsbewijs zijn geslaagd.');
