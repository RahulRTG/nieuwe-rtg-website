/* De eerste echte TravelOS-taak in de bestaande Spatial-werkruimte.

   Bewijst dat Peek niets zwaars laadt, dat invoer in hetzelfde paneel blijft,
   dat controleren geen mutatie uitvoert en dat alleen de bevestigde Broker-
   actie precies een bestaande reisaanvraag bij de bron maakt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const h = require('./helper');

const pw = h.laadPlaywright();

async function api(base, route, body, token) {
  const antwoord = await fetch(base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
  const data = await antwoord.json();
  assert.equal(antwoord.status, 200, JSON.stringify(data));
  return data;
}

async function nieuwLid(base) {
  const uniek = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const lid = await api(base, '/api/auth/register', {
    name: 'Spatial Reisproef', email: 'spatial-travel-' + uniek + '@voorbeeld.test',
    phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  const status = await api(base, '/api/onboarding/status', {}, lid.token);
  await api(base, '/api/onboarding/teken', {
    naam: 'Spatial Reisproef', akkoord: true, contractVersion: status.contract.versie
  }, lid.token);
  return lid.token;
}

async function context(browser, base, token, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => {
    localStorage.setItem('rtg_member_token', t);
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, token);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  return { ctx, page };
}

test('TravelOS blijft licht, rondt één aanvraag af en stopt bij een sessiewissel',
  { skip: h.geenBrowser(pw) }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spatial-travel-'));
    const srv = await h.startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DATA_DIR: dataDir } });
    const browser = await h.startBrowser(pw);
    try {
      const token = await nieuwLid(srv.base);
      const anderToken = await nieuwLid(srv.base);

      // Mobiel start de werktafel in Peek. Travel mag daar zijn catalogus nog
      // niet ophalen; de bestaande performancegrens blijft dus werkzaam.
      const mobiel = await context(browser, srv.base, token, { width: 390, height: 844 });
      let catalogusVerzoeken = 0;
      mobiel.page.on('request', (request) => {
        const url = new URL(request.url());
        if (request.method() === 'POST' && url.pathname === '/api/reisbureau') catalogusVerzoeken++;
      });
      await mobiel.page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      await mobiel.page.waitForSelector('[data-rtg-module="travel"]', { state: 'attached' });
      await mobiel.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      assert.equal(catalogusVerzoeken, 0, 'Travel laadde de catalogus al in Peek');
      await mobiel.ctx.close();

      // De bestaande RTGIntent-store bewaart uitsluitend de expliciet gekozen
      // velden in dit tabblad. Vrije tekst blijft buiten opslag en dezelfde
      // sessie kan datum en reizigers na herladen hervatten.
      const hervat = await context(browser, srv.base, token, { width: 1440, height: 960 });
      await hervat.page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      var hervatTravel = hervat.page.locator('[data-rtg-module="travel"]');
      await hervatTravel.locator('.rtg-travel-option').first().waitFor();
      await hervatTravel.locator('.rtg-travel-option').first().click();
      const hervatDatum = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);
      const nietBewaren = 'Deze vrije wens hoort nooit in sessieopslag';
      await hervatTravel.locator('[data-rtg-travel-input="date"]').fill(hervatDatum);
      await hervatTravel.locator('[data-rtg-travel-action="plus"]').click();
      await hervatTravel.locator('[data-rtg-travel-input="note"]').fill(nietBewaren);
      await hervatTravel.locator('[data-rtg-travel-action="remember"]').check();
      await hervat.page.waitForFunction((datum) => (sessionStorage.getItem('rtg.intent.v1') || '').includes(datum), hervatDatum);
      const intentTekst = await hervat.page.evaluate(() => sessionStorage.getItem('rtg.intent.v1') || '');
      assert.doesNotMatch(intentTekst, /Deze vrije wens/, 'vrije tekst kwam in RTGIntent terecht');
      await hervatTravel.locator('[data-rtg-travel-input="note"]').fill('');
      await hervat.page.reload({ waitUntil: 'domcontentloaded' });
      hervatTravel = hervat.page.locator('[data-rtg-module="travel"]');
      await hervatTravel.locator('.rtg-travel-option').first().waitFor();
      await hervatTravel.locator('.rtg-travel-option').first().click();
      assert.equal(await hervatTravel.locator('[data-rtg-travel-input="date"]').inputValue(), hervatDatum);
      assert.equal(await hervatTravel.locator('.rtg-travel-step output').textContent(), '3');
      await hervatTravel.locator('[data-rtg-travel-action="open-flow"]').click();
      const flow = hervat.page.frameLocator('iframe[src*="/apps/reisbureau.html?reis="]');
      await flow.locator('#rDatum').waitFor();
      assert.equal(await flow.locator('#rDatum').inputValue(), hervatDatum,
        'de volledige TravelOS-flow hervatte de bewaarde datum niet');
      assert.equal(await flow.locator('#rAantal').textContent(), '3',
        'de volledige TravelOS-flow hervatte het aantal reizigers niet');
      assert.equal(await flow.locator('#rNotitie').inputValue(), '',
        'vrije tekst werd onverwacht aan de volledige TravelOS-flow overgedragen');
      await hervatTravel.locator('[data-rtg-travel-action="remember"]').uncheck();
      await hervat.ctx.close();

      const desktop = await context(browser, srv.base, token, { width: 1440, height: 960 });
      const fouten = [];
      h.letOpFouten(desktop.page, fouten);
      let mutaties = 0;
      desktop.page.on('request', (request) => {
        const url = new URL(request.url());
        if (request.method() === 'POST' && url.pathname === '/api/reisbureau/boek') mutaties++;
      });
      await desktop.page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      const travel = desktop.page.locator('[data-rtg-module="travel"]');
      await travel.waitFor({ state: 'attached' });
      await travel.locator('.rtg-travel-option').first().waitFor();
      await travel.locator('.rtg-travel-option').first().click();
      const editContext = await desktop.page.evaluate(() => window.RTGAdaptief && window.RTGAdaptief.context());
      assert.equal(editContext.bron, 'workspace.travel');
      assert.ok(editContext.acties.includes('travel.request.review'));
      assert.ok(!editContext.acties.includes('travel.request.submit'));

      const datum = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);
      const wens = 'Rustige kamer, aankomst na 20:00 en Nederlands contact';
      await travel.locator('[data-rtg-travel-input="date"]').fill(datum);
      await travel.locator('[data-rtg-travel-input="note"]').fill(wens);
      assert.equal(await travel.locator('[data-rtg-travel-input="note"]').inputValue(), wens,
        'vrije tekst verloor focus of inhoud tijdens invoer');
      await travel.locator('[data-rtg-travel-action="plus"]').click();
      const bewijsMap = path.join(__dirname, '../artifacts/experience');
      fs.mkdirSync(bewijsMap, { recursive: true });
      await travel.screenshot({ path: path.join(bewijsMap, 'travel-spatial-request.png') });
      await travel.locator('[data-rtg-travel-action="review"]').click();
      await travel.getByRole('heading', { name: 'Controleer uw aanvraag' }).waitFor();
      const reviewContext = await desktop.page.evaluate(() => window.RTGAdaptief.context());
      assert.ok(reviewContext.acties.includes('travel.request.submit'));
      assert.ok(reviewContext.acties.includes('travel.request.edit'));
      assert.equal(mutaties, 0, 'Controleren verstuurde al een aanvraag');
      assert.match(await travel.innerText(), /Er wordt nu niets betaald of definitief geboekt/);
      assert.match(await travel.innerText(), /3 reizigers/);

      desktop.page.once('dialog', async (dialoog) => {
        assert.match(dialoog.message(), /reisaanvraag versturen/i);
        await dialoog.accept();
      });
      await travel.locator('[data-rtg-travel-action="submit"]').click();
      await travel.getByRole('heading', { name: 'Aanvraag ontvangen' }).waitFor();
      assert.equal(mutaties, 1, 'de bevestigde actie maakte niet precies één aanvraag');
      assert.match(await travel.innerText(), /Aangevraagd, nog niet bevestigd/);

      const aanvragen = (await api(srv.base, '/api/reisbureau/mijn', {}, token)).aanvragen;
      assert.equal(aanvragen.length, 1);
      assert.equal(aanvragen[0].personen, 3);
      assert.equal(aanvragen[0].vertrek, datum);
      assert.equal(aanvragen[0].notitie, wens);

      const opslag = await desktop.page.evaluate((gevoelig) => {
        const waarden = [];
        for (const opslag of [localStorage, sessionStorage]) {
          for (let i = 0; i < opslag.length; i++) waarden.push(String(opslag.getItem(opslag.key(i)) || ''));
        }
        return waarden.some((waarde) => waarde.includes(gevoelig));
      }, wens);
      assert.equal(opslag, false, 'vrije aanvraagtekst kwam in browseropslag terecht');
      assert.deepEqual(fouten, []);
      await desktop.ctx.close();

      // Houd de bestaande broncontrole even vast en wissel daarna het lokale
      // account. De oude werkruimte mag dan geen mutatie onder het nieuwe
      // credential uitvoeren.
      const wissel = await context(browser, srv.base, token, { width: 1440, height: 960 });
      let laatBronDoor, meldBron;
      const bronVrij = new Promise((resolve) => { laatBronDoor = resolve; });
      const bronGestart = new Promise((resolve) => { meldBron = resolve; });
      let wisselMutaties = 0;
      await wissel.page.route('**/api/reisbureau/mijn', async (route) => {
        meldBron(); await bronVrij; await route.continue();
      });
      wissel.page.on('request', (request) => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/reisbureau/boek') wisselMutaties++;
      });
      await wissel.page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      const wisselTravel = wissel.page.locator('[data-rtg-module="travel"]');
      await wisselTravel.locator('.rtg-travel-option').first().waitFor();
      await wisselTravel.locator('.rtg-travel-option').first().click();
      const wisselDatum = new Date(Date.now() + 49 * 86400000).toISOString().slice(0, 10);
      await wisselTravel.locator('[data-rtg-travel-input="date"]').fill(wisselDatum);
      await wisselTravel.locator('[data-rtg-travel-action="remember"]').check();
      await wissel.page.waitForFunction((datum) => (sessionStorage.getItem('rtg.intent.v1') || '').includes(datum), wisselDatum);
      await wisselTravel.locator('[data-rtg-travel-action="review"]').click();
      wissel.page.once('dialog', (dialoog) => dialoog.accept());
      const bronAntwoord = wissel.page.waitForResponse((response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/reisbureau/mijn');
      await wisselTravel.locator('[data-rtg-travel-action="submit"]').click();
      await bronGestart;
      await wissel.page.evaluate((t) => localStorage.setItem('rtg_member_token', t), anderToken);
      laatBronDoor(); await bronAntwoord;
      await wissel.page.waitForFunction(() => {
        const knop = document.querySelector('[data-rtg-module="travel"] [data-rtg-travel-action="submit"]');
        return knop && !knop.disabled;
      });
      assert.equal(wisselMutaties, 0, 'sessiewissel tussen broncontrole en mutatie werd niet gestopt');
      const anderAccountIntent = await wissel.page.evaluate(async (nieuwToken) => {
        const store = await window.RTGIntent.forSession(window, nieuwToken, 'travel');
        const rijen = store.list();
        return { rijen, opslag: sessionStorage.getItem('rtg.intent.v1') || '' };
      }, anderToken);
      assert.deepEqual(anderAccountIntent.rijen, [], 'een ander account kon de bewaarde reisintentie lezen');
      assert.doesNotMatch(anderAccountIntent.opslag, new RegExp(wisselDatum),
        'de reisintentie van het vorige account bleef na de eigenaarscontrole beschikbaar');
      const wisselTekst = await wisselTravel.innerText();
      assert.match(wisselTekst, /Controleer uw aanvraag/);
      assert.doesNotMatch(wisselTekst, /staat al een aanvraag open/, 'oude accountdata werd na de wissel geprojecteerd');
      await wissel.ctx.close();
    } finally {
      await browser.close().catch(() => {});
      await h.stop(srv.child || srv);
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
