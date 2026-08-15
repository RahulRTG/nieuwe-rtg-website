#!/usr/bin/env node
/* Machineleesbaar stuurpaneel voor de 13 zware Rust-migraties. Dit bestand
   controleert intentie, volgorde, noodstop en bewijs; het doet zelf nooit een
   cut-over en kan dus niet stilletjes productiegedrag veranderen. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const REGISTER = path.join(ROOT, 'RUST-MIGRATIES.json');
const VERWACHT = [
  'server/kern/magnaat-capabilities.js', 'server/kern/magnaat-economie.js',
  'server/kern/pay/index.js', 'server/db/ledengids.js', 'server/db/index.js',
  'server/pg/sync.js', 'server/kern/magnaat-controle.js',
  'server/kern/magnaatwereld.js', 'server/kern/rtgone.js', 'server/mail.js',
  'server/routes/rtmail.js', 'public/shared/media.js',
  'server/kern/appgids-data/deel1.js'
];
const FASEN = ['geregistreerd', 'rust-bouw', 'pariteit', 'schaduw', 'canary', 'rust'];

function lees() { return JSON.parse(fs.readFileSync(REGISTER, 'utf8')); }

function controleer(register, root = ROOT) {
  const fouten = [];
  if (!register || register.versie !== 1 || !Array.isArray(register.modules))
    return ['register moet versie 1 en een modules-lijst bevatten'];
  if (JSON.stringify(register.beleid && register.beleid.fasen) !== JSON.stringify(FASEN))
    fouten.push('beleid.fasen wijkt af van de vaste veiligheidstrechter');
  if (register.beleid && register.beleid.globaleNoodstop !== 'RTG_RUST_ALLES_UIT=1')
    fouten.push('de centrale noodstop ontbreekt of is gewijzigd');
  if (register.modules.length !== VERWACHT.length)
    fouten.push('verwacht exact 13 modules, vond ' + register.modules.length);
  const paden = register.modules.map(m => m && m.pad);
  if (new Set(paden).size !== paden.length) fouten.push('modulepaden moeten uniek zijn');
  let vorigeFase = FASEN.length;
  for (let i = 0; i < VERWACHT.length; i++) {
    const m = register.modules[i];
    if (!m) { fouten.push('module ' + (i + 1) + ' ontbreekt'); continue; }
    if (m.volgorde !== i + 1) fouten.push(m.pad + ': volgorde moet ' + (i + 1) + ' zijn');
    if (m.pad !== VERWACHT[i]) fouten.push('positie ' + (i + 1) + ': verwacht ' + VERWACHT[i] + ', vond ' + m.pad);
    if (!fs.existsSync(path.join(root, m.pad))) fouten.push(m.pad + ': bronbestand ontbreekt');
    const faseNummer = FASEN.indexOf(m.fase);
    if (faseNummer < 0) fouten.push(m.pad + ': onbekende fase ' + m.fase);
    else {
      if (faseNummer > vorigeFase) fouten.push(m.pad + ': een latere module staat verder dan zijn voorganger');
      vorigeFase = faseNummer;
    }
    if (typeof m.doel !== 'string' || !m.doel.trim()) fouten.push(m.pad + ': doel ontbreekt');
    if (typeof m.rust !== 'string' || !m.rust.startsWith('motor/src/')) fouten.push(m.pad + ': Rust-doelpad ontbreekt');
    else if (faseNummer > 0 && !fs.existsSync(path.join(root, m.rust)))
      fouten.push(m.pad + ': fase ' + m.fase + ' vereist de bestaande Rust-bron ' + m.rust);
    if (typeof m.noodstop !== 'string' || !m.noodstop.startsWith('RTG_')) fouten.push(m.pad + ': noodstop ontbreekt');
    if (!Array.isArray(m.bewijs) || !m.bewijs.length || m.bewijs.some(x => typeof x !== 'string' || !x.trim()))
      fouten.push(m.pad + ': uitvoerbaar bewijs ontbreekt');
  }
  const actief = register.modules.filter(m => m && ['schaduw', 'canary'].includes(m.fase));
  if (actief.length > 1) fouten.push('maximaal één module mag tegelijk in schaduw/canary staan: ' + actief.map(m => m.pad).join(', '));
  return fouten;
}

function tabel(register) {
  const regels = register.modules.map(m => {
    const nr = String(m.volgorde).padStart(2, '0');
    return nr + '  ' + m.fase.padEnd(13) + '  ' + m.pad + '\n' + ' '.repeat(18) + 'Rust: ' + m.rust + ' | noodstop: ' + m.noodstop;
  });
  return ['Rust-migraties: globale noodstop: ' + register.beleid.globaleNoodstop, ...regels].join('\n');
}

function hoofd() {
  let register;
  try { register = lees(); } catch (e) { console.error('[rust-migraties] register onleesbaar: ' + e.message); process.exit(1); }
  const fouten = controleer(register);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: !fouten.length, fouten, register }, null, 2));
  else if (fouten.length) console.error('[rust-migraties] ONGELDIG\n- ' + fouten.join('\n- '));
  else if (process.argv.includes('--controle')) console.log('[rust-migraties] geldig: exact 13 modules, vaste volgorde, bewijs en noodstops aanwezig.');
  else console.log(tabel(register));
  if (fouten.length) process.exitCode = 1;
}

if (require.main === module) hoofd();
module.exports = { controleer, tabel, lees, VERWACHT, FASEN, ROOT, REGISTER };
