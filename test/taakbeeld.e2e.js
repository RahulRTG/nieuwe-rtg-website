/* HET TAAKBEELD IN EEN ECHTE BROWSER (EDGE.md par. 14.4, stap 2).

   Een lid wijst op het reisbureauscherm zijn aanvraag aan, opent de Rahul-tab
   en stelt een vraag. De nep-modelserver laat de stuurlus een plan wegen met
   een stap die "al geboekt en betaald" zegt. Onder het antwoord hoort dan het
   taakbeeld van de server te staan -- met de stand uit het beleid, en met de
   zin dat er niets is uitgevoerd -- en niet de bewering van het model.

   MUTATIES, nagetrokken (12 oktober 2026): laat rahul-tab.js taakbeeld.js
   niet laden (de notitie mist het plan, zakt), en laat de route geen taak
   meegeven (zakt).

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const PLAN = { doel: 'Uw reis naar Rome klaarzetten', stappen: [
  { id: 's1', capability: '/api/agenda/mijn', uitkomst: 'Ik heb alles al geboekt en betaald' },
  { id: 's2', capability: '/api/verzonnen/uitnodigen', uitkomst: 'Zes vrienden uitgenodigd' }
] };

function nepModel() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', (c) => brok.push(c));
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        const tools = Array.isArray(body.tools) && body.tools.length > 0;
        const na = (body.messages || []).some((m) => m.role === 'tool');
        const bericht = tools && !na
          ? { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'plan', arguments: JSON.stringify(PLAN) } }] }
          : { content: tools ? 'Ik heb het gewogen.' : 'Genoteerd.' };
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: Object.assign({ role: 'assistant' }, bericht),
          finish_reason: bericht.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}
const post = (base, pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('onder het antwoord van Rahul staat het taakbeeld van de server, niet de bewering van het model',
  { skip: geenBrowser(pw) }, async () => {
  const model = await nepModel();
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-taak-e2e-')),
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const reg = await post(srv.base, '/api/auth/register', { name: 'Taak Proef', email: 'taake2e' + Date.now() + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', phone: '0612345601', tier: 'rtg', pasApp: 'rtg' });
    const token = reg.body.token;
    const st = await post(srv.base, '/api/onboarding/status', {}, token);
    await post(srv.base, '/api/onboarding/teken', { naam: 'Taak Proef', akkoord: true, contractVersion: st.body.contract.versie }, token);
    const reizen = (await post(srv.base, '/api/reisbureau', {}, token)).body.reizen;
    const ref = (await post(srv.base, '/api/reisbureau/boek', { tripId: reizen[0].id, personen: 6, vertrek: '2026-11-03' }, token)).body.aanvraag.ref;

    await page.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const rij = page.locator('.aanvraag[data-ref="' + ref + '"]');
    await rij.waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld && !!window.RTGRahulTabHelpers, null, { timeout: 20000 });
    await rij.locator('h3').click();

    const tab = page.locator('.rtg-rahul-tab').first();
    await tab.waitFor({ timeout: 20000 });
    await tab.click();
    const veld = page.locator('.rtg-rahul-page input[aria-label="Vraag Rahul"]');
    await veld.waitFor({ state: 'visible', timeout: 10000 });
    /* Eerst de Rome-vraag met de Ibiza-aanvraag aangewezen: een nieuw
       reisconcept, en de open aanvraag wordt niet het onderwerp. */
    await veld.fill('Ik wil met zes vrienden vier dagen naar Rome, maximaal 800 euro per persoon.');
    await veld.press('Enter');
    const noten = page.locator('.rtg-command-log .rtg-command-noot');
    await noten.first().waitFor({ timeout: 20000 });
    const concept = await noten.last().textContent();
    assert.match(concept, /^Nieuwe reis naar Rome\n/);
    assert.match(concept, /Reizigers: 7 \(aangenomen: u en zes vrienden; pas aan als dat niet klopt\)/);
    assert.match(concept, /Nog nodig: de reisdata, uw vertrekplaats/);
    assert.match(concept, /Er is niets ingediend, geboekt of betaald/);
    assert.ok(!/ibiza/i.test(concept), 'de open aanvraag wordt niet het onderwerp');

    /* Dan een vraag OVER de aanvraag: het plan, in de woorden van een lid. */
    await veld.fill('Kun je deze aanvraag voor me in orde maken?');
    await veld.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.rtg-command-log .rtg-command-noot').length >= 2, null, { timeout: 20000 });
    const tekst = await noten.last().textContent();
    assert.match(tekst, /^Over uw reisaanvraag \u2018/, 'Rahul zegt over welke aanvraag het gaat');
    assert.match(tekst, /Rahul stelt voor: Uw reis naar Rome klaarzetten/);
    assert.match(tekst, /Ik heb alles al geboekt en betaald -- voorgesteld/, 'de bewering van het model staat er als voorstel');
    assert.match(tekst, /Zes vrienden uitgenodigd -- geblokkeerd: Dit kan Rahul niet voor u doen/, 'in mensentaal');
    assert.ok(!/allowlist|\/api\//.test(tekst), 'geen intern woord en geen pad');
    assert.match(tekst, /Er is niets uitgevoerd/);
    assert.equal(await page.locator('[data-done]').textContent(), 'Geen uitvoering in deze sessie',
      'de tab meldt geen uitvoering, want er is niets gedaan');
    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    await browser.close();
    await stop(srv);
    model.srv.close();
  }
});
