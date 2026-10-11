/* KEURINGSREGEL 28 PER ROUTE: wat een gat is, en wat de opruimcontrole eist.

   Commit 944b8c13 veranderde een regel van check.js regel 28: een kale 401 of
   403 in het venster maakt een publieke uitzondering niet meer overbodig. De
   bedoeling was dat alleen de OPRUIMEIS veranderde en niet het oordeel over
   een GAT. Deze toets houdt die twee uit elkaar, op een paar regels bron en
   met het oordeel uit scripts/lib/poortoordeel.js, dat check.js zelf gebruikt
   (de laatste toets houdt dat vast).

   De bron wordt hier OPGEBOUWD en staat niet letterlijk in dit bestand: een
   aanroep op app met een /api-pad in de tekst van een toets is voor een
   scanner een route, en dat kostte een ronde eerder vier spookroutes. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { beoordeelBron, VENSTER } = require('../scripts/lib/poortoordeel');

const WORTEL = path.join(__dirname, '..');
const API = '/' + 'api';
const route = (methode, pad, lijf) => 'app.' + methode + "('" + API + pad + "', " + lijf + ');\n';

const KAAL = '(req, res) => { if (!req.headers.x) return res.status(401).json({}); res.json({ ok: 1 }); }';
const OPEN = '(req, res) => res.json({ ok: 1 })';
const BINNEN = '(req, res) => { const p = profiel(req, res); if (!p) return; res.json({ ok: 1 }); }';
const WACHTER = 'auth, (req, res) => res.json({ ok: 1 })';
const LIJST = {
  poortMw: new Set(['auth']),
  poortBinnen: /\bprofiel\s*\(/,
  publiek: new Map([[API + '/pub/kaal', 'reden'], [API + '/pub/binnen', 'reden'],
    [API + '/pub/wachter', 'reden'], [API + '/pub/open', 'reden'], [API + '/pub/ver', 'reden']])
};
const oordeel = (bron) => Object.fromEntries(beoordeelBron(bron, LIJST)
  .map(r => [r.pad.slice(API.length), { soort: r.soort, gezien: r.gezien }]));

test('een kale 401 zonder uitzondering is geen gat, een route zonder 401 en zonder uitzondering wel', () => {
  const o = oordeel(route('post', '/x/kaal', KAAL) + route('post', '/x/open', OPEN));
  assert.equal(o['/x/kaal'].soort, 'kaal', 'een kale 401 telt als gesloten');
  assert.equal(o['/x/open'].soort, 'gat', 'geen poort en geen uitzondering: de keuring zakt');
});

test('het venster stopt bij de buurman: zijn 401 maakt een open route niet dicht', () => {
  const o = oordeel(route('post', '/x/open', OPEN) + route('post', '/x/kaal', KAAL));
  assert.equal(o['/x/open'].soort, 'gat');
  assert.equal(o['/x/kaal'].soort, 'kaal');
});

test('een kale 401 maakt een publieke uitzondering niet overbodig (944b8c13)', () => {
  const o = oordeel(route('post', '/pub/kaal', KAAL));
  assert.deepEqual(o['/pub/kaal'], { soort: 'kaal', gezien: true },
    'een 401 is een tekstafstand en geen poort: de uitzondering blijft nodig');
});

test('en dat hangt niet aan de tekstafstand: ook een 401 buiten het venster laat hem staan', () => {
  const ver = '(req, res) => { const t = ' + JSON.stringify('x'.repeat(VENSTER)) +
    '; if (!t) return res.status(401).json({}); res.json({ ok: 1 }); }';
  const o = oordeel(route('post', '/pub/ver', ver));
  assert.deepEqual(o['/pub/ver'], { soort: 'publiek', gezien: true });
});

test('een echte poort maakt de uitzondering wel overbodig, dus de opruimeis blijft staan', () => {
  const o = oordeel(route('post', '/pub/binnen', BINNEN) + route('post', '/pub/wachter', WACHTER) +
    route('post', '/pub/open', OPEN));
  assert.deepEqual(o['/pub/binnen'], { soort: 'binnen', gezien: false });
  assert.deepEqual(o['/pub/wachter'], { soort: 'poortwachter', gezien: false });
  assert.deepEqual(o['/pub/open'], { soort: 'publiek', gezien: true });
});

test('check.js regel 28 gebruikt dit oordeel en heeft er geen eigen kopie van', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/check.js'), 'utf8');
  const begin = bron.indexOf("console.log('\\n28)");
  const eind = bron.indexOf("console.log('\\n29)");
  assert.ok(begin > 0 && eind > begin, 'regel 28 is in check.js gevonden');
  const regel = bron.slice(begin, eind);
  assert.match(regel, /require\('\.\/lib\/poortoordeel'\)/);
  assert.match(regel, /beoordeelBron\(/);
  assert.doesNotMatch(regel, /\\b\(401\|403\)\\b/, 'een tweede oordeel op de kale 401 in check.js loopt uiteen met dit');
});
