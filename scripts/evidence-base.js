#!/usr/bin/env node
'use strict';

/* Zoek een VOLLEDIG groene main-run met een nog bestaand bewijsboek. Exact de
   merge-base heeft voorrang. Ontbreekt die, dan mag een oudere groene
   VOOROUDER dienen: het boek is geen vrijbrief voor de commit, maar een bundel
   content-addressed records. plan.js hergebruikt per toets alleen een record
   als invoer, omgeving, verval en steekproef opnieuw kloppen. Een run die geen
   voorouder is, of geen bewijsartefact meer heeft, komt nooit in aanmerking. */
const fs = require('fs');
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

function kiesRun(runs, sha) {
  return (runs || []).find((r) => r.head_sha === sha && r.status === 'completed' &&
    r.conclusion === 'success' && r.event === 'push') || null;
}

function groeneRuns(runs) {
  return (runs || []).filter((r) => r.status === 'completed' &&
    r.conclusion === 'success' && ['push', 'schedule'].includes(r.event));
}

function kiesRuns(runs, sha, isVoorouder) {
  const groen = groeneRuns(runs);
  const exact = groen.filter((r) => r.head_sha === sha);
  const ouder = groen.filter((r) => r.head_sha !== sha && isVoorouder(r.head_sha, sha));
  return exact.concat(ouder);
}

function vraag(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token, 'User-Agent': 'rtg-evidence-engine',
      'X-GitHub-Api-Version': '2022-11-28' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('GitHub API ' + res.statusCode));
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('GitHub API gaf geen JSON')); }
      });
    });
    req.on('error', reject);
  });
}

function mergeBase() {
  return execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: WORTEL, encoding: 'utf8' }).trim();
}

function isVoorouder(ouder, jonger) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ouder, jonger], {
      cwd: WORTEL, stdio: 'ignore' });
    return true;
  } catch (e) { return false; }
}

async function heeftBewijsboek(repo, run, token) {
  const url = 'https://api.github.com/repos/' + repo + '/actions/runs/' + run.id + '/artifacts?per_page=100';
  const antwoord = await vraag(url, token);
  return (antwoord.artifacts || []).some((a) => a.name === 'evidence-book' && !a.expired);
}

/* Een rode of nog lopende volledige nachtelijke ijking die NIEUWER is dan het
   bewijsboek trekt het vertrouwen in. We weten dan nog niet welke aanname fout
   was, dus degraderen we fail-closed het hele oudere boek. Een later volledig
   groene main- of nachtrun kan het vertrouwen weer opbouwen. */
function kalibratieBlokkeert(run, nacht) {
  if (!run || !nacht || !nacht.created_at || !run.created_at) return false;
  if (Date.parse(nacht.created_at) <= Date.parse(run.created_at)) return false;
  return nacht.status !== 'completed' || nacht.conclusion !== 'success';
}

function laatsteAndereRun(runs, huidigId) {
  const huidig = huidigId == null ? null : String(huidigId);
  return (runs || []).find((run) => String(run.id) !== huidig) || null;
}

function schrijfOutput(waarden) {
  const pad = process.env.GITHUB_OUTPUT;
  if (!pad) return;
  fs.appendFileSync(pad, Object.entries(waarden).map(([k, v]) => k + '=' + v).join('\n') + '\n');
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    schrijfOutput({ found: 'false', run_id: '', base_sha: '', basis_kind: 'none',
      reason: 'geen-github-context' });
    console.log('geen GitHub-context; bewijsbasis niet opgehaald');
    return;
  }
  const sha = mergeBase();
  const url = 'https://api.github.com/repos/' + repo +
    '/actions/workflows/ci.yml/runs?branch=main&status=success&per_page=100';
  const nachtUrl = 'https://api.github.com/repos/' + repo +
    '/actions/workflows/ci.yml/runs?branch=main&event=schedule&per_page=5';
  const [antwoord, nachtAntwoord] = await Promise.all([vraag(url, token), vraag(nachtUrl, token)]);
  /* Tijdens een schedule staat de huidige run bovenaan als in_progress. Die is
     nog geen kalibratie-uitspraak en mag de VOORSPELLING van diezelfde ronde
     niet leegmaken. Alleen een eerdere nachtelijke uitslag telt. */
  const nacht = laatsteAndereRun(nachtAntwoord.workflow_runs, process.env.GITHUB_RUN_ID);
  const kandidaten = kiesRuns(antwoord.workflow_runs, sha, isVoorouder);
  let run = null;
  for (const kandidaat of kandidaten) {
    if (!kalibratieBlokkeert(kandidaat, nacht) && await heeftBewijsboek(repo, kandidaat, token)) {
      run = kandidaat; break;
    }
  }
  const soort = run ? (run.head_sha === sha ? 'exact' : 'ancestor') : 'none';
  const gekalibreerdGeblokkeerd = !run && kandidaten.some((k) => kalibratieBlokkeert(k, nacht));
  const reden = run ? (soort === 'exact' ? 'exact-groene-basis' : 'content-addressed-voorouder')
    : (gekalibreerdGeblokkeerd ? 'nachtelijke-kalibratie-niet-groen' : 'geen-groen-bewijsartefact');
  schrijfOutput({ found: run ? 'true' : 'false', run_id: run ? String(run.id) : '',
    base_sha: sha, basis_kind: soort, reason: reden });
  console.log(run ? 'vertrouwde ' + soort + '-basis ' + run.head_sha.slice(0, 8) +
    ' voor ' + sha.slice(0, 8) + ': run ' + run.id
    : 'geen vertrouwd, niet-verlopen bewijsboek in de groene voorgeschiedenis van ' +
      sha.slice(0, 8) + '; planner blijft full');
}

if (require.main === module) main().catch((e) => {
  /* Een netwerkstoring mag CI niet smaller maken. Geen basis betekent full. */
  schrijfOutput({ found: 'false', run_id: '', base_sha: '', basis_kind: 'none',
    reason: 'ophalen-mislukt' });
  console.error('[evidence-base] ' + e.message + '; planner blijft full');
});

module.exports = { kiesRun, groeneRuns, kiesRuns, vraag, mergeBase, isVoorouder,
  heeftBewijsboek, kalibratieBlokkeert, laatsteAndereRun };
