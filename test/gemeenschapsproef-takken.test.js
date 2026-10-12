/* De gemeenschapsproef (scripts/gemeenschapsproef.js) tegen een NAGEMAAKTE
   server: stopt het instrument met een duidelijke reden als de wereld er niet
   komt (geen kantoor, geen stichting, geen registratie, geen codenaam), en
   schrijft het een keten die het niet doet eerlijk weg als "stuk", "open",
   "openBekend" en "gebroken" in plaats van als gesloten? Een 5xx moet stuk
   zijn, ook bij een schakel met een bekende reden; een 4xx met een reden is
   een bevinding. test/gemeenschapsproef.test.js loopt de echte keten en ziet
   alleen de gelukkige kant.

   De wegwerpserver en test/helper.js worden (via de require-cache, alleen in
   dit proces) vervangen; de nagemaakte server luistert op 127.0.0.1. De
   opdrachtregel draait in een kindproces met dezelfde vervanging als preload,
   en nooit met --vastleggen (dat schrijft in de repository). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WEGWERP = require.resolve('../scripts/lib/wegwerpserver');
const HELPER = require.resolve('./helper');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'gemeenschapsproef.js');

function nepServer(scenario) {
  const http = require('node:http');
  let n = 0;
  const antwoord = (pad, b, tok) => {
    const s = scenario;
    if (pad === '/api/rtfos/stad/maak') return [200, { stad: { id: 1 } }];
    if (pad === '/api/rtfos/partner/maak') return s.geenPartner ? [400, { error: 'kvk onbekend' }] : [200, { partner: { id: 5, code: 'P5' } }];
    if (pad === '/api/auth/register') return s.geenRegistratie ? [400, 'geen json hier'] : [200, { token: 't' + (++n) }];
    if (pad === '/api/metier/ik') return [200, s.geenCodenaam ? {} : { profiel: { codenaam: 'Code-' + tok } }];
    if (s.modus === 'stuk') return [500, { error: 'kapot' }];
    if (s.modus === 'diep') {
      if (pad === '/api/genootschap/richt-op') return [200, { groep: { id: 7 } }];
      if (pad === '/api/genootschap/zoek') return [200, { groepen: [{ id: 7, ikBenLid: false, leden: 1 }] }];
      if (pad === '/api/genootschap/binnen' && s.binnenWeigert) return [409, { error: 'al lid' }];
      if (pad === '/api/beraad/lees') return [200, { beraad: { rondes: [{}] } }];
      if (pad === '/api/genootschap/mijn-uitvoer') return [403, { error: 'niet voor jou' }];
      if (pad === '/api/notifications') return [200, 'geen json'];
      return [200, {}];
    }
    return [200, {}];
  };
  return http.createServer((req, res) => {
    let ruw = '';
    req.on('data', d => { ruw += d; });
    req.on('end', () => {
      let b = {}; try { b = JSON.parse(ruw || '{}'); } catch (e) { b = {}; }
      const tok = String(req.headers.authorization || '').replace('Bearer ', '');
      const [status, lijf] = antwoord(new URL(req.url, 'http://x').pathname, b, tok);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(typeof lijf === 'string' ? lijf : JSON.stringify(lijf));
    });
  });
}

let scenario = {};
const gekeurd = [];
let opgeruimd = 0;
require.cache[HELPER] = { id: HELPER, filename: HELPER, loaded: true, exports: {
  kantoorAlsPersoon: async () => (scenario.geenKantoor ? null : 'KT'),
  keurLidGoed: async (basis, token, codenaam, geboren) => { gekeurd.push({ codenaam, geboren }); },
} };
require.cache[WEGWERP] = { id: WEGWERP, filename: WEGWERP, loaded: true, exports: {
  start: async () => {
    if (scenario.dicht) return { basis: 'http://127.0.0.1:9', klaar() { opgeruimd++; } };
    const srv = nepServer(scenario);
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    return { basis: 'http://127.0.0.1:' + srv.address().port, klaar() { opgeruimd++; srv.close(); } };
  },
} };
const { meet, DOEL } = require('../scripts/gemeenschapsproef');

async function metScenario(s) { scenario = s; gekeurd.length = 0; return meet(); }

test('de wereld komt er niet: elke reden wordt genoemd en de server wordt opgeruimd', async () => {
  const voor = opgeruimd;
  await assert.rejects(metScenario({ geenKantoor: true }), /geen kantoorsessie op naam/);
  await assert.rejects(metScenario({ geenPartner: true }), /geen partnerstichting \(400\): \{"error":"kvk onbekend"\}/);
  await assert.rejects(metScenario({ geenRegistratie: true }), /registratie mislukt \(400\): geen json hier/);
  await assert.rejects(metScenario({ geenCodenaam: true }), /geen codenaam voor een nieuw lid \(200\)/);
  await assert.rejects(metScenario({ dicht: true }), /geen partnerstichting \(0\)/, 'zonder server is elk antwoord status 0');
  assert.equal(opgeruimd - voor, 5);
  assert.equal(path.basename(DOEL), 'GEMEENSCHAPSPROEF.json');
});

test('een server die overal 500 geeft: schakel 1 is stuk, de keten stopt, elke storing is gebroken', async () => {
  const u = await metScenario({ modus: 'stuk' });
  assert.equal(u.schakels.length, 1);
  assert.deepEqual([u.schakels[0].stand, u.schakels[0].status, u.schakels[0].antwoord], ['stuk', 500, 'kapot']);
  assert.equal(u.ids, null, 'zonder genootschap geen ids');
  assert.equal(u.telling.storingen, 13);
  assert.equal(u.telling.gebroken, 13);
  assert.equal(u.sluit, false);
  assert.equal(u.sluitMetBevinding, false);
  assert.deepEqual(u.bevindingen, []);
  // de leden van het gedragen genootschap worden gekeurd, de anderen niet; de minderjarige ook
  assert.equal(gekeurd.length, 7);
  assert.equal(gekeurd.at(-1).geboren, '2009-09-09');
});

test('een server die leeg antwoordt: schakel 1 is open, niet gesloten', async () => {
  const u = await metScenario({ modus: 'leeg' });
  assert.equal(u.schakels.length, 1);
  assert.equal(u.schakels[0].stand, 'open');
  assert.equal(u.schakels[0].ziet, 'gevonden: false');
  assert.equal(u.wereld.genootschap, undefined);
});

test('een server die half meedoet: open, openBekend met reden, stuk bij een crash in het kijken', async () => {
  const u = await metScenario({ modus: 'diep' });
  const per = nr => u.schakels.find(s => s.nr === nr);
  assert.equal(u.schakels.length, 15);
  assert.equal(per(1).stand, 'gesloten');
  assert.equal(per(1).ziet, 'gevonden: true, 1 lid');
  assert.equal(per(2).stand, 'open');
  assert.equal(per(3).ziet, 'stand: niet zichtbaar, codenaam in het partnerantwoord: false');
  assert.equal(per(9).stand, 'stuk', 'een ronde zonder inbreng laat het kijken crashen, en dat is stuk');
  assert.match(per(9).fout, /length/);
  assert.equal(per(13).naad.slice(0, 10), 'menselijk:');
  assert.equal(per(15).stand, 'openBekend', 'een 4xx met een bekende reden is een bevinding');
  assert.equal(per(15).status, 403);
  assert.equal(per(15).antwoord, 'niet voor jou');
  assert.equal(u.bevindingen.length, 1);
  assert.equal(u.bevindingen[0].schakel, 15);
  assert.deepEqual(u.naden.map(x => x.schakel), [13]);
  assert.equal(u.ids.genootschap, 7);
  assert.equal(u.telling.openBekend, 1);
  assert.equal(u.sluitMetBevinding, false);
});

test('een schakel die halverwege een weigering krijgt, schrijft die weigering weg', async () => {
  const u = await metScenario({ modus: 'diep', binnenWeigert: true });
  const s2 = u.schakels.find(s => s.nr === 2);
  assert.equal(s2.stand, 'stuk', 'een 4xx zonder bekende reden is stuk');
  assert.equal(s2.status, 409);
  assert.equal(s2.antwoord, 'al lid');
});

function preload(map) {
  const bestand = path.join(map, 'nep-gemeenschap.js');
  fs.writeFileSync(bestand, "'use strict';\n" +
    'const nepServer = ' + nepServer.toString() + ';\n' +
    'const scenario = JSON.parse(process.env.NEP_SCENARIO || "{}");\n' +
    'const W = ' + JSON.stringify(WEGWERP) + ', H = ' + JSON.stringify(HELPER) + ';\n' +
    'require.cache[H] = { id: H, filename: H, loaded: true, exports: { kantoorAlsPersoon: async () => (scenario.geenKantoor ? null : "KT"), keurLidGoed: async () => {} } };\n' +
    'require.cache[W] = { id: W, filename: W, loaded: true, exports: { start: async () => {\n' +
    '  const srv = nepServer(scenario); await new Promise(r => srv.listen(0, "127.0.0.1", r));\n' +
    '  return { basis: "http://127.0.0.1:" + srv.address().port, klaar() { srv.close(); } };\n' +
    '} } };\n');
  return bestand;
}

test('opdrachtregel: --json en code 1, de leesbare druk met bevinding en naad, en een stopreden', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gemeenschapsproef-'));
  const doelVoor = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
  try {
    const pre = preload(map);
    const draai = (s, argv) => spawnSync(process.execPath, ['-r', pre, SCRIPT, ...argv],
      { encoding: 'utf8', timeout: 30000, env: Object.assign({}, process.env, { NEP_SCENARIO: JSON.stringify(s) }) });
    const j = draai({ modus: 'stuk' }, ['--json']);
    assert.equal(j.status, 1, j.stderr);
    assert.equal(JSON.parse(j.stdout.trim().split('\n').pop()).telling.stuk, 1);
    const d = draai({ modus: 'diep' }, []);
    assert.equal(d.status, 1, d.stderr);
    assert.match(d.stdout, /^gemeenschapsproef: 15 schakels/m);
    assert.match(d.stdout, /NAAD: menselijk/);
    assert.match(d.stdout, /BEVINDING: De meeneemuitvoer/);
    assert.match(d.stdout, /antwoord: niet voor jou/);
    assert.match(d.stdout, /FOUT: /);
    assert.match(d.stdout, /ziet: gevonden: true/);
    assert.match(d.stdout, /DE KETEN SLUIT NIET\./);
    const f = draai({ geenKantoor: true }, []);
    assert.equal(f.status, 1);
    assert.match(f.stderr, /de gemeenschapsproef kon niet draaien: geen kantoorsessie/);
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
    const doelNa = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
    assert.equal(doelNa, doelVoor, 'het register in de repository is niet aangeraakt');
  }
});
