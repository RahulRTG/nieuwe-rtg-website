/* LIVE SAMENWERKING IN EEN ECHTE BROWSER (EDGE.md par. 14.6).

   Een lid heeft op het reisbureauscherm zijn Ibiza-aanvraag aangewezen, opent de
   Rahul-tab en zegt "ik wil met zes vrienden vier dagen naar Rome". Onder het
   gesprek komt het concept als werkstuk; het lid zet de reizigers op 8 en de
   dagen op 5 op het scherm, zonder iets te typen tegen Rahul. Dan moet:
     - de kaart de nieuwe waarden en het nieuwe groepsbudget tonen, met de zin
       van Rahul eronder;
     - de Edge het concept als object kennen (en niet meer de Ibiza-aanvraag);
     - een volgende vraag aan Rahul het concept met de waarden van NU bij het
       model brengen, door de server opgezocht;
     - een ongeldige waarde bij het veld geweigerd worden, met de reden;
     - de Ibiza-aanvraag onveranderd zijn, en er geen model zijn geroepen voor
       de wijzigingen.

   MUTATIES, nagetrokken (12 oktober 2026): laat de tab conceptwerk.js niet laden
   (de kaart verschijnt niet, zakt), en laat de contextbouwer het werkstuk niet
   meesturen (het model krijgt het concept niet, zakt).

   Schrijft een schermafdruk naar RTG_DEMO_SCHERM als die is gezet. Draait alleen
   waar Playwright beschikbaar is; anders overgeslagen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

function nepModel() {
  return new Promise((resolve) => {
    const verzoeken = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', (c) => brok.push(c));
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        verzoeken.push(body);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Genoteerd.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, verzoeken, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}
const post = (base, pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('het lid past het Rome-concept op het scherm aan; Rahul en de Edge werken met dezelfde waarden',
  { skip: geenBrowser(pw) }, async () => {
  const model = await nepModel();
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-concept-e2e-')),
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const reg = await post(srv.base, '/api/auth/register', { name: 'Concept Proef', email: 'concepte2e' + Date.now() + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', phone: '0612345602', tier: 'rtg', pasApp: 'rtg' });
    const token = reg.body.token;
    const st = await post(srv.base, '/api/onboarding/status', {}, token);
    await post(srv.base, '/api/onboarding/teken', { naam: 'Concept Proef', akkoord: true, contractVersion: st.body.contract.versie }, token);
    const reizen = (await post(srv.base, '/api/reisbureau', {}, token)).body.reizen;
    const ibiza = reizen.find((r) => /ibiza/i.test(r.bestemming)) || reizen[0];
    const ref = (await post(srv.base, '/api/reisbureau/boek', { tripId: ibiza.id, personen: 6, vertrek: '2026-11-03' }, token)).body.aanvraag.ref;
    const ibizaVoor = JSON.stringify((await post(srv.base, '/api/reisbureau/mijn', {}, token)).body.aanvragen);

    await page.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const rij = page.locator('.aanvraag[data-ref="' + ref + '"]');
    await rij.waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld && !!window.RTGRahulTabHelpers && !!window.RTGEdgeConceptwerk, null, { timeout: 20000 });
    await rij.locator('h3').click();

    const tab = page.locator('.rtg-rahul-tab').first();
    await tab.waitFor({ timeout: 20000 });
    await tab.click();
    const veld = page.locator('.rtg-rahul-page input[aria-label="Vraag Rahul"]');
    await veld.waitFor({ state: 'visible', timeout: 10000 });
    await veld.fill('Ik wil met zes vrienden vier dagen naar Rome, maximaal 800 euro per persoon.');
    await veld.press('Enter');

    const kaart = page.locator('.rtg-rahul-page .rtg-conceptwerk');
    await kaart.waitFor({ timeout: 20000 });
    assert.match(await kaart.locator('header').textContent(), /TravelOS · Reisconcept.*Niet ingediend/);
    assert.equal(await kaart.locator('h3').textContent(), 'Nieuwe reis naar Rome');
    assert.equal(await kaart.locator('input[name="reizigers"]').inputValue(), '7');
    /* Elk veld past in zijn eigen vak. Dit stond een keer stil verkeerd: een losse
       `+` achter een commentaar in de stijlreeks maakte van de veldregel NaN, en
       de bestemming liep over de reizigers heen zonder dat een toets het zag. */
    const maten = await page.evaluate(() => [...document.querySelectorAll('.rtg-conceptwerk label')].map((l) =>
      [l.querySelector('input').getBoundingClientRect().width, l.getBoundingClientRect().width]));
    for (const [veld, vak] of maten) assert.ok(veld <= vak + 0.5, 'een veld van ' + veld + ' px in een vak van ' + vak + ' px');
    assert.ok(!(await page.evaluate(() => document.getElementById('rtgConceptwerkStijl').textContent)).includes('NaN'));
    assert.match(await kaart.locator('.afgeleid').textContent(), /Groepsbudget: maximaal € 5\.600/);
    const voorModel = model.verzoeken.length;

    // het lid past het concept op het scherm aan, zonder iets tegen Rahul te zeggen
    await kaart.locator('input[name="reizigers"]').fill('8');
    await kaart.locator('input[name="reizigers"]').press('Tab');
    await page.waitForFunction(() => document.querySelector('.rtg-conceptwerk').getAttribute('data-versie') === '2', null, { timeout: 10000 });
    await kaart.locator('input[name="dagen"]').fill('5');
    await kaart.locator('input[name="dagen"]').press('Tab');
    await page.waitForFunction(() => document.querySelector('.rtg-conceptwerk').getAttribute('data-versie') === '3', null, { timeout: 10000 });
    assert.match(await kaart.locator('.afgeleid').textContent(), /Groepsbudget: maximaal € 6\.400/);
    assert.equal(await kaart.locator('.rahul').textContent(),
      'Rahul · Concept bijgewerkt. U plant een reis naar Rome voor 8 personen, 5 dagen, met een maximaal groepsbudget van € 6.400. Er is niets ingediend of geboekt.');
    assert.equal(model.verzoeken.length, voorModel, 'een wijziging op het scherm roept geen model aan');

    /* Rahul kent het concept als het werkstuk van het lid: nieuwste eerst, naast de
       aangewezen aanvraag op het scherm. De schermcontext zelf zet de kaart niet
       (in de schil doet alleen de brug dat, test/edgedekking-zelf.test.js 5). */
    const obj = await page.evaluate(() => window.RTGRahulTabHelpers.context().verwijzingen);
    assert.equal(obj.length, 2);
    assert.equal(obj[0].soort, 'reiswens');
    assert.match(obj[0].id, /^RW-/);
    assert.deepEqual(obj[1], { soort: 'reisaanvraag', id: ref });

    // een ongeldige waarde: geweigerd bij het veld, met de reden, en de versie blijft
    await kaart.locator('input[name="reizigers"]').fill('40');
    await kaart.locator('input[name="reizigers"]').press('Tab');
    await page.waitForFunction(() => document.querySelector('.rtg-conceptwerk input[name="reizigers"]').getAttribute('aria-invalid') === 'true', null, { timeout: 10000 });
    assert.match(await kaart.locator('#cw-' + obj[0].id + '-reizigers').textContent(), /van 1 tot en met 30/);
    assert.equal(await kaart.getAttribute('data-versie'), '3');

    if (process.env.RTG_DEMO_SCHERM) await page.screenshot({ path: process.env.RTG_DEMO_SCHERM, fullPage: false });

    // een volgende vraag: Rahul krijgt het concept met de waarden van NU
    await veld.fill('Hoeveel dagen duurt deze reis?');
    await veld.press('Enter');
    await page.waitForFunction(() => /Genoteerd|Ik heb/.test(document.querySelector('.rtg-command-log').textContent) &&
      !/Context en grenzen controleren/.test(document.querySelector('.rtg-command-log').textContent), null, { timeout: 20000 });
    const alles = JSON.stringify(model.verzoeken.slice(voorModel));
    assert.match(alles, /opgezocht door RTG: reiswens RW-[0-9A-F]+ \(titel \\"Nieuwe reis naar Rome\\", bestemming \\"Rome\\", reizigers 8, dagen 5/);
    assert.equal(JSON.stringify((await post(srv.base, '/api/reisbureau/mijn', {}, token)).body.aanvragen), ibizaVoor,
      'de Ibiza-aanvraag is byte voor byte gelijk');
    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    await browser.close();
    await stop(srv);
    model.srv.close();
  }
});
