/* Scherm-test voor Notities & Taken: een lijst bouwen met Enter, bewaren,
   afvinken op de kaart zelf (zonder de editor te openen), delen op
   codenaam en de andere kant die meteen mee kan doen.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
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

test('Notities: lijst bouwen, afvinken op de kaart, delen en samen bijwerken',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-notities-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const regA = await api(base, '/api/auth/register', { name: 'Bord Echt', email: 'na' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1986-04-04', tier: 'rtg' });
    const regB = await api(base, '/api/auth/register', { name: 'Mee Echt', email: 'nb' + t + '@e.test',
      phone: '07' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1993-08-08', tier: 'rtg' });
    const stB = await api(base, '/api/state', {}, regB.token);
    const codeB = stB.state.user.codename;

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const als = async (token) => {
      await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate((tok) => {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#nieuwLijst', { timeout: 15000 });
    };

    /* ---- A bouwt een lijst met Enter ---- */
    await als(regA.token);
    await page.click('#nieuwLijst');
    await page.waitForSelector('#ntScrim.open', { timeout: 5000 });
    await page.fill('#ntTitel', 'Weekend');
    for (const punt of ['Citroenen', 'IJs', 'Bloemen']) {
      await page.fill('#ntNieuwTaak', punt);
      await page.press('#ntNieuwTaak', 'Enter');
    }
    await page.click('#ntBewaar');
    await page.waitForFunction(() => /Bewaard/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });
    await page.waitForFunction(() => /Weekend/.test(document.querySelector('#bord').textContent),
      null, { timeout: 8000 });

    /* ---- afvinken op de kaart zelf ---- */
    await page.evaluate(() => { document.querySelector('#bord [data-vink]').click(); });
    await page.waitForFunction(() => document.querySelector('#bord .taak.af'), null, { timeout: 8000 });

    /* ---- delen met B ---- */
    await page.evaluate(() => { document.querySelector('#bord [data-open]').click(); });
    await page.waitForSelector('#ntScrim.open', { timeout: 5000 });
    await page.fill('#ntCode', codeB);
    await page.click('#ntDeel');
    await page.waitForFunction(() => /samen/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });

    /* ---- B ziet de lijst en vinkt mee ---- */
    await als(regB.token);
    await page.waitForFunction(() => /Weekend/.test(document.querySelector('#gedeeldBord').textContent),
      null, { timeout: 8000 });
    await page.evaluate(() => {
      var v = document.querySelectorAll('#gedeeldBord [data-vink]');
      v[1].click();
    });
    await page.waitForFunction(() => document.querySelectorAll('#gedeeldBord .taak.af').length === 2,
      null, { timeout: 8000 });

    /* ---- en A ziet het vinkje van B na herladen ---- */
    await als(regA.token);
    await page.waitForFunction(() => document.querySelectorAll('#bord .taak.af').length === 2,
      null, { timeout: 8000 });
    const heleTekst = await page.evaluate(() => document.body.textContent);
    assert.ok(!/Mee Echt/.test(heleTekst), 'geen echte naam op het scherm van A');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
