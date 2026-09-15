/* DE WERELD VOOR DE KETENPROEF -- een echte server, eventueel met een echt
   pratend model ernaast, en een lid dat erop is ingelogd.

   APART VAN scripts/ketenbereik.js om dezelfde reden als scripts/lib/
   idemwereld.js en herstelwereld.js: het OPZETTEN van een wereld en het
   BEOORDELEN van wat erin gebeurt zijn twee dingen, en ze veranderen om
   verschillende redenen. Het is ook de les van keuringOmvang van vanochtend --
   splitsen op de naad, niet trimmen tot net onder de grens.

   HET NEPMODEL IS GEEN DEMO-STAND IN DE POORT. Hij is een gewone
   OpenAI-compatibele server op 127.0.0.1 waar LOCAL_AI_URL naar wijst; de
   productiecode merkt er niets van en kent geen testtak. Dat is dezelfde regel
   als MAGNAATLAB.md: een simulatie-adapter vervangt de rail, nooit de poort. */
'use strict';

const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');

const WORTEL = path.join(__dirname, '..', '..');

function vrijePoort() {
  return new Promise((klaar, fout) => {
    const s = net.createServer();
    s.once('error', fout);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => klaar(p)); });
  });
}

/* Een model dat antwoordt zonder iets te weten. Het gaat er hier niet om WAT
   het zegt maar DAT de stuurlus bestaat: zonder modelsleutel bestaat die niet,
   en dan is de halve keten onbereikbaar om een reden die niets met de
   architectuur te maken heeft. */
async function startNepModel() {
  const poort = await vrijePoort();
  const server = http.createServer((req, res) => {
    let lijf = '';
    req.on('data', c => { lijf += c; });
    req.on('end', () => {
      let p = {};
      try { p = JSON.parse(lijf); } catch (e) {}
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'nep', object: 'chat.completion', model: p.model || 'nep',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Ik kijk ernaar.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      }));
    });
  });
  await new Promise(k => server.listen(poort, '127.0.0.1', k));
  return { url: 'http://127.0.0.1:' + poort, stop: () => new Promise(k => server.close(k)) };
}

async function wachtOpServer(basis, seconden) {
  const tot = Date.now() + seconden * 1000;
  while (Date.now() < tot) {
    try {
      const r = await fetch(basis + '/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"tier":"rtg"}'
      });
      if (r.status < 500) return true;
    } catch (e) { /* nog niet op */ }
    await new Promise(k => setTimeout(k, 300));
  }
  return false;
}

/* Start een server met de meethaak ervoor. `extra` draagt de verschillen tussen
   de standen (met of zonder modelsleutel); al het andere is gelijk, anders meet
   je twee werelden in plaats van een verschil. */
async function startServer({ spoorPad, extra, dataDir }) {
  const poort = await vrijePoort();
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL,
    env: Object.assign({}, process.env, {
      PORT: String(poort),
      RTG_MAGNAAT_TEST: '1',
      RTG_KETENSPOOR: spoorPad,
      RTG_DATA_DIR: dataDir,
      NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' +
        path.join(WORTEL, 'scripts', 'lib', 'ketenspoor.js')).trim()
    }, extra || {}),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let uitvoer = '';
  kind.stdout.on('data', d => { uitvoer += d; });
  kind.stderr.on('data', d => { uitvoer += d; });

  const basis = 'http://127.0.0.1:' + poort;
  const op = await wachtOpServer(basis, 45);
  if (!op) {
    kind.kill('SIGKILL');
    throw new Error('de server kwam niet op binnen 45s. Uitvoer:\n' + uitvoer.slice(-1500));
  }
  return {
    basis,
    uitvoer: () => uitvoer,
    stop: () => new Promise(k => { kind.once('exit', k); kind.kill('SIGTERM'); setTimeout(() => { kind.kill('SIGKILL'); k(); }, 4000); })
  };
}

/* Een lid met een pas. De demo-inlog bestaat alleen in de Magnaat-testomgeving
   (server/testomgeving.js); daarbuiten zou dit niets opleveren, en dat hoort zo. */
async function logIn(basis) {
  const r = await fetch(basis + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"tier":"rtg"}'
  });
  const d = await r.json().catch(() => ({}));
  if (!d.token) throw new Error('geen sessie: ' + JSON.stringify(d).slice(0, 200));
  return d.token;
}

/* De drie menselijke ingangen, met per ingang de vorm van hun lijf. Ze staan
   hier als DATA en niet als drie functies, zodat scripts/ketenbereik.js er niet
   drie takken voor hoeft te hebben -- en zodat een vierde ingang er later bij
   kan zonder dat de meting verandert. */
const INGANGEN = [
  { id: 'fluister', pad: '/api/fluister', lijf: (zin) => ({ q: zin }) },
  { id: 'ai', pad: '/api/ai', lijf: (zin) => ({ messages: [{ role: 'user', content: zin }] }) },
  { id: 'chat', pad: '/api/chat/send', lijf: (zin) => ({ text: zin }) }
];

async function stuurZin(basis, token, ingang, zin) {
  const r = await fetch(basis + ingang.pad, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(ingang.lijf(zin))
  });
  const tekst = await r.text();
  let d = null;
  try { d = JSON.parse(tekst); } catch (e) {}
  /* De KOPPEN gaan mee, want server/effectmeter.js zet met RTG_STAATLOG zijn
     uitslag in X-RTG-Effect en niet in het lijf. Een ONTBREKENDE kop is daar
     iets anders dan `geen` (een stromend antwoord heeft zijn koppen al
     verstuurd), dus hij wordt doorgegeven als null en niet als lege tekst. */
  const koppen = {};
  r.headers.forEach((v, k) => { koppen[k.toLowerCase()] = v; });
  return { status: r.status, lijf: d, rauw: tekst.slice(0, 300), koppen,
    kop: (naam) => { const v = koppen[String(naam).toLowerCase()]; return v === undefined ? null : v; } };
}

module.exports = { vrijePoort, startNepModel, startServer, logIn, stuurZin, INGANGEN, WORTEL };
