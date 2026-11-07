/* Componentproef met echte i18n-bundel, DS-CSS en native dialoog.
   Het talenendpoint gebruikt het werkelijke register. Vertaal- en spraakdata
   zijn expliciete fixtures: geen claim over provider- of microfoonkwaliteit. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { TALEN } = require('../server/talen');
const pw = laadPlaywright(), skip = geenBrowser(pw), pub = path.join(__dirname, '../public');
let server, browser, base;
test.before(async () => {
  if (skip) return;
  server = http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    if (p === '/api/talen') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ talen: TALEN, alle: TALEN })); return; }
    if (p === '/api/vertaal/ui') {
      let raw = ''; for await (const deel of req) raw += deel; const body = JSON.parse(raw);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ naar: body.naar, teksten: body.teksten, voltooid: body.teksten.map(() => false), volledig: false })); return;
    }
    if (p === '/ds' || p === '/oud') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="nl"' + (p === '/ds' ? ' data-ds="1"' : '') + '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        (p === '/ds' ? '<link rel="stylesheet" href="/ds/rtg-ds.css"><link rel="stylesheet" href="/fonts/fonts.css">' : '') +
        '</head><body><main data-i18n-ignore><button id="ingang" data-language-picker>Taal kiezen</button>' +
        '<input id="concept" aria-label="Achtergrondconcept" value="Mijn werk"><button id="na">Andere actie</button></main>' +
        '<script src="/shared/i18n.js"></script></body></html>'); return;
    }
    if (!/^\/(ds|fonts|shared)\/[\w/.-]+$/.test(p)) { res.writeHead(404).end(); return; }
    const file = path.join(pub, p);
    if (!file.startsWith(pub + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', p.endsWith('.css') ? 'text/css' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'font/woff2');
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = 'http://127.0.0.1:' + server.address().port; browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(r => server.close(r)); });
async function open(pad, spreken = false) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(spraak => {
    localStorage.setItem('rtg_lang', 'nl');
    if (spraak) window.SpeechRecognition = class { constructor() { window.spraak = this; } start() { this.gestart = true; } };
  }, spreken);
  const page = await ctx.newPage(), fouten = letOpFouten(page, []);
  await page.goto(base + pad); await page.waitForFunction(() => window.RTGi18n?._alleTalen?.length === 114);
  return { ctx, page, fouten };
}
test('taalkeuze DS: native focus, RTL, 44px, drie breedtes en 200% tekst zonder globale stijlen', { skip }, async () => {
  const { ctx, page, fouten } = await open('/ds');
  try {
    const ingang = page.locator('#ingang'), dialog = page.locator('dialog.ds-taalkeuze');
    assert.equal(await page.locator('#rtg-i18n-styles').count(), 0);
    for (const width of [390, 820, 1440]) for (const zoom of [100, 200]) for (const dir of ['ltr', 'rtl']) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(([p, d]) => { document.documentElement.style.fontSize = p + '%'; document.documentElement.dir = d; }, [zoom, dir]);
      await ingang.click(); await dialog.waitFor();
      assert.equal(await dialog.evaluate(el => el.matches(':modal')), true);
      await page.waitForFunction(() => document.activeElement?.id === 'rtg-lang-zoek');
      const m = await dialog.locator('.rtg-lang-card').evaluate(el => ({ w: el.clientWidth, scroll: el.scrollWidth,
        r: el.getBoundingClientRect().toJSON(), doelen: [...el.querySelectorAll('button,input')].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect().toJSON()) }));
      assert.ok(m.scroll <= m.w + 1 && m.r.left >= -1 && m.r.right <= width + 1 && m.r.top >= -1 && m.r.bottom <= 845,
        width + '/' + zoom + '/' + dir + ': ' + JSON.stringify(m));
      assert.ok(m.doelen.every(b => b.width >= 44 && b.height >= 44), 'alle zichtbare bedieningsdoelen minstens 44px');
      await page.evaluate(() => document.getElementById('na').focus()); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      await page.keyboard.press('Shift+Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.id === 'ingang');
    }
    assert.equal(await page.locator('#concept').inputValue(), 'Mijn werk'); assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
test('taalkeuze: zoeken, Enter, snelle keuze, spraakfixture en onbekende taal behouden hetzelfde contract', { skip }, async () => {
  const { ctx, page, fouten } = await open('/ds', true);
  try {
    const ingang = page.locator('#ingang'), dialog = page.locator('dialog.ds-taalkeuze');
    await ingang.click(); await page.locator('#rtg-lang-zoek').fill('日本語');
    assert.equal(await page.locator('#rtg-lang-hint').getAttribute('data-lang'), 'ja');
    await page.locator('#rtg-lang-zoek').press('Enter'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_lang')), 'ja');
    await ingang.click(); await page.locator('#rtg-lang-zoek').fill('qqqqnonexistent');
    assert.equal(await page.locator('#rtg-lang-hint').isDisabled(), true); assert.equal(await page.locator('#rtg-lang-hint').getAttribute('data-lang'), null);
    await dialog.locator('.rtg-lang-quick[data-lang="nl"]').click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => RTGi18n.lang), 'nl');
    await ingang.click(); await page.locator('#rtg-lang-mic').click();
    assert.equal(await page.evaluate(() => spraak.gestart), true);
    await page.evaluate(() => { spraak.onresult({ results: [[{ transcript: 'English' }]] }); spraak.onend(); });
    await dialog.waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => localStorage.getItem('rtg_lang')), 'en');
    await ingang.click(); await dialog.locator('.rtg-lang-close').click(); await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.id === 'ingang');
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
test('taalkeuze legacy: hetzelfde native DS-component, zoekkeuze en Escape blijven bruikbaar', { skip }, async () => {
  const { ctx, page, fouten } = await open('/oud');
  try {
    assert.equal(await page.locator('#rtg-i18n-styles').count(), 1);
    await page.locator('#ingang').click(); await page.locator('dialog.ds-taalkeuze.open').waitFor();
    assert.equal(await page.locator('dialog.ds-taalkeuze').count(), 1);
    assert.equal(await page.locator('dialog.ds-taalkeuze').evaluate(el => el.matches(':modal')), true);
    await page.locator('#rtg-lang-zoek').fill('English'); await page.locator('#rtg-lang-submit').click();
    await page.locator('.rtg-lang-scrim').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_lang')), 'en');
    await page.locator('#ingang').click(); await page.keyboard.press('Escape'); await page.locator('dialog.ds-taalkeuze').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.id === 'ingang'); assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
