/* Schermtoets voor het oude adres van Vandaag. Dat was een eigen dagscherm met
   verzonnen momenten naast RTG Life, en is sinds de consolidatieronde van 23
   september 2026 (SCHERMEIGENAAR.json: dag.overzicht -> life.html) een
   doorverwijzing. Een bladwijzer moet dus op Life uitkomen, en daar moeten de
   ingangen staan die alleen op Vandaag stonden: de Agenda, wat onderweg is, en
   de avond. Die drie zijn op telefoonformaat een raakvlak van minstens 24x24
   (WCAG 2.5.8) -- de toegankelijkheidsronde vond ze eerst op 20px.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Vandaag: het oude adres komt op RTG Life uit, met de ingangen naar agenda, bestellingen en avond',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vandaag-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Vandaag Lid', email: 'vandaagomleiding@x.nl', phone: '0612345867',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/vandaag.html', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/apps\/life\.html$/, { timeout: 15000 });
    await page.waitForSelector('a.heen[href="/apps/agenda.html"]', { timeout: 15000 });

    const heen = await page.$$eval('a.heen', as => as
      .filter(a => a.offsetParent !== null)
      .map(a => { const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), w: r.width, h: r.height }; }));
    for (const doel of ['/apps/agenda.html', '/apps/mijnmall.html', '/apps/leven.html']) {
      const a = heen.find(x => x.href === doel);
      assert.ok(a, 'Life draagt de ingang naar ' + doel + ' die eerst alleen op Vandaag stond');
      assert.ok(a.w >= 24 && a.h >= 24, doel + ' is een raakvlak van ' + Math.round(a.w) + 'x' + Math.round(a.h) + ', onder 24x24');
    }
    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
