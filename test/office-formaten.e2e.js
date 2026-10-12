/* Scherm-test voor in en uit van RTG Office: exporteren via het venster en een
   XLSX inlezen vanuit de drive.

   test/office-formaten.test.js bewijst de server; deze bewijst dat een mens erbij
   kan. Het gedownloade bestand is de waarneming, niet een melding op het scherm:
   het wordt uitgepakt en er wordt gekeken of de classificatie erin staat. En de
   trouwlijst moet IN het venster staan, niet in een melding die na drie seconden
   weg is. Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { lees } = require('../server/kern/office/zip');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Office: exporteren als XLSX met de classificatie erin, en een XLSX inlezen als nieuw blad',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-formaten-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Formaat E2E', email: 'fe' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1988-01-01', tier: 'rtg' });
    const m = await api(base, '/api/kantoorpakket/maak', { soort: 'blad', titel: 'Kwartaal' }, reg.token);
    await api(base, '/api/kantoorpakket/bewaar', { id: m.id, inhoud: { cellen: { A1: '4', A2: '=SOM(A1;1)', A3: '=JAAR("2026-01-01")' }, rijen: 20, kolommen: 8 } }, reg.token);
    await api(base, '/api/kantoorpakket/beheer', { id: m.id, classificatie: 'vertrouwelijk' }, reg.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/office.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-rtd-diep="lijst"]', { timeout: 15000 });
    await page.click('[data-rtd-diep="lijst"]');
    await page.waitForSelector('#nieuwBlad', { timeout: 15000 });

    // het blad openen zoals een mens dat doet: vanuit de drive
    await page.waitForSelector('.doc[data-open="' + m.id + '"]', { timeout: 15000 });
    await page.click('.doc[data-open="' + m.id + '"]');
    await page.waitForSelector('#blad td[data-ref="A1"]', { timeout: 15000 });

    await page.click('#officeMeer summary');
    await page.click('#exportBtn');
    await page.waitForSelector('#formaatScrim.open [data-formaat="xlsx"]', { timeout: 5000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-formaat="xlsx"]')]);
    assert.equal(download.suggestedFilename(), 'Kwartaal (Vertrouwelijk).xlsx');
    /* saveAs en niet path(): in CI draait de browser op afstand, en dan bestaat path() niet. */
    const kopie = path.join(os.tmpdir(), 'rtg-office-' + Date.now() + '.xlsx');
    await download.saveAs(kopie);
    const delen = lees(fs.readFileSync(kopie));
    assert.match(delen['docProps/custom.xml'].toString(), /RTG-Classificatie"><vt:lpwstr>Vertrouwelijk</);
    await page.waitForFunction(() => /JAAR/.test(document.querySelector('#formaatTrouw').textContent), null, { timeout: 5000 });
    assert.match(await page.textContent('#formaatTrouw'), /A3/, 'de trouwlijst staat in het venster, met de cel');
    await page.click('#formaatDicht');

    // en weer in: via de knop in de drive, als NIEUW blad
    const xlsx = kopie;
    await page.goto(base + '/apps/office.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-rtd-diep="lijst"]', { timeout: 15000 });
    await page.click('[data-rtd-diep="lijst"]');
    await page.waitForSelector('#inleesXlsx', { timeout: 15000 });
    const [kiezer] = await Promise.all([page.waitForEvent('filechooser'), page.click('#inleesXlsx')]);
    await kiezer.setFiles({ name: 'Terug.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: fs.readFileSync(xlsx) });
    fs.rmSync(xlsx, { force: true });
    await page.waitForSelector('#formaatScrim.open', { timeout: 10000 });
    assert.match(await page.textContent('#formaatKop'), /Ingelezen: Terug/);
    await page.waitForFunction(() => {
      const c = document.querySelector('#blad td[data-ref="A2"]');
      return c && c.textContent === '5';
    }, null, { timeout: 15000 });
    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
