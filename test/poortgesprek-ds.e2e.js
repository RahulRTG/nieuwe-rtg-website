/* Echte Hotels-aanvraag → 428 → gegevensgesprek boven een native dialoog.
   Eigen lokale server/kluis, geen API-stubs, externe boeking of betaling.
   Dit bewijst deze DS-route; geen volledige gegevenspoort-/Experience-kwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, beeld } = require('./lib/ds-toets');
const pw = laadPlaywright();
const opPad = (response, pad) => new URL(response.url()).pathname === pad && response.request().method() === 'POST';

async function pastEnBereikbaar(page, poort, width, zoom) {
  const maten = await poort.evaluate(el => ({ rect: el.getBoundingClientRect().toJSON(),
    breed: el.clientWidth, inhoud: el.scrollWidth, hoogte: innerHeight,
    invoer: parseFloat(getComputedStyle(el.querySelector('.rp-in')).fontSize) }));
  assert.ok(maten.rect.left >= 0 && maten.rect.right <= width + 1 && maten.rect.top >= 0 &&
    maten.rect.bottom <= maten.hoogte + 1 && maten.inhoud <= maten.breed + 1,
  width + '/' + zoom + ': ' + JSON.stringify(maten));
  const doelen = poort.locator('button,input');
  for (let i = 0; i < await doelen.count(); i++) {
    const doel = doelen.nth(i); await doel.scrollIntoViewIfNeeded();
    const r = await doel.evaluate(el => {
      const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { width: b.width, height: b.height, hit: hit === el || el.contains(hit),
        naam: el.getAttribute('aria-label') || el.textContent || el.type };
    });
    assert.ok(r.width >= 44 && r.height >= 44 && r.hit, 'zichtbaar, onbedekt 44px-doel: ' + JSON.stringify(r));
  }
  return maten.invoer;
}

test('Hotels: echte 428 boven verblijfBlad, herstel, focus en één hervatte aanvraag op DS',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-poort-ds-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1',
      LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
    async function post(pad, body, token) {
      const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
      const j = await r.json(); assert.equal(r.status, 200, pad + ': ' + JSON.stringify(j)); return j;
    }
    const lid = await post('/api/auth/register', { name: 'Pia Gegevenspoort', email: 'poort-ds@voorbeeld.test',
      password: 'poortgeheim12', geboortedatum: '1991-02-02', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(lid.token);
    const nodig = () => post('/api/gegevens/nodig', { soort: 'reservering' }, lid.token);
    const mijn = () => post('/api/verblijf/mijn', {}, lid.token);
    assert.deepEqual((await nodig()).ontbreekt.map(v => v.veld), ['telefoon']);
    assert.deepEqual((await mijn()).verblijven, []);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
      serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'nl-NL' });
    try {
      await ctx.addInitScript(token => {
        localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, lid.token);
      const page = await ctx.newPage(), fouten = letOpFouten(page, [], { eigenZeef: true }), aanvragen = [];
      page.on('response', r => { if (opPad(r, '/api/verblijf')) aanvragen.push({ status: r.status(), body: r.request().postDataJSON() }); });
      const response = await page.goto(srv.base + '/apps/hotels.html', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await page.locator('[data-huis]').first().click();
      const verblijf = page.locator('#verblijfBlad'), boek = page.locator('#rBoek');
      assert.equal(await verblijf.evaluate(el => el instanceof HTMLDialogElement && el.matches(':modal')), true);
      await verblijf.locator('[data-kamer]').first().click();
      const concept = () => verblijf.evaluate(el => ({ kamer: el.querySelector('[data-kamer][aria-pressed="true"]').dataset.kamer,
        aankomst: el.querySelector('#rAan').value, vertrek: el.querySelector('#rVer').value, personen: el.querySelector('#rAantal').value }));
      const voor = await concept(), poort = page.getByRole('dialog', { name: 'Nog een ding', exact: true });
      async function openPoort() {
        const [r] = await Promise.all([page.waitForResponse(r => opPad(r, '/api/verblijf')), boek.click()]);
        assert.equal(r.status(), 428); assert.deepEqual((await r.json()).ontbreekt.map(v => v.veld), ['telefoon']);
        await poort.locator('.rp-in').waitFor();
        await page.waitForFunction(() => document.querySelector('.rp-in') === document.activeElement);
        assert.equal(await poort.evaluate(el => el instanceof HTMLDialogElement && el.matches(':modal')), true);
        assert.equal(await verblijf.evaluate(el => el.open), true, 'onderliggende verblijfstaak blijft geopend');
        assert.match(await poort.locator('.rp-vraag').textContent(), /telefoonnummer|bereiken/i);
      }
      for (const width of [390, 820, 1440]) {
        let basisLetter;
        for (const zoom of [100, 200]) {
          await page.setViewportSize({ width, height: 844 });
          await page.evaluate(p => { document.documentElement.style.fontSize = p + '%'; }, zoom);
          await openPoort();
          const letter = await pastEnBereikbaar(page, poort, width, zoom);
          await beeld(page, 'gegevenspoort-' + width + '-' + zoom);
          if (zoom === 100) basisLetter = letter;
          else assert.ok(letter >= basisLetter * 1.9, 'invoer groeit mee met 200% tekst');
          await boek.evaluate(el => el.focus());
          assert.equal(await poort.evaluate(el => el.contains(document.activeElement)), true, 'achterliggende dialoog blijft inert');
          await poort.locator('.rp-in').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
          assert.equal(await poort.evaluate(el => el.contains(document.activeElement)), true, 'Tab blijft bij de gegevensvraag');
          await poort.locator('.rp-in').fill('12');
          const [waarom] = await Promise.all([page.waitForResponse(r => opPad(r, '/api/gegevens/zeg')),
            poort.getByRole('button', { name: 'Waarom vraag je dit?', exact: true }).click()]);
          assert.equal(waarom.status(), 200);
          await page.waitForFunction(() => /bereiken/i.test(document.querySelector('.rp-uitleg')?.textContent || ''));
          assert.match(await poort.locator('.rp-vraag').textContent(), /telefoonnummer|bereiken/i);
          assert.equal(await poort.locator('.rp-in').inputValue(), '12', 'Waarom wist het concept niet');
          const [ongeldig] = await Promise.all([page.waitForResponse(r => opPad(r, '/api/gegevens/zeg')),
            poort.getByRole('button', { name: 'Doorgaan', exact: true }).click()]);
          assert.equal(ongeldig.status(), 200); assert.equal((await ongeldig.json()).klaar, undefined);
          await page.waitForFunction(() => /te kort|voluit/i.test(document.querySelector('.rp-vraag')?.textContent || ''));
          assert.equal(await poort.locator('.rp-in').inputValue(), '12', 'echte validatiefout behoudt invoer');
          assert.equal(await poort.locator('.rp-door').isEnabled(), true, 'herstellen blijft mogelijk');
          await pastEnBereikbaar(page, poort, width, zoom);
          await page.keyboard.press('Escape'); await poort.waitFor({ state: 'hidden' });
          await page.waitForFunction(() => document.activeElement === document.getElementById('rBoek'));
          assert.equal(await verblijf.evaluate(el => el.open && el.matches(':modal')), true);
          assert.deepEqual(await concept(), voor, 'Escape behoudt kamer, data en gasten');
          assert.deepEqual((await mijn()).verblijven, [], 'afbreken creëert geen aanvraag');
          assert.deepEqual((await nodig()).ontbreekt.map(v => v.veld), ['telefoon'], 'ongeldige invoer is niet opgeslagen');
        }
      }
      assert.equal(aanvragen.length, 6); assert.ok(aanvragen.every(r => r.status === 428));
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await openPoort(); await poort.locator('.rp-in').fill('0612345678');
      const [hervat] = await Promise.all([page.waitForResponse(r => opPad(r, '/api/verblijf') && r.status() === 200),
        poort.getByRole('button', { name: 'Doorgaan', exact: true }).click()]);
      const resultaat = await hervat.json(); assert.equal(resultaat.ok, true);
      await poort.waitFor({ state: 'hidden' }); await verblijf.waitFor({ state: 'hidden' });
      await page.locator('#inhoud .ds-detail__status').waitFor();
      assert.match(await page.locator('#inhoud').textContent(), /Aangevraagd/);
      assert.doesNotMatch(await page.locator('#inhoud').textContent(), /Klaar voor aankomst|U bent thuis/);
      const verblijven = (await mijn()).verblijven;
      assert.equal(verblijven.length, 1); assert.equal(verblijven[0].status, 'aangevraagd');
      assert.deepEqual((await nodig()).ontbreekt, []);
      assert.equal(aanvragen.length, 8); assert.equal(aanvragen.at(-1).status, 200);
      assert.deepEqual(aanvragen.at(-1).body, aanvragen.at(-2).body, 'hervatten herhaalt de oorspronkelijke taakinhoud');
      await alleenDs(page);
      assert.equal(await page.locator('style').evaluateAll(els => els.some(el => el.textContent.includes('.rp-waas{'))), false,
        'DS heeft geen verborgen legacy-presentatie-injectie');
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  } finally {
    if (browser) await browser.close(); if (srv) await stop(srv.child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
