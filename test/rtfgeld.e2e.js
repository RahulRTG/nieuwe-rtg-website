/* Scherm-test voor de geldschool: de ouder zet op klusjes.html weekgeld en
   verzilvert sterren; het kind ziet alles eerlijk terug in zakgeld.html.
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

test('Geldschool: ouder zet weekgeld en verzilvert sterren; het kind ziet het in zijn potje',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfgeld-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = async (p, b) => (await fetch(base + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })).json();
  let browser;
  try {
    const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam Munt', naam: 'Pap', pin: '1234' });
    const k = await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token,
      naam: 'Mila', rol: 'kind', groep: 'tiener' });
    const kindToken = (await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: k.profiel.id })).token;
    // de klusketen via de API: 3 sterren verdiend
    const kl = await post('/api/foundation/gezin/klus', { code: g.code, token: g.token, titel: 'Auto wassen', sterren: 3, voor: k.profiel.id });
    await post('/api/foundation/gezin/klus/gedaan', { code: g.code, token: kindToken, klusId: kl.klus.id });
    await post('/api/foundation/gezin/klus/keur', { code: g.code, token: g.token, klusId: kl.klus.id, goed: true });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- de ouder op klusjes.html: weekgeld zetten en verzilveren ---- */
    await page.goto(base + '/apps/foundation/klusjes.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: g.token, profiel: { naam: 'Pap', beheerder: true } });
    /* Het bezoek hierboven was uitgelogd -- alleen om localStorage te kunnen
       zetten -- en de pagina stopt daar bewust met 'geen sessie'. De meting
       begint bij het ingelogde bezoek hieronder. */
    fouten.length = 0;
    await page.goto(base + '/apps/foundation/klusjes.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Mila/.test((document.querySelector('#geldKinderen') || {}).textContent || ''),
      null, { timeout: 15000 });
    assert.ok(await page.evaluate(() => /3 van 3 sterren open/.test(document.querySelector('#geldKinderen').textContent)),
      'de sterrenstand staat klaar voor de ouder');
    const pid = k.profiel.id;
    await page.fill('[data-wg="' + pid + '"]', '2,50');
    await page.evaluate((id) => { document.querySelector('[data-wgzet="' + id + '"]').click(); }, pid);
    await page.waitForFunction(() => /2,50 p\/w/.test(document.querySelector('#geldKinderen').textContent),
      null, { timeout: 8000 });
    await page.fill('[data-vs="' + pid + '"]', '2');
    await page.fill('[data-vb="' + pid + '"]', '1');
    await page.evaluate((id) => { document.querySelector('[data-verz="' + id + '"]').click(); }, pid);
    await page.waitForFunction(() => /1 van 3 sterren open/.test(document.querySelector('#geldKinderen').textContent),
      null, { timeout: 8000 });

    /* ---- het kind in zakgeld.html: alles staat er eerlijk in ---- */
    await page.evaluate((sessie) => { localStorage.setItem('rtf_sessie', JSON.stringify(sessie)); },
      { code: g.code, token: kindToken, profiel: { naam: 'Mila', groep: 'tiener' } });
    await page.goto(base + '/apps/foundation/zakgeld.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /3,50/.test(document.querySelector('#saldo').textContent),
      null, { timeout: 15000 });
    const txs = await page.evaluate(() => document.querySelector('#txs').textContent);
    assert.ok(/Zakgeld \(week\)/.test(txs), 'het weekgeld staat als boeking in het potje');
    assert.ok(/Sterren verzilverd \(2\)/.test(txs), 'de verzilverde sterren staan er met naam en toenaam');
    assert.ok(await page.evaluate(() => /per week/.test((document.querySelector('#week') || {}).textContent || '')),
      'het kind ziet wat zijn weekgeld is');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
