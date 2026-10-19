/* ============================================================================
   DE BETAALKNOP VAN EEN BEVESTIGDE REIS (K2, docs/domeinkaarten/travelos.md).

   Tot 19 oktober 2026 riep geen enkel scherm /api/reisbureau/betaal aan: een
   lid kon een reis die de reisadviseur bevestigde nergens zelf betalen. Nu
   staat in "Mijn aanvragen" bij elke bevestigde reis "Bevestigd, nog niet
   betaald" met een knop, en "Betaald" pas als de SERVER het zegt.

   WAT HIER ECHT LANGS DE SERVER GAAT, en wat niet:
     echt     een weigering (lege wallet: er beweegt niets, de knop blijft), en
              een antwoord dat verloren gaat NADAT de server betaalde (het
              scherm leest de stand terug en het saldo zakt precies een keer)
     scherm   het wachten op de bank (402 met pending) en de paspoortpoort
              (403 met kyc): die vorm komt van Geld (appwerkt/geld, /api/
              booking/pay en reisPoort) en staat nog niet op dit pad. Hier wordt
              alleen getoetst dat het scherm hem goed leest; de serverproef
              volgt als de rail er is.

   Draai: node --test test/reisbureau-betaalknop.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon, keurLidGoed, browserOpties, geenBrowser, laadPlaywright } = require('./helper');

const pw = laadPlaywright();
const CODE = 'KANTOOR-BETAALKNOP-1';

test('reisbureau: de betaalknop van een bevestigde reis, en Betaald alleen als de server het zegt',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-betaalknop-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const reg = await post('/api/auth/register', { name: 'Knop Reiziger', email: 'knop' + u + '@voorbeeld.test',
      phone: '06' + u, password: 'Geheim123!', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const lid = reg.body.token;
    assert.ok(lid, JSON.stringify(reg.body).slice(0, 200));
    await keurLidGoed(srv.base, lid, reg.body.state.user.codename, '1990-01-01');
    const kantoor = await kantoorAlsPersoon(srv.base, CODE);
    assert.ok(kantoor, 'de eigenaar staat als persoon in de backoffice');
    const ref = (await post('/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, lid)).body.aanvraag.ref;
    assert.equal((await post('/api/office/reisbureau/besluit', { ref, besluit: 'bevestigd', bericht: 'Bevestigd.' }, kantoor)).status, 200);
    const saldo = async () => (await post('/api/pay/overzicht', {}, lid)).body.saldo;
    const mijn = async () => ((await post('/api/reisbureau/mijn', {}, lid)).body.aanvragen || []).find(a => a.ref === ref);

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((tok) => {
      try { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', tok); } catch (e) {}
    }, lid);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const rij = page.locator('.aanvraag[data-ref="' + ref + '"]');
    const knop = rij.getByRole('button', { name: 'Betaal deze reis', exact: true });
    await page.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded' });

    /* 1. BEVESTIGD, NOG NIET BETAALD: de stand en de knop staan er. */
    await rij.getByText('Bevestigd, nog niet betaald', { exact: true }).waitFor({ timeout: 20000 });
    assert.equal(await knop.count(), 1, 'de knop staat bij de bevestigde reis');

    /* 2. WEIGERING, ECHT: de wallet is leeg. Er beweegt niets, het scherm zegt
       waarom, en de knop blijft voor een tweede poging. */
    const leeg = await saldo();
    await knop.click();
    await rij.locator('[role="alert"]').waitFor({ timeout: 15000 });
    assert.match(await rij.locator('[role="alert"]').innerText(), /onvoldoende saldo/i, 'het scherm zegt waarom');
    assert.equal(await rij.locator('[data-stand="betaald"]').count(), 0, 'een weigering heet geen betaling');
    assert.equal(await knop.count(), 1, 'na een weigering staat de knop er weer');
    assert.equal(await saldo(), leeg, 'een weigering beweegt geen cent');
    assert.ok(!(await mijn()).betaald, 'de server kent geen betaling');

    /* 3. WACHTEN OP DE BANK (vorm van Geld): geen knop, geen Betaald. */
    await page.route('**/api/reisbureau/betaal', (r) => r.fulfill({ status: 402, contentType: 'application/json',
      body: JSON.stringify({ pending: true, error: 'De betaling wacht op bevestiging. Betaal niet opnieuw.' }) }));
    await knop.click();
    await rij.locator('[data-stand="wacht"]').waitFor({ timeout: 15000 });
    assert.match(await rij.locator('[data-stand="wacht"]').innerText(), /^Wacht op bevestiging/);
    assert.equal(await knop.count(), 0, 'wie wacht, krijgt geen tweede knop');
    assert.equal(await rij.locator('[data-stand="betaald"]').count(), 0);
    await page.unroute('**/api/reisbureau/betaal');

    /* 4. DE PASPOORTPOORT (vorm van Geld): het scherm wijst de weg. */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await knop.waitFor({ timeout: 20000 });
    await page.route('**/api/reisbureau/betaal', (r) => r.fulfill({ status: 403, contentType: 'application/json',
      body: JSON.stringify({ kyc: true, error: 'RTG Pay vraagt eenmalig je paspoort.' }) }));
    await knop.click();
    await rij.getByRole('link', { name: 'Laat zien wie u bent', exact: true }).waitFor({ timeout: 15000 });
    assert.equal(await rij.getByRole('link', { name: 'Laat zien wie u bent' }).getAttribute('href'), '/apps/verificatie.html');
    await page.unroute('**/api/reisbureau/betaal');

    /* 5. HET ANTWOORD GAAT VERLOREN NADAT DE SERVER BETAALDE: het scherm leest
       de stand terug en zegt Betaald, want de server zegt het. Een keer betaald. */
    assert.equal((await post('/api/pay/oplaad', { centen: 300000, idem: 'knop-op-' + u }, lid)).status, 200);
    const voor = await saldo();
    await page.route('**/api/reisbureau/betaal', async (r) => { await r.fetch(); await r.abort('failed'); });
    await knop.click();
    await rij.locator('[data-stand="betaald"]').waitFor({ timeout: 15000 });
    await page.unroute('**/api/reisbureau/betaal');
    const a = await mijn();
    assert.ok(a.betaald && a.betaald.centen > 0, 'de server kent de betaling');
    assert.equal(await saldo(), voor - a.betaald.centen, 'precies een keer afgeschreven');
    assert.match(await rij.locator('[data-stand="betaald"]').innerText(), /^Betaald/);
    assert.equal(await knop.count(), 0, 'een betaalde reis heeft geen knop meer');

    /* En een tweede keer via de server: geen tweede afschrijving. */
    const weer = await post('/api/reisbureau/betaal', { ref }, lid);
    assert.equal(weer.status, 200);
    assert.equal(weer.body.alBetaald, true);
    assert.equal(await saldo(), voor - a.betaald.centen);

    assert.deepEqual(fouten.filter((f) => !/40[23]|Failed to load resource|net::ERR_FAILED/.test(f)), [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
