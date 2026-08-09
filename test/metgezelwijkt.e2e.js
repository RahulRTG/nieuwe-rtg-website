/* RAHUL WIJKT VOOR EEN GEOPEND VENSTER -- EN KOMT TERUG.

   Het blok van de metgezel staat op z-index 9980 en zweeft daarmee boven
   vrijwel elk venster in dit huis (de bladen van Clips staan op 10, de
   onboarding-poort op 130). Die vensters openen onderaan, want dat is de
   telefoonvorm hier, en dus lagen hun onderste knoppen onder de balk van
   Rahul. In Clips was dat letterlijk de knop "Sluit": met een vinger niet te
   raken, en in test/clips-studio.e2e.js dertig seconden lang "intercepts
   pointer events".

   De reparatie zit in de metgezel zelf (shared/metgezel/metgezel-01c.js): hij
   gaat opzij zolang er een venster openstaat. Dat is een gedragsregel over
   ALLE schermen, dus hij hoort een eigen toets te hebben -- en die toets moet
   BEIDE kanten opnemen. Alleen "hij wijkt" toetsen zou een metgezel goedkeuren
   die na het sluiten nooit meer terugkomt, en dat is een app die stilletjes
   zijn assistent kwijtraakt.

   Draai: npm run e2e (of los: node --experimental-sqlite --test test/metgezelwijkt.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) {}
  return null;
}
const pw = laadBrowser();

const zichtbaarheid = () => {
  const blok = document.querySelector('.mgz-blok');
  if (!blok) return 'geen blok';
  const r = blok.getBoundingClientRect();
  return getComputedStyle(blok).display !== 'none' && r.height > 0 ? 'zichtbaar' : 'weg';
};

test('de metgezel wijkt voor een venster en komt daarna terug',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mgzwijkt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const lid = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Wijklid', email: 'mw' + u + '@x.nl', phone: '06' + u,
        password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    assert.ok(lid.token, 'het lid is ingelogd');
    /* Een eigen clip, zodat de feed een kaart heeft met bladen erachter. Zonder
       kaart staat er niets om te openen en toetst de tweede helft niets. */
    const clip = await fetch(base + '/api/clips/maak', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid.token },
      body: JSON.stringify({ titel: 'Proefclip', duurS: 9, mbGeschat: 1 }) }).then(r => r.json());
    assert.ok(clip.id, 'er staat een kaart in de feed');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);

    /* Clips, want daar kwam de melding vandaan: een blad dat onderaan opent,
       met zijn sluitknop precies op de plek van de balk. */
    await page.goto(base + '/apps/clips.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !!document.querySelector('.mgz-blok'), null, { timeout: 20000 });
    assert.equal(await page.evaluate(zichtbaarheid), 'zichtbaar', 'in rust staat Rahul er gewoon');

    // het blad openen zoals een lid dat doet
    await page.click('#studioOpen');
    await page.waitForFunction(() => {
      const b = document.querySelector('.mgz-blok');
      return b && getComputedStyle(b).display === 'none';
    }, null, { timeout: 5000 }).catch(() => {});
    assert.equal(await page.evaluate(zichtbaarheid), 'weg', 'zolang het venster openstaat, gaat Rahul opzij');

    /* En de knop die hier het hele geval aanwees: zonder de reparatie zit hij
       onder de balk en meldt Playwright "intercepts pointer events". */
    await page.click('#studioDicht', { timeout: 10000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('.mgz-blok');
      return b && getComputedStyle(b).display !== 'none';
    }, null, { timeout: 5000 });
    assert.equal(await page.evaluate(zichtbaarheid), 'zichtbaar', 'en daarna komt hij terug');

    /* Twee keer achter elkaar, want een wijk-regel die maar een keer werkt is
       net zo goed stuk -- en dan via een ANDER blad, zodat het niet aan dat
       ene blad ligt. De knop staat op de kaart van de eigen clip. */
    await page.waitForSelector('.clip .laag .knop', { timeout: 20000 });
    await page.locator('.clip .laag .knop', { hasText: 'Bewerken' }).first().click();
    await page.waitForFunction(() => {
      const b = document.querySelector('.mgz-blok');
      return b && getComputedStyle(b).display === 'none';
    }, null, { timeout: 5000 }).catch(() => {});
    assert.equal(await page.evaluate(zichtbaarheid), 'weg', 'ook voor het tweede blad');
    await page.click('#knipDicht');
    await page.waitForFunction(() => {
      const b = document.querySelector('.mgz-blok');
      return b && getComputedStyle(b).display !== 'none';
    }, null, { timeout: 5000 });
    assert.equal(await page.evaluate(zichtbaarheid), 'zichtbaar', 'en hij blijft terugkomen');

    assert.deepEqual(fouten, [], 'geen fout op de pagina');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
