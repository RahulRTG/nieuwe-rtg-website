'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { WORTEL, eisSchoneBoom, vuileBoom } = require('./stempel');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function binding(journaal) {
  if (process.env.RTG_METEN_OP_VUILE_BOOM) throw Error('Output evidence requires a clean source; dirty-tree bypass is forbidden.');
  const clean = eisSchoneBoom('output evidence');
  if (!clean.ok || vuileBoom()?.code.length) throw Error(clean.reden || 'Source changed.');
  const git = args => execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8' }).trim();
  const commit = git(['rev-parse', 'HEAD']);
  const source = git(['rev-parse', 'HEAD^{tree}']);
  const journal = path.resolve(journaal);
  const sidecar = JSON.parse(fs.readFileSync(journal + '.provenance.json', 'utf8'));
  const journalSha256 = digest(fs.readFileSync(journal));
  if (sidecar.commit !== commit || sidecar.sha256 !== journalSha256 || sidecar.complete !== true)
    throw Error('A complete current-candidate TOETS journal with matching provenance is required.');
  const inputDigests = Object.fromEntries(['MUTATIES.json', 'INHOUDSKAART.json'].map(file =>
    [file, digest(fs.readFileSync(path.join(WORTEL, file)))]));
  const value = { commit, sourceTree: source, journalSha256, journal, inputDigests,
    runtime: process.version, runtimeSha256: digest(fs.readFileSync(process.execPath)) };
  return { ...value, id: digest(JSON.stringify(value)) };
}
function complete(run) {
  return !!run && !run.tijdout && !run.signal && !run.error && run.toetsen > 0 &&
    run.overgeslagen === 0 && ((run.status === 0 && run.gezakt === 0) || (run.status === 1 && run.gezakt > 0));
}
function green(run) { return complete(run) && run.status === 0 && run.gezakt === 0; }
function currentBaseline(entry, id) {
  return !!entry && entry.binding === id && entry.staat === 'groen' && green(entry.execution);
}
module.exports = { binding, digest, complete, green, currentBaseline };
