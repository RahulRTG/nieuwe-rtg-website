/* De voorbeeldpagina van het RTG Design System (/ds/voorbeeld.html): elk
   schermtype in een telefoonkader, om naast de goedgekeurde mockups te leggen.

   Wat deze toets eist: alleen /ds/ en /fonts/ actief (de voorbeeldpagina is
   zelf een ds-scherm en valt onder dezelfde regel), precies de schermtypen
   uit contract.json in die volgorde, geen horizontale overloop BINNEN een
   kader (een scherm reageert op zijn eigen breedte, @container ds), de Edge
   onderaan elk kader en geen paginafouten. Zet RTG_DS_BEELDEN=<map> om het
   overzicht te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { decodeer, PAD } = require('../server/middleware/stijlbundel-rij');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
let srv, browser;

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('de voorbeeldpagina toont elk schermtype uit het contract, alleen met het Design System', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 3400, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/ds/voorbeeld.html', { waitUntil: 'domcontentloaded' });
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const bladen = hrefs.flatMap(h => { const u = new URL(h); return u.pathname === PAD ? decodeer(u.searchParams.get('f')) : [u.pathname]; });
  for (const b of bladen) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad op de voorbeeldpagina: ' + b);
  const namen = await page.locator('.ds-toestel__naam').allTextContents();
  assert.deepEqual(namen.map(n => n.toLowerCase()), contract.schermtypen);
  const kaders = await page.locator('.ds-toestel__scherm').evaluateAll(xs => xs.map(x => {
    const edge = x.querySelector('.ds-edge'), k = x.getBoundingClientRect(), e = edge && edge.getBoundingClientRect();
    return { breed: x.scrollWidth, venster: x.clientWidth, edgeOnder: e ? Math.round(k.bottom - e.bottom) : null };
  }));
  kaders.forEach((k, i) => {
    assert.ok(k.breed <= k.venster, contract.schermtypen[i] + ' loopt horizontaal over in zijn kader');
    assert.ok(k.edgeOnder !== null && k.edgeOnder >= 0 && k.edgeOnder < 40, contract.schermtypen[i] + ': de Edge staat niet onderaan het kader');
  });
  if (process.env.RTG_DS_BEELDEN) {
    fs.mkdirSync(process.env.RTG_DS_BEELDEN, { recursive: true });
    await page.screenshot({ path: path.join(process.env.RTG_DS_BEELDEN, 'voorbeeld.png'), fullPage: true });
  }
  assert.deepEqual(fouten, []);
  await ctx.close();
});
