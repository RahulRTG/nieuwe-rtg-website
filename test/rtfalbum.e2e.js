/* Scherm-test voor het gezinsalbum: maandgroepen, het gedeelde hartje met
   de favorietenfilter, de kijker met pijlen, de terugblik en de
   jarigenstrook die de verjaardagen-app alleen meeleest.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
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
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('Gezinsalbum: maandgroepen, hartje + filter, kijker, terugblik en de jarigenstrook',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfalbum-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = async (p, b) => (await fetch(base + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })).json();
  let browser;
  try {
    const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam Album', naam: 'Mam', pin: '1234' });
    const sess = { code: g.code, token: g.token };
    await post('/api/rtf/baby/instellen', Object.assign({}, sess, { kindNaam: 'Fien', geboren: '2025-11-05' }));
    await post('/api/rtf/baby/entry-maak', Object.assign({}, sess, { tekst: 'Eerste stapjes', foto: PNG }));
    const nu = new Date();
    const oud = (nu.getFullYear() - 1) + '-' + String(nu.getMonth() + 1).padStart(2, '0') + '-' + String(nu.getDate()).padStart(2, '0');
    await post('/api/rtf/baby/entry-maak', Object.assign({}, sess, { tekst: 'Toen nog zo klein', dag: oud }));
    // een verjaardag over tien dagen, voor de strook
    const over10 = new Date(Date.now() + 10 * 86400000);
    await post('/api/foundation/gezin/verjaardag/persoon', Object.assign({}, sess,
      { naam: 'Oma Riet', dag: over10.getDate(), maand: over10.getMonth() + 1, jaar: 1956 }));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/babyboek.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: g.token, profiel: { naam: 'Mam', beheerder: true } });
    /* Het bezoek hierboven was uitgelogd -- alleen om localStorage te kunnen
       zetten -- en de pagina stopt daar bewust met 'geen sessie'. De meting
       begint bij het ingelogde bezoek hieronder. */
    fouten.length = 0;
    await page.goto(base + '/apps/foundation/babyboek.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#vBoek').hidden &&
      /Eerste stapjes/.test(document.querySelector('#boek').textContent), null, { timeout: 15000 });

    /* maandgroepen: het album kent hoofdstukken, en de terugblik het verleden */
    const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
    const kop = MAANDEN[new Date().getMonth()];
    assert.ok(await page.evaluate(k => new RegExp(k, 'i').test(document.querySelector('#boek').textContent), kop),
      'de huidige maand is een hoofdstuk');
    await page.waitForFunction(() => !document.querySelector('#terugblikSec').hidden &&
      /Toen nog zo klein/.test(document.querySelector('#terugblik').textContent), null, { timeout: 8000 });

    /* de jarigenstrook leest de verjaardagen-app mee */
    await page.waitForFunction(() => /Oma Riet/.test(document.querySelector('#jarigen').textContent), null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => /Over 10 dagen/.test(document.querySelector('#jarigen').textContent)),
      'de strook telt eerlijk af');

    /* het hartje + de favorietenfilter */
    await page.evaluate(() => { document.querySelector('#boek [data-fav]').click(); });
    await page.waitForFunction(() => /♥\s*1/.test(document.querySelector('#boek').textContent), null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#fFavs').click(); });
    await page.waitForFunction(() => document.querySelectorAll('#boek .moment').length === 1 &&
      /Eerste stapjes/.test(document.querySelector('#boek').textContent), null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#fAlles').click(); });
    await page.waitForFunction(() => /Toen nog zo klein/.test(document.querySelector('#terugblik').textContent), null, { timeout: 8000 });

    /* de kijker: foto groot, en Escape sluit */
    await page.evaluate(() => { document.querySelector('#boek [data-kijk]').click(); });
    await page.waitForFunction(() => document.querySelector('#kijker').classList.contains('open'), null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => /Eerste stapjes/.test(document.querySelector('#kTekst').textContent)));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#kijker').classList.contains('open'), null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
