/* Schermtoets voor apps/tijdlijn.html.

   De belofte van dit scherm is dat het NIETS verzint: wat er staat komt uit een
   laag die het lid al had, en er wordt geen verband en geen score bij verzonnen.
   Dat wordt hier op het scherm zelf nagekeken, plus het ding dat een tijdlijn
   uniek gevaarlijk maakt: een gat leest als "toen gebeurde er niets", dus een
   kapotte laag hoort zichtbaar te zijn en niet stil.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test('Tijdlijn: alleen wat er echt was, met de laag waar het vandaan komt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tlscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tijd Lid', email: 'tlscherm@x.nl', phone: '0612345922',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');
    const api = (pad, body) => fetch(base + '/api/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {}) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);

    /* 1. leeg is leeg, en zegt dat ook: geen lege lijst zonder uitleg. */
    await page.goto(base + '/apps/tijdlijn.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const e = document.getElementById('lijst');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, { timeout: 15000 });
    assert.match(await page.textContent('#lijst'), /nog niets op uw tijdlijn/i);
    assert.equal(await page.textContent('#storingen'), '', 'en geen storing op een gezond systeem');

    /* 2. een doel via de doelen-deur verschijnt op de tijdlijn, met zijn laag en
       zijn herkomst -- zonder dat het hier is ingetikt. */
    await api('doelen/maak', { titel: '10 kilometer hardlopen', reden: 'ik wil het kunnen',
      eenheid: 'km', nulmeting: 2, streef: 10, streefOp: overDagen(60) });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /10 kilometer/.test(document.getElementById('lijst').textContent),
      { timeout: 15000 });

    const lijst = await page.textContent('#lijst');
    assert.match(lijst, /Begonnen: 10 kilometer hardlopen/);
    assert.match(lijst, /zelf/, 'de herkomst staat erbij');
    assert.ok(await page.locator('#lijst a[href*="doelen"]').count(),
      'en er staat een weg naar de app waar het thuishoort');
    assert.ok(await page.locator('#lijst .maand h3').count(), 'met een maandkop erboven');

    /* 3. nergens een verband of een score op het scherm. */
    assert.ok(!/doordat|waardoor|verband|score|trend|percentiel/i.test(lijst),
      'geen verband en geen score in de regels: ' + lijst.slice(0, 120));

    /* 4. EEN KAPOTTE LAAG MOET TE ZIEN ZIJN. Zonder deze stap toetste stap 1
       alleen dat er GEEN storing staat op een gezond systeem -- en dan mag het
       scherm ze net zo goed weggooien. Hier zegt de motor dat er een laag stuk
       is, en dan hoort dat bovenaan te staan, want een gat in een tijdlijn leest
       als "toen gebeurde er niets". */
    await page.route('**/api/tijdlijn', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, vandaag: overDagen(0), maanden: [], aantal: 0, leeg: true,
        uitleg: 'x', storingen: ['De laag Zorg gaf een fout.'] })
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /De laag Zorg/.test(document.getElementById('storingen').textContent),
      { timeout: 10000 });
    assert.match(await page.textContent('#storingen'), /niet compleet/i,
      'met erbij dat wat eronder staat daardoor niet compleet is');
    await page.unroute('**/api/tijdlijn');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
