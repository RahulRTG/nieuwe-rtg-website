/* EEN ROTATIE IS HEEL OF NIET (machinedekking, keuze (a) van de integrator,
   19 oktober 2026).

   Een rotatie is drie stappen: oude code dicht, nieuwe code erin, koppeling van
   de oude code weg. Een halve rotatie is een echte fout: een oude code die
   half werkt, of een nieuwe die er staat terwijl de oude nog opent. Daarom
   lopen stap 1 en 2 als EEN wissel in een collectietransactie op de collectie
   van het dossier, en stap 3 erna (kern/codekoppel.js roteer()).

   Per pad (partner, gemeente, ondernemer, club, stadsraadpartner) laat de
   verraadsmotor de rotatie op twee plekken omvallen:
     - IN de wissel (na het zetten van de nieuwe code, voor de commit): de
       transactie rolt terug, de oude code werkt nog voor het gekoppelde
       account, en het dossier draagt nog de oude code;
     - NA de wissel (voor de koppeling vervalt): de nieuwe code staat er en
       werkt al volledig, en de oude opent niets meer -- ook niet voor het
       account dat eraan hing.
   Nooit een tussenstand. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const OFFICE_CODE = 'CODEROTATIE-ATOMAIR';

async function wereld(verraad) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-coderotatie-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE, RTG_VERRAAD: verraad } });
  const post = (pad, body, tok) => fetch(srv.base + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const LAND = await kantoorAlsPersoon(srv.base, OFFICE_CODE);
  const STAD = (await post('/api/rtfos/stad/maak', { naam: 'Zutphen' }, LAND)).body.stad.id;
  await post('/api/rtfos/stad/status', { id: STAD, status: 'actief' }, LAND);
  for (const vlag of ['business_sponsorships', 'municipal_reporting']) await post('/api/rtfos/stad/module', { id: STAD, vlag, aan: true }, LAND);
  const PADEN = [
    { soort: 'partner', portaal: '/api/rtfos/portaal/partner', roteer: '/api/rtfos/partner/code/roteren',
      maak: async () => (await post('/api/rtfos/partner/maak', { stad: STAD, naam: 'Stichting Zutphen', kvk: '87654320',
        rsin: '123456789', doel: 'jongeren', werkgebied: 'Zutphen' }, LAND)).body.partner,
      code: async (id) => ((await post('/api/rtfos/partners', { stad: STAD }, LAND)).body.partners || []).find(x => x.id === id).code },
    { soort: 'gemeente', portaal: '/api/rtfos/portaal/gemeente', roteer: '/api/rtfos/gemeente/code/roteren',
      maak: async () => (await post('/api/rtfos/gemeente/maak', { stad: STAD, naam: 'Gemeente Zutphen', contact: 'B. Smit' }, LAND)).body.gemeente,
      code: async (id) => ((await post('/api/rtfos/gemeenten', { stad: STAD }, LAND)).body.gemeenten || []).find(x => x.id === id).code },
    { soort: 'ondernemer', portaal: '/api/rtfos/portaal/ondernemer', roteer: '/api/rtfos/ondernemer/code/roteren',
      maak: async () => (await post('/api/rtfos/ondernemer/maak', { stad: STAD, naam: 'Drukkerij Zutphen', branche: 'diensten' }, LAND)).body.ondernemer,
      code: async (id) => ((await post('/api/rtfos/ondernemers', { stad: STAD }, LAND)).body.ondernemers || []).find(x => x.id === id).code },
    { soort: 'club', portaal: '/api/rtf/club/portaal', roteer: '/api/rtfkantoor/club/code/roteren',
      maak: async () => (await post('/api/rtfkantoor/club/maak', { naam: 'Zutphen Jeugd', stad: 'Zutphen', sport: 'hockey' }, LAND)).body.club,
      code: async (id) => ((await post('/api/rtfkantoor/clubs', {}, LAND)).body.steden || [])
        .flatMap(s => s.clubs || []).find(x => x.id === id).code },
    { soort: 'raad', portaal: '/api/rtf/partner/raad', roteer: '/api/rtfkantoor/stadsraad/partner-code/roteren',
      maak: async () => (await post('/api/rtfkantoor/stadsraad/partner-maak', { stad: 'Zutphen', naam: 'Fonds Zutphen' }, LAND)).body.partner,
      code: async (id) => ((await post('/api/rtfkantoor/stadsraad', {}, LAND)).body.partners || []).find(x => x.id === id).code }
  ];
  return { srv, TMP, post, LAND, PADEN };
}
const sluit = (w) => { stop(w.srv && w.srv.child); try { fs.rmSync(w.TMP, { recursive: true, force: true }); } catch (e) {} };

test('omvallen IN de wissel: de oude code werkt nog, het dossier draagt de oude code', async () => {
  const w = await wereld('coderotatie-crasht-in-wissel');
  try {
    for (const P of w.PADEN) {
      const d = await P.maak();
      assert.ok(d && d.id && d.code, P.soort + ': het dossier en zijn code');
      const a = await registreerGratis(w.srv.base);
      assert.equal((await w.post(P.portaal, { code: d.code }, a.token)).status, 200, P.soort + ': A koppelt');
      const r = await w.post(P.roteer, { id: d.id }, w.LAND);
      assert.equal(r.status, 500, P.soort + ': de rotatie viel om: ' + JSON.stringify(r.body));
      assert.equal(await P.code(d.id), d.code, P.soort + ': het dossier draagt nog de oude code');
      assert.equal((await w.post(P.portaal, { code: d.code }, a.token)).status, 200, P.soort + ': de oude code werkt nog voor A');
    }
  } finally { sluit(w); }
});

test('omvallen NA de wissel: de nieuwe code werkt al volledig, de oude opent niets', async () => {
  const w = await wereld('coderotatie-crasht-na-wissel');
  try {
    for (const P of w.PADEN) {
      const d = await P.maak();
      const a = await registreerGratis(w.srv.base);
      const b = await registreerGratis(w.srv.base);
      assert.equal((await w.post(P.portaal, { code: d.code }, a.token)).status, 200, P.soort + ': A koppelt');
      assert.equal((await w.post(P.roteer, { id: d.id }, w.LAND)).status, 500, P.soort + ': de rotatie viel om');
      const nieuw = await P.code(d.id);
      assert.notEqual(nieuw, d.code, P.soort + ': de nieuwe code staat er');
      assert.equal((await w.post(P.portaal, { code: d.code }, a.token)).status, 404, P.soort + ': de oude opent niets, ook niet voor A');
      assert.equal((await w.post(P.portaal, { code: nieuw }, b.token)).status, 200, P.soort + ': de nieuwe code werkt volledig');
    }
  } finally { sluit(w); }
});
