/* ROTEREN VOOR ELK CODEPORTAAL (eigenaarsbesluit 19 oktober 2026: een code per
   medewerker, en roteren voor elk portaal).

   De vrijwilliger, de hulpvrager en de donateur konden al roteren; nu ook de
   partnerstichting, de gemeente, de ondernemer, de club en de stadsraadpartner.
   Per portaal bewijst deze toets:
     - na roteren werkt de oude code voor niemand meer, ook niet voor het
       account dat eraan gekoppeld was;
     - de nieuwe code koppelt opnieuw (en dan alleen dat account);
     - een ander account kan niet roteren, en bij club en raad de gedeelde
       kantoorcode ook niet: roteren doet een kantoormens op naam. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const OFFICE_CODE = 'TOEGANG-ROTATIE';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-rotatie-'));
let srv, BASE, LAND, GEDEELD, STAD;
const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE, OFFICE_CODE);
  assert.ok(LAND, 'een kantoormens op naam');
  GEDEELD = (await post('/api/office/login', { code: OFFICE_CODE })).body.token;
  assert.ok(GEDEELD, 'de gedeelde kantoorcode');
  STAD = (await post('/api/rtfos/stad/maak', { naam: 'Deventer' }, LAND)).body.stad.id;
  await post('/api/rtfos/stad/status', { id: STAD, status: 'actief' }, LAND);
  for (const vlag of ['business_sponsorships', 'municipal_reporting']) await post('/api/rtfos/stad/module', { id: STAD, vlag, aan: true }, LAND);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const PORTALEN = [
  { soort: 'partner', portaal: '/api/rtfos/portaal/partner', roteer: '/api/rtfos/partner/code/roteren',
    maak: async () => { const p = (await post('/api/rtfos/partner/maak', { stad: STAD, naam: 'Stichting Deventer', kvk: '87654329',
      rsin: '123456789', doel: 'jongeren in Deventer', werkgebied: 'Deventer' }, LAND)).body.partner; return { id: p.id, code: p.code }; } },
  { soort: 'gemeente', portaal: '/api/rtfos/portaal/gemeente', roteer: '/api/rtfos/gemeente/code/roteren',
    maak: async () => { const g = (await post('/api/rtfos/gemeente/maak', { stad: STAD, naam: 'Gemeente Deventer', contact: 'A. Bakker' }, LAND)).body.gemeente;
      return { id: g.id, code: g.code }; } },
  { soort: 'ondernemer', portaal: '/api/rtfos/portaal/ondernemer', roteer: '/api/rtfos/ondernemer/code/roteren',
    maak: async () => { const o = (await post('/api/rtfos/ondernemer/maak', { stad: STAD, naam: 'Bakkerij De Brink', branche: 'horeca' }, LAND)).body.ondernemer;
      return { id: o.id, code: o.code }; } },
  { soort: 'club', portaal: '/api/rtf/club/portaal', roteer: '/api/rtfkantoor/club/code/roteren',
    maak: async () => { const c = (await post('/api/rtfkantoor/club/maak', { naam: 'Go Ahead Jeugd', stad: 'Deventer', sport: 'voetbal' }, LAND)).body.club;
      return { id: c.id, code: c.code }; } },
  { soort: 'raad', portaal: '/api/rtf/partner/raad', roteer: '/api/rtfkantoor/stadsraad/partner-code/roteren',
    maak: async () => { const p = (await post('/api/rtfkantoor/stadsraad/partner-maak', { stad: 'Deventer', naam: 'Fonds Deventer' }, LAND)).body.partner;
      return { id: p.id, code: p.code }; } }
];

for (const P of PORTALEN) {
  test(P.soort + ': roteren sluit de oude code voor iedereen, de nieuwe koppelt opnieuw, en alleen het kantoor op naam roteert', async () => {
    const d = await P.maak();
    assert.ok(d && d.id && d.code, 'het dossier en zijn code');
    const a = await registreerGratis(BASE);
    const b = await registreerGratis(BASE);
    assert.equal((await post(P.portaal, { code: d.code }, a.token)).status, 200, 'A koppelt met de eerste code');

    assert.ok([401, 403].includes((await post(P.roteer, { id: d.id }, a.token)).status), 'het gekoppelde account roteert niet zelf');
    assert.ok([401, 403].includes((await post(P.roteer, { id: d.id }, b.token)).status), 'een ander account roteert niet');
    assert.equal((await post(P.roteer, { id: d.id }, GEDEELD)).status, 403, 'de gedeelde kantoorcode roteert niet');

    const r = await post(P.roteer, { id: d.id, reden: 'code kwijt' }, LAND);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const nieuw = r.body.code;
    assert.ok(nieuw && nieuw !== d.code, 'een nieuwe code');

    assert.equal((await post(P.portaal, { code: d.code }, a.token)).status, 404, 'de oude code werkt niet meer, ook niet voor A');
    assert.equal((await post(P.portaal, { code: d.code }, b.token)).status, 404, 'en voor B evenmin');
    assert.equal((await post(P.portaal, { code: nieuw }, b.token)).status, 200, 'de nieuwe code koppelt opnieuw');
    assert.equal((await post(P.portaal, { code: nieuw }, a.token)).status, 404, 'en daarna alleen voor dat account');
  });
}
