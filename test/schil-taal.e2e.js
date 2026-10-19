'use strict';
/* <html lang> ZEGT DE TAAL VAN DE INHOUD (19 oktober 2026).

   Op een toestel in het Engels zette i18n.js zonder keuze van het lid
   <html lang="en"> op elke pagina, ook als de inhoud Nederlands bleef: het
   vangnet vertaalt tekst zonder sleutel pas na een keuze. Een schermlezer las
   concierge.html dus Nederlands voor met een Engelse stem. Nu volgt lang de
   inhoud, en de schil draagt zelf een lang dat zegt wat zij toont.

   Drie standen, met een Engelse browser:
   - concierge.html, geen keuze, geen eigen sleutels: html nl, schil nl;
   - concierge.html na de keuze Engels: html en, schil en;
   - personeel.html, geen keuze, eigen sleutels: volgt de toesteltaal zoals
     voorheen (dat gedrag is een huisbesluit en blijft), html en, schil en. */
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, letOpFouten } = require('./helper');
let srv, browser;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DEMO: '0' } });
  const pw = laadPlaywright(); assert.ok(pw, 'een echte browser is nodig'); browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

async function meet(pad, keuze) {
  const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript((k) => { localStorage.setItem('rtg_cookieinfo_v1', '1'); if (k) localStorage.setItem('rtg_lang', k); }, keuze || '');
  const page = await ctx.newPage(), fouten = []; letOpFouten(page, fouten);
  try {
    await page.goto(srv.base + pad);
    await page.waitForSelector('.wd-people a.wd-person', { state: 'attached' });
    await page.waitForFunction(() => window.RTGi18n && window.RTGi18n.lang === 'en');
    assert.deepEqual(fouten, []);
    return await page.evaluate(() => {
      const paneel = document.querySelector('.wd-people');
      const a = paneel.querySelector('a.wd-person');
      return { html: document.documentElement.lang, paneel: (paneel.closest('[lang]') || {}).lang, link: (a.closest('[lang]') || {}).lang, tekst: a.textContent.trim() };
    });
  } finally { await ctx.close(); }
}

test('concierge.html zonder keuze: de inhoud is Nederlands, dus html en schil zijn nl', async () => {
  const m = await meet('/apps/concierge.html');
  assert.equal(m.html, 'nl', 'html lang zegt een andere taal dan de inhoud');
  assert.equal(m.tekst, 'Bekijk uw gesprekken');
  assert.equal(m.paneel, 'nl');
});

test('concierge.html na de keuze Engels: html en, en het personenpaneel draagt lang en', async () => {
  const m = await meet('/apps/concierge.html', 'en');
  assert.equal(m.html, 'en');
  assert.equal(m.tekst, 'View your conversations');
  assert.equal(m.paneel, 'en');
  assert.equal(m.link, 'en');
});

test('personeel.html draagt eigen sleutels en volgt zonder keuze de toesteltaal, met lang en', async () => {
  const m = await meet('/apps/personeel.html');
  assert.equal(m.html, 'en');
  assert.equal(m.tekst, 'View your conversations');
  assert.equal(m.paneel, 'en');
});

// Arrival gebruikt inmiddels de DS-schil zonder personenpaneel. De taalgrens
// blijft daar even belangrijk; test de echte pagina naast de erfenisschil.
for (const keuze of ['', 'en']) test('Arrival DS behoudt de inhoudstaal, keuze: ' + (keuze || 'geen'), async () => {
  const ctx = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' });
  await ctx.addInitScript(k => { localStorage.setItem('rtg_cookieinfo_v1', '1'); if (k) localStorage.setItem('rtg_lang', k); }, keuze);
  const page = await ctx.newPage();
  try {
    await page.goto(srv.base + '/apps/arrival.html');
    await page.waitForFunction(() => window.RTGi18n && window.RTGi18n.lang === 'en');
    assert.equal(await page.locator('html').getAttribute('lang'), keuze || 'nl');
    assert.equal(await page.locator('html').getAttribute('data-ds'), '1');
    assert.equal(await page.locator('.wd-people').count(), 0, 'DS hoort geen tweede erfenisschil te laden');
  } finally { await ctx.close(); }
});
