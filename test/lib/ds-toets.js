/* Gedeelde stappen voor de browsertoetsen van schermen op het RTG Design
   System (TRAVELOS-MIGRATIE.md par. 3), naar het model van
   test/hotels-ds.e2e.js: welke bladen werkelijk actief zijn (met de
   stijlbundel uitgepakt), of de ds-poort van de basis klopt, en of er iets
   horizontaal overloopt. Elke toets eist zelf wat zijn scherm belooft. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { decodeer, PAD } = require('../../server/middleware/stijlbundel-rij');

/* Elk actief blad, met de bundel uitgepakt tot de bladen die erin zitten. */
async function bladen(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const uit = [];
  for (const h of hrefs) {
    const u = new URL(h);
    if (u.pathname === PAD) uit.push(...decodeer(u.searchParams.get('f')));
    else uit.push(u.pathname);
  }
  return uit;
}

/* Geen erfenisblad, het Design System geladen, en wat contract.json dsPoort
   dicht noemt laadt hier werkelijk niet. basis: of de basis draait (een
   openbare gastdeur laat hem met opzet buiten de deur). */
async function alleenDs(page, { basis = true } = {}) {
  const lijst = await bladen(page);
  assert.ok(lijst.length, 'er is minstens een blad actief');
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'), 'het Design System is geladen');
  assert.equal(await page.locator('.rtgsprong-greep').count(), 0, 'de sprong tekent geen eigen greep naast de Edge');
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) {
    assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt op een ds-scherm terwijl de ds-poort hem dicht noemt');
  }
  if (basis) assert.ok(scripts.includes('/shared/basis.js') || scripts.includes('/scriptbundel.js'), 'de basis draait (gedrag blijft)');
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  assert.equal(await page.locator('.rtg-adaptive-bar,.wd-shell,.rtg-edge-chrome').count(), 0, 'geen oude Edge of schil');
}

async function edgeLabels(page) {
  return page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
}

/* De handelingen die de Edge onder Acties toont (data-ds-actie van het scherm). */
async function edgeActies(page) {
  await page.locator('[data-ds-edge="acties"]').click();
  const tekst = await page.locator('#dsEdgeBlad').textContent();
  await page.keyboard.press('Escape');
  return tekst;
}

async function geenOverloop(page) {
  const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
  assert.ok(maat.breed <= maat.venster, 'scrollWidth ' + maat.breed + ' > ' + maat.venster);
}

async function beeld(page, naam) {
  const map = process.env.RTG_DS_BEELDEN || '';
  if (!map) return;
  fs.mkdirSync(map, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(map, naam + '.png'), fullPage: !!process.env.RTG_DS_HEEL });
}

module.exports = { bladen, alleenDs, edgeLabels, edgeActies, geenOverloop, beeld };
