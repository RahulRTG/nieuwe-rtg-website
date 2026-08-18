/* Auth-scoping over elke leden-route die AAN ZIJN VORM te herkennen is: deze
   test leest de bron en eist dat een leverancier- EN een kantoor-token 401
   krijgen -- nooit 2xx (ongewenste toegang) en nooit 5xx (crash).

   HIER STOND "UITPUTTEND", EN DAT WAS HET NIET. De zoektocht herkent een
   leden-endpoint aan het eerste WOORD na het pad, en dat werkt alleen bij
   `app.post('/api/x', auth, ...)`. Staat de grendel in de BODY van de handler
   -- `app.post('/api/bedrijf/rollen', (req, res) => { const g = werkPoort(req,
   res); if (!g) return; ... })` -- dan valt de route buiten de uitdrukking en
   dus stilzwijgend buiten deze toets. Gemeten op 18 augustus 2026: 511 van de
   1885 registraties vielen erbuiten, en zeventig daarvan zijn echte
   leden-endpoints die hier nooit langs zijn gekomen. Een uitputtende toets die
   5% mist en dat niet zegt, is geen uitputtende toets maar een geruststelling.

   HET UITPUTTENDE WERK STAAT NU IN scripts/rolronde.js. Die vraagt het niet aan
   de bron maar aan de SERVER: krijgt een anonieme beller 401 en een echt lid
   niet, dan IS het een leden-endpoint, hoe zijn grendel er ook uitziet. 1444
   stuks, met twee ratels eronder (`rolscheidingGaten` en `rolscheidingGemeten`)
   en een eigen CI-baan, want zo'n ronde duurt minuten.

   DEZE TOETS BLIJFT STAAN, en niet uit sentiment: hij draait in de hoofdsuite
   bij elke push en is binnen een minuut rond, terwijl de rolronde parallel in
   een eigen baan zit. Twee snelheden, en de snelle vangt de meeste fouten het
   eerst. Wat hij NIET meer doet is beweren dat hij alles ziet.

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
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

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
      const { status, body } = await api(e.method, e.pad, tok);
      /* 401 is de eis. 404 mag (een padparam-dummy bestaat niet), maar 2xx/3xx
         (ongewenste toegang) en 5xx (crash) zijn allebei fout.

         Een uitzondering, en het is er een die de belofte STERKER maakt: een
         503 van een functie die bewust uitstaat. Dat endpoint laat niemand
         binnen -- ook geen lid -- en dat is meer dan de 401 die hier gevraagd
         wordt. We eisen wel dat het antwoord de functie noemt, zodat een echte
         503-crash gewoon blijft opvallen. */
      const bewustDicht = status === 503 && body && body.functie;
      if (!bewustDicht && (status < 400 || status >= 500)) fout.push(e.method + ' ' + e.pad + ' [' + rol + '] -> ' + status);
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
