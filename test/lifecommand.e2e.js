/* Schermtoets voor Life Command (LIFE.md fase 5).

   Deze toets bewaakt de regel waar de hele fase op staat, en hij meet hem op het
   GERENDERDE scherm en niet op de bron: er is geen knop die iets uitvoert zonder
   dat de mens een keuze maakt. Elke knop hieronder is een keuze; er is er geen
   die "bevestig" heet met de keuze er al in.

   Waarom op het scherm en niet op de code: een verbod dat je op de broncode
   toetst, overleeft geen herschrijving. Hetzelfde argument als in
   test/leven.e2e.js.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Life Command: klaargezet, en pas na een keuze gebeurt er iets',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cmd-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const api = async (pad, body, tok) => (await fetch(base + pad, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {})
    })).json();

    const reg = await api('/api/auth/register', { name: 'Command Lid', email: 'cm' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1991-04-04', tier: 'rtg' });
    const g = await api('/api/genootschap/richt-op', { naam: 'Commandkring', soort: 'besloten' }, reg.token);
    const groepId = (g.groep && g.groep.id) || g.id;
    const straks = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
    await api('/api/genootschap/roep-bijeen',
      { groep: groepId, wat: 'Beslisborrel', datum: straks, tijd: '19:30' }, reg.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await ctx.addInitScript((tok) => {
      try {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/sociaal.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#klaar .vst', { timeout: 15000 });

    const beeld = await page.evaluate(() => ({
      kop: (document.querySelector('#klaar .vst b') || {}).textContent || '',
      gevolg: (document.querySelector('#klaar .vst .gevolg') || {}).textContent || '',
      waarom: (document.querySelector('#klaar .vst .waarom') || {}).textContent || '',
      knoppen: [...document.querySelectorAll('#klaar .vst [data-kies]')].map((b) => b.textContent.trim())
    }));

    assert.match(beeld.kop, /Beslisborrel/);
    assert.ok(beeld.gevolg, 'wat er gebeurt staat er VOORAF bij; er zit een ander mens achter');
    assert.ok(beeld.waarom, 'waarop dit voorstel rust, staat erbij en niet achter een knop');
    assert.deepEqual(beeld.knoppen, ['ja', 'misschien', 'nee'],
      'elke knop is een KEUZE; er is er geen die "bevestig" heet met de keuze er al in');

    /* De regel van deze fase, op het scherm gemeten: geen knop die uitvoert
       zonder keuze. Alles wat klikbaar is binnen het voorstel draagt data-kies. */
    const losseKnoppen = await page.evaluate(() =>
      [...document.querySelectorAll('#klaar button')].filter((b) => !b.hasAttribute('data-kies')).length);
    assert.equal(losseKnoppen, 0, 'geen knop in Life Command zonder een keuze eraan');

    /* En nu de keten: klikken bevestigt echt, en daarna vraagt het niets meer. */
    await page.click('#klaar .vst [data-kies="misschien"]');
    await page.waitForFunction(() => !document.querySelector('#klaar .vst'), { timeout: 10000 });

    const na = await api('/api/sociaal/actielog', {}, reg.token);
    assert.ok(na.log.length >= 1, 'de handeling staat in het actielog');
    assert.equal(na.log[0].wie, 'lid', 'de mens koos; het log mag niet zeggen dat het systeem koos');
    assert.match(na.log[0].wat, /misschien/);

    assert.deepEqual(fouten, [], 'geen enkele scherm-fout op dit pad');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
