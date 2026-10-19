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
  /* hidden verbergt ook een component met een eigen display (reset.css). */
  const verborgen = await page.evaluate(() => ['ds-kaart', 'ds-knop', 'ds-lijst', 'ds-chips', 'ds-status'].map(k => {
    const el = document.createElement('div'); el.className = k; el.hidden = true;
    document.querySelector('.ds-scherm').appendChild(el);
    const d = getComputedStyle(el).display; el.remove(); return k + ':' + d;
  }));
  assert.deepEqual(verborgen.filter(v => !v.endsWith(':none')), [], 'hidden verliest van een component');
  if (process.env.RTG_DS_BEELDEN) {
    fs.mkdirSync(process.env.RTG_DS_BEELDEN, { recursive: true });
    await page.screenshot({ path: path.join(process.env.RTG_DS_BEELDEN, 'voorbeeld.png'), fullPage: true });
  }
  assert.deepEqual(fouten, []);
  await ctx.close();
});

/* De nadruk (ONTWERPSYSTEEM.md par. 7) verandert echt iets: per schermtype de
   standaard uit contract.json, en data-ds-nadruk op een deel verlegt hem voor
   alleen dat deel. Gemeten op de berekende stijl, niet op de klassenaam. */
test('de nadruk volgt het schermtype en laat zich per deel verleggen', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(srv.base + '/ds/voorbeeld.html', { waitUntil: 'domcontentloaded' });
  const meet = await page.evaluate(standaard => {
    const uit = {};
    const maak = (type, nadruk) => {
      const s = document.createElement('div'); s.className = 'ds-scherm';
      if (type) s.setAttribute('data-ds-schermtype', type);
      if (nadruk) s.setAttribute('data-ds-nadruk', nadruk);
      s.innerHTML = '<h2 class="ds-titel">Titel</h2><section class="ds-sectie">x</section><div class="ds-status"><p class="ds-status__titel">Klaar</p></div><div class="ds-knop">k</div>';
      document.body.append(s);
      const cs = el => getComputedStyle(s.querySelector(el));
      const r = { titel: cs('.ds-titel').fontSize, lucht: cs('.ds-sectie').marginBlockStart, uitkomst: cs('.ds-status__titel').fontSize, duur: getComputedStyle(s).getPropertyValue('--ds-duur').trim() };
      s.remove(); return r;
    };
    for (const t of Object.keys(standaard)) uit[t] = maak(t);
    for (const n of ['beleving', 'balans', 'gereedschap', 'bevestiging']) uit['n:' + n] = maak('collectie', n);
    return uit;
  }, contract.nadrukStandaard);
  for (const [t, n] of Object.entries(contract.nadrukStandaard)) assert.deepEqual(meet[t], meet['n:' + n], t + ' volgt zijn standaard ' + n);
  assert.equal(meet['n:beleving'].lucht, '64px');
  assert.equal(meet['n:balans'].lucht, '48px');
  assert.equal(meet['n:gereedschap'].lucht, '32px');
  assert.ok(parseFloat(meet['n:gereedschap'].titel) < parseFloat(meet['n:balans'].titel), 'gereedschap: compactere kop');
  assert.ok(parseFloat(meet['n:bevestiging'].uitkomst) > parseFloat(meet['n:balans'].uitkomst), 'bevestiging: de uitkomst groter');
  assert.notEqual(meet['n:gereedschap'].duur, meet['n:beleving'].duur, 'gereedschap beweegt korter');
  await ctx.close();
});
