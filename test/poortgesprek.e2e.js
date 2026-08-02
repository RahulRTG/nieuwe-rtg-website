/* Scherm-test voor het gegevensgesprek: de client-kant van de gegevenspoort.

   De server houdt een handeling met een derde partij tegen met 428 en zegt wat
   er mist. Zonder deze schil bleef het daarbij: een melding "dat vraag ik even"
   en er werd niets gevraagd. Deze test loopt na wat een lid echt ziet -- Rahul
   vraagt het in beeld, "waarom?" krijgt een eerlijk antwoord zonder dat de vraag
   verdwijnt, onzin wordt niet geslikt, en na het antwoord gaat de oorspronkelijke
   handeling vanzelf door zonder dat je hem opnieuw hoeft te starten.

   Het loopt via de echte api-helper van foodcourt.html, dus de bedrading van de
   pagina wordt meegetoetst en niet alleen de module.

   Draai los: node --experimental-sqlite --test test/poortgesprek.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('Rahul vraagt het in beeld, en daarna gaat de handeling vanzelf door',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-poort-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // een vers lid: de korte aanmelding, dus GEEN telefoonnummer
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pia Poort', email: 'poort-e2e@voorbeeld.test',
        password: 'poortgeheim12', geboortedatum: '1991-02-02', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    assert.ok(reg.token, 'aanmelden lukt met vier velden');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foodcourt.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/foodcourt.html', { waitUntil: 'domcontentloaded' });

    /* reserveren via de EIGEN api-helper van de pagina: zo wordt de bedrading
       meegetoetst. De uitkomst parkeren we, want die hoort pas te vallen als het
       gesprek klaar is. */
    await page.evaluate(() => {
      window.__uit = null;
      api('/api/reserveer', { supplierCode: 'KIKUNOI', datum: '2027-01-04', tijd: '19:00', personen: 2 })
        .then(d => { window.__uit = { ok: true, d: d }; })
        .catch(e => { window.__uit = { ok: false, fout: e.message }; });
    });

    // 1) Rahul staat in beeld met de vraag -- geen kale foutmelding
    await page.waitForFunction(() => {
      const w = document.querySelector('.rp-waas');
      return w && !w.hidden && /telefoonnummer|bereiken/i.test(w.textContent);
    }, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => window.__uit), null,
      'de reservering hangt nog: hij is niet geweigerd en niet stiekem doorgegaan');

    // 2) "waarom?" geeft een eerlijk antwoord EN laat de vraag staan
    await page.click('.rp-waarom');
    await page.waitForFunction(() => {
      const u = document.querySelector('.rp-uitleg');
      return u && /bereiken/i.test(u.textContent);
    }, null, { timeout: 8000 });
    assert.match(await page.evaluate(() => document.querySelector('.rp-vraag').textContent), /telefoonnummer|bereiken/i,
      'de vraag blijft staan naast het antwoord');

    // 3) onzin wordt niet geslikt
    await page.fill('.rp-in', '12');
    await page.click('.rp-door');
    await page.waitForFunction(() => /te kort|voluit/i.test(document.querySelector('.rp-vraag').textContent),
      null, { timeout: 8000 });

    // 4) een echt nummer: het gesprek sluit en de handeling gaat vanzelf door
    await page.fill('.rp-in', '0612345678');
    await page.click('.rp-door');
    await page.waitForFunction(() => {
      const w = document.querySelector('.rp-waas');
      return (!w || w.hidden) && window.__uit !== null;
    }, null, { timeout: 10000 });

    const uit = await page.evaluate(() => window.__uit);
    assert.ok(uit, 'de oorspronkelijke reservering is opnieuw gedaan zonder dat het lid iets hoefde te doen');
    if (!uit.ok) assert.doesNotMatch(String(uit.fout), /telefoonnummer/i,
      'wat er daarna nog misgaat, gaat in elk geval niet meer over de gegevens: ' + uit.fout);

    // 5) en het nummer staat echt in de kluis: de poort vraagt niets meer
    const na = await fetch(base + '/api/gegevens/nodig', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify({ soort: 'reservering' }) }).then(r => r.json());
    assert.deepEqual(na.ontbreekt, [], 'er mist niets meer voor een reservering');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
