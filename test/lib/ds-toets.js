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
const scriptRij = require('../../server/middleware/scriptbundel-rij');

/* Elk actief blad, met de bundel uitgepakt tot de bladen die erin zitten. */
async function bladen(page) {
  const hrefs = await page.evaluate(() => {
    const bezocht = new Set(), uit = [];
    function lees(blad) {
      if (bezocht.has(blad)) return;
      bezocht.add(blad);
      if (blad.href) uit.push(blad.href);
      // @import is ook actief: alleen document.styleSheets lezen mist juist
      // de transitieve laag waar oude architectuur zich kan verbergen.
      for (const regel of blad.cssRules) if (regel.type === CSSRule.IMPORT_RULE) {
        if (!regel.styleSheet) throw Error('Ongelezen stijlimport: ' + regel.href);
        lees(regel.styleSheet);
      }
    }
    [...document.styleSheets].forEach(lees);
    return uit;
  });
  const uit = [];
  for (const h of hrefs) {
    const u = new URL(h);
    if (u.pathname === PAD) {
      uit.push(...decodeer(u.searchParams.get('f')));
      // De bestaande bundelaar lost imports inline op: CSSOM bewaart dan
      // geen IMPORT_RULE. Lees de door diezelfde server geleverde herkomst-
      // markeringen, zodat een ingesloten legacyblad niet onzichtbaar wordt.
      const antwoord = await page.request.get(h);
      assert.equal(antwoord.status(), 200, 'de actieve stijlbundel is uitleesbaar');
      const css = await antwoord.text();
      for (const m of css.matchAll(/^\/\* @import (\/[^\s:]+\.css)(?:: al ingesloten)? \*\//gm)) uit.push(m[1]);
    } else uit.push(u.pathname);
  }
  return [...new Set(uit)];
}

/* Dezelfde manifestdecoder als de server; een bundelnaam bewijst geen levering.
   Bronaanwezigheid/levering is geen bewijs dat al het basisgedrag slaagt. */
async function scriptsVan(page) {
  const urls = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean));
  const uit = [];
  for (const src of urls) {
    const u = new URL(src);
    if (u.pathname !== scriptRij.PAD) { uit.push(u.pathname); continue; }
    const paden = scriptRij.decodeer(u.searchParams.get('f'));
    assert.ok(paden.length && paden.length <= 60, 'actieve scriptbundel heeft geldig manifest');
    for (const pad of paden) {
      assert.ok(scriptRij.GOED_PAD.test(pad) && !pad.includes('..') && pad !== scriptRij.PAD,
        'actieve scriptbundel bevat oncontroleerbaar pad: ' + pad);
    }
    const antwoord = await page.request.get(src);
    assert.equal(antwoord.status(), 200, 'de verwezen scriptbundel wordt geleverd');
    assert.match(antwoord.headers()['content-type'] || '', /^(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i,
      'de scriptbundel levert JavaScript, geen foutpagina');
    const js = await antwoord.text();
    // Markeringen uit de bestaande server/middleware/scriptbundel.omwikkel.
    // Een 200-fallback, verkeerde cache-inhoud of afgebroken bron telt niet mee.
    const geleverd = [...js.matchAll(/^\/\* (\/[^\n]+\.js) \*\/\ntry \{\n/gm)].map(m => m[1]);
    assert.deepEqual(geleverd, paden, 'de geleverde bronvolgorde komt overeen met het bundelmanifest');
    for (const pad of paden) assert.ok(js.includes('/* ' + pad + ' */\ntry {\n') &&
      js.includes('} catch (e) { console.error("[rtg] script ' + pad + ' ging mis:", e); }\n'),
    'de geleverde bundel bevat de volledige bronmarkeringen van ' + pad);
    uit.push(...paden);
  }
  return [...new Set(uit)];
}

/* Geen erfenisblad, het Design System geladen, en wat contract.json dsPoort
   dicht noemt laadt hier werkelijk niet. basis: de expliciete bronverwijzing
   moet aanwezig zijn (een openbare gastdeur laat hem met opzet buiten de deur).
   Werkelijk basisgedrag wordt in de gerichte functionele proeven beoordeeld. */
async function alleenDs(page, { basis = true } = {}) {
  const lijst = await bladen(page);
  assert.ok(lijst.length, 'er is minstens een blad actief');
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'), 'het Design System is geladen');
  assert.equal(await page.locator('.rtgsprong-greep').count(), 0, 'de sprong tekent geen eigen greep naast de Edge');
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await scriptsVan(page);
  for (const dicht of contract.dsPoort['public/shared/basis.js']) {
    if (dicht === '/shared/randen.js' && scripts.includes(dicht)) {
      const bron = fs.readFileSync(path.join(__dirname, '..', '..', 'public', new URL(page.url()).pathname), 'utf8');
      assert.ok(bron.includes('<script src="/shared/randen.js"'), 'Randen is een expliciete schermverantwoordelijkheid');
      // De bestaande owner begint uitgesteld na DOMContentLoaded. Wacht op
      // zijn echte ingang; de aanwezigheid van een scripttag is geen ready-signaal.
      await page.locator('.rnd-toets.ds-randen-toets').waitFor({state:'visible'});
      assert.equal(await page.locator('#rtgRandenJs,#rndCss').count(), 0, 'basis start geen tweede of legacy Randen-owner');
      assert.equal(await page.locator('.rnd-toets.ds-randen-toets').count(), 1, 'één canonieke Randen-ingang');
      assert.equal(await page.locator('.rnd-toets:not(.ds-randen-toets),.rnd-hint:not(.ds-randen-hint)').count(), 0);
      assert.ok(lijst.includes('/ds/componenten/randen.css'), 'Randen gebruikt canonieke presentatie');
      continue;
    }
    if (dicht === '/shared/ios.js' && scripts.includes(dicht)) {
      // Basis laadt iOS niet op DS. Een gemigreerde werkruimte mag zijn
      // expliciete gebaren-owner behouden, mits diens DS-tak werkelijk actief
      // is. Oude iOS-presentatie mag daarbij nergens terugkomen.
      const bron = fs.readFileSync(path.join(__dirname, '..', '..', 'public', new URL(page.url()).pathname), 'utf8');
      assert.ok(bron.includes('<script src="/shared/ios.js"'), 'iOS is een expliciete schermverantwoordelijkheid');
      assert.equal(await page.locator('body.ds-ios-host:not([data-ios])').count(), 1);
      assert.equal(await page.locator('.ios-nav, #rtg-ios-thuis-basis, #rtg-ios-acties-basis').count(), 0);
      assert.ok(lijst.includes('/ds/componenten/ios.css'), 'gebaren hebben hun canonieke presentatie');
      continue;
    }
    assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt op een ds-scherm terwijl de ds-poort hem dicht noemt');
  }
  if (basis) assert.ok(scripts.includes('/shared/basis.js'), 'de basis is expliciet opgenomen');
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  assert.equal(await page.locator('.rtg-adaptive-bar,.rtg-edge-chrome').count(), 0, 'geen oude Edge');
  if (await page.locator('.wd-shell').count()) {
    assert.equal(await page.locator('body.ds-wereldwerkruimte > .wd-shell').count(), 1, 'bestaande runtime gebruikt zijn canonieke eigenaar');
    assert.ok(lijst.includes('/ds/componenten/wereldwerkruimte.css'), 'werkruimtepresentatie is aangesloten');
    assert.equal(await page.locator('.wd-shell').evaluate(el => getComputedStyle(el).display),
      await page.evaluate(() => innerWidth < 1000 ? 'contents' : 'grid'), 'bestaande mobiele en desktopindeling');
  }
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

/* Native dialogen mogen browserchrome bereiken, nooit de achterliggende app.
   Dezelfde grens als de bestaande sneltoetsproef, inclusief terugkeer. */
async function nativeModalTab(page, dialoog) {
  const vorige = await page.evaluateHandle(() => document.activeElement);
  try {
    assert.equal(await dialoog.evaluate(el => el.matches(':modal') && el.contains(document.activeElement)), true);
    await page.keyboard.press('Tab');
    const f = await dialoog.evaluate(el => ({ binnen: el.contains(document.activeElement),
      modal: el.matches(':modal'), documentFocus: document.hasFocus(), tag: document.activeElement.tagName }));
    assert.ok(f.modal && (f.binnen || !f.documentFocus && f.tag === 'BODY'), JSON.stringify(f));
    if (!f.binnen) {
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialoog.evaluate((el, vorige) => el.contains(document.activeElement) && document.activeElement === vorige, vorige), true, 'terugkeer uit browserchrome naar hetzelfde dialoogveld');
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      assert.equal(await dialoog.evaluate(el => el.matches(':modal') && el.contains(document.activeElement)), true, 'volgende cyclus keert terug in de dialoog');
    }
  } finally { await vorige.dispose(); }
}

module.exports = { scriptsVan, bladen, alleenDs, edgeLabels, edgeActies, geenOverloop, beeld, nativeModalTab };
