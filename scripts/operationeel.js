#!/usr/bin/env node
'use strict';
/* Vers bewijs verzamelen, daarna een AND-poort. Geen percentages of groene
   vervanging voor ontbrekende invoer. De bestaande functiecatalogus is leidend. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { FUNCTIES } = require('../server/functies/register');
const { KETENS, CONTRACTEN, PROEVEN } = require('./lib/operationeel/register');
const { beoordeel } = require('./lib/operationeel/beoordeel');
const root = path.resolve(__dirname, '..');
function vingerafdruk() {
  // Inclusief nieuwe bronbestanden; uitgesloten gegenereerde rapporten zijn
  // geen bewijsbron. Geen nieuwe parser voor routes of functies.
  const bestanden = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root }).toString().split('\0');
  const hash = createHash('sha256');
  for (const naam of [...new Set(bestanden)].sort()) {
    if (!/^(server\/|public\/|scripts\/|test\/|package(?:-lock)?\.json$)/.test(naam)) continue;
    const pad = path.join(root, naam); hash.update(naam + '\0');
    hash.update(fs.existsSync(pad) ? fs.readFileSync(pad) : '<deleted>');
  }
  return hash.digest('hex');
}
function main() {
  const poort = require('./afbouw-slot').eisGeenAfbouw('operationeel');
  if (!poort.ok || process.env.RTG_METEN_TIJDENS_AFBOUW === '1') throw Error(poort.reden);
  const run = randomUUID(), bron = vingerafdruk();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-operationeel-bewijs-'));
  const journaal = path.join(tmp, 'journaal.jsonl'); fs.writeFileSync(journaal, '');
  const uitgevoerd = {}, logboek = {};
  for (const bestand of [...new Set(Object.values(PROEVEN).filter(Boolean))]) {
    process.stderr.write('Operationele proef: ' + bestand + '\n');
    if (!fs.existsSync(path.join(root, bestand))) { uitgevoerd[bestand] = false; logboek[bestand] = 'Proef ontbreekt.'; continue; }
    const r = spawnSync(process.execPath, ['--test', bestand], { cwd: root, encoding: 'utf8', timeout: 180000,
      maxBuffer: 8 * 1024 * 1024, env: { ...process.env, RTG_OPERATIONEEL_RUN: run,
        RTG_OPERATIONEEL_BRON: bron, RTG_OPERATIONEEL_JOURNAAL: journaal } });
    uitgevoerd[bestand] = !r.error && r.status === 0;
    const log = path.join(tmp, path.basename(bestand) + '.log');
    fs.writeFileSync(log, (r.stdout || '') + (r.stderr || '') + (r.error?.message || ''));
    logboek[bestand] = log;
    process.stderr.write((uitgevoerd[bestand] ? '  PASS ' : '  FAIL ') + log + '\n');
  }
  if (vingerafdruk() !== bron) throw Error('Bronnen wijzigden tijdens de proef; start opnieuw voor bewijs van één versie.');
  const journal = fs.readFileSync(journaal, 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x));
  const r = beoordeel({ catalogus: FUNCTIES, ketens: KETENS, contracten: CONTRACTEN, proeven: PROEVEN,
    journal, uitgevoerd, run, bron });
  const rapport = { ...r, op: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
    grens: 'Alle geregistreerde functies blijven V1-plichtig totdat een expliciet scopebesluit anders bepaalt. Deelketens certificeren geen hele capability.',
    uitgevoerd, logboek, bewijs: journal };
  const doel = path.join(tmp, 'operationeel.json'); fs.writeFileSync(doel, JSON.stringify(rapport, null, 2) + '\n');
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(rapport, null, 2) + '\n');
  else {
    const regel = (k, v) => console.log(k.padEnd(31) + v);
    console.log('RTG OPERATIONEEL');
    regel('Registered capabilities', FUNCTIES.length);
    regel('Mapped (volledig contract)', r.capabilities.filter(c => c.mapped).length + '/' + FUNCTIES.length);
    regel('Deelcontract aanwezig', r.capabilities.filter(c => c.deelcontract).length + '/' + FUNCTIES.length);
    regel('V1 capabilities', r.capabilities.length);
    for (const [d, n] of Object.entries(r.dimensies)) regel(d, n + '/' + r.capabilities.length);
    for (const [m, d] of Object.entries(r.modi)) regel(m, d.status + (d.deelproeven.length ? ' (deelproef: ' + d.deelproeven.join(', ') + ')' : ''));
    regel('Critical journeys', r.journeys.length);
    regel('Fully proven', r.journeys.filter(k => k.status === 'PROVEN').length + '/' + r.journeys.length);
    for (const [k, v] of Object.entries(r.controles)) regel(k, v == null ? 'UNKNOWN' : v);
    for (const k of r.journeys) console.log(k.id + ': ' + k.status + ' - ontbreekt: ' + k.ontbreekt.join(', '));
    console.log('OPERATIONAL_STATUS=' + r.status); console.log('Bewijs: ' + doel);
  }
  process.exitCode = r.status === 'PROVEN' ? 0 : 2;
}
try { main(); } catch (e) { console.error('OPERATIONAL_STATUS=ERROR: ' + e.message); process.exitCode = 1; }
