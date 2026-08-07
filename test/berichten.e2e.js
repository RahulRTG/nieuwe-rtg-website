/* Scherm-test voor de communicatie-app. De unit-toetsen (test/berichten.test.js,
   test/comm-dm.test.js) bewijzen de server-kant; deze bewijst dat de APP het ook
   echt doet in een browser: de lijst komt op, een gesprek opent IN de app (dat
   was het hele punt -- hij verwees vroeger alleen door), een eigen bericht staat
   aan de goede kant, en zoeken over alle gesprekken werkt.

   DE APP IS VERHUISD. Deze toets stuurde /apps/berichten.html aan, en die is
   opgegaan in de ene communicatie-app (/apps/comm.html) waar bellen en
   videobellen ook in zitten. De EIS is niet veranderd, de kiezers wel: geen
   [data-open]/#draad/#zoekveld meer maar .gsp/.bubbels/#zoek. Een toets die
   meeverhuist met de app die hij bewaakt hoort erbij; hem laten staan op een
   pagina die alleen nog doorstuurt zou een groene uitslag geven over niets.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
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

test('de communicatie-app: de lijst komt op, het gesprek opent in de app en zoeken werkt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-berichten-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // twee leden, verbonden, met een gesprek ertussen
    const maak = async (n) => {
      const t = Date.now() + '' + n;
      return (await api(base, '/api/auth/register', { name: 'Lid ' + t, email: 'e' + t + '@v.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' })).token;
    };
    const a = await maak(1), b = await maak(2);
    const mijA = await api(base, '/api/member/connections', {}, a);
    const mijB = await api(base, '/api/member/connections', {}, b);
    await api(base, '/api/member/connect', { key: mijB.me }, a);
    await api(base, '/api/member/connect/respond', { key: mijA.me, action: 'accept' }, b);
    await api(base, '/api/member/dm/send', { toKey: mijB.me, text: 'De boot vertrekt om negen uur' }, a);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, a);
    // via het oude pad, zodat de omleiding meteen meegetoetst is
    await page.goto(base + '/apps/berichten.html', { waitUntil: 'load' });
    await page.waitForURL(/\/apps\/comm\.html/, { timeout: 10000 });

    // 1. de lijst komt op, met het prive-gesprek erin
    await page.waitForSelector('.gsp', { timeout: 15000 });
    const lijst = await page.evaluate(() => document.getElementById('gesprekken').textContent);
    assert.ok(/boot vertrekt/.test(lijst), 'het laatste bericht staat in de lijst: ' + lijst.slice(0, 120));

    // 2. het gesprek opent IN de app (geen doorverwijzing naar een andere pagina)
    await page.click('.gsp');
    await page.waitForSelector('.bubbels .bub', { timeout: 10000 });
    assert.equal(await page.evaluate(() => location.pathname), '/apps/comm.html', 'we zijn weggenavigeerd');
    const draad = await page.evaluate(() => document.querySelector('.bubbels').textContent);
    assert.ok(/boot vertrekt/.test(draad), 'het bericht staat niet in de draad');
    // het is MIJN bericht, dus de bel staat aan mijn kant
    assert.equal(await page.evaluate(() => !!document.querySelector('.bubbels .bub.van-mij')), true,
      'mijn eigen bericht staat niet aan mijn kant');

    // 3. de drie AI-knoppen staan op het gesprek (de server zegt netjes nee zonder sleutel)
    for (const taak of ['samenvat', 'concept', 'afspraken']) {
      assert.equal(await page.evaluate((t) => !!document.querySelector('[data-ai="' + t + '"]'), taak), true,
        'de AI-knop ' + taak + ' staat niet op het gesprek');
    }

    // 4. bellen en videobellen zitten in de kop van het gesprek en niet in een eigen app
    for (const id of ['#belBtn', '#vidBtn']) {
      assert.equal(await page.evaluate((s) => !!document.querySelector(s), id), true,
        'de knop ' + id + ' ontbreekt in de kop van het gesprek');
    }

    // 5. zoeken over alle gesprekken
    await page.evaluate(() => {
      const v = document.getElementById('zoek');
      v.value = 'boot'; v.dispatchEvent(new Event('input'));
    });
    await page.waitForFunction(() => /boot/.test(document.getElementById('gesprekken').textContent),
      null, { timeout: 10000 });
    assert.ok(/boot/.test(await page.evaluate(() => document.getElementById('gesprekken').textContent)),
      'de zoekuitslag toont de treffer niet');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
