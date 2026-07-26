/* Scherm-test voor Métier. De unit-toetsen (test/metier.test.js) bewijzen de
   server-kant; deze bewijst dat het SCHERM het doet, en vooral dat het
   signatuurstuk zichtbaar werkt: je kaart bewaren, de bevestigde rol met zijn
   zegel, en de naam vrijgeven waarna in je eigen log staat wie hem bekeek.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
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
    if (page.on) page.on('pageerror', e => fouten.push(e.message));
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    await page.goto(base + '/apps/metier.html', { waitUntil: 'load' });

    // 1. de app opent op je eigen profiel, en toont je codenaam -- niet je naam
    await page.waitForSelector('#fkop', { timeout: 15000 });
    const eerste = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.equal(/Cornelis|Bakhuis/.test(eerste), false, 'je echte naam staat niet op je eigen profielscherm');

    // 2. je kaart bewaren, en de app laat het zien
    await page.evaluate(() => {
      document.querySelector('#fkop').value = 'Maitre d\'hotel, vijftien jaar';
      document.querySelector('#fover').value = 'De vloer, de gasten en de rust erin houden.';
      document.querySelector('#fplaats').value = 'Ibiza';
    });
    await page.click('#bkaart');
    /* Wachten op de MELDING, niet op de waarde in het veld: die waarde stond er al
       omdat ik hem zelf had getypt, dus die voorwaarde was meteen waar en het
       herladen wiste daarna de velden die ik hieronder invul. */
    await page.waitForFunction(() => /bewaard/.test((document.querySelector('#aiuit') || {}).textContent || ''), null, { timeout: 10000 });
    await page.waitForSelector('#rwat', { timeout: 10000 });

    // 3. een zelf opgegeven rol krijgt zichtbaar het label "Zelf opgegeven"
    await page.evaluate(() => {
      document.querySelector('#rwat').value = 'Chef de rang';
      document.querySelector('#rwaar').value = 'Een zaak buiten RTG';
    });
    await page.click('#brol');
    await page.waitForFunction(() => /Zelf opgegeven/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });

    // 4. het beroepsregister vindt je op je vak
    await page.click('[data-t="register"]');
    await page.waitForSelector('#zveld', { timeout: 10000 });
    await page.evaluate(() => { document.querySelector('#zveld').value = 'maitre'; });
    await page.click('#bzoek');
    await page.waitForFunction(() => /Gevonden/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const reg2 = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/Gevonden: 1 van 1/.test(reg2), 'je staat in het register op je eigen vak: ' + reg2.slice(0, 120));

    // 5. HET SIGNATUURSTUK: de naam vrijgeven aan een zaak
    await page.click('[data-t="naam"]');
    await page.waitForSelector('#nzaak', { timeout: 10000 });
    const leeg = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/Je hebt je naam aan niemand gegeven/.test(leeg), 'begint met niemand');
    await page.evaluate((code) => {
      document.querySelector('#nzaak').value = code;
      document.querySelector('#nwaarvoor').value = 'Sollicitatie maitre';
    }, zaakCode);
    await page.click('#bvrij');
    await page.waitForFunction(() => /Actief/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });

    // 6. de werkgever leest de naam; daarna staat dat in het log van het lid
    const gezien = await api(base, '/api/supplier/metier/naam', { codenaam: (await api(base, '/api/metier/ik', {}, token)).profiel.codenaam }, zaak.token);
    assert.equal(gezien.naam, 'Cornelis Bakhuis', 'de werkgever ziet de naam nu wel');
    await page.click('[data-t="ik"]');
    await page.click('[data-t="naam"]');
    await page.waitForFunction(() => /Naam gezien/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });

    // 7. intrekken, en het scherm zegt het eerlijk
    await page.click('[data-intrek]');
    await page.waitForFunction(() => /Ingetrokken/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });

    // 8. de AI-balk staat er
    const balk = await page.evaluate(() => !!document.querySelector('#aiform') && !!document.querySelector('#aiin'));
    assert.equal(balk, true, 'de AI-balk staat op de app');
    const pad = await page.evaluate(() => location.pathname);
    assert.equal(pad, '/apps/metier.html', 'we zijn nergens heen genavigeerd');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
