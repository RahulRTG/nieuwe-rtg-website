'use strict';
/* De Saloon-lezer bij een leeg of ontbrekend artikel (bevinding van LivingOS-A,
   19 oktober 2026). public/apps/saloon/lezer.js las a.beeld en a.naam voordat
   er gekeken werd of het antwoord een artikel droeg; een ontbrekend artikel gaf
   de kale TypeError in beeld, een leeg artikel een kop zonder tekst. Beide
   horen een eerlijke lege toestand te geven, met "Opnieuw proberen".

   Draai: node --test test/saloon-lezer-leeg.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');

const pw = laadPlaywright();

test('Saloon-lezer: een leeg of ontbrekend artikel geeft een eerlijke lege toestand', { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-saloon-leeg-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '' } });
    const post = async (pad, body, token) => (await fetch(srv.base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body) })).json();
    const reg = await post('/api/auth/register', { name: 'Saloon Lezer', email: 'lezer-leeg@example.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    const rooster = await post('/api/supplier/roster', { code: 'BODE' });
    const zaak = await post('/api/supplier/login', { code: 'BODE', staffId: rooster.staff.find(x => x.role === 'manager').id, pin: '1234' });
    const bericht = await post('/api/supplier/redactie/artikel/bewaar', { titel: 'Een artikel voor de lezer',
      chapo: 'Kort.', inhoud: 'De tekst van het artikel.', rubriek: 'Stad' }, zaak.token);
    await post('/api/supplier/redactie/artikel/publiceer', { id: bericht.artikel.id }, zaak.token);
    await post('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['nieuws'], plaats: '', vorm: 'overzicht' } }, reg.token);

    browser = await pw.chromium.launch(browserOpties(pw, { headless: true }));
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const fouten = []; letOpFouten(page, fouten);
    await page.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl'); }, reg.token);
    let antwoord = { ok: true };
    await page.route('**/api/krant/artikel', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwoord) }));
    await page.goto(srv.base + '/apps/wereld.html?embed=1');
    const kaart = page.locator('[data-saloon-id="nieuws:BODE:' + bericht.artikel.id + '"]');
    await kaart.waitFor();

    for (const [wat, lijf] of [['ontbrekend', { ok: true }], ['leeg', { ok: true, artikel: {} }]]) {
      antwoord = lijf;
      await kaart.getByRole('button', { name: 'Lees artikel' }).click();
      const vlak = page.locator('#saloonArtikel');
      await vlak.getByRole('button', { name: 'Opnieuw proberen' }).waitFor({ timeout: 8000 });
      const tekst = await vlak.innerText();
      assert.doesNotMatch(tekst, /Cannot read|undefined|TypeError/, wat + ': geen kale fout in beeld');
      assert.match(tekst, /niet .*geladen|onvolledig/i, wat + ': het scherm zegt eerlijk dat het artikel er niet is');
      await page.getByRole('button', { name: '‹ Saloon', exact: true }).click();
      await kaart.waitFor();
    }
    assert.deepEqual(fouten, []);
  } finally { if (browser) await browser.close(); stop(srv && srv.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
