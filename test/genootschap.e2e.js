/* Scherm-test voor Genootschap. De unit-toetsen (test/genootschap.test.js)
   bewijzen de server-kant; deze bewijst dat het scherm het doet: oprichten,
   een bijeenkomst uitroepen en beantwoorden, en een peiling waarvan de balk
   meebeweegt.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test('Genootschap: oprichten, een bijeenkomst uitroepen en een peiling houden',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-genoot-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Lid ' + t, email: 'v' + t + '@v.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1987-07-07', tier: 'rtg' });

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/genootschap.html', { waitUntil: 'domcontentloaded' });

    // 1. leeg begin
    await page.waitForFunction(() => /Je zit nog nergens in/.test(document.querySelector('#main').textContent), null, { timeout: 15000 });

    // 2. oprichten
    await page.click('[data-t="nieuw"]');
    await page.waitForSelector('#nnaam', { timeout: 10000 });
    await page.evaluate(() => {
      document.querySelector('#nnaam').value = 'Het Zeilgezelschap';
      document.querySelector('#nover').value = 'Wij varen, en daarna eten wij.';
      document.querySelector('#nsoort').value = 'besloten';
    });
    await page.click('#bnieuw');
    await page.waitForFunction(() => /Zeilgezelschap/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const mijn = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/Beheerder/.test(mijn), 'de oprichter is beheerder');

    // 3. het genootschap openen
    await page.click('[data-open]');
    await page.waitForSelector('#bwat', { timeout: 10000 });

    // 4. een bijeenkomst uitroepen
    await page.evaluate((d) => {
      document.querySelector('#bwat').value = 'Proefvaart';
      document.querySelector('#bdatum').value = d;
      document.querySelector('#bwaar').value = 'De haven';
    }, morgen());
    await page.click('#broep');
    await page.waitForFunction(() => /Proefvaart/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });

    // 5. ja zeggen, en de teller loopt op
    await page.click('[data-antw][data-w="ja"]');
    await page.waitForFunction(() => /ja 1/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });

    // 6. een peiling op het prikbord, en erop stemmen
    await page.evaluate(() => {
      document.querySelector('#ptekst').value = 'Welke avond komt het beste uit?';
      document.querySelector('#pkeuzes').value = 'Vrijdag, Zaterdag';
    });
    await page.click('#bprik');
    await page.waitForFunction(() => /Welke avond/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    await page.click('[data-stem]');
    await page.waitForFunction(() => /jouw stem/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const bord = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/1 stemmen/.test(bord), 'de peiling telt de stem: ' + bord.slice(0, 80));

    // 7. de agenda bundelt het over genootschappen heen
    await page.click('[data-t="agenda"]');
    await page.waitForFunction(() => /Proefvaart/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const agenda = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/Zeilgezelschap/.test(agenda), 'de groepsnaam staat bij de bijeenkomst');

    // 8. bijgepraat heeft een bodem, en inzicht telt de groep zonder ranglijst
    await page.click('[data-open]');
    await page.waitForSelector('#bgezond', { timeout: 10000 });
    await page.waitForFunction(() => {
      const u = document.querySelector('#ubij');
      return u && !/Kijken/.test(u.textContent);
    }, null, { timeout: 10000 });
    const bij = await page.evaluate(() => document.querySelector('#ubij').textContent);
    assert.ok(/Je bent bij/.test(bij), 'alles is van jezelf, dus je bent bij: ' + bij);

    await page.click('#bgezond');
    await page.waitForFunction(() => /actief/.test(document.querySelector('#ugezond').textContent), null, { timeout: 10000 });
    const gz = await page.evaluate(() => document.querySelector('#ugezond').textContent);
    assert.ok(/zonder reactie/.test(gz), 'de enige score gaat over de groep: ' + gz.slice(0, 120));
    assert.ok(/geen lijst van wie het meest/.test(gz), 'en het scherm zegt zelf waarom er geen ranglijst is');

    // 9. de AI-balk staat er en we zijn nergens heen genavigeerd
    const balk = await page.evaluate(() => !!document.querySelector('#aiform'));
    assert.equal(balk, true);
    assert.equal(await page.evaluate(() => location.pathname), '/apps/genootschap.html');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
