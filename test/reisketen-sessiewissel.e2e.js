/* Echte bronantwoorden mogen niet over een leden-/tabwissel heen tekenen.
   Alleen aflevering van het bestaande HTTP-antwoord wordt vertraagd. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');

test('reiziger verwerpt oud sessieantwoord en wisselt via een echt tweede tabblad', async t => {
  const pw = h.laadPlaywright({ eigenDriver: false });
  assert.ok(pw && pw.chromium, 'Chromium is verplicht, deze grens mag niet worden overgeslagen');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-sessiewissel-'));
  const srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  let browser, vrij;
  try {
    const x = await maakReisketenFixture(srv.base), pad = '/api/reisbureau/keten';
    const a = goed(await x.api(pad + '/start', { titel: 'Alleen van eerste reiziger', bestemming: 'Ibiza',
      idem: 'sessie-a' }, x.reiziger.token), 'eerste aanvraag').reis;
    const b = goed(await x.api(pad + '/start', { titel: 'Alleen van tweede reiziger', bestemming: 'Utrecht',
      idem: 'sessie-b' }, x.anderLid.token), 'tweede aanvraag').reis;
    browser = await h.startBrowser(pw); t.diagnostic('Chromium ' + browser.version());
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const page = await ctx.newPage(), fouten = h.letOpFouten(page, []);
    // Alleen voor de eerste pagina initialiseren: een reload moet de nieuwe
    // echte opslag lezen, niet door de proef het oude token terugkrijgen.
    await page.goto(srv.base + '/manifest.webmanifest');
    await page.evaluate(token => { localStorage.setItem('rtg_member_token', token);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, x.reiziger.token);
    let bronGelezen, afgegeven, telling = 0;
    const bron = new Promise(r => { bronGelezen = r; });
    const klaar = new Promise(r => { afgegeven = r; });
    const wacht = new Promise(r => { vrij = r; });
    await page.route('**/api/reisbureau/keten', async route => {
      telling++;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      assert.ok((await response.json()).reizen.some(r => r.ref === a.ref));
      bronGelezen(); await wacht;
      await route.fulfill({ response }); afgegeven();
    });
    await page.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded' });
    await bron;
    // Een lokale wissel triggert in ditzelfde tabblad geen storage-event:
    // juist daarom moet ook de antwoordgrens zelf de opslag hercontroleren.
    await page.evaluate(token => localStorage.setItem('rtg_member_token', token), x.anderLid.token);
    vrij(); await klaar;
    const host = page.locator('#reisKeten');
    await host.getByRole('status').filter({ hasText: 'Uw sessie is gewijzigd' }).waitFor();
    assert.equal((await host.innerText()).includes(a.titel), false);
    assert.equal(await host.locator('form').isVisible(), false);
    await host.getByRole('button', { name: 'Controleer mijn reiscontracten' }).click();
    await page.waitForFunction(() => !document.querySelector('[data-keten-actie="ververs"]').disabled);
    assert.equal(telling, 1, 'er volgt geen tweede netwerkverzoek onder het oude token');
    await page.unroute('**/api/reisbureau/keten');
    const tweedeTab = await ctx.newPage();
    await tweedeTab.goto(srv.base + '/manifest.webmanifest');
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      tweedeTab.evaluate(() => localStorage.removeItem('rtg_member_token'))]);
    await page.waitForFunction(() => !document.body.hidden);
    assert.equal((await page.locator('body').innerText()).includes(a.titel), false);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      tweedeTab.evaluate(token => localStorage.setItem('rtg_member_token', token), x.anderLid.token)]);
    await page.getByRole('heading', { name: b.titel, exact: true }).waitFor();
    assert.equal((await page.locator('#reisKeten').innerText()).includes(a.titel), false);
    assert.deepEqual(fouten, [], 'geen paginafouten bij echte sessie-/tabwisseling');
    await ctx.close();
  } finally {
    if (vrij) vrij();
    if (browser) await browser.close();
    await h.stop(srv); fs.rmSync(map, { recursive: true, force: true });
  }
});
