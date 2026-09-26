/* ONTDEKKEN VOOR EEN GEZIN -- het scherm neemt de gezinsdeur, niet de ledendeur.

   Op 24 september 2026 toonde /apps/connect.html een gezinslid in FoundationOS
   "Niet ingelogd.": het scherm riep alleen /api/connect/* aan met een ledentoken,
   terwijl de motor een tweede deur heeft (/api/rtf/connect/*, met code en token
   van het gezinsprofiel) die door geen enkel scherm werd gebruikt. Deze toets
   houdt vast:

     1. een gezinssessie zonder ledentoken roept de gezinsdeur aan, en het scherm
        zegt niet "Niet ingelogd.";
     2. een lid met een ledentoken blijft de ledendeur nemen, ook als er toevallig
        ook een gezinssessie op het toestel staat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { ROLLEN } = require('../scripts/lib/proefsessies');

const pw = laadPlaywright();

async function bezoek(browser, base, opslag) {
  const ctx = await browser.newContext();
  await ctx.route('**/api/onboarding/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"klaar":true}' }));
  await ctx.addInitScript((o) => { for (const k of Object.keys(o)) localStorage.setItem(k, o[k]); }, opslag);
  const page = await ctx.newPage();
  const paden = [];
  page.on('request', (req) => { const p = new URL(req.url()).pathname; if (/connect\//.test(p)) paden.push(p); });
  /* Op het ANTWOORD wachten en niet op tekst in #lijst: daar staat al "Laden..."
     in de HTML, en een wachtregel op tekst is dan meteen vervuld. */
  const antwoord = page.waitForResponse((r) => /\/connect\/ontdek$/.test(new URL(r.url()).pathname), { timeout: 20000 });
  await page.goto(base + '/apps/connect.html', { waitUntil: 'domcontentloaded' });
  await antwoord;
  await page.waitForFunction(() => !/Laden\.\.\./.test((document.querySelector('#lijst') || {}).textContent || ''), null, { timeout: 10000 });
  const tekst = await page.evaluate(() => document.body.innerText);
  await ctx.close();
  return { paden, tekst };
}

test('Ontdekken: een gezin neemt de gezinsdeur, een lid de ledendeur', { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-connect-gezin-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const gezin = await ROLLEN.gezin.haal(base);
    assert.ok(gezin && gezin.code && gezin.token, 'geen gezinssessie');
    const lid = await ROLLEN.lid.haal(base);
    assert.ok(lid, 'geen ledensessie');

    const g = await bezoek(browser, base, { rtf_sessie: JSON.stringify(gezin), rtg_cookieinfo_v1: '1' });
    assert.ok(g.paden.includes('/api/rtf/connect/ontdek'), 'de gezinsdeur is niet aangeroepen: ' + g.paden.join(', '));
    assert.ok(!g.paden.some((p) => p.startsWith('/api/connect/')), 'een gezin klopte aan bij de ledendeur: ' + g.paden.join(', '));
    assert.doesNotMatch(g.tekst, /Niet ingelogd/, 'het scherm zegt een gezinslid dat het niet is ingelogd');

    const l = await bezoek(browser, base, { rtg_member_token: lid, rtf_sessie: JSON.stringify(gezin), rtg_cookieinfo_v1: '1' });
    assert.ok(l.paden.includes('/api/connect/ontdek'), 'een lid nam de ledendeur niet: ' + l.paden.join(', '));
    assert.ok(!l.paden.some((p) => p.startsWith('/api/rtf/connect/')), 'een lid klopte aan bij de gezinsdeur');
  } finally {
    await browser.close();
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
