/* Scherm-test voor de RTF-gezinsagenda op RTG-niveau: het maandraster met
   kleur per gezinslid, een punt zetten via het paneel, bewerken, en de
   verjaardag-snelknop die er een jaarpunt van maakt.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const post = async (base, p, b) => (await fetch(base + p, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })).json();

test('Gezinsagenda: maandraster, punt zetten, bewerken en de verjaardag-snelknop',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfagenda-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const g = await post(base, '/api/foundation/gezin/maak', { gezinsnaam: 'Rasterfamilie', naam: 'Papa', pin: '1234' });
    await post(base, '/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token,
      naam: 'Milan', rol: 'kind', groep: 'kind', kleur: '#3A7BD5' });

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/agenda.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: g.token, profiel: { naam: 'Papa', beheerder: true } });
    /* Het bezoek hierboven was uitgelogd -- alleen om localStorage te kunnen
       zetten -- en de pagina stopt daar bewust met 'geen sessie'. De meting
       begint bij het ingelogde bezoek hieronder. */
    fouten.length = 0;
    await page.goto(base + '/apps/foundation/agenda.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mgrid', { timeout: 15000 });

    /* ---- een punt zetten via het paneel ---- */
    await page.evaluate(() => { document.querySelector('#nieuwKnop').click(); });
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    await page.fill('#afTitel', 'Zwemles');
    await page.fill('#afTijd', '16:00');
    const wieOpties = await page.evaluate(() => [...document.querySelectorAll('#afWie option')].map(o => o.textContent));
    assert.ok(wieOpties.includes('Milan'), 'de wie-kiezer kent het gezin');
    await page.selectOption('#afWie', { label: 'Milan' });
    await page.evaluate(() => { document.querySelector('#afBewaar').click(); });
    await page.waitForFunction(() => /Zwemles/.test(document.querySelector('#bord').textContent),
      null, { timeout: 8000 });
    const kleur = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.chip')].find(x => /Zwemles/.test(x.textContent));
      return c ? c.style.borderColor : '';
    });
    assert.ok(kleur, 'de chip draagt de kleur van het gezinslid');

    /* ---- bewerken: verzetten is verzetten ---- */
    await page.evaluate(() => {
      const c = [...document.querySelectorAll('.chip')].find(x => /Zwemles/.test(x.textContent));
      c.click();
    });
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    await page.fill('#afTitel', 'Zwemles A-diploma');
    await page.evaluate(() => { document.querySelector('#afBewaar').click(); });
    await page.waitForFunction(() => /A-diploma/.test(document.querySelector('#bord').textContent),
      null, { timeout: 8000 });

    /* ---- de verjaardag-snelknop maakt er een jaarpunt van ---- */
    await page.evaluate(() => { document.querySelector('#nieuwKnop').click(); });
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    await page.evaluate(() => { document.querySelector('#afVerjaardag').click(); });
    assert.equal(await page.evaluate(() => document.querySelector('#afHerhaal').value), 'jaar');
    await page.fill('#afTitel', 'Jarig: Milan');
    await page.evaluate(() => { document.querySelector('#afBewaar').click(); });
    await page.waitForFunction(() => /Jarig: Milan/.test(document.querySelector('#bord').textContent),
      null, { timeout: 8000 });

    /* ---- weergaven en navigatie doen het ---- */
    await page.evaluate(() => { document.querySelector('[data-zicht="week"]').click(); });
    await page.waitForSelector('.wgrid', { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('[data-zicht="lijst"]').click(); });
    await page.waitForFunction(() => /A-diploma/.test(document.querySelector('#bord').textContent),
      null, { timeout: 8000 });
    const periode1 = await page.evaluate(() => document.querySelector('#periode').textContent);
    await page.evaluate(() => { document.querySelector('[data-zicht="maand"]').click(); });
    await page.waitForSelector('.mgrid', { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#volgende').click(); });
    await page.waitForFunction((p1) => document.querySelector('#periode').textContent !== p1,
      periode1, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
