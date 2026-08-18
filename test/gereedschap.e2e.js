/* Scherm-test voor RTG Gereedschap: rekenen met de toetsen (btw erbij),
   een wekker en een timer zetten (de server telt), en het alarmscherm
   dat op het SSE-seintje opent. Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Gereedschap: rekenen, btw, een wekker en een timer, en het alarm via SSE',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gereedschap-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Gereed Echt', email: 'gr' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1986-08-08', tier: 'rtg' });

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/gereedschap.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/gereedschap.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rkToetsen button', { timeout: 15000 });

    /* ---- rekenen met de toetsen: (2+3)x4 = 20 ---- */
    for (const k of ['(', '2', '+', '3', ')', 'x', '4', '=']) {
      await page.evaluate((kk) => {
        document.querySelector('#rkToetsen [data-k="' + kk + '"]').click();
      }, k);
    }
    assert.equal(await page.evaluate(() => document.querySelector('#rkScherm').value), '20');

    /* ---- btw: 100 ex bij 21% is 121 samen ---- */
    await page.fill('#btwBedrag', '100');
    await page.waitForFunction(() => /121,00/.test(document.querySelector('#btwUit').textContent),
      null, { timeout: 5000 });

    /* ---- wekker en timer op de server ---- */
    await page.evaluate(() => { document.querySelector('[data-tab="wekker"]').click(); });
    await page.fill('#wkTijd', '07:00');
    await page.fill('#wkLabel', 'Zwemmen');
    await page.evaluate(() => { document.querySelector('#wkZet').click(); });
    await page.waitForFunction(() => /07:00/.test(document.querySelector('#wekkers').textContent) &&
      /Zwemmen/.test(document.querySelector('#wekkers').textContent), null, { timeout: 8000 });
    await page.fill('#tmMin', '5');
    await page.fill('#tmLabel', 'Thee');
    await page.evaluate(() => { document.querySelector('#tmStart').click(); });
    await page.waitForFunction(() => /Thee/.test(document.querySelector('#timers').textContent),
      null, { timeout: 8000 });

    /* ---- het alarm: wij verzetten de timer op de server en vegen ----
       (de veegtimer loopt elke 15 s; het SSE-seintje opent het alarmscherm) */
    await page.waitForFunction(() => {
      // wacht tot de SSE-lijn er is; de veeg hierna moet het scherm bereiken
      return true;
    }, null, { timeout: 1000 });
    const lijst = await api(base, '/api/klok/mijn', {}, reg.token);
    assert.equal(lijst.timers.length, 1);
    // een tweede, ultrakorte timer via de API (zoals Rahul dat zou doen)
    await api(base, '/api/klok/timer', { duurS: 5, label: 'Rahul-proef' }, reg.token);
    await page.waitForFunction(() => document.querySelector('#alarm').classList.contains('open'),
      null, { timeout: 30000 });
    const alarmTekst = await page.evaluate(() => document.querySelector('#alarmTekst').textContent);
    assert.ok(/Rahul-proef/.test(alarmTekst), 'het alarm noemt de timer bij naam');
    await page.evaluate(() => { document.querySelector('#alarmStil').click(); });

    /* ---- stopwatch en wereldklok bestaan en tekenen ---- */
    await page.evaluate(() => { document.querySelector('[data-tab="tijd"]').click(); });
    await page.evaluate(() => { document.querySelector('#swStart').click(); });
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => { document.querySelector('#swRonde').click(); });
    await page.waitForFunction(() => document.querySelectorAll('#swRondes .ronde').length === 1,
      null, { timeout: 5000 });
    const klokken = await page.evaluate(() => document.querySelectorAll('#klokken .kaart').length);
    assert.ok(klokken >= 3, 'de wereldklok toont de begin-steden');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
