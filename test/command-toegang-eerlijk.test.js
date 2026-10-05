/* EEN RECHT DAT NIETS OPENT, ZEGT DAT (UITVOERINGSPLAN par. 8:
   command/toegang.geef/breekGlas, "KEEP LOCAL, onderzoeken").

   Het onderzoek: geldig(), vanWie() en open() hebben buiten
   server/kern/command/toegang.js geen enkele lezer. Een tijdelijk recht of
   een geopende nooddeur legt dus vast wie wat vroeg en waarom, maar geen van
   de vijf zware handelingen vraagt het na. Zolang dat zo is, draagt elk
   antwoord `nietAfgedwongen`.

   Deze toets bewaakt die AANNAME en niet alleen de zin: komt er een lezer bij,
   dan zakt toets 2. Pas hem dan niet aan, maar vervang hem door een proef op de
   poort (zonder recht nee, met recht ja, na verval nee) en haal de zin weg. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { maakToegang, NIET_AFGEDWONGEN } = require('../server/kern/command/toegang');

const laag = () => { const b = {}; return maakToegang({ opslag: { bak: k => (b[k] = b[k] || []) }, save() {}, crypto, journaal: { noteer() {} } }); };

test('1. geef en breekGlas zeggen dat het recht nog niets opent', () => {
  const t = laag();
  const g = t.geef('massamutatie', 'mw-b', 'mw-a', 'opruimen na een import');
  assert.equal(g.nietAfgedwongen, NIET_AFGEDWONGEN, JSON.stringify(g));
  const n = t.breekGlas('kluis-inzage', 'mw-a', 'storing bij de ledenbalie, lid wacht aan de lijn');
  assert.equal(n.nietAfgedwongen, NIET_AFGEDWONGEN, JSON.stringify(n));
  assert.match(n.waarschuwing, /journaal/);
});

function serverBestanden(dir, uit = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'data' && e.name !== 'node_modules') serverBestanden(p, uit); }
    else if (e.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

test('2. DE AANNAME: niemand buiten de module leest of een tijdelijk recht openstaat', () => {
  const wortel = path.join(__dirname, '..', 'server');
  const eigen = path.join(wortel, 'kern', 'command', 'toegang.js');
  const lezers = [];
  for (const f of serverBestanden(wortel)) {
    if (f === eigen) continue;
    const s = fs.readFileSync(f, 'utf8');
    if (/toegang\s*\.\s*(geldig|vanWie|open)\s*\(/.test(s) && /command/.test(s)) lezers.push(path.relative(wortel, f));
  }
  assert.deepEqual(lezers, [], 'Er leest nu iets of een tijdelijk recht openstaat: ' + lezers.join(', ') +
    '. Haal NIET_AFGEDWONGEN weg en vervang deze toets door een proef op die poort.');
});

test('3. besturingsproef: de zoekregel vindt een lezer als die er is', () => {
  const s = "const ok = command.toegang.geldig(wie, 'kluis-inzage');";
  assert.ok(/toegang\s*\.\s*(geldig|vanWie|open)\s*\(/.test(s) && /command/.test(s));
});
