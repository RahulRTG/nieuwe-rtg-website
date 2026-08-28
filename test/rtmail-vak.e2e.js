/* Schermtoets voor het POSTVAK in RTG Mail: de mappenbalk, zoeken, opbergen,
   de ster en het gesprek.

   De servertoetsen (test/rtmail-vak.test.js) bewijzen dat de laag klopt; deze
   bewijst dat een mens er ook echt bij kan. Dat verschil is hier niet
   theoretisch: mappen en zoeken bestonden al een golf lang in de API voordat
   er een knop voor was, en een functie zonder knop is voor de gebruiker geen
   functie.

   Draait alleen waar een browser is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('postvak op het scherm: mappen, opbergen, ster, zoeken en het gesprek',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vak-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Vak Kijker', email: 'vak' + t + '@e.test',
      phone: '06' + String(t).slice(-7) + '3', password: 'geheim123', geboortedatum: '1988-08-08', tier: 'rtg' });
    const adres = (await api(base, '/api/member/rtmail/adres', {}, reg.token)).adres;
    // twee berichten aan onszelf, zodat er iets te zoeken en op te bergen valt
    for (const ond of ['Factuur augustus', 'Uitnodiging diner']) {
      const c = await api(base, '/api/member/rtmail/concept/bewaar', { naar: adres, onderwerp: ond, tekst: 'inhoud van ' + ond }, reg.token);
      await api(base, '/api/member/rtmail/concept/verstuur', { id: c.concept.id }, reg.token);
    }

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => { localStorage.setItem('rtg_member_token', tok); }, reg.token);
    await page.goto(base + '/apps/rtmail.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mapbalk', { timeout: 15000 });

    // de vier mappen staan er, en "Postvak in" is de open map
    const mappen = await page.$$eval('.mapknp', ns => ns.map(n => n.textContent.replace(/\d+$/, '').trim()));
    assert.ok(mappen.some(m => /Postvak in/.test(m)), 'Postvak in staat er: ' + mappen.join(', '));
    assert.ok(mappen.some(m => /Archief/.test(m)) && mappen.some(m => /Prullenbak/.test(m)) && mappen.some(m => /Verzonden/.test(m)));
    assert.equal(await page.$eval('.mapknp.aan', n => n.dataset.map), 'in');

    // een bericht openen en opbergen
    await page.click('.rij:has-text("Factuur augustus")');
    await page.waitForSelector('.acties', { timeout: 10000 });
    await page.click('[data-act="archief"]');
    await page.waitForSelector('.mapknp[data-map="archief"] .mtel', { timeout: 10000 });
    assert.equal(await page.locator('.rij:has-text("Factuur augustus")').count(), 0, 'weg uit het postvak in');

    /* En terugvinden in het archief. Wachten op ".rij" is hier NIET goed genoeg:
       de rijen van het postvak in staan er nog terwijl de nieuwe map laadt, dus
       die selector is meteen raak en de telling kijkt naar oude inhoud. We
       wachten daarom tot de map-knop zelf op "aan" staat. */
    await page.click('[data-map="archief"]');
    await page.waitForSelector('.mapknp.aan[data-map="archief"]', { timeout: 10000 });
    assert.equal(await page.locator('.rij:has-text("Factuur augustus")').count(), 1, 'terug te vinden in het archief');

    // zoeken vindt hem ook, ongeacht de map
    await page.click('[data-map="in"]');
    await page.waitForSelector('.mapknp.aan[data-map="in"]', { timeout: 10000 });
    await page.fill('#zoekVeld', 'factuur');
    await page.click('#zoekKnp');
    await page.waitForSelector('#zoekAf', { timeout: 10000 });
    assert.equal(await page.locator('.rij:has-text("Factuur augustus")').count(), 1, 'zoeken vindt het opgeborgen bericht');
    assert.equal(await page.locator('.rij:has-text("Uitnodiging diner")').count(), 0, 'en niet wat er niet bij past');
    assert.match(await page.textContent('#main'), /binnen je eigen postvak/,
      'het scherm zegt erbij dat zoeken binnen je eigen postvak blijft');

    // de ster erop, en hij is terug te zien in de lijst
    await page.click('.rij:has-text("Factuur augustus")');
    await page.waitForSelector('[data-act="ster"]', { timeout: 10000 });
    /* Weer niet op ".acties" wachten: die staat er al. Wachten op de nieuwe
       TEKST is het enige dat bewijst dat het scherm opnieuw is opgebouwd. */
    await page.click('[data-act="ster"]');
    await page.waitForSelector('[data-act="ster"]:has-text("Ster eraf")', { timeout: 10000 });
    assert.match(await page.textContent('[data-act="ster"]'), /Ster eraf/, 'de knop kent nu de omgekeerde stand');
    // en de ster staat ook in de lijst
    await page.click('#terug');
    await page.waitForSelector('.mapbalk', { timeout: 10000 });
    await page.click('[data-map="archief"]');
    await page.waitForSelector('.mapknp.aan[data-map="archief"]', { timeout: 10000 });
    assert.equal(await page.locator('.rij .ster').count(), 1, 'de ster is terug te zien in de lijst');
    await page.click('.rij:has-text("Factuur augustus")');
    await page.waitForSelector('[data-act="draad"]', { timeout: 10000 });

    // het gesprek van een bericht, met de hulp erbij
    await page.click('[data-act="draad"]');
    await page.waitForSelector('.draadje', { timeout: 10000 });
    assert.equal(await page.locator('.draadje').count(), 1, 'dit gesprek heeft een bericht');

    /* De hulp moet TERUG kunnen wijzen. Een samenvatting waarop je niet kunt
       doorklikken naar het oorspronkelijke bericht, is een tweede versie van de
       waarheid -- dus toetsen we niet alleen dat er tekst verschijnt, maar dat
       elke regel een bericht aanwijst dat op deze pagina staat. */
    await page.click('[data-hulp="samenvatting"]');
    await page.waitForSelector('.hulpblok .hulprij', { timeout: 10000 });
    const springt = await page.$$eval('.hulprij', ns => ns.map(n => n.dataset.spring));
    assert.ok(springt.length >= 1, 'de samenvatting heeft regels');
    for (const id of springt) {
      assert.equal(await page.locator('#b-' + id).count(), 1, 'regel wijst naar bericht ' + id + ' op deze pagina');
    }
    await page.click('[data-hulp="risico"]');
    await page.waitForSelector('.hulpblok b', { timeout: 10000 });
    assert.match(await page.textContent('.hulpblok'), /geen score/, 'het risico komt met redenen, niet met een cijfer');

    await page.click('#terug');
    await page.waitForSelector('.mapbalk', { timeout: 10000 });

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
