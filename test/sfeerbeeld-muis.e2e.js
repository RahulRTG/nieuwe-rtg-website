'use strict';
/* "Sfeerbeeld wijzigen" op het Overzicht is met een muis bereikbaar (19 oktober
   2026). De sfeerbeeldstrook (.wp-atmosphere) staat op pointer-events:none, zodat
   hij de inhoud eronder niet blokkeert; daardoor kreeg hij nooit :hover, en de
   desktopregel hield de knop onzichtbaar en onklikbaar. Alleen het toetsenbord en
   de Edge kwamen erbij. Deze toets beweegt de MUIS naar de knop en klikt hem,
   zonder force en zonder focus, en ziet de beeldeditor openen. */
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, letOpFouten } = require('./helper');
let srv, browser, token;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DEMO: '0' } });
  const pw = laadPlaywright(); assert.ok(pw, 'een echte browser is nodig'); browser = await pw.chromium.launch(browserOpties(pw));
  const n = Date.now();
  const r = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sfeerbeeld', email: 'sfeer-' + n + '@e.test', phone: '06' + String(n).slice(-8), password: 'geheim123',
      geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business' }) });
  token = (await r.json()).token; assert.ok(token);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

for (const breedte of [1440, 1100]) test('de muis bereikt "Sfeerbeeld wijzigen" op het Overzicht en opent de beeldeditor (' + breedte + ' px)', async () => {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: 1040 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, token);
  const page = await ctx.newPage(), fouten = []; letOpFouten(page, fouten);
  try {
    await page.goto(srv.base + '/apps/rtg.html'); await page.waitForSelector('body[data-rtg-desktop-state="ready"]');
    await page.waitForFunction(() => document.body.dataset.rtgWorldStart === 'ready');
    const knop = page.locator('.wp-atmosphere > .pi-change');
    await knop.waitFor({ state: 'attached' });
    const vak = await knop.boundingBox(); assert.ok(vak && vak.width > 0, 'de knop heeft geen plek op het scherm');
    await page.mouse.move(vak.x + vak.width / 2, vak.y + vak.height / 2);
    assert.equal(await knop.evaluate((el) => getComputedStyle(el).opacity), '1', 'onder de muis hoort de knop zichtbaar te zijn');
    await knop.click({ timeout: 4000 });
    await page.waitForSelector('.pi-editor[open]', { timeout: 4000 });
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
