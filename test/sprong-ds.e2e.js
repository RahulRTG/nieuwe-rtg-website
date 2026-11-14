/* Werkelijke gedeelde Sprong op Wonen, met native DS-modaliteit. De vertraagde
   catalogus is een gerichte transporttegenproef, geen complete ketenkwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(); let srv, browser, token;
test.before(async () => {
  if (geenBrowser(pw)) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' } });
  const r = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sprong DS', email: 'sprong-ds@example.test', phone: '0612345871', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' }) });
  assert.equal(r.status, 200); token = (await r.json()).token; assert.ok(token);
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
  const page = await context.newPage(), fouten = letOpFouten(page, []);
  return { page, context, fouten };
}
test('Sprong DS: echte index, toetsenbord, modaliteit, tekstvergroting en bestemming', { skip: geenBrowser(pw) }, async () => {
  const { page, context, fouten } = await open();
  try {
    await page.goto(srv.base + '/apps/wonen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGSprong && document.body.dataset.rtgDesktopState === 'ready');
    const ingang = page.locator('[data-ds-zoek]').first(), d = page.getByRole('dialog', { name: 'Spring naar een functie', exact: true });
    await page.waitForFunction(() => !!window.RTGPalet);
    await page.keyboard.press('Control+Space'); await d.waitFor();
    assert.equal(await page.locator('.ds-sprong').count(), 1,
      'de historische Palet-sneltoets opent dezelfde Spotlight-owner en geen tweede dialoog');
    assert.equal(await page.locator('#rosPalet').count(), 0, 'de parallelle Palet-dialoog bestaat niet meer');
    await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' });
    for (const width of [390, 820, 1440]) for (const zoom of [100, 200]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(z => { document.documentElement.style.fontSize = z + '%'; }, zoom);
      await ingang.click(); await d.waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.rtgsprong-rij').length > 20);
      assert.equal(await d.evaluate(el => el.matches(':modal')), true);
      assert.equal(await page.locator('.rtgsprong-greep').count(), 0, 'de DS-kop blijft de enige ingang');
      const m = await d.evaluate(el => ({ r: el.getBoundingClientRect().toJSON(), w: el.clientWidth, scroll: el.scrollWidth,
        doelen: [...el.querySelectorAll('input,button')].map(x => x.getBoundingClientRect().toJSON()) }));
      assert.ok(m.scroll <= m.w + 1 && m.r.left >= 0 && m.r.right <= width + 1 && m.r.top >= 0 && m.r.bottom <= 845, JSON.stringify(m));
      assert.ok(m.doelen.every(r => r.width >= 44 && r.height >= 44), 'doelen minstens 44px');
      const input = d.getByRole('searchbox', { name: 'Zoek een functie' });
      await input.focus(); await page.keyboard.press('ArrowDown');
      assert.equal(await d.locator('.rtgsprong-rij').first().evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('ArrowUp'); assert.equal(await input.evaluate(el => el === document.activeElement), true);
      await page.evaluate(() => document.querySelector('[data-ds-zoek]').focus());
      assert.equal(await d.evaluate(el => el.contains(document.activeElement)), true);
      await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' });
      assert.equal(await ingang.evaluate(el => el === document.activeElement), true);
    }
    assert.equal((await page.locator('style').allTextContents()).some(s => s.includes('.rtgsprong-greep{')), false);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await ingang.click(); await d.waitFor();
    const input = d.getByRole('searchbox', { name: 'Zoek een functie' });
    await input.fill('zzzz-geen-functie'); await d.getByText('Niets gevonden. Wis het zoekwoord om alles te zien.').waitFor();
    await input.fill('pay'); await d.locator('.rtgsprong-rij').first().waitFor();
    await Promise.all([page.waitForURL('**/apps/pay.html'), input.press('Enter')]);
    assert.equal(new URL(page.url()).pathname, '/apps/pay.html');
    assert.deepEqual(fouten, []);
  } finally { await context.close(); }
});
test('Sprong DS: catalogusantwoord na sluiten steelt geen focus; heropenen werkt', { skip: geenBrowser(pw) }, async () => {
  const { page, context } = await open(); let pending;
  try {
    await page.route('**/shared/sprongindex.json', r => { pending = r; });
    await page.goto(srv.base + '/apps/wonen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGSprong && document.body.dataset.rtgDesktopState === 'ready');
    const ingang = page.locator('[data-ds-zoek]').first(), d = page.getByRole('dialog', { name: 'Spring naar een functie', exact: true });
    await ingang.click(); await d.waitFor();
    await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' });
    assert.ok(pending, 'catalogusaanvraag werkelijk onderschept');
    const response = await pending.fetch(); await pending.fulfill({ response }); await response.dispose();
    await page.waitForLoadState('networkidle');
    assert.equal(await ingang.evaluate(el => el === document.activeElement), true);
    await ingang.click(); await d.waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.rtgsprong-rij').length > 20);
    await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' });
    await page.locator('.ds-sprong').evaluate(el => el.remove());
    await ingang.click(); await d.waitFor();
    assert.equal(await page.locator('.ds-sprong').count(), 1, 'losgeraakte dialoog wordt vervangen');
  } finally { await context.close(); }
});
