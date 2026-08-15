/* Scherm-test voor het gevoelsdagboek op gevoel.html: gezichtje aantikken
   blijft vluchtig (de belofte van de pagina), bewaren is een eigen keuze,
   het dagboekje toont wat het kind zelf bewaarde, en herzien kan.
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

test('Gevoelsdagboek: aantikken is vluchtig, bewaren is een keuze, herzien kan',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfwelzijn-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = async (p, b) => (await fetch(base + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })).json();
  let browser;
  try {
    const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam Zon', naam: 'Mam', pin: '1234' });
    const k = await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token,
      naam: 'Juno', rol: 'kind', groep: 'kind', geboortedatum: '2015-02-18' });
    const kindToken = (await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: k.profiel.id })).token;

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/gevoel.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: kindToken, profiel: { naam: 'Juno', groep: 'kind', geboortedatum: '2015-02-18' } });
    /* Het bezoek hierboven was uitgelogd -- alleen om localStorage te kunnen
       zetten -- en de pagina stopt daar bewust met 'geen sessie'. De meting
       begint bij het ingelogde bezoek hieronder. */
    fouten.length = 0;
    await page.goto(base + '/apps/foundation/gevoel.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#koppen .kop', { timeout: 15000 });

    // aantikken alleen = niets bewaard (de belofte van de pagina)
    await page.evaluate(() => { [...document.querySelectorAll('#koppen .kop')].find(b => /verdrietig/.test(b.textContent)).click(); });
    assert.ok(await page.evaluate(() => document.querySelector('#dagboekBlok').hidden),
      'zonder eigen keuze blijft het dagboekje leeg en verborgen');
    // bewaren is een eigen keuze
    await page.evaluate(() => { document.querySelector('#bewaarKnop').click(); });
    await page.waitForFunction(() => /Vandaag bewaard: verdrietig/.test(document.querySelector('#bewaarKnop').textContent),
      null, { timeout: 8000 });
    await page.waitForFunction(() => !document.querySelector('#dagboekBlok').hidden, null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => /Alleen jij ziet dit/.test(document.querySelector('#dagboekBlok').textContent)),
      'het dagboekje zegt eerlijk van wie het is');

    // herzien: een ander gezichtje kiezen en opnieuw bewaren vervangt vandaag
    await page.evaluate(() => { [...document.querySelectorAll('#koppen .kop')].find(b => /blij/.test(b.textContent)).click(); });
    await page.evaluate(() => { document.querySelector('#bewaarKnop').click(); });
    await page.waitForFunction(() => /Vandaag bewaard: blij/.test(document.querySelector('#bewaarKnop').textContent),
      null, { timeout: 8000 });
    const strook = await page.evaluate(() => document.querySelectorAll('#dagboekStrook .kop').length);
    assert.equal(strook, 1, 'een dag heeft hooguit een gevoel in de strook');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
