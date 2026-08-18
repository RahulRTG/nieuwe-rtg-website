#!/usr/bin/env node
/* ============================================================================
   KOMT DE CONTAINER OP? -- de poort die PR #58 miste.

   HET GAT. Dependabot bood aan om het runtime-image van node:22-slim naar
   node:26-slim te tillen, en zes vinkjes stonden groen naast dat voorstel. Geen
   van die zes raakte de container ook maar aan: `release-image.yml` bouwt het
   image pas bij een release, en de keuring draait op de Node van de runner
   (node-version: '22'), niet op de Node uit de Dockerfile. Er stond dus een
   groen vinkje naast een wijziging die niemand had uitgeprobeerd.

   En het risico was niet theoretisch. De CMD in de Dockerfile is

     CMD ["node", "--experimental-sqlite", "server/server.js"]

   en `node:sqlite` is sinds Node 24 stabiel. Bestaat die vlag in een volgende
   major niet meer, dan weigert node te starten op een onbekende optie: de
   container komt niet op, en de keuring had er niets over te zeggen.

   WAAROM DIT GEEN IMAGEBOUW IS. Het image bouwen kost een Rust-fase van vele
   minuten op elke PR, en dat is niet waar dit gat zit. Het gat zit in de
   laatste fase: draait DEZE Node de CMD die er DAADWERKELIJK in staat. Omdat
   dit huis nul runtime-dependencies heeft, is de server zonder node_modules te
   starten -- dus draaien we de echte server met de echte CMD in de echte
   Node-image, met de map eronder gemonteerd. Dat is een halve minuut.

   Wat dit dus WEL en NIET dekt. Wel: de Node-versie, de startvlag, de
   opstartketen en /api/health. Niet: de Rust-fase, de COPY-regels en de
   rechten van de gebruiker `node` -- die blijven voor de release-bouw.

   GEEN GROEN ZONDER METING. Zonder draaiende docker-daemon zakt deze proef, hij
   slaat zichzelf niet stil over. Wie hem lokaal zonder docker wil overslaan
   zegt dat met zoveel woorden: CONTAINERPROEF_SOFT=1.

   Draai: node scripts/containerproef.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DOCKERFILE = path.join(WORTEL, 'Dockerfile');
const POORT = Number(process.env.CONTAINERPROEF_POORT || 3999);
const NAAM = 'rtg-containerproef-' + process.pid;

function klaar(code, bericht) {
  console.log(bericht);
  process.exit(code);
}

/* ---------- 1. lees wat de Dockerfile werkelijk zegt ----------
   Uit het bestand en niet uit een tweede lijst hier, want dan kan die lijst
   verouderen terwijl de proef groen blijft (LAT.md regel 4: geen tweede
   waarheid). Bumpt iemand de Node-tag, dan verschuift deze proef mee. */
function leesDockerfile() {
  const bron = fs.readFileSync(DOCKERFILE, 'utf8');
  const froms = [...bron.matchAll(/^FROM\s+node:(\S+)/gm)].map(m => m[1]);
  if (!froms.length) throw new Error('geen "FROM node:<tag>" in de Dockerfile gevonden');
  const cmdRegel = bron.match(/^CMD\s+(\[[^\]]*\])/m);
  if (!cmdRegel) throw new Error('geen CMD-array in de Dockerfile gevonden');
  return { tag: froms[froms.length - 1], cmd: JSON.parse(cmdRegel[1]) };
}

function docker(args, opties) {
  return spawnSync('docker', args, { encoding: 'utf8', ...(opties || {}) });
}

async function wacht(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gezond(url, seconden) {
  const einde = Date.now() + seconden * 1000;
  let laatste = '';
  while (Date.now() < einde) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.status === 200) return { ok: true };
      laatste = 'status ' + r.status;
    } catch (e) { laatste = e.message; }
    await wacht(1000);
  }
  return { ok: false, waarom: laatste };
}

(async () => {
  const { tag, cmd } = leesDockerfile();
  const image = 'node:' + tag;
  console.log('  Dockerfile zegt: ' + image + '  ·  CMD ' + cmd.join(' ') + '\n');

  if (docker(['info']).status !== 0) {
    if (process.env.CONTAINERPROEF_SOFT === '1')
      klaar(0, '  OVERGESLAGEN: geen draaiende docker-daemon, en CONTAINERPROEF_SOFT=1 staat dat toe.');
    klaar(1, '  GEEN DOCKER: deze proef heeft een draaiende docker-daemon nodig.\n' +
             '  Dit is bewust geen stille overslag -- groen zonder meting is het patroon\n' +
             '  waar LAT.md regel 9 voor waarschuwt. Lokaal overslaan mag met\n' +
             '  CONTAINERPROEF_SOFT=1; in CI hoort die vlag niet te staan.');
  }

  /* ---------- 2. de startvlag apart, want die geeft de scherpste melding ----------
     Zonder deze stap zou een verdwenen vlag zich melden als "de container kwam
     niet op", en dan mag iemand gaan zoeken. */
  const vlaggen = cmd.slice(1).filter(a => a.startsWith('--'));
  for (const vlag of vlaggen) {
    const r = docker(['run', '--rm', image, 'node', vlag, '-e', 'process.exit(0)']);
    if (r.status !== 0) {
      console.log((r.stderr || '').trim().split('\n').slice(0, 3).map(l => '    ' + l).join('\n'));
      klaar(1, '\n  DE STARTVLAG BESTAAT NIET MEER: ' + image + ' weigert "node ' + vlag + '".\n' +
               '  De CMD in de Dockerfile gebruikt hem wel, dus deze container komt niet op.\n' +
               '  Pas de CMD aan (en server/server.js, die zichzelf met die vlag herstart)\n' +
               '  voordat de Node-major omhoog gaat.');
    }
  }
  if (vlaggen.includes('--experimental-sqlite')) {
    const r = docker(['run', '--rm', image, 'node', '--experimental-sqlite', '-e', "require('node:sqlite')"]);
    if (r.status !== 0)
      klaar(1, '  node:sqlite laadt niet in ' + image + ': de accountsdatabase komt daar niet op.');
    console.log('  ✓ ' + image + ' accepteert ' + vlaggen.join(' ') + ' en laadt node:sqlite');
  }

  /* ---------- 3. en dan de echte server, met de echte CMD ----------
     Zonder node_modules: nul runtime-dependencies betekent dat dit kan. */
  docker(['rm', '-f', NAAM]); // een restant van een afgebroken ronde
  const run = docker(['run', '-d', '--name', NAAM,
    '-v', WORTEL + ':/app', '-w', '/app',
    '-e', 'RTG_DATA_DIR=/tmp/rtgproef', '-e', 'SMTP_URL=', '-e', 'PORT=3000',
    '-p', '127.0.0.1:' + POORT + ':3000',
    image, ...cmd]);
  if (run.status !== 0) klaar(1, '  docker run mislukte:\n' + (run.stderr || '').trim());

  try {
    const uit = await gezond('http://127.0.0.1:' + POORT + '/api/health', 60);
    if (!uit.ok) {
      const logs = docker(['logs', '--tail', '40', NAAM]);
      console.log('\n  --- laatste 40 regels uit de container ---');
      console.log(((logs.stdout || '') + (logs.stderr || '')).trim().split('\n').map(l => '  ' + l).join('\n'));
      klaar(1, '\n  DE CONTAINER KWAM NIET OP: /api/health gaf binnen 60s geen 200 (' + uit.waarom + ').');
    }
    console.log('  ✓ de container komt op en /api/health antwoordt met 200');
  } finally {
    docker(['rm', '-f', NAAM]);
  }

  console.log('\n  De container komt op met de Node en de CMD uit de Dockerfile.');
})().catch(e => klaar(1, '  FOUT: ' + e.message));
