/* REIZEN & VEILIG ZONDER SCHIJNINHOUD -- in een echte browser, op een echte server.

   De werkruimte toonde drie dingen die niet uit de data kwamen:
   - "Uw eerstvolgende moment · LIVE" was een vaste regel "Nu: Vertrek plannen",
     voor elk lid gelijk, ook voor wie morgen om acht uur een afspraak heeft;
   - het reisblad had twee reizen met een vaste prijs in de OPMAAK (Ibiza,
     Gstaad), los van de catalogus van het Reisbureau;
   - het veld "Waar hebt u zin in?" met de knop Adviseer gooide de wens weg en
     opende alleen Mijn reizen.

   Nu komt het moment uit RTG Move (/api/move/volgende), het aanbod uit
   /api/reisbureau, en gaat de wens mee naar het Reisbureau -- de eigenaar van
   reisadvies -- waar hij ingevuld klaarstaat en NIETS wordt verstuurd tot het
   lid zelf drukt. Deze toets loopt alle drie af, plus de stand zonder reis.

   Draai los: node --test test/reizen-veilig.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, wachtOpNetstilte } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/reizen-veilig.html';
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function post(base, pad, lijf, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
}

async function proeflid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'rvv' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(r.status, 200, 'proeflid: ' + JSON.stringify(r.data));
  return r.data.token;
}

async function blad(browser, token) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'nl-NL', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  await page.addInitScript(t => {
    try { localStorage.setItem('rtg_cookieinfo_v1', '1'); if (t) localStorage.setItem('rtg_member_token', t); } catch (e) {}
  }, token || '');
  return { ctx, page, fouten };
}

test('Reizen & Veilig toont het echte volgende moment, het echte aanbod en geeft de wens door',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  let browser;
  try {
    const base = srv.base;
    const tok = await proeflid(base);
    const bk = await post(base, '/api/booking/request', { supplierCode: 'KAITO', serviceId: 's1', date: morgen(), time: '08:00' }, tok);
    assert.equal(bk.status, 200, 'boeking: ' + JSON.stringify(bk.data));
    assert.equal((await post(base, '/api/booking/pay', { ref: bk.data.boeking.ref }, tok)).status, 200, 'betaald');

    const volg = await post(base, '/api/move/volgende', {}, tok);
    assert.ok(volg.data && volg.data.volgende, 'Move kent een volgend onderdeel');
    const catalogus = (await post(base, '/api/reisbureau', {}, tok)).data.reizen || [];
    assert.ok(catalogus.length > 0, 'de zaaiset heeft samengestelde reizen');

    browser = await pw.chromium.launch(browserOpties(pw));
    const { ctx, page, fouten } = await blad(browser, tok);
    const adviesVragen = [];
    page.on('request', r => { if (r.url().includes('/api/reisbureau/advies')) adviesVragen.push(r.url()); });
    await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
    /* DE EINDSTAND VAN HET SCHERM, NIET EEN TUSSENSTAND. De Edge-laag
       (shared/rtg-adaptive-edge-loader.js) komt asynchroon op, en zodra hij er
       is verbergt shared/rtg-adaptive-edge.css de eigen balk .rv-bank: de Edge
       neemt de bediening over. Wie eerder klikt, klikt op een tussenstand -- en
       of hij die haalt hangt af van de runner. Op de CI viel dat eens verkeerd
       uit (#631, schermtoetsen deel 3: '.rv-bank [data-open=reisblad]' "not
       visible" na 15 s). Dus eerst wachten tot de Edge er staat. */
    await page.waitForSelector('body[data-rtg-adaptive-ready="true"]', { timeout: 20000 });

    /* 1. HET MOMENT KOMT UIT MOVE: de titel van het echte onderdeel. */
    const moment = page.locator('.rv-pane[data-id=overzicht] [data-volgende] .rv-lijn').first();
    await page.waitForFunction(t => {
      const v = document.querySelector('.rv-pane[data-id=overzicht] [data-volgende]');
      return v && v.textContent.includes(t);
    }, volg.data.volgende.titel, { timeout: 20000 });
    assert.equal(await page.locator('.rv-momentkop em').count(), 0, 'geen LIVE-label boven een regel die niet live is');

    /* Navigeer erheen opent Navigatie met de OPGELOSTE plek. */
    await moment.locator('[data-navigeer]').click();
    const nav = page.locator('.rv-pane[data-id=navigatie] iframe');
    await nav.waitFor({ state: 'attached', timeout: 10000 });
    const navSrc = await nav.getAttribute('src');
    const naar = new URL(navSrc, base).searchParams.get('naar') || '';
    const [lat, lng] = naar.split(',').map(Number);
    assert.ok(Math.abs(lat - volg.data.volgende.plek.lat) < 1e-9 && Math.abs(lng - volg.data.volgende.plek.lng) < 1e-9,
      'Navigatie krijgt exact de plek van Move mee: ' + navSrc);

    /* 2. HET AANBOD KOMT UIT DE CATALOGUS. */
    /* Langs de Edge, zoals een lid het in de eindstand ziet: Acties, dan Reizen. */
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
    await page.locator('.rtg-adaptive-controls button', { hasText: 'Reizen' }).first().click({ timeout: 15000 });
    const kaarten = page.locator('.rv-pane[data-id=reisblad] [data-reisaanbod] .rv-reiskaart');
    await kaarten.first().waitFor({ timeout: 15000 });
    assert.equal(await kaarten.count(), Math.min(3, catalogus.length), 'een kaart per reis uit de catalogus (hoogstens drie)');
    const titels = await kaarten.locator('h2').allTextContents();
    assert.deepEqual(titels, catalogus.slice(0, 3).map(r => r.titel), 'de titels zijn die van de catalogus, in die volgorde');
    const prijzen = await kaarten.locator('em').allTextContents();
    assert.deepEqual(prijzen.map(t => Number(t.replace(/[^0-9]/g, ''))),
      catalogus.slice(0, 3).filter(r => r.prijs > 0).map(r => Math.round(r.prijs)),
      'de prijs komt uit de catalogus en niet uit de opmaak: ' + JSON.stringify(prijzen));

    /* 2b. EEN KAART OPENT DIE REIS in het Reisbureau, langs ?reis=. */
    await kaarten.first().locator('[data-reis]').click();
    const rbKaart = page.locator('.rv-pane[data-id=reisbureau] iframe');
    await rbKaart.waitFor({ state: 'attached', timeout: 10000 });
    assert.equal(new URL(await rbKaart.getAttribute('src'), base).searchParams.get('reis'), catalogus[0].id, 'de reis-id reist mee');
    await page.frameLocator('.rv-pane[data-id=reisbureau] iframe').locator('#bladNaam')
      .filter({ hasText: catalogus[0].titel }).waitFor({ timeout: 20000 });

    /* 3. DE WENS GAAT MEE NAAR HET REISBUREAU en wordt daar niet verstuurd. */
    await page.locator('.rv-pane[data-id=reisblad] [data-wens] input').fill('rust aan zee');
    await page.locator('.rv-pane[data-id=reisblad] [data-wens] button').click();
    const rb = page.locator('.rv-pane[data-id=reisbureau] iframe');
    await rb.waitFor({ state: 'attached', timeout: 10000 });
    assert.match(await rb.getAttribute('src'), /reisbureau\.html\?wens=rust(%20|\+)aan(%20|\+)zee/, 'de wens reist mee');
    /* Het paneel stond al open (de kaart hierboven) en laadt opnieuw: er wordt
       gewacht tot HET NIEUWE document de wens draagt, niet het oude. */
    await page.waitForFunction(() => {
      const f = document.querySelector('.rv-pane[data-id=reisbureau] iframe');
      const doc = f && f.contentDocument;
      const veld = doc && doc.querySelector('#adviesIn');
      return !!veld && /wens=/.test(f.contentWindow.location.search) && veld.value === 'rust aan zee'
        && !doc.querySelector('#travelAdvice').hidden;
    }, null, { timeout: 20000 });
    /* Ook niet een tel later: een uitgestelde vraag is net zo goed een vraag. Wachten tot
       het netwerk twee seconden stil ligt, en niet op een vaste tijd. */
    await wachtOpNetstilte(page, { stilMs: 2000, maxMs: 8000 });
    assert.deepEqual(adviesVragen, [], 'er is geen advies opgevraagd: drukken doet het lid daar zelf');

    assert.deepEqual(fouten, [], 'geen paginafout');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});

test('zonder reis zegt Reizen & Veilig waarom er geen volgend moment is, met de reden van Move',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  let browser;
  try {
    const tok = await proeflid(srv.base);
    const volg = await post(srv.base, '/api/move/volgende', {}, tok);
    assert.equal(volg.data.volgende, null, 'een vers lid heeft geen volgend onderdeel');
    browser = await pw.chromium.launch(browserOpties(pw));
    const { ctx, page, fouten } = await blad(browser, tok);
    await page.goto(srv.base + SCHERM, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(w => {
      const v = document.querySelector('.rv-pane[data-id=overzicht] [data-volgende]');
      return v && v.textContent.includes(w);
    }, volg.data.waarom, { timeout: 20000 });
    const tekst = await page.locator('.rv-pane[data-id=overzicht] [data-volgende]').textContent();
    assert.match(tekst, /geen komend onderdeel/i, 'het zegt dat er niets komt: "' + tekst + '"');
    assert.doesNotMatch(tekst, /navigeer/i, 'en biedt geen route naar een verzonnen plek');
    assert.equal(await page.locator('.rv-pane[data-id=overzicht] [data-volgende] [data-navigeer]').count(), 0,
      'er staat ook geen navigeerknop onder een andere naam');
    await page.locator('.rv-pane[data-id=overzicht] [data-volgende] [data-move]').click();
    await page.locator('.rv-pane[data-id=move] iframe').waitFor({ state: 'attached', timeout: 10000 });
    assert.deepEqual(fouten, [], 'geen paginafout');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});
