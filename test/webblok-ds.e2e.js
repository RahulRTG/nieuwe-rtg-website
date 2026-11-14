/* Gepubliceerde auteursblokken en een echt bericht, op een eigen server. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, beeld } = require('./lib/ds-toets');
const { auteursOntwerp } = require('./lib/webblok-fixture');
const { beginConcept, bereikbaar, berichtProef } = require('./lib/webblok-formulier');
const pw = laadPlaywright();

test('gepubliceerde webblokken behouden auteursinhoud, toestellen en het echte zaakformulier',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-webblok-ds-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1',
      LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
    async function post(url, body, token) {
      const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
      const j = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(j)); return j;
    }
    const roster = await post('/api/supplier/roster', { code: 'ESVEDRA' });
    const manager = roster.staff.find(s => s.role === 'manager'); assert.ok(manager);
    const zaak = (await post('/api/supplier/login', { code: 'ESVEDRA', staffId: manager.id, pin: '1234' })).token;
    const ontwerp = auteursOntwerp();
    const opgeslagen = await post('/api/supplier/site/bewaar', { design: ontwerp }, zaak);
    assert.equal(opgeslagen.ok, true); assert.equal(opgeslagen.design.blokken.length, 13);
    const online = await post('/api/supplier/site/publiceer', { id: opgeslagen.design.id, adres: 'webblokproef' }, zaak);
    assert.equal(online.ok, true); assert.ok(online.adres);
    const lid = (await post('/api/auth/register', { name: 'Webblokbezoeker', email: 'webblok@proef.test',
      phone: '0612345678', password: 'webblokgeheim12', geboortedatum: '1990-01-01', tier: 'rtg' })).token;
    assert.ok(lid && zaak);
    const publiek = await post('/api/browser/open', { adres: online.adres }, lid);
    assert.equal(publiek.ok, true); assert.ok(publiek.zaak);
    assert.deepEqual(publiek.site.kleuren, ontwerp.kleuren);
    const gewoneTekst = publiek.site.blokken.find(b => b.id === 'tekst').tekst;

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      await ctx.addInitScript(token => {
        localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, lid);
      const page = await ctx.newPage(), fouten = letOpFouten(page, []);
      await page.goto(srv.base + '/apps/browser.html?adres=' + online.adres, { waitUntil: 'domcontentloaded' });
      const doek = page.locator('#hoofd .ds-webblok'); await doek.waitFor();
      await page.waitForFunction(() => document.body.dataset.rtgDesktopState === 'ready');
      await page.waitForFunction(() => [...document.querySelectorAll('.ds-webblok img')]
        .every(img => img.complete && img.naturalWidth > 0));
      await alleenDs(page);
      const controleerConcept = await beginConcept(doek);
      for (const [breedte, versie, aantal, koppen] of [
        [390, 'telefoon', 12, ['Schrijf ons', 'Kop telefoon', 'Welkom bij de proef']],
        [820, 'tablet', 12, ['Kop tablet', 'Schrijf ons', 'Welkom bij de proef']],
        [1280, 'desktop', 13, ['Welkom bij de proef', 'Kop desktop']]
      ]) {
        await page.setViewportSize({ width: breedte, height: 900 });
        await page.waitForFunction(v => document.querySelector('.ds-webblok')?.dataset.ver === v, versie);
        const blokken = doek.locator(':scope > .ds-webblok__blok');
        assert.equal(await blokken.count(), aantal, versie + ': zichtbare blokvolgorde');
        assert.deepEqual(await blokken.evaluateAll((els, n) => els.slice(0, n)
          .map(el => el.querySelector('h1,h2')?.textContent), koppen.length), koppen);
        assert.equal(await doek.locator('.b-citaat').count(), versie === 'telefoon' ? 0 : 1);
        assert.equal(await doek.locator('.b-voet').count(), versie === 'tablet' ? 0 : 1);
        assert.equal(await doek.locator('.b-beeld img').getAttribute('alt'), versie === 'telefoon' ? 'Eigen mobiel beeld' : 'Eigen beeld');
        const maten = await doek.evaluate(el => {
          const stijl = getComputedStyle(el), ruimte = [...el.children].find(n => n.style.blockSize);
          return { bg: stijl.backgroundColor, inkt: stijl.color, kaart: stijl.getPropertyValue('--ds-webblok-kaart').trim(),
            accent: getComputedStyle(el.querySelector('.b-knop')).backgroundColor,
            ruimte: ruimte?.getBoundingClientRect().height, hoogtestijl: ruimte?.style.blockSize,
            kolommen: getComputedStyle(el.querySelector('.b-kol')).gridTemplateColumns.split(' ').length,
            breed: el.clientWidth, inhoud: el.scrollWidth };
        });
        assert.equal(maten.bg, 'rgb(245, 239, 226)'); assert.equal(maten.inkt, 'rgb(37, 48, 68)');
        assert.equal(maten.accent, 'rgb(26, 107, 78)'); assert.equal(maten.kaart, '#dfe5d1');
        assert.equal(maten.ruimte, 73); assert.equal(maten.hoogtestijl, '73px');
        assert.equal(maten.kolommen, maten.breed <= 640 ? 1 : 2);
        assert.ok(maten.inhoud <= maten.breed, versie + ': auteursdoek loopt niet horizontaal over');
        assert.equal(await doek.getByText(gewoneTekst, { exact: true }).count(), 1);
        assert.equal(await doek.locator('script,a').count(), 0, 'geen actieve auteurs-HTML of links');
        assert.equal(await doek.locator('.b-gal img').count(), 2);
        await controleerConcept(); await bereikbaar(doek);
        await beeld(page, 'webblok-' + breedte);
      }
      for (const tekst of ['Linker kolom', 'Rechter kolom', 'Citaat van de maker', 'De auteur',
        'Voettekst van de maker', 'Wanneer open?', 'Morgen om tien uur.', 'Proefdienst', '€ 12', 'Per uur'])
        assert.equal(await doek.getByText(tekst, { exact: true }).isVisible(), true, tekst);
      const url = page.url(), ctas = doek.locator('.b-hero .b-knop,.b-knoprij .b-knop');
      assert.deepEqual(await ctas.evaluateAll(els => els.map(el => el.tagName)), ['SPAN', 'SPAN']);
      await doek.locator('.b-knoprij .b-knop').click();
      assert.equal(page.url(), url); assert.equal(await page.evaluate(() => window.__webblokXss), undefined);

      // Tekstvergroting en een laag scherm mogen de bestaande bediening niet bedekken.
      const letter = await doek.locator('textarea').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      for (const [width, versie] of [[390, 'telefoon'], [820, 'tablet'], [1280, 'desktop']]) {
        await page.setViewportSize({ width, height: 480 });
        await page.waitForFunction(v => document.querySelector('.ds-webblok')?.dataset.ver === v, versie);
        assert.ok(await doek.locator('textarea').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) >= letter * 1.9);
        await bereikbaar(doek);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForFunction(() => document.querySelector('.ds-webblok')?.dataset.ver === 'telefoon');
      await berichtProef(page, post, zaak, online.adres);
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  } finally {
    if (browser) await browser.close();
    if (srv) await stop(srv.child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
