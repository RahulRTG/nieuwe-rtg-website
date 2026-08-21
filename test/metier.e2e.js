/* Scherm-test voor Métier. De unit-toetsen (test/metier.test.js) bewijzen de
   server-kant; deze bewijst dat het SCHERM het doet, en vooral dat het
   signatuurstuk zichtbaar werkt: je kaart bewaren, de bevestigde rol met zijn
   zegel, en de naam vrijgeven waarna in je eigen log staat wie hem bekeek.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Métier: je kaart, het beroepsregister en de naam die je zelf vrijgeeft',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-metier-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Cornelis Bakhuis', email: 'w' + t + '@v.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg' });
    const token = reg.token;
    const zaak = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    const zaakCode = zaak.state.supplier.code;

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    await page.goto(base + '/apps/geld.html#metier', { waitUntil: 'load' });

    // 1. de app opent op je eigen profiel, en toont je codenaam -- niet je naam
    await page.waitForSelector('#mtFkop', { timeout: 15000 });
    const eerste = await page.evaluate(() => document.querySelector('#paneel').textContent);
    assert.equal(/Cornelis|Bakhuis/.test(eerste), false, 'je echte naam staat niet op je eigen profielscherm');

    // 2. je kaart bewaren, en de app laat het zien
    await page.evaluate(() => {
      document.querySelector('#mtFkop').value = 'Maitre d\'hotel, vijftien jaar';
      document.querySelector('#mtFover').value = 'De vloer, de gasten en de rust erin houden.';
      document.querySelector('#mtFplaats').value = 'Ibiza';
    });
    await page.click('#mtBkaart');
    /* Wachten op de MELDING, niet op de waarde in het veld: die waarde stond er al
       omdat ik hem zelf had getypt, dus die voorwaarde was meteen waar en het
       herladen wiste daarna de velden die ik hieronder invul. */
    await page.waitForFunction(() => /bewaard/i.test((document.querySelector('#geldMelding') || {}).textContent || ''), null, { timeout: 10000 });
    await page.waitForSelector('#mtRwat', { timeout: 10000 });

    // 3. een zelf opgegeven rol krijgt zichtbaar het label "Zelf opgegeven"
    await page.evaluate(() => {
      document.querySelector('#mtRwat').value = 'Chef de rang';
      document.querySelector('#mtRwaar').value = 'Een zaak buiten RTG';
    });
    await page.click('#mtBrol');
    await page.waitForFunction(() => /Zelf opgegeven/.test(document.querySelector('#paneel').textContent), null, { timeout: 10000 });

    // 4. het beroepsregister vindt je op je vak
    await page.click('[data-mtt="register"]');
    await page.waitForSelector('#mtZveld', { timeout: 10000 });
    await page.evaluate(() => { document.querySelector('#mtZveld').value = 'maitre'; });
    await page.click('#mtBzoek');
    await page.waitForFunction(() => /Gevonden/.test(document.querySelector('#paneel').textContent), null, { timeout: 10000 });
    const reg2 = await page.evaluate(() => document.querySelector('#paneel').textContent);
    assert.ok(/Gevonden: 1 van 1/.test(reg2), 'je staat in het register op je eigen vak: ' + reg2.slice(0, 120));

    // 5. HET SIGNATUURSTUK: de naam vrijgeven aan een zaak
    await page.click('[data-mtt="naam"]');
    await page.waitForSelector('#mtNzaak', { timeout: 10000 });
    const leeg = await page.evaluate(() => document.querySelector('#paneel').textContent);
    assert.ok(/Je hebt je naam aan niemand gegeven/.test(leeg), 'begint met niemand');
    await page.evaluate((code) => {
      document.querySelector('#mtNzaak').value = code;
      document.querySelector('#mtNwaarvoor').value = 'Sollicitatie maitre';
    }, zaakCode);
    await page.click('#mtBvrij');
    await page.waitForFunction(() => /Actief/.test(document.querySelector('#paneel').textContent), null, { timeout: 10000 });

    // 6. de werkgever leest de naam; daarna staat dat in het log van het lid
    const gezien = await api(base, '/api/supplier/metier/naam', { codenaam: (await api(base, '/api/metier/ik', {}, token)).profiel.codenaam }, zaak.token);
    assert.equal(gezien.naam, 'Cornelis Bakhuis', 'de werkgever ziet de naam nu wel');
    await page.click('[data-mtt="ik"]');
    await page.click('[data-mtt="naam"]');
    await page.waitForFunction(() => /Naam gezien/.test(document.querySelector('#paneel').textContent), null, { timeout: 10000 });

    // 7. intrekken, en het scherm zegt het eerlijk
    await page.click('[data-mtintrek]');
    await page.waitForFunction(() => /Ingetrokken/.test(document.querySelector('#paneel').textContent), null, { timeout: 10000 });

    // 8. de loonspiegel: een te laag bod wordt naast de wet gelegd
    await page.click('[data-mtt="loon"]');
    await page.waitForSelector('#mtTuur', { timeout: 10000 });
    await page.evaluate(() => { document.querySelector('#mtTuur').value = '9'; });
    await page.click('#mtBtoets');
    await page.waitForFunction(() => /minimum/i.test(document.querySelector('#mtUtoets').textContent), null, { timeout: 10000 });
    const oordeel = await page.evaluate(() => document.querySelector('#mtUtoets').textContent);
    assert.ok(/onder het wettelijk minimum/i.test(oordeel), 'het scherm zegt dat dit bod niet mag: ' + oordeel);

    // 9. de AI-balk staat er
    const balk = await page.evaluate(() => !!document.querySelector('#mtAiForm') && !!document.querySelector('#mtAiIn'));
    assert.equal(balk, true, 'de AI-balk staat op de app');
    const pad = await page.evaluate(() => location.pathname);
    assert.equal(pad, '/apps/geld.html', 'we blijven in de samengevoegde Geld-app');
    assert.equal(await page.evaluate(() => location.hash), '#metier', 'Métier blijft de actieve stand');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
