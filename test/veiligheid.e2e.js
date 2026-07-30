/* De vier veiligheidsapps in een echte browser.

   De server-toetsen (test/veiligheid.test.js) bewijzen dat de keten werkt. Wat
   die niet kunnen zien: of de schermen ook echt staan, of er geen JS-fout op de
   pagina knalt, en of de dingen die er ALTIJD moeten staan er ook staan --
   met name de eerlijke grens ("dit is geen alarmcentrale"), want dat is de zin
   die een gebruiker beschermt tegen valse geruststelling.

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

const SCHERMEN = [
  ['/apps/thuiswacht.html', 'Thuiswacht', 'Start de wacht'],
  ['/apps/codewoord.html', 'Codewoord', 'Instellen'],
  ['/apps/vitaal.html', 'Vitaal', 'Zet de check-in aan'],
  ['/apps/thuisrust.html', 'Thuisrust', 'Zet aan']
];

test('de vier veiligheidsapps staan echt', { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-veilig-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Veilig Tester', email: 'vt' + u + '@x.nl', phone: '062' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
      })
    }).then(r => r.json());
    assert.ok(reg.token, 'het lid moet een token krijgen');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    // ingelogd doen alsof, net als de app zelf
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, reg.token);

    for (const [pad, titel, knop] of SCHERMEN) {
      await t.test(titel, async () => {
        const page = await ctx.newPage();
        const fouten = [];
        page.on('pageerror', (e) => fouten.push(String(e && e.message || e)));
        page.on('console', (m) => { if (m.type() === 'error') fouten.push('console: ' + m.text()); });

        await page.goto(srv.base + pad, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#grens .grens', { timeout: 15000 });

        // 1. de eerlijke grens staat er, en zegt wat het NIET is
        const grens = await page.textContent('#grens .grens');
        assert.match(grens, /geen alarmcentrale/i, titel + ': de grens hoort op het scherm te staan');
        assert.match(grens, /alarmnummer/i, titel + ': en moet naar het alarmnummer wijzen');

        // 2. het bedieningselement van deze app is echt opgebouwd (dus de
        //    fetch naar de server is gelukt en het scherm is niet leeg)
        await page.waitForFunction((tekst) => document.body.innerText.includes(tekst), knop, { timeout: 15000 });

        // 3. de kring is geladen (gedeelde laag), niet blijven hangen op "Laden..."
        const kring = await page.textContent('#kring');
        assert.ok(!/Laden\.\.\./.test(kring), titel + ': de kring bleef hangen op laden');

        // 4. geen JS-fouten op de pagina
        assert.deepEqual(fouten.filter(f => !/favicon|manifest|Failed to load resource/i.test(f)), [],
          titel + ': er hoort geen JS-fout te knallen');
        await page.close();
      });
    }

    // Het codewoord mag NERGENS op het scherm terugkomen nadat het is gezet.
    await t.test('het codewoord komt na het instellen nooit meer op het scherm', async () => {
      const page = await ctx.newPage();
      await page.goto(srv.base + '/apps/codewoord.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#zin', { timeout: 15000 });
      await page.fill('#zin', 'staat de blauwe fiets nog buiten');
      await page.click('#zet');
      await page.waitForFunction(() => /woorden/.test(document.querySelector('#zinKaart').innerText), null, { timeout: 15000 });
      const hele = await page.content();
      assert.ok(!/staat de blauwe fiets nog buiten/i.test(hele),
        'de zin mag na het instellen nergens meer in de pagina staan');
      await page.close();
    });
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    stop(srv && srv.child);
  }
});
