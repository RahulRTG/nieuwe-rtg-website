/* Plek op de echte Navigatie-route: lokale sessie, echte zoek-/kaart-API.
   De GPS-teller roept de originele browsermethoden door; hij levert geen fix.
   We verlenen de browser toestemming, maar RTG krijgt geen toestemming:
   de applicatiepoort moet zelfstandig iedere GPS-aanroep tegenhouden. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, beeld } = require('./lib/ds-toets');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, token, tmp;
const opPad = (r, pad) => new URL(r.url()).pathname === pad && r.request().method() === 'POST';

test.before(async () => {
  if (skip) return;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-plek-ds-'));
  srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1',
    LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  const r = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Plek Lid', email: 'plek-ds@voorbeeld.test', phone: '0612345678',
      password: 'plekgeheim12', geboortedatum: '1991-02-02', tier: 'rtg', pasApp: 'rtg' }) });
  const j = await r.json(); assert.equal(r.status, 200, JSON.stringify(j)); token = j.token; assert.ok(token);
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => {
  if (browser) await browser.close(); if (srv) await stop(srv.child);
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

async function raakbaar(doel, naam) {
  await doel.scrollIntoViewIfNeeded();
  const m = await doel.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { r: r.toJSON(), hit: hit === el || el.contains(hit), geraakt: hit && hit.className };
  });
  assert.ok(m.r.width >= 44 && m.r.height >= 44 && m.hit, naam + ': ' + JSON.stringify(m));
}

const standen = [390, 820, 1440].flatMap(width => [100, 200].map(zoom => ({ width, height: 844, zoom })));
// Lage hoogte is een afzonderlijke proef, geen stilzwijgende claim voor alle schermhoogtes.
standen.push({ width: 390, height: 480, zoom: 200 });
for (const [i, stand] of standen.entries()) {
  const { width, height, zoom } = stand, escape = i % 2 === 1;
  test('Plek ' + width + '×' + height + ' / tekst ' + zoom + '%: ' + (escape ? 'Escape' : 'Nu niet') + ' → handmatig vertrek → kaart',
    { skip, timeout: 60000 }, async () => {
    const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block',
      reducedMotion: 'reduce', locale: 'nl-NL', permissions: ['geolocation'],
      geolocation: { latitude: 38.91, longitude: 1.43 } });
    try {
      await ctx.addInitScript(({ token, zoom }) => {
        localStorage.clear(); localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
        window.__plekGps = { getCurrentPosition: 0, watchPosition: 0, clearWatch: 0 };
        const geo = navigator.geolocation;
        for (const naam of Object.keys(window.__plekGps)) {
          const origineel = geo[naam].bind(geo);
          geo[naam] = (...args) => { window.__plekGps[naam]++; return origineel(...args); };
        }
        // Leg een echte, bestaande focusbestemming vast vóór de automatische
        // locatievraag. Geen productflag of aangepaste eigenaar.
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = zoom + '%';
          document.getElementById('zoek')?.focus();
        }, { once: true });
      }, { token, zoom });
      const page = await ctx.newPage(), fouten = letOpFouten(page, [], { eigenZeef: true });
      const kaartvragen = [];
      page.on('request', r => { if (new URL(r.url()).pathname === '/api/nav/kaart') kaartvragen.push(r.postDataJSON()); });
      const response = await page.goto(srv.base + '/apps/navigatie.html', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200); await page.evaluate(() => document.fonts.ready);
      const vraag = page.getByRole('dialog', { name: 'Locatie gebruiken', exact: true }), zoek = page.locator('#zoek');
      await vraag.waitFor();
      assert.equal(await vraag.getAttribute('aria-modal'), 'false');
      assert.equal(await vraag.evaluate(el => el.classList.contains('ds-plek') && !(el instanceof HTMLDialogElement)), true);
      assert.equal(await page.locator('.rtgplek').count(), 1);
      assert.equal(await vraag.getByRole('button', { name: 'Aanzetten', exact: true }).evaluate(el => el === document.activeElement), true);
      const m = await vraag.evaluate(el => ({ r: el.getBoundingClientRect().toJSON(), w: el.clientWidth, s: el.scrollWidth,
        letter: parseFloat(getComputedStyle(el.querySelector('p')).fontSize), wortel: parseFloat(getComputedStyle(document.documentElement).fontSize) }));
      assert.ok(m.r.left >= 0 && m.r.right <= width + 1 && m.r.top >= 0 && m.r.bottom <= height + 1 && m.s <= m.w + 1,
        'locatievraag past: ' + JSON.stringify({ stand, m }));
      assert.ok(m.letter >= m.wortel * 0.9, 'tekst volgt de ingestelde vergroting');
      await raakbaar(vraag.getByRole('button', { name: 'Nu niet', exact: true }), 'Nu niet');
      await raakbaar(vraag.getByRole('button', { name: 'Aanzetten', exact: true }), 'Aanzetten');
      await raakbaar(zoek, 'zoeken blijft bereikbaar naast de niet-modale vraag');
      const [gevonden] = await Promise.all([page.waitForResponse(r => opPad(r, '/api/nav/bestemmingen')),
        zoek.fill('laad')]);
      assert.equal(gevonden.status(), 200); assert.deepEqual(gevonden.request().postDataJSON(), { q: 'laad' });
      await page.locator('#res [role="option"]').first().waitFor();
      assert.equal(await zoek.evaluate(el => el === document.activeElement), true);
      assert.equal(await vraag.isVisible(), true, 'zoeken beantwoordt de locatievraag niet');
      assert.ok((await page.locator('#res .af').allTextContents()).every(t => !t.trim()), 'zonder locatie geen verzonnen afstand');
      assert.equal(kaartvragen.length, 0, 'er wordt zonder vertrekpunt geen kaart opgebouwd');
      await page.keyboard.press('Escape'); await page.locator('#res').waitFor({ state: 'hidden' });
      assert.equal(await vraag.isVisible(), true, 'Escape in zoeken sluit alleen de zoekresultaten');
      await beeld(page, 'plek-' + width + '-' + height + '-' + zoom);
      if (escape) {
        await vraag.getByRole('button', { name: 'Nu niet', exact: true }).focus(); await page.keyboard.press('Escape');
      } else await vraag.getByRole('button', { name: 'Nu niet', exact: true }).click();
      await vraag.waitFor({ state: 'hidden' });
      assert.equal(await zoek.evaluate(el => el === document.activeElement), true, 'focus keert terug naar de bestaande zoektaak');
      await page.locator('#manualStart').waitFor();
      assert.match(await page.locator('#poortReden').textContent(), /niet vrijgegeven[\s\S]*verzint nooit/);
      assert.equal(await page.locator('#liveBadge').textContent(), 'Locatie onbekend');
      assert.equal(await page.evaluate(() => RTGPlek.vraag()), null, 'een volgende vraag respecteert Nu niet');
      assert.equal(await page.locator('.rtgplek').count(), 0, 'geen herhaalde toestemmingskaart');
      assert.notEqual(await page.evaluate(() => localStorage.getItem('rtg_os_gps')), '1');
      await raakbaar(page.locator('#manualStart'), 'handmatig vertrek');
      const [vertrek] = await Promise.all([page.waitForResponse(r => opPad(r, '/api/nav/bestemmingen')),
        page.locator('#manualStart').click()]);
      assert.equal(vertrek.status(), 200);
      const opties = (await vertrek.json()).bestemmingen; assert.ok(opties.length > 0);
      const eerste = page.locator('#startResultaten button').first(); await eerste.waitFor();
      assert.equal(await eerste.locator('strong').textContent(), opties[0].naam);
      await raakbaar(eerste, 'werkelijke vertrekkeuze');
      const [kaart] = await Promise.all([page.waitForResponse(r => opPad(r, '/api/nav/kaart')), eerste.click()]);
      assert.equal(kaart.status(), 200);
      const data = await kaart.json(); assert.ok(data.ref && Array.isArray(data.plekken) && data.plekken.length > 0);
      assert.deepEqual(kaart.request().postDataJSON(), { lat: opties[0].lat, lng: opties[0].lng });
      await page.waitForFunction(() => document.getElementById('poort').hidden &&
        document.getElementById('main').getAttribute('aria-busy') === 'false' && window.RTGNav.S.kaartBegonnen);
      assert.equal(await page.evaluate(() => RTGNav.S.kaartData.plekken.length), data.plekken.length);
      assert.equal(await page.locator('#kaart').isVisible(), true);
      assert.equal(await page.locator('#kaart').evaluate(el => el.width > 0 && el.height > 0 &&
        el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0), true);
      assert.match(await page.locator('#liveBadge').textContent(), /Demonstratienet|actief/);
      assert.deepEqual(await page.evaluate(() => window.__plekGps), { getCurrentPosition: 0, watchPosition: 0, clearWatch: 0 },
        'handmatig vertrek vraagt ook later geen GPS zonder toestemming');
      assert.equal(await page.locator('style').evaluateAll(els => els.some(el => el.textContent.includes('.rtgplek{'))), false,
        'geen oude Plek-stijlinjectie');
      await alleenDs(page); assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  });
}
