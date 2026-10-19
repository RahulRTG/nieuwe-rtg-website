/* DE BUURTPAGINA (RTF Buurt) HEEFT DE ACCOUNTDEUR IN HET SCHERM.

   Sinds 66f413ff vragen /api/rtfos/publiek/* een sessie (eigenaarsbesluit 19
   oktober 2026: gebruiken vraagt een account). Het scherm laadde de deur niet:
   wie zonder sessie kwam, zag alleen de foutmelding van de server en geen weg
   naar een gratis account (gevonden bij de domeinkaart van FoundationOS). Nu
   staat de deur er (shared/accountdeur.js, zoals bij het portaal en het
   klimaatfonds), en na een gratis account gaat de pagina verder waar hij was.

   Draai los: node --test test/rtfbuurt-accountdeur.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('zonder sessie toont de buurtpagina de accountdeur, en na een gratis account laadt hij de steden', { skip: geenBrowser(pw) }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-buurt-deur-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  t.after(async () => { await browser.close(); stop(srv.child); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(srv.base + '/apps/foundation/os-publiek.html', { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('.rtg-ad', { timeout: 15000 }).catch(() => null);
  const deur = await page.evaluate(() => ({ deur: !!document.querySelector('.rtg-ad'),
    steden: (document.getElementById('steden') || {}).textContent || '' }));
  assert.equal(deur.deur, true, 'zonder sessie staat er geen accountdeur; de steden tonen: "' + deur.steden.trim().slice(0, 80) + '"');

  const u = Date.now().toString().slice(-8);
  await page.fill('#rtgAdNaam', 'Buur ' + u);
  await page.fill('#rtgAdMail', 'buur' + u + '@voorbeeld.nl');
  await page.fill('#rtgAdGeb', '1985-05-05');
  await page.fill('#rtgAdWw', 'geheim12345');
  await page.click('.rtg-ad button.hoofd');
  await page.waitForFunction(() => !document.querySelector('.rtg-ad') && !/Laden/.test((document.getElementById('steden') || {}).textContent || ''), null, { timeout: 15000 });
  const na = await page.evaluate(() => ({ melder: !!document.querySelector('#steden .melder'),
    tekst: (document.getElementById('steden') || {}).textContent || '', token: !!localStorage.getItem('rtg_member_token') }));
  assert.equal(na.token, true, 'het gratis account staat niet waar elke app het leest');
  assert.equal(na.melder, false, 'na het account staat er nog een foutmelding: ' + na.tekst.trim().slice(0, 80));
});
