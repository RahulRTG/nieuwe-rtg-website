/* De leverancierdeur in een echte browser: productie-UI vraagt geen
   viercijferige staff-PIN en het hoofdformulier belt uitsluitend aan bij de
   persoonlijke RTG-accountingang. De server draait in Magnaat Test zodat een
   bestaand persoonlijk personeelsaccount beschikbaar is; juist dan bewijst de
   toets dat de normale UI niet stil naar de legacy fixture terugvalt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser,
  letOpFouten, wachtTot } = require('./helper');

const pw = laadPlaywright();

test('leverancierdeur gebruikt zichtbaar alleen het persoonlijke RTG-account',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const verzoeken = [];
    page.on('request', r => { if (r.method() === 'POST') verzoeken.push(new URL(r.url()).pathname); });
    await page.goto(srv.base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const deur = await page.evaluate(() => ({
      tekst: document.getElementById('gate').innerText.replace(/\s+/g, ' '),
      pinInUitnodiging: !!document.getElementById('enPin'),
      pinKiezerZichtbaar: getComputedStyle(document.getElementById('spPin')).display !== 'none'
    }));
    assert.match(deur.tekst, /persoonlijke RTG-account|personal RTG account/i);
    assert.equal(deur.pinInUitnodiging, false);
    assert.equal(deur.pinKiezerZichtbaar, false);
    assert.doesNotMatch(deur.tekst, /pincode|personeelspin|manager-pin/i);

    await page.fill('.rp-rij input', 'nora@rtg.example');
    await page.press('.rp-rij input', 'Enter');
    await page.waitForFunction(() => document.querySelector('.rp-rij input').type === 'password');
    await page.fill('.rp-rij input', 'werk');
    await page.press('.rp-rij input', 'Enter');
    await wachtTot(page, () => window.localStorage.getItem('rtg_sup_token'), null,
      { wat: 'persoonlijke supplier-sessie' });
    assert.ok(verzoeken.includes('/api/supplier/mijn/login'));
    assert.equal(verzoeken.includes('/api/supplier/login'), false,
      'het normale formulier gebruikt nooit de legacy PIN-/gedeelde ingang');
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});
