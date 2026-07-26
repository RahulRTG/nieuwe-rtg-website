/* Scherm-test voor Genootschap. De unit-toetsen (test/genootschap.test.js)
   bewijzen de server-kant; deze bewijst dat het scherm het doet: oprichten,
   een bijeenkomst uitroepen en beantwoorden, en een peiling waarvan de balk
   meebeweegt.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test('Genootschap: oprichten, een bijeenkomst uitroepen en een peiling houden',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-genoot-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Lid ' + t, email: 'v' + t + '@v.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1987-07-07', tier: 'rtg' });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    if (page.on) page.on('pageerror', e => fouten.push(e.message));
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/genootschap.html', { waitUntil: 'load' });

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

    // 8. de AI-balk staat er en we zijn nergens heen genavigeerd
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
