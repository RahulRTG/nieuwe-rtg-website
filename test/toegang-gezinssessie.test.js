/* EEN GEZINSSESSIE HOORT BIJ HET ACCOUNT DAT HAAR UITGAF (gevonden door
   FoundationOS, af89167b: op een gedeeld toestel stond het gezinstoken van
   account A nog in de browser, en B las ermee).

   De serverregel, zodat het overal dicht is en niet alleen in de app die zijn
   eigen opslag opruimt (server/foundation/accountplicht.js, poort()):
     - een gezinstoken weet bij uitgifte welk account hem uitgaf;
     - draagt een verzoek met een gezinstoken OOK een ledensessie van een ANDER
       account, dan weigert de server: 403, en er is niets gelezen;
     - een verzoek met ALLEEN het gezinstoken blijft werken: dat is het toestel
       van het kind, zonder account;
     - en het ernstigste geval dat dit opende: B hangt zijn eigen passkey aan het
       gezinsprofiel van A (/api/rtf/gezin/passkey). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const { gezinAanAccount } = require('./gezinaccount');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-gezinssessie-'));
let srv, BASE;
const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTF_GEZIN_ACCOUNTPLICHT: '1' } }); BASE = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('het gezinstoken van A met de ledensessie van B: 403; met die van A of alleen: 200', async () => {
  const a = await gezinAanAccount(BASE);
  const b = await registreerGratis(BASE);
  const gezin = { code: a.code, token: a.token };
  const PAD = '/api/rtfos/publiek/steden';   // leest met een sessie of een gezinsprofiel (kern/elkesessie.js)

  const vreemd = await post(PAD, gezin, b.token);
  assert.equal(vreemd.status, 403, 'een ander account met het gezinstoken van A: ' + JSON.stringify(vreemd.body));
  assert.equal(vreemd.body.steden, undefined, 'en er is niets gelezen');
  assert.equal((await post(PAD, gezin, a.ouder.token)).status, 200, 'het account dat het token uitgaf');
  assert.equal((await post(PAD, gezin)).status, 200, 'alleen het gezinstoken: het toestel van het kind');

  const passkey = await post('/api/rtf/gezin/passkey', gezin, b.token);
  assert.equal(passkey.status, 403, 'B hangt geen passkey aan het gezinsprofiel van A: ' + JSON.stringify(passkey.body));
});

/* Een token ZONDER uitgever (van voor deze regel, of van gezinscode en pincode):
   de veilige kant. In een gezin met een eigenaar komt alleen een account door
   dat aantoonbaar aan het gezin hangt; elk ander account krijgt 403. */
test('een token zonder uitgever: alleen een account dat aan het gezin hangt', () => {
  const { zetSessieOplosser } = require('../server/kern/isolatie/sessiedragers');
  zetSessieOplosser((t) => ({ A: { key: 'user-1', account: { id: 1 } }, O: { key: 'user-3', account: { id: 3 } },
    B: { key: 'user-2', account: { id: 2 } } })[t] || null);
  const g = { code: 'GZTEST', eigenaar: { userId: 1 }, profielen: { k: { id: 'k', rol: 'kind' }, o: { id: 'o', rol: 'gast', koppel: { userId: 3 } } } };
  const gezinstoken = { zoek: (gz, raw) => (raw === 'GZ.' + 'A'.repeat(32) ? { p: g.profielen.k, t: { onderwerp: { gezin: 'GZTEST' } } } : null) };
  const poort = require('../server/foundation/accountplicht').maak({ ctx: {}, isBeschermd: () => false })
    .poort({ G: () => ({ GZTEST: g }), gezinstoken });
  const vraag = (wie) => {
    let status = null, verder = false;
    const req = { path: '/api/x', body: { code: 'GZTEST', token: 'GZ.' + 'A'.repeat(32) }, get: (h) => (h === 'authorization' ? 'Bearer ' + wie : '') };
    const res = { status(s) { status = s; return { json() {} }; } };
    poort(req, res, () => { verder = true; });
    return verder ? 'door' : status;
  };
  assert.equal(vraag('B'), 403, 'een vreemd account');
  assert.equal(vraag('A'), 'door', 'de eigenaar van het gezin');
  assert.equal(vraag('O'), 'door', 'een gekoppelde oppas');
});
