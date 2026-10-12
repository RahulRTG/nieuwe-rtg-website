/* DE CONTEXT BRIDGE IN EEN ECHTE BROWSER (EDGE.md par. 14.4).

   test/contextbrug-model.test.js stuurt de context met de hand mee. Dit
   bestand laat de PAGINA hem samenstellen: een lid opent het reisbureau, wijst
   een aanvraag aan, en de context die het blikveld daarvan maakt gaat via
   /api/fluister naar een nep-modelserver. Zo is de hele keten gelopen --
   scherm -> RTGAdaptief.context -> blikveld -> Rahul-context -> route ->
   opzoeking -> prompt -- en niet alleen de helften.

     1. het scherm zegt welke aanvraag is aangewezen, en het blikveld maakt er
        een verwijzing van met alleen soort en ref;
     2. de context die de pagina zelf bouwt, brengt die aanvraag in de prompt,
        met de velden van de server en zonder de notitie van het lid;
     3. een toetsenbordgebruiker kan aanwijzen met Enter.

   MUTATIES, elk nagetrokken (12 oktober 2026); het is een proef, dus hij zakt
   op de eerste stap die niet meer klopt: haal spreek() uit de klik in
   reisbureau.html (zakt bij 1), laat voorRahul() de verwijzingen leeg laten
   (zakt bij 1), haal de keydown-luisteraar weg (zakt bij 3).

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
const MERK = 'NOTITIEMERK' + Math.random().toString(36).slice(2, 8);

function nepModel() {
  return new Promise((resolve) => {
    const verzoeken = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', (c) => brok.push(c));
      req.on('end', () => {
        try { verzoeken.push(JSON.parse(Buffer.concat(brok).toString())); } catch (e) { verzoeken.push({}); }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: 'Genoteerd.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, verzoeken, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

async function post(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('een aangewezen reisaanvraag reist van het scherm tot in de prompt, en alleen als verwijzing',
  { skip: geenBrowser(pw) }, async () => {
  const model = await nepModel();
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cb-e2e-')),
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const u = Date.now().toString(36);
    const reg = await post(srv.base, '/api/auth/register', { name: 'Brug Proef', email: 'brug' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', phone: '0612345679', tier: 'rtg', pasApp: 'rtg' });
    const token = reg.body.token;
    assert.ok(token, 'registratie');
    const status = await post(srv.base, '/api/onboarding/status', {}, token);
    assert.equal((await post(srv.base, '/api/onboarding/teken', { naam: 'Brug Proef', akkoord: true,
      contractVersion: status.body.contract.versie }, token)).status, 200, 'de overeenkomst is getekend');
    const reizen = (await post(srv.base, '/api/reisbureau', {}, token)).body.reizen;
    const boek = await post(srv.base, '/api/reisbureau/boek', { tripId: reizen[0].id, personen: 6, vertrek: '2026-11-03',
      notitie: MERK }, token);
    assert.equal(boek.status, 200, 'reisaanvraag');
    const ref = boek.body.aanvraag.ref;

    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    await page.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const rij = page.locator('.aanvraag[data-ref="' + ref + '"]');
    await rij.waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld && typeof RTGEdgeBlikveld.voorRahul === 'function',
      null, { timeout: 20000 });

    // 1) Voor het aanwijzen is er geen verwijzing; erna precies een, met soort en ref.
    assert.deepEqual(await page.evaluate(() => RTGEdgeBlikveld.voorRahul().verwijzingen), []);
    await rij.locator('h3').click();
    assert.equal(await rij.getAttribute('aria-current'), 'true', 'het scherm laat zien welke is aangewezen');
    const v = await page.evaluate(() => RTGEdgeBlikveld.voorRahul());
    assert.deepEqual(v.verwijzingen, [{ soort: 'reisaanvraag', id: ref }]);
    assert.ok(!JSON.stringify(v).includes(reizen[0].titel), 'de titel komt niet van het scherm mee');

    // 2) De pagina bouwt de context zelf; de server zoekt de aanvraag op.
    const context = await page.evaluate(() => (window.RTGRahulTabHelpers ? RTGRahulTabHelpers.context() : RTGEdgeBlikveld.voorRahul()));
    assert.deepEqual(context.verwijzingen, [{ soort: 'reisaanvraag', id: ref }]);
    const voor = model.verzoeken.length;
    const r = await page.evaluate(async ({ c, t }) => {
      const x = await fetch('/api/fluister', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ q: 'Kun je deze aanvraag aanpassen naar vijf personen?', plafond: 'tonen', context: c }) });
      return x.status;
    }, { c: context, t: token });
    assert.equal(r, 200);
    const nieuw = JSON.stringify(model.verzoeken.slice(voor));
    assert.ok(nieuw.includes('opgezocht door RTG: reisaanvraag ' + ref), 'de aanvraag staat in de prompt');
    assert.ok(nieuw.includes('personen 6'), 'met de waarde van de server, niet die uit de vraag');
    assert.ok(!nieuw.includes(MERK), 'de notitie van het lid gaat niet naar het model');

    // 3) Aanwijzen kan ook met het toetsenbord.
    await page.evaluate(() => RTGAdaptief.context({ bron: 'reisbureau', titel: 'Reisbureau' }));
    assert.deepEqual(await page.evaluate(() => RTGEdgeBlikveld.voorRahul().verwijzingen), []);
    await rij.focus();
    await page.keyboard.press('Enter');
    assert.deepEqual((await page.evaluate(() => RTGEdgeBlikveld.voorRahul())).verwijzingen, [{ soort: 'reisaanvraag', id: ref }]);

    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    await browser.close();
    await stop(srv);
    model.srv.close();
  }
});
