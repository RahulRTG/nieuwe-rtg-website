#!/usr/bin/env node
'use strict';

/* Zoek de VOLLEDIG groene main-run van exact de merge-base. Geen "laatste
   ongeveer passende" run: ontbreekt exact bewijs, dan meldt deze stap niets en
   schaalt de planner op naar full. */
const fs = require('fs');
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

function kiesRun(runs, sha) {
  return (runs || []).find((r) => r.head_sha === sha && r.status === 'completed' &&
    r.conclusion === 'success' && r.event === 'push') || null;
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

function schrijfOutput(waarden) {
  const pad = process.env.GITHUB_OUTPUT;
  if (!pad) return;
  fs.appendFileSync(pad, Object.entries(waarden).map(([k, v]) => k + '=' + v).join('\n') + '\n');
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    schrijfOutput({ found: 'false', run_id: '', base_sha: '' });
    console.log('geen GitHub-context; bewijsbasis niet opgehaald');
    return;
  }
  const sha = mergeBase();
  const url = 'https://api.github.com/repos/' + repo +
    '/actions/workflows/ci.yml/runs?branch=main&status=success&event=push&per_page=100';
  const antwoord = await vraag(url, token);
  const run = kiesRun(antwoord.workflow_runs, sha);
  schrijfOutput({ found: run ? 'true' : 'false', run_id: run ? String(run.id) : '', base_sha: sha });
  console.log(run ? 'vertrouwde main-run voor ' + sha.slice(0, 8) + ': ' + run.id
    : 'geen vertrouwde main-run voor ' + sha.slice(0, 8) + '; planner blijft full');
}

if (require.main === module) main().catch((e) => {
  /* Een netwerkstoring mag CI niet smaller maken. Geen basis betekent full. */
  schrijfOutput({ found: 'false', run_id: '', base_sha: '' });
  console.error('[evidence-base] ' + e.message + '; planner blijft full');
});

module.exports = { kiesRun, vraag, mergeBase };
