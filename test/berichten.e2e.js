/* Scherm-test voor de Berichten-app. De unit-toetsen (test/berichten.test.js)
   bewijzen de server-kant; deze bewijst dat de APP het ook echt doet in een
   browser: de lijst komt op, een gesprek opent IN de app (dat was het hele punt
   van deze ronde -- hij verwees vroeger alleen door), een verstuurd bericht
   verschijnt aan de goede kant, en zoeken over alle kanalen werkt.
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

test('Berichten: de lijst komt op, het gesprek opent in de app en zoeken werkt',
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
    await page.goto(base + '/apps/berichten.html', { waitUntil: 'load' });

    // 1. de lijst komt op, met het prive-gesprek erin
    await page.waitForSelector('[data-open]', { timeout: 15000 });
    const lijst = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/boot vertrekt/.test(lijst), 'het laatste bericht staat in de lijst');

    // 2. het gesprek opent IN de app (geen doorverwijzing naar een andere pagina)
    await page.click('[data-open]');
    await page.waitForSelector('#stuurform', { timeout: 10000 });
    const url = await page.evaluate(() => location.pathname);
    assert.equal(url, '/apps/berichten.html', 'we zijn niet weggenavigeerd');
    const draad = await page.evaluate(() => document.querySelector('#draad').textContent);
    assert.ok(/boot vertrekt/.test(draad), 'het bericht staat in de draad');
    // het is MIJN bericht, dus de bel staat aan mijn kant
    const eigen = await page.evaluate(() => !!document.querySelector('#draad .bel.van-mij'));
    assert.equal(eigen, true, 'mijn eigen bericht staat aan mijn kant');

    // 3. de drie AI-knoppen staan er (de server zegt netjes nee zonder sleutel)
    for (const id of ['#bSamen', '#bConcept', '#bAfspraak']) {
      const er = await page.evaluate((s) => !!document.querySelector(s), id);
      assert.equal(er, true, 'knop ' + id + ' staat op het gesprek');
    }

    // 4. zoeken over alle kanalen
    await page.evaluate(() => {
      const v = document.querySelector('#zoekveld');
      v.value = 'boot'; v.dispatchEvent(new Event('input'));
    });
    await page.waitForFunction(() => /treffer/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const uitslag = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/boot/.test(uitslag), 'de zoekuitslag toont de treffer');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
