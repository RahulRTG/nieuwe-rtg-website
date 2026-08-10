/* Schermtoets voor de verzorgingskant van de Zorg-tab: de kapper, de barbier
   en de nagelstudio staan nu in de leden-app. Wat hier bewezen wordt is precies
   wat een servertoets NIET kan zien: dat het blok echt op het scherm komt, dat
   het als verzorging en niet als zorg wordt gepresenteerd, en dat een lid er
   met twee tikken een afspraak maakt die daarna in zijn eigen lijst staat.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadPlaywright();

test('Zorg-tab: de salon komt op het scherm en een lid boekt er een knipbeurt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verzscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kapper Lid', email: 'verzscherm@x.nl', phone: '0612345799',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    /* Een vers lid krijgt eerst de verplichte overeenkomst-modal, en die
       blokkeert het scherm terecht. Deze toets gaat niet over de onboarding,
       dus die zetten we op klaar; net als apps-ui.e2e.js dat doet. */
    await page.route('**/api/onboarding/status', r => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true })
    }));
    /* De tabbalk zit achter het beginscherm, dus die is niet aan te klikken
       zolang de app thuis staat. We landen op de Zorg-tab langs de weg die de
       app daar zelf voor heeft: hij onthoudt je plek in rtg_actieve_tab. */
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_actieve_tab', JSON.stringify({ tab: 'zorg', t: Date.now() }));
    }, reg.token);
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });
    await page.waitForSelector('#app', { state: 'visible', timeout: 5000 });
    await page.waitForSelector('.view[data-view="zorg"].active', { timeout: 5000 });

    await page.waitForFunction(() => {
      const e = document.getElementById('verzorgingAanbod');
      return e && e.textContent.trim().length > 0;
    }, null, { timeout: 10000 });

    const tekst = await page.textContent('#verzorgingAanbod');
    assert.match(tekst, /Velvet/i, 'de salon staat op het scherm');
    assert.match(tekst, /geen zorg/i, 'het blok zegt zelf dat dit verzorging is en geen zorg');

    /* Twee tikken: een tijd kiezen en boeken. Het aanbod staat ver onder de
       vouw (de tab is een lange lijst), dus elke knop wordt eerst in beeld
       gerold; anders wacht een klik op een element dat buiten het venster
       staat en loopt de toets af op een timeout in plaats van op een fout. */
    const tik = async (sel) => {
      const knop = page.locator(sel).first();
      await knop.scrollIntoViewIfNeeded();
      await knop.click();
    };
    await tik('#verzorgingAanbod [data-verzopen]');
    await page.waitForSelector('#verzorgingAanbod [data-verzt]', { timeout: 5000 });
    const eersteTijd = await page.locator('#verzorgingAanbod [data-verzt]').first().textContent();
    await tik('#verzorgingAanbod [data-verzt]');
    await page.waitForSelector('#verzBoek:not([disabled])', { timeout: 5000 });
    await tik('#verzBoek');

    await page.waitForFunction(() => {
      const e = document.getElementById('verzorgingAanbod');
      return e && /verzorgingsafspraken/i.test(e.textContent);
    }, null, { timeout: 10000 });
    const na = await page.textContent('#verzorgingAanbod');
    assert.match(na, new RegExp(eersteTijd.trim()), 'de geboekte tijd staat in mijn afspraken');

    // en de server is het daarmee eens: het scherm heeft niet alleen zichzelf bijgewerkt
    const mijn = await fetch(base + '/api/verzorging/mijn', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: '{}'
    }).then(r => r.json());
    assert.equal(mijn.afspraken.length, 1, 'de afspraak staat echt in de agenda van de salon');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
