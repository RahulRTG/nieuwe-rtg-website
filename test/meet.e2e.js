/* Scherm-test voor RTG Meet: A maakt een kamer, B komt binnen op de code,
   de WebRTC-mesh verbindt echt (nepcamera's van Chromium) en de hand
   opsteken komt bij de ander aan. Twee aparte browser-contexten, zodat
   beide leden hun eigen inlog hebben. Draait alleen met een browser. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, nepMediaArgs, installeerNepMicrofoon } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze: ./browser.js -- maar hier ZONDER de eigen driver. Die kent
   geen aparte contexten met eigen permissies, en dat heeft deze toets nodig;
   dan is overslaan eerlijker dan draaien op iets dat de vraag niet kent. */
const { laadBrowser: kiesBrowser } = require('./browser');
const laadBrowser = () => kiesBrowser({ eigenDriver: false });
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Meet: kamer maken, binnenkomen op code, echt verbinden en de hand opsteken',
  { skip: pw ? false : 'geen playwright in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-meet-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const regA = await api(base, '/api/auth/register', { name: 'Zaal Echt', email: 'ma' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1984-01-01', tier: 'rtg' });
    const regB = await api(base, '/api/auth/register', { name: 'Gast Echt', email: 'mb' + t + '@e.test',
      phone: '07' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1994-04-04', tier: 'rtg' });
    const stB = await api(base, '/api/state', {}, regB.token);
    const codeB = stB.state.user.codename;

    browser = await pw.chromium.launch({ args: nepMediaArgs() });
    const fouten = [];
    const open = async (token) => {
      const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
      await installeerNepMicrofoon(ctx);
      const page = await ctx.newPage();
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/meet.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate((tok) => {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      await page.goto(base + '/apps/meet.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#komBtn', { timeout: 15000 });
      return page;
    };

    /* ---- A maakt de kamer en staat erin ---- */
    const pageA = await open(regA.token);
    await pageA.fill('#nieuwTitel', 'Proefvergadering');
    await pageA.click('#nieuwBtn');
    await pageA.waitForFunction(() => /code [A-Z0-9]{6}/.test(document.querySelector('#kamerKop').textContent),
      null, { timeout: 20000 });
    const kop = await pageA.evaluate(() => document.querySelector('#kamerKop').textContent);
    const kamercode = /code ([A-Z0-9]{6})/.exec(kop)[1];

    /* ---- B komt binnen op de code ---- */
    const pageB = await open(regB.token);
    await pageB.fill('#komCode', kamercode);
    await pageB.click('#komBtn');
    await pageB.waitForFunction(() => document.querySelector('#kamer').style.display === 'flex',
      null, { timeout: 15000 });

    /* ---- beide kanten zien twee tegels en de mesh verbindt echt ---- */
    for (const page of [pageA, pageB]) {
      await page.waitForFunction(() => document.querySelectorAll('#tegels .tegel').length === 2,
        null, { timeout: 15000 });
      await page.waitForFunction(() => {
        const v = document.querySelectorAll('#tegels video');
        return v.length === 2 && [...v].every(x => x.srcObject);
      }, null, { timeout: 20000 });
    }
    const wie = await pageA.evaluate(() => document.querySelector('#wieLijst').textContent);
    assert.ok(wie.includes(codeB), 'A ziet B op codenaam in de kamer');

    /* ---- B steekt de hand op; A ziet het ---- */
    await pageB.click('#knopHand');
    await pageA.waitForFunction(() => /steekt de hand op/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });

    const heleTekst = await pageA.evaluate(() => document.body.textContent);
    assert.ok(!/Gast Echt/.test(heleTekst), 'geen echte naam op het scherm van A');

    /* ---- B verlaat; A houdt een tegel over (klik via de DOM: de
       metgezel-knop zweeft rechtsonder over de balk heen) ---- */
    await pageB.evaluate(() => { document.querySelector('#knopWeg').click(); });
    await pageA.waitForFunction(() => document.querySelectorAll('#tegels .tegel').length === 1,
      null, { timeout: 10000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina\'s');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
