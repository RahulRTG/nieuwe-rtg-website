/* De werkvloer moet echt geschilderd zijn, niet uitsluitend hit-testbaar.
   Deze proef decodeert de echte Chromium-screenshot in een los beeldbuffer;
   hij vervangt geen product-DOM, CSS, beeld of HTTP-antwoord. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper');
const { rondLidAf } = require('../scripts/lib/proefsessies');

test('de actieve Command-werkvloer blijft zichtbaar boven de levende shellgrond', async t => {
  const pw = h.laadPlaywright({ eigenDriver: false });
  assert.ok(pw && pw.chromium, 'echte Chromium is verplicht, geen skip of vervangende driver');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-command-schilderlaag-'));
  const srv = await h.startServer({ env: { RTG_DATA_DIR: map, RTG_DEMO: '1', NODE_ENV: 'test', SMTP_URL: '' } });
  let browser;
  try {
    const antwoord = await fetch(srv.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran' }) });
    const lid = await antwoord.json(); assert.equal(antwoord.status, 200); assert.ok(lid.token);
    await rondLidAf(srv.base, lid.token, 'Rahul Imran');
    browser = await h.startBrowser(pw); t.diagnostic('Chromium ' + browser.version());
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
      reducedMotion: 'reduce', colorScheme: 'light', serviceWorkers: 'block' });
    await ctx.addInitScript(token => {
      localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, lid.token);
    const page = await ctx.newPage(), fouten = h.letOpFouten(page, []);
    await page.goto(srv.base + '/apps/app.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('#rtgCommand[data-stand="open"] .cmd-startwereld').first().waitFor();
    await page.waitForFunction(() => {
      const beeld = document.querySelector('.cmd-startwereld .cmd-wereldbeeld');
      return beeld && beeld.complete && beeld.naturalWidth > 0 && document.querySelector('#levendegrond-stijl')?.sheet &&
        document.body.dataset.rtgDesktopState === 'ready';
    });
    await page.evaluate(() => document.fonts.ready);
    const kaart = page.locator('.cmd-startwereld').first();
    const vlak = await kaart.boundingBox();
    assert.ok(vlak && vlak.y >= 0 && vlak.y + vlak.height < 844, 'eerste wereld staat volledig in de echte beginviewport');
    assert.equal(await kaart.evaluate(el => {
      const r = el.getBoundingClientRect(), boven = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!boven && (el === boven || el.contains(boven));
    }), true, 'de eerste wereld is ook werkelijk bedienbaar');
    assert.match(await kaart.innerText(), /LivingOS/);
    const uit = path.join(__dirname, '../artifacts/experience'); fs.mkdirSync(uit, { recursive: true });
    const beeld = await page.screenshot({ path: path.join(uit, 'command-beginscherm-390.png') });
    const pixels = await page.evaluate(async ({ png, rect }) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), g = canvas.getContext('2d');
      g.drawImage(bitmap, 0, 0); bitmap.close();
      const data = g.getImageData(Math.ceil(rect.x + 4), Math.ceil(rect.y + 4), Math.floor(rect.width - 8), Math.floor(rect.height - 8)).data;
      const helder = [], kleuren = new Set(); let licht = 0;
      for (let i = 0; i < data.length; i += 4) {
        const waarde = (data[i] + data[i + 1] + data[i + 2]) / 3;
        helder.push(waarde); if (waarde > 120) licht++;
        kleuren.add((data[i] >> 3) + ':' + (data[i + 1] >> 3) + ':' + (data[i + 2] >> 3));
      }
      helder.sort((a, b) => a - b);
      return { spreiding: helder[Math.floor(helder.length * 0.95)] - helder[Math.floor(helder.length * 0.05)],
        lichtAandeel: licht / helder.length, kleurVakken: kleuren.size };
    }, { png: beeld.toString('base64'), rect: vlak });
    t.diagnostic('Werkelijke wereldpixels: ' + JSON.stringify(pixels));
    assert.ok(pixels.spreiding > 40 && pixels.lichtAandeel > 0.05 && pixels.kleurVakken > 20,
      'foto en lichte opschriften moeten zichtbaar geschilderd zijn; alleen een donkere was met klikbare DOM is niet genoeg: ' + JSON.stringify(pixels));
    assert.equal(await page.locator('#shell').evaluate(el => getComputedStyle(el, '::before').content), 'none',
      'de actieve Command verwijdert uitsluitend de overlappende shellwas');
    assert.deepEqual(fouten, []);
    const gast = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const deur = await gast.newPage();
    await deur.goto(srv.base + '/apps/app.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await deur.waitForFunction(() => document.querySelector('#levendegrond-stijl')?.sheet);
    assert.notEqual(await deur.locator('#shell').evaluate(el => getComputedStyle(el, '::before').content), 'none',
      'de gewone niet-ingelogde shell behoudt de levende grond');
    await gast.close(); await ctx.close();
  } finally {
    if (browser) await browser.close(); await h.stop(srv);
    fs.rmSync(map, { recursive: true, force: true });
  }
});
