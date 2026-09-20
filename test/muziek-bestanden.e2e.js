/* Schermbewijs voor Mijn muziek: kiezen op het toestel, terugzien in RTG Sound
   en bedienen met precies dezelfde vaste speler als de live stations. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');

const pw = laadPlaywright();
function stilleWav() {
  const hz = 8000, samples = hz * 2, data = samples * 2, b = Buffer.alloc(44 + data);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(hz, 24); b.writeUInt32LE(hz * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data, 40); return b;
}
async function post(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

test('een maker publiceert muziek en een ander luistert en geeft waardering',
  { skip: geenBrowser(pw) }, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-muziek-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } });
    let browser;
    try {
      const maker = (await post(base, '/api/auth/register', { name: 'Muziekmaker',
        email: 'muziekmaker@x.test', phone: '0612345671', password: 'geheim123',
        geboortedatum: '1990-01-01', tier: 'rtg' })).token;
      const luisteraar = (await post(base, '/api/auth/register', { name: 'Muziekluisteraar',
        email: 'muziekluisteraar@x.test', phone: '0612345672', password: 'geheim123',
        geboortedatum: '1991-01-01', tier: 'rtg' })).token;
      browser = await pw.chromium.launch(browserOpties(pw));
      const fouten = [];
      const contextA = await browser.newContext(), pageA = await contextA.newPage(); letOpFouten(pageA, fouten);
      await pageA.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, maker);
      await pageA.goto(base + '/apps/muziek.html', { waitUntil: 'domcontentloaded' });
      await pageA.waitForSelector('#muziekKies:not([disabled])', { timeout: 15000 });
      await pageA.setInputFiles('#muziekBestand', { name: 'schets.wav', mimeType: 'audio/wav', buffer: stilleWav() });
      await pageA.fill('#muziekTitel', 'Avond aan zee');
      await pageA.fill('#muziekBeschrijving', 'Zelf gemaakt voor een avond aan het water.');
      await pageA.check('#muziekEigenwerk');
      await pageA.click('#muziekPubliceer');
      await pageA.waitForFunction(() => /Avond aan zee/.test(document.querySelector('#muziekLijst').textContent), null, { timeout: 15000 });

      const contextB = await browser.newContext(), page = await contextB.newPage(); letOpFouten(page, fouten);
      await page.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, luisteraar);
      await page.goto(base + '/apps/muziek.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => /Avond aan zee/.test(document.querySelector('#muziekLijst').textContent), null, { timeout: 15000 });
      assert.match(await page.textContent('.eigen-nummer__beschrijving'), /Zelf gemaakt/);
      assert.equal(await page.locator('.eigen-nummer__weg').count(), 0, 'een luisteraar kan het werk van de maker niet verwijderen');
      await page.click('.eigen-nummer__mooi');
      await page.waitForFunction(() => /♥ 1/.test(document.querySelector('.eigen-nummer__mooi').textContent));
      await page.click('.eigen-nummer__speel');
      await page.waitForFunction(() => /\/api\/muziek\/luister\//.test(document.querySelector('#eigenAudio').src), null, { timeout: 10000 });
      if (await page.evaluate(() => document.querySelector('#eigenAudio').paused)) await page.evaluate(() => document.querySelector('#knopSpeel').click());
      await page.waitForFunction(() => !document.querySelector('#eigenAudio').paused, null, { timeout: 8000 });
      assert.match(await page.textContent('#spTitel'), /Avond aan zee/);
      assert.match(await page.textContent('#spSub'), /muziek van mensen/);
      await page.evaluate(() => document.querySelector('#knopSpeel').click());
      assert.equal(await page.evaluate(() => document.querySelector('#eigenAudio').paused), true,
        'de vaste afspeelknop pauzeert ook een eigen bestand');
      await contextB.close();
      pageA.once('dialog', d => d.accept());
      await pageA.click('.eigen-nummer__weg');
      await pageA.waitForFunction(() => /U kunt de eerste zijn/.test(document.querySelector('#muziekLijst').textContent));
      await contextA.close();
      assert.deepEqual(fouten, []);
    } finally {
      if (browser) await browser.close(); stop(child);
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    }
  });
