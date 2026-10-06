#!/usr/bin/env node
'use strict';

/* CodeQL's analyze-action kan groen eindigen terwijl de SARIF-uitvoer echte
   bevindingen bevat. Deze poort leest de bestanden die diezelfde action op de
   runner maakte en maakt daarvan een klein, commitgebonden nul-verdict. De
   releaseketen consumeert alleen het artifactdigest van dit verdict; geen
   mutable Security-tab of latere branchstand kan een oude commit groener maken. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SHA = /^[0-9a-f]{40}$/;
const MAX_BESTAND = 100 * 1024 * 1024;
const MAX_BESTANDEN = 32;

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function sarifBestanden(map) {
  const root = path.resolve(map || '');
  if (!fs.existsSync(root) || !fs.lstatSync(root).isDirectory())
    throw new Error('CodeQL-resultatenmap ontbreekt of is geen gewone map');
  const uit = [];
  function loop(dir) {
    for (const naam of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, naam), stat = fs.lstatSync(p);
      if (stat.isSymbolicLink()) throw new Error('CodeQL-resultaten mogen geen symlinks bevatten');
      if (stat.isDirectory()) loop(p);
      else if (stat.isFile() && /\.sarif$/i.test(naam)) uit.push(p);
      if (uit.length > MAX_BESTANDEN) throw new Error('te veel CodeQL-SARIF-bestanden');
    }
  }
  loop(root);
  if (!uit.length) throw new Error('CodeQL leverde geen SARIF-bestand');
  return { root, files:uit };
}

function beoordeel({ map, commit, ref, runId } = {}) {
  if (!SHA.test(String(commit || ''))) throw new Error('CodeQL-verdict mist volledige commit-SHA');
  /* Een pull_request-run draait op refs/pull/<n>/merge. De ref staat alleen
     ter herkomst in het verdict; de releaseketen kiest zelf uitsluitend
     runs op main (release-workflow-bewijs.js), dus een PR-verdict telt daar niet. */
  if (!/^refs\/(?:(?:heads|tags)\/[A-Za-z0-9._\/-]+|pull\/[1-9][0-9]*\/merge)$/.test(String(ref || '')))
    throw new Error('CodeQL-verdict mist geldige Git-ref');
  const gevonden = sarifBestanden(map), bestanden = [];
  let resultaten = 0, runs = 0;
  for (const bestand of gevonden.files) {
    const stat = fs.statSync(bestand);
    if (stat.size <= 0 || stat.size > MAX_BESTAND) throw new Error('CodeQL-SARIF is leeg of te groot');
    const bytes = fs.readFileSync(bestand), document = JSON.parse(bytes.toString('utf8'));
    if (document.version !== '2.1.0' || !Array.isArray(document.runs) || !document.runs.length)
      throw new Error('CodeQL-SARIF mist een geldige 2.1.0-run');
    for (const run of document.runs) {
      const naam = run && run.tool && run.tool.driver && run.tool.driver.name;
      if (!/codeql/i.test(String(naam || ''))) throw new Error('SARIF-run is niet aantoonbaar van CodeQL');
      if (Array.isArray(run.invocations) && run.invocations.some(x => x && x.executionSuccessful === false))
        throw new Error('CodeQL-SARIF meldt een mislukte uitvoering');
      if (run.results != null && !Array.isArray(run.results)) throw new Error('CodeQL-SARIF heeft ongeldige resultaten');
      resultaten += Array.isArray(run.results) ? run.results.length : 0;
      runs++;
    }
    bestanden.push({ naam:path.relative(gevonden.root, bestand).replace(/\\/g, '/'),
      bytes:stat.size, sha256:sha256(bytes) });
  }
  return Object.freeze({ formaat:'rtg-codeql-verdict-v1', beleid:'zero-sarif-results-v1',
    stand:resultaten === 0 ? 'PASS' : 'FAIL', commit, ref, runId:String(runId || ''),
    codeqlRuns:runs, openResultaten:resultaten, bestanden });
}

function schrijf(doel, verdict) {
  const p = path.resolve(doel);
  fs.mkdirSync(path.dirname(p), { recursive:true });
  const tmp = p + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(verdict, null, 2) + '\n', { mode:0o600 });
  fs.renameSync(tmp, p);
  return p;
}

function arg(naam, standaard) {
  const v = process.argv.find(x => x.startsWith('--' + naam + '='));
  return v ? v.slice(naam.length + 3) : standaard;
}

if (require.main === module) {
  try {
    const verdict = beoordeel({ map:arg('dir', 'codeql-results'),
      commit:process.env.GITHUB_SHA, ref:process.env.GITHUB_REF, runId:process.env.GITHUB_RUN_ID });
    const doel = schrijf(arg('out', '.release/codeql-verdict.json'), verdict);
    if (verdict.stand !== 'PASS') throw new Error(verdict.openResultaten + ' CodeQL-bevinding(en) in SARIF');
    console.log('CodeQL-verdict PASS: nul resultaten · ' + doel);
  } catch (e) {
    console.error('[codeql-verdict] ' + e.message);
    process.exitCode = 1;
  }
}

module.exports = { MAX_BESTAND, MAX_BESTANDEN, sarifBestanden, beoordeel, schrijf };
