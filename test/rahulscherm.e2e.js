/* Het scherm van Rahul in een echte browser.

   De standen, de beweging en de uitwegen zijn alleen in een browser te zien:
   een toets op een functie zegt niets over of het paneel ook echt omhoog komt
   en of de pagina eronder nog scrolt. Dit toetst precies de vier beloften:

     1. hij praat -> omhoog; jij antwoordt -> omlaag
     2. de standen zijn met de hand te zetten, en dan blijft hij staan
     3. de pagina blijft scrollen, ook met het paneel open
     4. staat iets anders op volledig scherm, dan verdwijnt hij, en daarna
        komt hij terug

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
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

test('het scherm van Rahul beweegt mee en zit nooit in de weg', { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scherm-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Scherm Tester', email: 'st' + u + '@x.nl', phone: '063' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'het lid moet een token krijgen');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, reg.token);

    const page = await ctx.newPage();
    const fouten = [];
    page.on('pageerror', (e) => fouten.push(String(e && e.message || e)));
    await page.goto(srv.base + '/apps/berichten.html', { waitUntil: 'domcontentloaded' });
    /* de balk en het paneel horen er te komen zonder dat er iets geopend wordt.
       Let op 'attached', niet zichtbaar: sinds "Losse knoppen weg" staat er geen
       vaste balk meer op het scherm. Hij hangt klaar en komt pas als je Rahul
       roept -- precies het punt van deze test: het paneel bemoeit zich nergens
       mee tot er iets te melden is. */
    await page.waitForSelector('.hv-balk input', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGChatScherm, null, { timeout: 20000 });

    const stand = () => page.evaluate(() => window.RTGChatScherm.stand());
    const zichtbaar = () => page.evaluate(() => {
      var c = document.querySelector('.hv-chat');
      return !!c && !c.hidden;
    });

    await t.test('hij begint klein: alleen de balk, geen paneel', async () => {
      assert.equal(await stand(), 'min');
      assert.equal(await zichtbaar(), false);
    });

    await t.test('zegt Rahul iets, dan komt hij vanzelf omhoog', async () => {
      await page.evaluate(() => window.__handenvrijKamer.beurt('rahul', 'Je taxi staat om zeven uur voor.'));
      await page.waitForFunction(() => window.RTGChatScherm.stand() !== 'min', null, { timeout: 5000 });
      assert.equal(await stand(), 'half');
      assert.equal(await zichtbaar(), true);
    });

    await t.test('antwoord jij, dan zakt hij weer weg', async () => {
      await page.evaluate(() => window.__handenvrijKamer.beurt('member', 'Prima.'));
      await page.waitForFunction(() => window.RTGChatScherm.stand() === 'min', null, { timeout: 5000 });
      assert.equal(await zichtbaar(), false);
    });

    await t.test('zet je zelf een stand, dan blijft hij staan (geen terugveren)', async () => {
      await page.evaluate(() => window.RTGChatScherm.zet('vol'));
      assert.equal(await stand(), 'vol');
      await page.evaluate(() => window.__handenvrijKamer.beurt('member', 'En nog iets.'));
      await new Promise(r => setTimeout(r, 300));
      assert.equal(await stand(), 'vol', 'een met de hand gezette stand hoort te blijven staan');
    });

    await t.test('de pagina blijft scrollen, ook met het paneel open', async () => {
      const kan = await page.evaluate(() => {
        // niemand mag de body op slot zetten
        var s = getComputedStyle(document.body);
        var op = s.overflow === 'hidden' || s.overflowY === 'hidden' || getComputedStyle(document.documentElement).overflow === 'hidden';
        // en er blijft een strook pagina over boven het paneel
        var c = document.querySelector('.hv-chat').getBoundingClientRect();
        return { op: op, ruimte: Math.round(c.top) };
      });
      assert.equal(kan.op, false, 'de body mag nooit op overflow:hidden komen te staan');
      assert.ok(kan.ruimte > 40, 'boven het paneel hoort een strook pagina zichtbaar te blijven (was ' + kan.ruimte + 'px)');
    });

    await t.test('staat iets anders op volledig scherm, dan gaat de balk weg en komt daarna terug', async () => {
      await page.evaluate(() => window.RTGChatScherm.zet('half'));
      // we doen alsof: de laag kijkt naar document.fullscreenElement
      await page.evaluate(() => {
        var doel = document.createElement('div'); doel.id = 'nep-vol'; document.body.appendChild(doel);
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: function () { return doel; } });
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      await page.waitForFunction(() => document.body.classList.contains('hv-weg'), null, { timeout: 5000 });
      const weg = await page.evaluate(() => {
        var b = document.querySelector('.hv-balk');
        return getComputedStyle(b).display === 'none';
      });
      assert.equal(weg, true, 'de balk hoort weg te zijn zolang er iets anders op vol scherm staat');

      await page.evaluate(() => {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: function () { return null; } });
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      await page.waitForFunction(() => !document.body.classList.contains('hv-weg'), null, { timeout: 5000 });
      assert.equal(await stand(), 'half', 'hij hoort terug te komen in de stand waarin hij stond');
    });

    await t.test('er knalt geen JS-fout op de pagina', () => {
      assert.deepEqual(fouten.filter(f => !/favicon|manifest|Failed to load resource/i.test(f)), []);
    });
    await page.close();
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    stop(srv && srv.child);
  }
});
