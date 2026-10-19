/* EEN GASTLINK IS EEN EXTRA SLEUTEL BIJ EEN ACCOUNT, GEEN VERVANGING ERVAN
   (eigenaarsbesluit 19 oktober 2026, AGENTS.md: gebruiken vraagt een account).

   De klantlink (#gast=) en de leverancierslink (#leverancier=) uit WorkOS
   openden hun afspraak zonder account. Nu vraagt elke deur erachter een
   ingelogde sessie, met minimaal een gratis account; de link blijft daarnaast
   bewijzen WELKE afspraak het is. Het akkoord hangt aan de codenaam van het
   account dat het gaf. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stopHard } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

test('gastlinks van WorkOS: zonder account 401, met een gratis account werkt het', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-gastlinks-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', PAYMENT_ENABLED: 'false' } });
  const api = async (p, b = {}, tok) => {
    const r = await fetch(srv.base + p, { method: 'POST', body: JSON.stringify(b),
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const w = (await api('/api/bedrijf/werkruimte/maak', { naam: 'Toegangsproef', idem: crypto.randomUUID() })).body;
    const ctx = { werkruimte: w.werkruimte, beheerToken: w.beheerToken };
    const doe = (p, b = {}) => api('/api/bedrijf/praktijk/' + p, { ...ctx, idem: crypto.randomUUID(), ...b });
    assert.equal((await doe('inrichten', { profiel: 'winkel', land: 'NL', valuta: 'EUR', tijdzone: 'Europe/Amsterdam', versie: 0 })).status, 200);
    const a = (await doe('aanbod', { naam: 'Taart', soort: 'product', prijswijze: 'vast', bedragMinor: 4200, locatie: 'Haarlem' })).body;
    const p = (await doe('vraag', { aanbodId: a.aanbodId, klant: 'Klant A', vraag: 'Taart' })).body.projectId;
    const versie = async () => (await doe('beeld')).body.werk.find(x => x.id === p).versie;
    assert.equal((await doe('stap', { projectId: p, versie: await versie(), stap: 'voorstel', toelichting: 'Taart', bedragMinor: 4200 })).status, 200);
    const sleutel = (await doe('delen', { projectId: p, versie: await versie() })).body.link.split('#gast=')[1];
    assert.ok(sleutel, 'een klantlink');

    // zonder account: elke deur 401, ook met een geldige link
    for (const [pad, lijf] of [['/api/werk-gast/beeld', { sleutel }], ['/api/werk-gast/besluit', { sleutel, versie: 1, keuze: 'akkoord' }],
      ['/api/werk-gast/betaling/start', { sleutel, versie: 1, akkoord: true }], ['/api/werk-gast/betaling/status', { sleutel }]]) {
      const r = await api(pad, lijf);
      assert.equal(r.status, 401, pad + ' zonder account hoort 401 te geven, kreeg ' + r.status);
    }

    // met een gratis account: de link werkt, en een account zonder link opent niets
    const klant = await registreerGratis(srv.base);
    assert.ok(klant, 'een gratis account');
    assert.equal((await api('/api/werk-gast/beeld', {}, klant.token)).status, 404, 'het account is geen link');
    const beeld = await api('/api/werk-gast/beeld', { sleutel }, klant.token);
    assert.equal(beeld.status, 200, JSON.stringify(beeld.body));
    const ja = await api('/api/werk-gast/besluit', { sleutel, versie: beeld.body.versie, keuze: 'akkoord' }, klant.token);
    assert.equal(ja.status, 200, JSON.stringify(ja.body));
    const werk = (await doe('beeld')).body.werk.find(x => x.id === p);
    assert.ok(JSON.stringify(werk).includes(klant.codenaam), 'het akkoord hangt aan de codenaam van het account');

    // de leverancierslink: zelfde regel
    const ls = (await doe('leverancier', { projectId: p, versie: await versie(), actie: 'aanvragen', leverancier: 'Lokaal',
      onderdeel: 'Bezorgen', datum: '2026-12-01', locatie: 'Adres', bedragMinor: 500, voorwaarden: 'Geen' })).body.link.split('#leverancier=')[1];
    assert.equal((await api('/api/werk-leverancier/beeld', { sleutel: ls })).status, 401, 'leverancierslink zonder account');
    assert.equal((await api('/api/werk-leverancier/besluit', { sleutel: ls, versie: 1, keuze: 'bevestigen', naam: 'X', referentie: 'Y' })).status, 401);
    const lb = await api('/api/werk-leverancier/beeld', { sleutel: ls }, klant.token);
    assert.equal(lb.status, 200, JSON.stringify(lb.body));
    const lja = await api('/api/werk-leverancier/besluit', { sleutel: ls, versie: lb.body.versie, keuze: 'bevestigen', naam: 'Planner', referentie: 'T-1' }, klant.token);
    assert.equal(lja.status, 200, JSON.stringify(lja.body));
  } finally { await stopHard(srv.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
