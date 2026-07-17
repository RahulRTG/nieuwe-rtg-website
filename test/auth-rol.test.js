/* Uitputtende auth-scoping-test. Niet een steekproef en geen mooipraterij:
   deze test leest ELKE leden-route (auth-middleware) rechtstreeks uit de bron
   en eist dat een leverancier- EN een kantoor-token daar 401 krijgen -- nooit
   2xx (ongewenste toegang) en nooit 5xx (crash). Zo kan geen enkel nieuw
   leden-endpoint ongemerkt de rol-scheiding omzeilen.

   Achtergrond: de chaos-soak (scripts/mega65-storm.js) vond dat de leden-auth
   een niet-leden-sessie (leverancier/kantoor, zonder persona-tier) accepteerde,
   waarna de ledengids crashte -> 500. Deze test dekt die klasse fouten af voor
   het hele oppervlak. Draai: node --experimental-sqlite --test test/auth-rol.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-authrol-'));
const api = (method, pad, token) => fetch(base + pad, {
  method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: method === 'GET' ? undefined : '{}'
}).then(r => ({ status: r.status }));

// Elke route + de eerste echte middleware (express.json-prefix overslaan) uit
// de serverbron. Middleware 'auth' = leden-endpoint.
function ledenEndpoints() {
  const dir = path.join(__dirname, '..', 'server');
  const files = [];
  (function loop(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const s = fs.statSync(p); if (s.isDirectory()) loop(p); else if (n.endsWith('.js')) files.push(p); } })(dir);
  const re = /app\.(get|post|put|delete)\(\s*'(\/api\/[a-zA-Z0-9/_:-]+)'\s*,\s*(?:express\.[a-zA-Z]+\([^)]*\)\s*,\s*)?([a-zA-Z]+)/g;
  const set = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8'); let m;
    while ((m = re.exec(txt))) {
      if (m[3] !== 'auth') continue;                       // alleen leden-endpoints
      if (/\/stream|\/sse/.test(m[2])) continue;           // geen SSE (die blijven open)
      const pad = m[2].replace(/:([a-zA-Z0-9_]+)/g, 'x1'); // padparam -> dummy
      set.set(m[1].toUpperCase() + ' ' + pad, { method: m[1].toUpperCase(), pad });
    }
  }
  return [...set.values()];
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'KIKUNOI' } });
  base = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('ELK leden-endpoint weigert een leverancier- en kantoor-token met 401 (geen 2xx, geen 5xx)', async () => {
  const sup = (await (await fetch(base + '/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json()).token;
  const office = (await (await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'RTG-OFFICE' }) })).json()).token;
  assert.ok(sup && office, 'leverancier- en kantoor-login werken');

  const endpoints = ledenEndpoints();
  assert.ok(endpoints.length > 150, 'er zijn ruim honderd leden-endpoints gevonden (' + endpoints.length + ')');

  const fout = [];
  for (const e of endpoints) {
    for (const [rol, tok] of [['leverancier', sup], ['kantoor', office]]) {
      const { status } = await api(e.method, e.pad, tok);
      // 401 is de eis. 404 mag (een padparam-dummy bestaat niet), maar 2xx/3xx
      // (ongewenste toegang) en 5xx (crash) zijn allebei fout.
      if (status < 400 || status >= 500) fout.push(e.method + ' ' + e.pad + ' [' + rol + '] -> ' + status);
    }
  }
  assert.equal(fout.length, 0, 'endpoints die een niet-leden-token binnenlieten of crashten:\n' + fout.slice(0, 40).join('\n'));
});

test('een lid komt wel binnen, en een onbekende tier levert geen sessie op', async () => {
  const lid = (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json()).token;
  assert.equal((await api('POST', '/api/suppliers', lid)).status, 200);
  const junk = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'zzz-onbekend' }) })).json();
  assert.ok(!junk.token, 'een onbekende tier levert geen sessie op');
});
