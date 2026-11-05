/* Componentproef met echte DS-bladen en RTGGlyf; geen gekopieerde product-CSS.
   De donkere variant is het bestaande cover-oppervlak, geen nieuw dark theme.
   Tekstzoom vergroot de rootletter naar 200%; dit is geen toestel-/mensproef. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser;
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' } });
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

const controls = [
  ['button', 'ds-knop', 'knop'], ['a', 'ds-knop', 'link'],
  ['button', 'ds-knop ds-knop--klein', 'klein-knop'], ['a', 'ds-knop ds-knop--klein', 'klein-link'],
  ['button', 'ds-chip', 'chip-knop'], ['a', 'ds-chip', 'chip-link']
];
const html = `<!doctype html><html lang="nl" data-ds="1"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><title>DS bediening componentproef</title>
  <link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/ds/rtg-ds.css">
  <script src="/shared/glyf.js" defer></script></head><body class="ds-scherm" tabindex="-1">
  <main class="ds-taak">${controls.map(([tag, klasse, id]) => `<p><${tag} id="${id}" class="${klasse}" ${tag === 'a' ? 'href="#resultaat"' : 'type="button"'}><span data-proef-glyf></span><span>Open werk</span></${tag}></p>`).join('')}
  <p id="resultaat">Bestemming van deze lokale componentproef.</p></main>
  <dialog class="ds-dialoog" id="proef-dialoog" aria-labelledby="dialoog-titel">
    <h2 id="dialoog-titel">Uw keuze</h2><p>Lichte systeemlaag boven de cover.</p>
    <p><button class="ds-knop" id="dialoog-sluiten" type="button" autofocus>Sluiten</button></p>
    <p><a class="ds-knop" id="dialoog-verder" href="#resultaat">Verder</a></p>
  </dialog></body></html>`;

/* WCAG relatieve luminantie, gemeten uit de werkelijk berekende, ondoorzichtige
   RGB-kleuren. Een onverwachte transparante kleur is geen geldig contrastbewijs. */
function luminantie(kleur) {
  const m = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(kleur);
  assert.ok(m, 'onbekende berekende kleur: ' + kleur);
  assert.equal(m[4] === undefined ? 1 : Number(m[4]), 1, 'contrast vraagt een ondoorzichtige kleur: ' + kleur);
  const c = m.slice(1, 4).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function contrast(a, b) { const x = luminantie(a), y = luminantie(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }

for (const donker of [false, true]) test('DS bediening: ' + (donker ? 'donkere cover' : 'lichte grond') + ', echte kleuren, doelen, glyfen en toetsenbordfocus', { skip }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(), fouten = letOpFouten(page, []);
    // Alleen het proefdocument is een fixture. Alle CSS, fonts en glyfcode
    // worden ongewijzigd door de echte RTG-server geleverd.
    await page.route('**/__ds-bediening-proef', r => r.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(srv.base + '/__ds-bediening-proef', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.RTGGlyf && getComputedStyle(document.querySelector('.ds-knop')).display === 'inline-flex');
    await page.evaluate(async donker => {
      document.body.classList.toggle('ds-scherm--cover', donker);
      document.querySelector('main').className = donker ? 'ds-cover' : 'ds-taak';
      for (const el of document.querySelectorAll('[data-proef-glyf]')) el.outerHTML = RTGGlyf.tekst('paneel');
      await document.fonts.ready;
    }, donker);
    const basis = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const normaal = new Map();
    for (const width of [390, 820, 1440]) for (const zoom of [1, 2]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(({ basis, zoom }) => { document.documentElement.style.fontSize = (basis * zoom) + 'px'; }, { basis, zoom });
      const meting = await page.evaluate(() => ({
        grond: getComputedStyle(document.body).backgroundColor,
        venster: document.documentElement.clientWidth, inhoud: document.documentElement.scrollWidth,
        controls: [...document.querySelectorAll('main button,main a')].map(el => {
          const c = getComputedStyle(el), r = el.getBoundingClientRect(), svg = el.querySelector('svg'), g = svg?.getBoundingClientRect();
          return { id: el.id, rect: r.toJSON(), tekst: c.color, grond: c.backgroundColor,
            rand: c.borderColor, randstijl: c.borderStyle, randmaat: c.borderWidth,
            letter: c.fontFamily, maat: parseFloat(c.fontSize), zicht: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
            inhoud: el.scrollWidth, breedte: el.clientWidth, glyf: g?.toJSON(), verborgen: svg?.getAttribute('aria-hidden'),
            tab: svg?.tabIndex, naam: el.textContent.trim() };
        })
      }));
      const label = JSON.stringify({ donker, width, zoom });
      if (zoom === 1) normaal.set(width, meting.controls);
      assert.ok(meting.inhoud <= meting.venster + 1, 'geen horizontale pagina-overloop ' + label);
      assert.equal(meting.controls.length, controls.length);
      for (const c of meting.controls) {
        const detail = label + ' ' + JSON.stringify(c);
        assert.ok(c.zicht && c.rect.width >= 44 && c.rect.height >= 44, 'zichtbaar 44px-doel ' + detail);
        assert.ok(c.rect.left >= 0 && c.rect.right <= width + 1 && c.inhoud <= c.breedte + 1, 'tekst past binnen bediening ' + detail);
        assert.ok(contrast(c.tekst, c.grond) >= 4.5, 'normaal tekstcontrast minstens 4.5:1 ' + detail);
        assert.equal(c.verborgen, 'true', 'decoratief glyf blijft buiten toegankelijke naam ' + detail);
        assert.ok(c.tab < 0 && c.glyf && c.glyf.width >= c.maat * .9 && c.glyf.width <= c.maat * 1.5 &&
          c.glyf.height >= c.maat * .9 && c.glyf.height <= c.maat * 1.5, 'glyf blijft tekstgebonden, ook bij zoom ' + detail);
        assert.ok(c.glyf.left >= c.rect.left && c.glyf.right <= c.rect.right && c.glyf.top >= c.rect.top && c.glyf.bottom <= c.rect.bottom, 'glyf past binnen bediening ' + detail);
        assert.equal(c.naam, 'Open werk');
        if (zoom === 2) {
          const voor = normaal.get(width).find(v => v.id === c.id);
          assert.ok(c.maat >= voor.maat * 1.99 && c.maat <= voor.maat * 2.01 &&
            c.glyf.width >= voor.glyf.width * 1.95 && c.glyf.width <= voor.glyf.width * 2.05,
          '200% tekst vergroot ook het glyf zonder vaste pixelmaat ' + detail);
        }
      }
      for (let i = 0; i < meting.controls.length; i += 2) {
        const knop = meting.controls[i], link = meting.controls[i + 1];
        for (const veld of ['tekst', 'grond', 'rand', 'randstijl', 'randmaat', 'letter', 'maat'])
          assert.equal(knop[veld], link[veld], 'knop en navigatielink delen presentatie: ' + veld + ' ' + label);
      }
      await page.evaluate(() => document.body.focus());
      for (const [, , id] of controls) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => {
          const el = document.activeElement, c = getComputedStyle(el), r = el.getBoundingClientRect();
          return { id: el.id, zichtbaar: el.matches(':focus-visible'), kleur: c.outlineColor, stijl: c.outlineStyle,
            maat: parseFloat(c.outlineWidth), afstand: parseFloat(c.outlineOffset), schaduw: c.boxShadow, rect: r.toJSON() };
        });
        const detail = label + ' ' + JSON.stringify(focus);
        assert.equal(focus.id, id, 'Tab volgt semantische bediening, niet decoratieve glyfen ' + detail);
        assert.ok(focus.zichtbaar && !['none', 'hidden'].includes(focus.stijl) && focus.maat >= 2 && focus.afstand >= 2, 'zichtbare focusring ' + detail);
        assert.ok(contrast(focus.kleur, meting.grond) >= 3, 'focus contrasteert minstens 3:1 met aangrenzende schermgrond ' + detail);
        if (donker) {
          const ring = /^(rgba?\([^)]*\))\s+0px\s+0px\s+0px\s+([\d.]+)px$/.exec(focus.schaduw);
          assert.ok(ring, 'coverfocus heeft een ondoorzichtige onderring voor fotografie ' + detail);
          assert.equal(ring[1], meting.grond, 'onderring gebruikt de donkere covergrond ' + detail);
          assert.ok(Number(ring[2]) >= focus.afstand + focus.maat && contrast(focus.kleur, ring[1]) >= 3,
            'onderring draagt de volledige focusring met voldoende contrast ' + detail);
        }
        assert.ok(focus.rect.left >= focus.maat + focus.afstand && focus.rect.right + focus.maat + focus.afstand <= width, 'focusring niet horizontaal afgesneden ' + detail);
      }
      if (donker) {
        await page.evaluate(() => document.getElementById('proef-dialoog').showModal());
        assert.equal(await page.locator('#proef-dialoog').evaluate(el => el.matches(':modal')), true);
        // De native dialoog woont naast de cover, zoals de bestaande overlays.
        // Een globale donkere focustoken mag zijn lichte grond niet aantasten.
        for (const [toets, id] of [['Tab', 'dialoog-verder'], ['Shift+Tab', 'dialoog-sluiten']]) {
          await page.keyboard.press(toets);
          const d = await page.evaluate(() => {
            const el = document.activeElement, c = getComputedStyle(el), dialog = document.getElementById('proef-dialoog');
            return { id: el.id, modal: dialog.matches(':modal'), inDialoog: dialog.contains(el),
              focus: el.matches(':focus-visible'), kleur: c.outlineColor, stijl: c.outlineStyle,
              maat: parseFloat(c.outlineWidth), schaduw: c.boxShadow, tekst: c.color, knopgrond: c.backgroundColor,
              grond: getComputedStyle(dialog).backgroundColor, rect: el.getBoundingClientRect().toJSON() };
          });
          const detail = label + ' ' + JSON.stringify(d);
          assert.equal(d.id, id, 'toetsenbord blijft in de native dialoog ' + detail);
          assert.ok(d.modal && d.inDialoog && d.focus && d.maat >= 2 && !['none', 'hidden'].includes(d.stijl), 'dialoogfocus blijft zichtbaar ' + detail);
          assert.ok(luminantie(d.grond) > .8 && contrast(d.kleur, d.grond) >= 3, 'focus op lichte dialoog behoudt minstens 3:1 ' + detail);
          assert.ok(contrast(d.tekst, d.knopgrond) >= 4.5 && d.rect.width >= 44 && d.rect.height >= 44, 'dialoogbediening leesbaar en raakbaar ' + detail);
          assert.equal(d.schaduw, 'none', 'coveronderring lekt niet naar de lichte dialoog ' + detail);
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#proef-dialoog').evaluate(el => el.open), false);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'chip-link', 'native dialoog herstelt coverfocus');
      }
    }
    assert.deepEqual(fouten, []);
  } finally { await context.close(); }
});
