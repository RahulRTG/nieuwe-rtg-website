'use strict';
// One full suite, two storage boundaries. The ordinary tests own their local
// stores; the existing PG runner owns a fresh database for each PG test file.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { TOETSEN, toetslijstSha256 } = require('./pg-toetslijst');

function plan(bestanden, env, volledig, pgApart = false) {
  const pg = TOETSEN.map(n => path.basename(n));
  const actief = !!(env.DATABASE_URL || env.PG_URL);
  // CI-scherven hebben geen database; de verplichte PG-job draait deze lijst
  // wel, elk bestand in een eigen database. Een losse PG-selectie blijft falen
  // zonder database, en een volledige release blijft echt PG-bewijs eisen.
  if (!actief && pgApart) return { apart:false, bestanden:bestanden.filter(n=>!pg.includes(n)),
    env:{...env}, pg:[], uitgesteld:pg.filter(n=>bestanden.includes(n)) };
  if (!actief) return { apart: false, bestanden, env: { ...env }, pg: [] };
  if (!volledig) throw Error('Een gedeelde DATABASE_URL mag niet naar losse tests of scherven. Gebruik scripts/pgtoetsen.js voor databaseproeven.');
  if (!pg.every(n => bestanden.includes(n))) throw Error('De volledige suite mist verplichte PostgreSQL-bestanden.');
  const lokaal = lokaleOmgeving(env);
  return { apart: true, bestanden: bestanden.filter(n => !pg.includes(n)), env: lokaal, pg };
}
function lokaleOmgeving(env) {
  const lokaal = { ...env };
  for (const naam of ['DATABASE_URL', 'PG_URL', 'REDIS_URL', 'RTG_STORE']) delete lokaal[naam];
  return lokaal;
}

function telling(bewijs, commit) {
  const namen = (bewijs?.controles || []).map(x => x.bestand).sort();
  const velden = ['tests', 'geslaagdeTests', 'mislukt', 'geannuleerd', 'overgeslagen', 'todo'];
  if (bewijs?.formaat !== 'rtg-pg-bewijs-v1' || bewijs.bron?.commit !== commit || bewijs.bron?.boomVuil !== false ||
      bewijs.toetslijstSha256 !== toetslijstSha256 || bewijs.geslaagd !== true || bewijs.tapVolledig !== true ||
      bewijs.bestanden !== TOETSEN.length || JSON.stringify(namen) !== JSON.stringify([...TOETSEN].sort()) ||
      !velden.every(v => Number.isSafeInteger(bewijs[v]) && bewijs[v] >= 0) || bewijs.tests < 1 ||
      bewijs.geslaagdeTests !== bewijs.tests || ['mislukt', 'geannuleerd', 'overgeslagen', 'todo'].some(v => bewijs[v] !== 0))
    throw Error('PostgreSQL-bewijs is niet volledig, actueel en zonder skips.');
  const koppeling = { tests:'tests', geslaagdeTests:'geslaagd', mislukt:'mislukt', geannuleerd:'geannuleerd', overgeslagen:'overgeslagen', todo:'todo' };
  for (const [totaal, per] of Object.entries(koppeling)) {
    if (bewijs.controles.some(c => !Number.isSafeInteger(c[per]) || c[per] < 0 || c.tests < 1) ||
        bewijs[totaal] !== bewijs.controles.reduce((n, c) => n + c[per], 0))
      throw Error('PostgreSQL-totaal wijkt af van de werkelijk uitgevoerde bestanden.');
  }
  return { volledig:true, ...Object.fromEntries(velden.map(v => [v, bewijs[v]])) };
}

function draai(root, env) {
  const bestand = path.join(root, '.release/pg-bewijs.json');
  fs.rmSync(bestand, { force:true }); // an old PASS must never survive a failed child
  const commit = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd:root, encoding:'utf8' }).trim();
  const r = cp.spawnSync(process.execPath, ['scripts/pgtoetsen.js'], { cwd:root, env, stdio:'inherit', timeout:20 * 60 * 1000 });
  if (r.error || r.status !== 0) throw Error('De geïsoleerde PostgreSQL-suite is niet geslaagd.');
  const bytes = fs.readFileSync(bestand), bewijs = JSON.parse(bytes);
  return { telling:telling(bewijs, commit), bron:{ pad:'.release/pg-bewijs.json',
    sha256:crypto.createHash('sha256').update(bytes).digest('hex'), bestanden:TOETSEN.length, toetslijstSha256 } };
}
module.exports = { plan, telling, draai, lokaleOmgeving };
