/* Scherm-test voor RTG Bestanden: uploaden via de kiezer, het paneel met
   voorvertoning, delen op codenaam, de nieuwe versie van de andere kant,
   en de prullenbak met herstel. Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');
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

test('Bestanden: uploaden, delen, een versie van de ander en de prullenbak',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bestanden-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const regA = await api(base, '/api/auth/register', { name: 'Kluis Echt', email: 'ka' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1985-02-02', tier: 'rtg' });
    const regB = await api(base, '/api/auth/register', { name: 'Kijker Echt', email: 'kb' + t + '@e.test',
      phone: '07' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1992-09-09', tier: 'rtg' });
    const stB = await api(base, '/api/state', {}, regB.token);
    const codeB = stB.state.user.codename;

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    if (page.on) page.on('pageerror', e => fouten.push(e.message));
    const als = async (token) => {
      await page.goto(base + '/apps/bestanden.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate((tok) => {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      await page.goto(base + '/apps/bestanden.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#kies', { timeout: 15000 });
    };
    // een bestand in de kiezer leggen zonder echt bestandssysteem: DataTransfer
    const legIn = (sel, naam, inhoud) => page.evaluate(function (a) {
      var dt = new DataTransfer();
      dt.items.add(new File([a.inhoud], a.naam, { type: 'text/plain' }));
      var inp = document.querySelector(a.sel);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }, { sel, naam, inhoud });

    /* ---- A uploadt en ziet het quotum meelopen ---- */
    await als(regA.token);
    await legIn('#bestandkiezer', 'paklijst.txt', 'Zonnebril. Linnen. Niets dat kreukt.');
    await page.waitForFunction(() => /paklijst\.txt/.test(document.querySelector('#lijst').textContent),
      null, { timeout: 8000 });
    const quotum = await page.evaluate(() => document.querySelector('#quotumTekst').textContent);
    assert.ok(/van 200,?\.?0? MB|van 200 MB/.test(quotum), 'het quotum staat er eerlijk bij: ' + quotum);

    /* ---- het paneel: voorvertoning en delen met B ---- */
    await page.evaluate(() => { document.querySelector('#lijst [data-open]').click(); });
    await page.waitForSelector('#bkScrim.open', { timeout: 5000 });
    await page.waitForFunction(() => /Zonnebril/.test(document.querySelector('#bkKijk').textContent),
      null, { timeout: 8000 });
    await page.fill('#bkCode', codeB);
    await page.click('#bkDeel');
    await page.waitForFunction(() => /nieuwe versies/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });
    await page.click('#bkDicht');

    /* ---- B ziet het bestand en zet een nieuwe versie ---- */
    await als(regB.token);
    await page.waitForFunction(() => /paklijst\.txt/.test(document.querySelector('#gedeeldLijst').textContent),
      null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#gedeeldLijst [data-open]').click(); });
    await page.waitForSelector('#bkScrim.open', { timeout: 5000 });
    await legIn('#versiekiezer', 'paklijst.txt', 'Zonnebril. Linnen. En een hoed.');
    await page.waitForFunction(() => /Nieuwe versie geplaatst/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });

    /* ---- A ziet de versie van B, op codenaam; daarna de prullenbak ---- */
    await als(regA.token);
    await page.evaluate(() => { document.querySelector('#lijst [data-open]').click(); });
    await page.waitForSelector('#bkScrim.open', { timeout: 5000 });
    await page.waitForFunction(() => /hoed/.test(document.querySelector('#bkKijk').textContent),
      null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelectorAll('#bkVersies .versierij').length === 1,
      null, { timeout: 8000 });
    const heleTekst = await page.evaluate(() => document.body.textContent);
    assert.ok(!/Kijker Echt/.test(heleTekst), 'geen echte naam op het scherm van A');

    await page.evaluate(() => { window.confirm = function () { return true; }; });
    await page.click('#bkWeg');
    await page.waitForFunction(() => /prullenbak/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });
    await page.click('#toonBak');
    await page.waitForFunction(() => /paklijst\.txt/.test(document.querySelector('#lijst').textContent),
      null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#lijst [data-open]').click(); });
    await page.waitForSelector('#bkHerstel', { timeout: 5000 });
    await page.click('#bkHerstel');
    await page.waitForFunction(() => /Terug in de kluis/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
