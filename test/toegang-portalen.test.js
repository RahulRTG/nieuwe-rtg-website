/* DE CODEPORTALEN VAN DE RTFOUNDATION VRAGEN EEN ACCOUNT, EN DE CODE KOPPELT
   DAT ACCOUNT AAN HET DOSSIER (eigenaarsbesluit 19 oktober 2026, AGENTS.md:
   gebruiken vraagt een account).

   De partnerstichting, de gemeente, de ondernemer, de vrijwilliger, de
   hulpvrager, de donateur en de club openden hun dossier op een code alleen:
   de code was de geloofsbrief. Nu:
     - zonder account 401, op elke codedeur;
     - met een account en de juiste code 200, en het account hangt daarna aan
       dat dossier (server/kern/codekoppel.js legt vast welk account het opende);
     - met een account en de code van een ander dossier 404 (de kern kent hem niet);
     - het account van de een opent met de code van de ander niet: een code
       die al aan een account hangt, is voor elk ander account onbekend (404).
       De code koppelt een keer; daarna is hij een EXTRA sleutel naast de sessie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-portalen-'));
let srv, BASE, LAND;
const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const CODEDEUREN = [
  '/api/rtfos/portaal/partner', '/api/rtfos/portaal/partner/genootschap', '/api/rtfos/portaal/partner/genootschap/erken',
  '/api/rtfos/portaal/gemeente', '/api/rtfos/portaal/ondernemer',
  '/api/rtfos/portaal/vrijwilliger', '/api/rtfos/portaal/vrijwilliger/zet', '/api/rtfos/portaal/vrijwilliger/uren',
  '/api/rtfos/portaal/deelnemer', '/api/rtfos/portaal/deelnemer/intrekken',
  '/api/rtfos/portaal/donateur', '/api/rtfos/portaal/donateur/bewijs',
  '/api/rtf/club/portaal', '/api/rtf/club/bericht',
  '/api/rtf/partner/raad', '/api/rtf/partner/besluit-start', '/api/rtf/partner/stem', '/api/rtf/partner/besluit-sluit'
];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'TOEGANG-PORTALEN' } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('elke codedeur vraagt een account', async () => {
  for (const pad of CODEDEUREN) {
    const r = await post(pad, { code: 'RTFP-ZZZZZZZ' });
    assert.equal(r.status, 401, pad + ' zonder account: ' + r.status);
  }
});

test('de code koppelt een account aan een dossier, en daarna alleen dat account', async () => {
  const stad = (await post('/api/rtfos/stad/maak', { naam: 'Zwolle' }, LAND)).body.stad.id;
  await post('/api/rtfos/stad/status', { id: stad, status: 'actief' }, LAND);
  await post('/api/rtfos/stad/module', { id: stad, vlag: 'business_sponsorships', aan: true }, LAND);
  const maakPartner = async (naam, kvk) => (await post('/api/rtfos/partner/maak', { stad, naam, kvk,
    rsin: '123456789', doel: 'jongeren in Zwolle', werkgebied: 'Zwolle' }, LAND)).body.partner.code;
  const codeA = await maakPartner('Stichting Zwolle Noord', '87654321');
  const codeB = await maakPartner('Stichting Zwolle Zuid', '87654322');
  assert.ok(codeA && codeB && codeA !== codeB, 'twee partnerdossiers met elk een code');

  const a = await registreerGratis(BASE);
  const b = await registreerGratis(BASE);
  const eerst = await post('/api/rtfos/portaal/partner', { code: codeA }, a.token);
  assert.equal(eerst.status, 200, 'met een account en de juiste code: ' + JSON.stringify(eerst.body).slice(0, 160));
  assert.equal((await post('/api/rtfos/portaal/partner', { code: codeA }, a.token)).status, 200, 'en daarna nog steeds');
  assert.equal((await post('/api/rtfos/portaal/partner', { code: 'RTFP-ZZZZZZZ' }, a.token)).status, 404,
    'een code die bij geen dossier hoort');

  const vanB = await post('/api/rtfos/portaal/partner', { code: codeB }, b.token);
  assert.equal(vanB.status, 200, 'B opent zijn eigen dossier');
  const kruis = await post('/api/rtfos/portaal/partner', { code: codeB }, a.token);
  assert.equal(kruis.status, 404, 'A opent met de code van B niet: ' + JSON.stringify(kruis.body).slice(0, 160));
  assert.equal((await post('/api/rtfos/portaal/partner', { code: codeA }, b.token)).status, 404,
    'en B niet met de code van A');
  assert.equal((await post('/api/rtfos/portaal/partner/genootschap', { code: codeA }, b.token)).status, 404,
    'ook niet langs de deur ernaast, want het is hetzelfde dossier');
});
