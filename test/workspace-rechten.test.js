/* DE RECHTEN VAN DE WERKRUIMTE: de server beslist wat het Second Screen mag
   tonen, de browser presenteert (kern/workspace-rechten.js).

   Vier dingen worden hier vastgehouden, en elk is een manier waarop het scherm
   eerder meer beloofde dan de server gaf:
   1 elke permissie die een module vraagt, heeft een regel op de server --
     anders is hij voor iedereen dicht en merkt niemand waarom;
   2 de server leest alleen de sessie: een rol, actor of rechtenlijst in het
     verzoek verandert niets, en een verzonnen naam opent niets;
   3 zonder sessie, of met een verlopen token, is er geen antwoord;
   4 de policy en de blueprintvalidator in de browser zeggen nee zolang er geen
     antwoord van de server is -- ook als een blueprint een module noemt die
     de sessie niet mag zien.
   Draai los: node --test test/workspace-rechten.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { startServer, stop } = require('./helper');
const { PERMISSIES, rechtenVoor } = require('../server/kern/workspace-rechten');

const ROOT = path.join(__dirname, '..', 'public', 'shared', 'interface');
function platform(...namen) {
  const window = { navigator: { onLine: true }, matchMedia: () => ({ matches: false }), confirm: () => true };
  const sandbox = { window, document: { documentElement: { dataset: {}, lang: 'nl' } }, console, Date,
    JSON, Object, Array, String, Number, Promise, TypeError, Error, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  for (const naam of namen) vm.runInContext(fs.readFileSync(path.join(ROOT, naam), 'utf8'), sandbox, { filename: naam });
  return window;
}

test('1. elke permissie die een module vraagt, heeft een regel op de server', () => {
  const gevraagd = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'modules'))) {
    const bron = fs.readFileSync(path.join(ROOT, 'modules', f), 'utf8');
    for (const m of bron.matchAll(/permissions:\s*\[([^\]]*)\]/g)) {
      for (const p of m[1].matchAll(/'([^']+)'/g)) gevraagd.add(p[1]);
    }
  }
  assert.ok(gevraagd.size >= 4, 'de meting vond de modulepermissies niet: ' + [...gevraagd].join(', '));
  for (const p of gevraagd) assert.ok(PERMISSIES[p], p + ' heeft geen regel in kern/workspace-rechten.js');
});

test('2. de rekenregel: geen sessie of geen sleutel is nee, en een onbekende naam is nee', () => {
  assert.equal(rechtenVoor(null).rechten['travel.read'], false);
  assert.equal(rechtenVoor({ tier: 'rtg' }).rechten['safety.respond'], false, 'een sessie zonder sleutel');
  const r = rechtenVoor({ key: 'user-1' }, ['travel.read', 'admin.alles', '__proto__', 'travel.read']);
  assert.deepEqual(r.rechten, { 'travel.read': true, 'admin.alles': false, '__proto__': false });
  assert.deepEqual(r.onbekend, ['admin.alles', '__proto__']);
  assert.equal(r.bron, 'server');
});

test('3. over de draad: alleen de sessie telt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wsrechten-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = async (body, token) => {
    const r = await fetch(base + '/api/ik/workspace/rechten', { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    assert.equal((await api({})).status, 401, 'zonder sessie geen antwoord');
    assert.equal((await api({}, 'verlopen-of-vervalst-token')).status, 401, 'een vervalst token geeft geen antwoord');
    const lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
    assert.ok(lid, 'demo-sessie');
    const gewoon = await api({}, lid);
    assert.equal(gewoon.status, 200);
    for (const p of Object.keys(PERMISSIES)) assert.equal(gewoon.body.rechten[p], true, p);
    // gemanipuleerd: een rol, een actor en een eigen rechtenlijst in het verzoek
    const vals = await api({ rol: 'office', actor: { id: 'eigenaar' }, rechten: { 'admin.alles': true },
      gevraagd: ['travel.read', 'admin.alles', 'office.kluis'] }, lid);
    assert.equal(vals.status, 200);
    assert.deepEqual(vals.body.rechten, { 'travel.read': true, 'admin.alles': false, 'office.kluis': false });
    assert.deepEqual(vals.body.onbekend, ['admin.alles', 'office.kluis']);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('4. in de browser: geen antwoord van de server is nee, ook voor een blueprint', () => {
  const w = platform('workspace-policy.js', 'workspace-blueprints.js');
  const zonder = w.RTGWorkspacePolicy({ actor: { id: 'lid' } });
  assert.equal(zonder.allowed('safety.read', 'safety'), false, 'zonder antwoordfunctie is een permissie niet verleend');
  assert.equal(zonder.allowed(null, 'context'), true, 'een module die niets eist, blijft zichtbaar');
  assert.equal(zonder.decide({ permission: 'safety.respond', owner: 'safety' }).allowed, false);

  const manifests = {
    safety: { permissions: ['safety.read'], states: ['peek', 'panel'], surfaces: { peek: true, panel: true } },
    context: { permissions: [], states: ['peek', 'panel'], surfaces: { peek: true, panel: true } }
  };
  const server = { 'safety.read': false };
  const policy = w.RTGWorkspacePolicy({ actor: { id: 'lid' }, permission: p => server[p] === true });
  const bp = w.RTGWorkspaceBlueprints({ manifest: id => manifests[id], permission: policy.allowed });
  const vals = bp.validate({ workspace: 'Gemanipuleerd', layout: [{ module: 'safety', state: 'panel' }] });
  assert.equal(vals.ok, false, 'een blueprint opent geen module die de server weigerde');
  assert.match(vals.errors[0], /niet bevoegd voor safety/);
  assert.equal(bp.validate({ workspace: 'Rol', layout: [{ module: 'safety', state: 'panel', rol: 'office', permission: true }] }).ok, false,
    'een rol of permissie in de blueprint zelf telt niet');
  assert.equal(bp.validate({ workspace: 'Gewoon', layout: [{ module: 'context', state: 'panel' }] }).ok, true);
  const zonderFunctie = w.RTGWorkspaceBlueprints({ manifest: id => manifests[id] });
  assert.equal(zonderFunctie.validate({ workspace: 'X', layout: [{ module: 'safety', state: 'panel' }] }).ok, false,
    'de validator zonder antwoordfunctie laat een module met een eis niet door');
  server['safety.read'] = true;
  assert.equal(bp.validate({ workspace: 'Na antwoord', layout: [{ module: 'safety', state: 'panel' }] }).ok, true);
});
