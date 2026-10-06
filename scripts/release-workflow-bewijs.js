#!/usr/bin/env node
'use strict';

/* De release-imageworkflow voert zijn eigen volledige software-afbouw uit, maar
   mag daarmee niet stil de onafhankelijke poorten vervangen. Dit dossier bindt
   de nieuwste uitspraken van vier voorafgaande workflows aan exact dezelfde
   commit. Het bevat uitsluitend GitHub-metadata en artifactdigests; de BUILD-
   handtekening bindt hieronder vervolgens deze exacte bytes aan het image. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { vraag } = require('./evidence-base');

const WORTEL = path.join(__dirname, '..');
const FORMAAT = 'rtg-prerelease-workflows-v2';
const STANDAARD = '.release/prerelease-workflows.json';
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

/* CI moet het evidence-book hebben: alleen de volledige bewijsroute publiceert
   dat. Een gewone groene incrementele run kan de release dus niet autoriseren. */
const VEREISTEN = Object.freeze([
  Object.freeze({ naam:'ci-full', workflow:'ci.yml', events:Object.freeze(['push', 'schedule', 'workflow_dispatch']),
    maxLeeftijdUur:72, artifacts:Object.freeze(['evidence-book']) }),
  Object.freeze({ naam:'prestatie-4k-17g', workflow:'ronde.yml', events:Object.freeze(['schedule', 'workflow_dispatch']),
    maxLeeftijdUur:24, artifacts:Object.freeze(['beproeving']) }),
  Object.freeze({ naam:'desktop-mobiel', workflow:'desktop-standard.yml', events:Object.freeze(['push', 'workflow_dispatch']),
    maxLeeftijdUur:72, artifacts:Object.freeze(['desktop-standard-1440', 'desktop-standard-390']) }),
  Object.freeze({ naam:'codeql', workflow:'codeql.yml', events:Object.freeze(['push', 'schedule']),
    maxLeeftijdUur:72, artifacts:Object.freeze(['codeql-verdict']) })
]);

function gitCommit(root = WORTEL) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd:root, encoding:'utf8', stdio:['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (e) { return null; }
}

function tijd(waarde) {
  const n = Date.parse(String(waarde || ''));
  return Number.isFinite(n) ? n : null;
}

function nieuwsteEerst(a, b) {
  const verschil = (tijd(b.updated_at || b.created_at) || 0) - (tijd(a.updated_at || a.created_at) || 0);
  return verschil || Number(b.run_attempt || 0) - Number(a.run_attempt || 0) || Number(b.id || 0) - Number(a.id || 0);
}

function kiesRun(eis, runs, commit, nu = Date.now(), huidigeRun) {
  if (!SHA.test(String(commit || ''))) throw new Error('releasecommit is geen volledige Git-SHA');
  const kandidaten = (Array.isArray(runs) ? runs : []).filter(run =>
    run && run.head_sha === commit && run.head_branch === 'main' && eis.events.includes(run.event) &&
    run.path === '.github/workflows/' + eis.workflow).sort(nieuwsteEerst);
  if (!kandidaten.length) throw new Error(eis.naam + ': geen workflowrun op exact ' + commit);
  const run = kandidaten[0];
  if (String(run.id) === String(huidigeRun || '')) throw new Error(eis.naam + ': workflow mag zichzelf niet bewijzen');
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error(eis.naam + ': nieuwste exacte run is ' + (run.status || 'onbekend') + '/' +
      (run.conclusion || 'onbekend'));
  }
  if (!Number.isSafeInteger(Number(run.id)) || Number(run.id) <= 0 ||
      !Number.isSafeInteger(Number(run.run_attempt)) || Number(run.run_attempt) <= 0) {
    throw new Error(eis.naam + ': run-identiteit ontbreekt');
  }
  const voltooid = tijd(run.updated_at || run.created_at);
  const maximaal = eis.maxLeeftijdUur * 60 * 60 * 1000;
  if (voltooid == null || voltooid > nu + 5 * 60 * 1000 || nu - voltooid > maximaal) {
    throw new Error(eis.naam + ': workflowbewijs is oud, toekomstig of heeft geen geldige tijd');
  }
  return run;
}

function artifactBewijs(eis, artifacts) {
  const lijst = Array.isArray(artifacts) ? artifacts : [];
  return eis.artifacts.map(naam => {
    const gevonden = lijst.filter(a => a && a.name === naam);
    if (gevonden.length !== 1) throw new Error(eis.naam + ': artifact ' + naam + ' ontbreekt of is dubbel');
    const a = gevonden[0];
    if (a.expired !== false) throw new Error(eis.naam + ': artifact ' + naam + ' is verlopen of heeft geen expirybewijs');
    if (!DIGEST.test(String(a.digest || ''))) throw new Error(eis.naam + ': artifact ' + naam + ' mist SHA-256-digest');
    const bytes = Number(a.size_in_bytes);
    if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error(eis.naam + ': artifact ' + naam + ' is leeg of onbegrensd');
    return { naam, digest:a.digest, bytes };
  });
}

function runBewijs(eis, run, artifacts) {
  return {
    naam:eis.naam,
    workflow:eis.workflow,
    workflowPad:run.path,
    runId:Number(run.id),
    poging:Number(run.run_attempt),
    event:run.event,
    commit:run.head_sha,
    branch:run.head_branch,
    status:run.status,
    conclusie:run.conclusion,
    afgerond:run.updated_at || run.created_at,
    maximaalOudUur:eis.maxLeeftijdUur,
    artifacts:artifactBewijs(eis, artifacts)
  };
}

function apiBasis(api, repository) {
  const delen = String(repository || '').split('/');
  if (delen.length !== 2 || delen.some(d => !/^[A-Za-z0-9_.-]+$/.test(d))) {
    throw new Error('GITHUB_REPOSITORY heeft niet de vorm eigenaar/repository');
  }
  return String(api || 'https://api.github.com').replace(/\/$/, '') + '/repos/' +
    encodeURIComponent(delen[0]) + '/' + encodeURIComponent(delen[1]);
}

async function verzamel({ repository, token, commit, eventCommit, huidigeRun, api, nu, request } = {}) {
  const nuMs = nu == null ? Date.now() : Number(nu);
  if (!Number.isFinite(nuMs)) throw new Error('controletijd ontbreekt');
  if (!token) throw new Error('GITHUB_TOKEN ontbreekt voor commitgebonden workflowbewijs');
  if (!SHA.test(String(commit || '')) || commit !== eventCommit || commit !== gitCommit()) {
    throw new Error('releasebron is niet exact gelijk aan GITHUB_SHA en de checkout');
  }
  const basis = apiBasis(api, repository), haal = request || vraag, workflows = [];
  for (const eis of VEREISTEN) {
    const runsUrl = basis + '/actions/workflows/' + encodeURIComponent(eis.workflow) +
      '/runs?branch=main&head_sha=' + encodeURIComponent(commit) + '&per_page=100';
    const antwoord = await haal(runsUrl, token);
    const run = kiesRun(eis, antwoord.workflow_runs, commit, nuMs, huidigeRun);
    let artifacts = [];
    if (eis.artifacts.length) {
      const art = await haal(basis + '/actions/runs/' + run.id + '/artifacts?per_page=100', token);
      artifacts = art.artifacts;
    }
    workflows.push(runBewijs(eis, run, artifacts));
  }
  const vervalt = Math.min(...workflows.map(w => tijd(w.afgerond) + w.maximaalOudUur * 60 * 60 * 1000));
  return {
    formaat:FORMAAT,
    profiel:'release-workflows-v2',
    stand:'VERIFIED',
    commit,
    repository,
    waargenomen:new Date(nuMs).toISOString(),
    geldigTot:new Date(vervalt).toISOString(),
    bron:'github-actions-api',
    releaseRun:huidigeRun ? String(huidigeRun) : null,
    workflows
  };
}

function schrijf(bestand, bewijs) {
  const doel = path.resolve(WORTEL, bestand || STANDAARD);
  fs.mkdirSync(path.dirname(doel), { recursive:true });
  const tijdelijk = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, JSON.stringify(bewijs, null, 2) + '\n', { mode:0o600 });
  fs.renameSync(tijdelijk, doel);
  return doel;
}

function argument(naam) {
  const v = process.argv.find(a => a.startsWith('--' + naam + '='));
  return v ? v.slice(naam.length + 3) : null;
}

async function hoofd() {
  const bewijs = await verzamel({
    repository:process.env.GITHUB_REPOSITORY,
    token:process.env.GITHUB_TOKEN,
    commit:process.env.RTG_RELEASE_EXPECTED_COMMIT,
    eventCommit:process.env.GITHUB_SHA,
    huidigeRun:process.env.GITHUB_RUN_ID,
    api:process.env.GITHUB_API_URL
  });
  const doel = schrijf(argument('uit') || STANDAARD, bewijs);
  console.log('Prerelease-workflowbewijs VERIFIED: ' + bewijs.commit + ' · ' +
    bewijs.workflows.length + ' workflows · ' + path.relative(WORTEL, doel));
}

if (require.main === module) hoofd().catch(e => {
  console.error('[release-workflow-bewijs] ' + e.message);
  process.exitCode = 1;
});

module.exports = { FORMAAT, STANDAARD, VEREISTEN, gitCommit, tijd, nieuwsteEerst,
  kiesRun, artifactBewijs, runBewijs, apiBasis, verzamel, schrijf };
