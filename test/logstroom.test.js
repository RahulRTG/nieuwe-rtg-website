/* DE LOGSTROOM (techniekcontrole LOG-01, server/techniek.js).

   Node kiest zijn stdout-stroom op wat eraan hangt, en dat bepaalt of de log de
   server ophoudt:

     een PIJP    (systemd, docker, `| logger`) -> Socket, schrijft ASYNCHROON
     een BESTAND (`node server.js > log`)      -> SyncWriteStream, SYNCHROON

   Met LOG_LEVEL=info schrijft elk verzoek een regel. Op een bestand is dat dus
   per verzoek een synchrone schrijfactie, midden op de event-loop. Gemeten op
   24 augustus 2026 onder last: 5,2% van alle rekentijd, en het verschil tussen
   bestand en pijp was 26% op de event-loop-p99 en 40% op de hoogste uitschieter
   (zie PRESTATIES.md).

   WAAROM DEZE TOETS ECHTE PROCESSEN START en geen process.stdout nabootst: het
   ding dat getoetst wordt IS het gedrag van Node zelf. Een nagemaakte stdout met
   de goede constructornaam bewijst dat de check een string vergelijkt, niet dat
   de aanname over Node klopt. Zou Node dat ooit veranderen, dan hoort deze toets
   te zakken en niet stilletjes door te draaien op een aanname uit 2026.

   Draai los: node --test test/logstroom.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* Start een echt proces, met stdout aan een pijp of aan een bestand, en laat de
   controle zichzelf uitvoeren. Het antwoord komt via stderr terug, want stdout
   is juist het ding dat we verbouwen. */
function stand({ pijp, niveau }) {
  const code = `
    const t = require(${JSON.stringify(path.join(WORTEL, 'server/techniek.js'))});
    const c = (t.CHECKS || []).find(x => x.id === 'logstroom');
    if (!c) { console.error('MIST'); process.exit(0); }
    const r = c.run({});
    console.error(JSON.stringify({ status: r.status, soort: process.stdout.constructor.name, detail: r.detail }));
  `;
  const env = Object.assign({}, process.env);
  if (niveau) env.LOG_LEVEL = niveau; else delete env.LOG_LEVEL;
  /* Het antwoord komt via STDERR terug, dus lezen we dat en niet stdout --
     stdout is juist het ding dat we per proef verbouwen. */
  const r = spawnSync(process.execPath, ['-e', code],
    { env, encoding: 'utf8', stdio: ['ignore', pijp ? 'pipe' : 'ignore', 'pipe'], timeout: 30000 });
  const regels = String(r.stderr || '').trim().split('\n').filter(Boolean);
  assert.ok(regels.length, 'het kindproces gaf niets terug (status ' + r.status + ')');
  return JSON.parse(regels.pop());
}

/* 'ignore' geeft /dev/null en dus een SyncWriteStream -- precies de vorm die een
   logbestand ook geeft. 'pipe' geeft een Socket. */

test('1. stdout aan een PIJP is asynchroon, en de controle staat op groen', () => {
  const r = stand({ pijp: true });
  assert.equal(r.soort, 'Socket', 'een pijp geeft een Socket');
  assert.equal(r.status, 'ok');
  assert.match(r.detail, /asynchroon/);
});

test('2. stdout aan een BESTAND met logging per verzoek geeft een waarschuwing', () => {
  const r = stand({ pijp: false });
  assert.equal(r.soort, 'SyncWriteStream', 'een bestand geeft een SyncWriteStream -- dit is de aanname die de check maakt');
  assert.equal(r.status, 'waarschuwing',
    'wie zijn uitvoer naar een bestand leidt en per verzoek logt, hoort te weten wat dat kost');
  assert.match(r.detail, /synchrone schrijfactie/);
  assert.match(r.detail, /pijp|LOG_LEVEL/, 'en de waarschuwing zegt wat je eraan doet');
});

test('3. een bestand zonder logging per verzoek is geen probleem', () => {
  /* De kosten zitten in het AANTAL regels, niet in de stroom op zichzelf. Staat
     LOG_LEVEL boven info, dan schrijft een gewoon verzoek niets en valt de hele
     zaak weg -- dan hoort er geen waarschuwing te staan die niemand kan wegnemen. */
  const r = stand({ pijp: false, niveau: 'warn' });
  assert.equal(r.soort, 'SyncWriteStream');
  assert.equal(r.status, 'ok');
  assert.match(r.detail, /niet per verzoek/);
});

test('4. de controle staat op het bord, met een eigen code en categorie', () => {
  const { CHECKS } = require('../server/techniek.js');
  const c = CHECKS.find(x => x.id === 'logstroom');
  assert.ok(c, 'de controle bestaat');
  assert.equal(c.code, 'LOG-01', 'een vaste code, zoals elke andere controle');
  assert.equal(c.categorie, 'Runtime');
  const codes = CHECKS.map(x => x.code);
  assert.equal(new Set(codes).size, codes.length, 'geen twee controles met dezelfde code');
});
