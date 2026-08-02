/* Scherm-test voor de Clips-studio: knippen, geluid en ondertitels, en het
   toegangsfilter in de kop. test/clips.test.js bewijst de server-kant; deze
   bewijst dat de studio op het scherm werkt en dat de feed de standen toont.
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

test('Clips-studio: knippen, geluid, ondertitels en het toegangsfilter',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-clips-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Clip E2E', email: 'ce' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1995-05-05', tier: 'rtg' });
    // twee clips: een die we bewerken, en een kale om het filter op te toetsen
    const mijn = await api(base, '/api/clips/maak', { titel: 'Kade bij avond', duurS: 30 }, reg.token);
    await api(base, '/api/clips/maak', { titel: 'Zonder ondertitel', duurS: 8 }, reg.token);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/clips.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Kade bij avond/.test(document.body.textContent), null, { timeout: 15000 });

    // de studio openen op de eigen clip
    await page.click('[data-id="' + mijn.id + '"] .rij button:nth-child(3)');
    await page.waitForSelector('#knipVan', { timeout: 8000 });

    // knippen: het scherm meldt de nieuwe speelduur en dat het origineel heel bleef
    await page.fill('#knipVan', '4');
    await page.fill('#knipTot', '19');
    await page.click('#knipZet');
    await page.waitForFunction(() => /15 seconden/.test(document.querySelector('#knipStatus').textContent),
      null, { timeout: 8000 });
    assert.match(await page.evaluate(() => document.querySelector('#knipStatus').textContent),
      /origineel is heel gebleven/);

    // geluid: "stil" is een mededeling van de maker, geen muziekkeuze
    await page.click('[data-geluid="stil"]');
    await page.waitForFunction(() => document.querySelector('[data-geluid="stil"]').getAttribute('aria-pressed') === 'true',
      null, { timeout: 8000 });

    // ondertitels bewaren
    const velden = await page.$$('#cueLijst .cue input');
    await velden[0].fill('1');
    await velden[1].fill('4');
    await velden[2].fill('Het is bijna donker.');
    await page.click('#cueBewaar');
    await page.waitForFunction(() => /1 regel bewaard/.test(document.querySelector('#knipStatus').textContent),
      null, { timeout: 8000 });

    await page.click('#knipDicht');
    // de feed draagt nu het merk "ondertiteld" en de stand van het geluid
    await page.waitForFunction(() => /ondertiteld/.test(document.body.textContent), null, { timeout: 8000 });
    const feed = await page.evaluate(() => document.querySelector('#feed').textContent);
    assert.match(feed, /zonder geluid te bekijken/, 'de kijker leest wat hij gaat horen: ' + feed.slice(0, 200));
    assert.match(feed, /15s/, 'en de speelduur volgt de knip');

    /* Het toegangsfilter, gezien door een KIJKER. Bij de maker zelf staat zijn
       eigen werk altijd bovenaan -- het filter gaat over wat je kijkt, niet over
       wat je maakte -- dus is een tweede lid nodig om hem te zien werken. */
    const kijker = await api(base, '/api/auth/register', { name: 'Kijker E2E', email: 'ke' + t + '@e.test',
      phone: '06' + String(t + 1).slice(-8), password: 'geheim123', geboortedatum: '1994-04-04', tier: 'rtg' });
    const pagina2 = await browser.newPage();
    letOpFouten(pagina2, fouten);
    await pagina2.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, kijker.token);
    await pagina2.goto(base + '/apps/clips.html', { waitUntil: 'domcontentloaded' });
    await pagina2.waitForFunction(() => /Zonder ondertitel/.test(document.querySelector('#feed').textContent),
      null, { timeout: 15000 });

    await pagina2.click('#volgbaar');
    await pagina2.waitForFunction(() => !/Zonder ondertitel/.test(document.querySelector('#feed').textContent),
      null, { timeout: 8000 });
    assert.match(await pagina2.evaluate(() => document.querySelector('#feed').textContent), /Kade bij avond/,
      'wat wel ondertiteld is, blijft gewoon staan');
    assert.equal(await pagina2.evaluate(() => document.querySelector('#volgbaar').getAttribute('aria-pressed')), 'true');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
