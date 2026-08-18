/* Scherm-test voor RTG Geld als ECHTE app: tien standen in een schil
   (PLATFORM.md par. 0, de eerste wereld die werkelijk is samengevoegd).

   Wat hier bewezen wordt:
   1. elke stand opent en tekent iets -- ook de premium-standen, die op een
      RTG-pas de weigering van de SERVER tonen en geen leeg vlak;
   2. wisselen laat geen fouten achter in de console;
   3. de tien oude paden leiden om naar hun stand, met de querystring erbij --
      een oude bladwijzer of alarmmail komt precies uit waar hij heen wilde.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

const STANDEN = ['overzicht', 'wallet', 'bank', 'wbw', 'metier', 'balans',
  'rtgcode', 'labfonds', 'mecenaat', 'logboek', 'nalatenschap'];
const OUDE_PADEN = {
  '/apps/wallet.html': 'wallet', '/apps/bank.html': 'bank', '/apps/wbw.html': 'wbw',
  '/apps/metier.html': 'metier', '/apps/balans.html': 'balans', '/apps/rtgcode.html': 'rtgcode',
  '/apps/labfonds.html': 'labfonds', '/apps/mecenaat.html': 'mecenaat',
  '/apps/logboek.html': 'logboek', '/apps/nalatenschap.html': 'nalatenschap'
};

test('RTG Geld: tien standen openen, wisselen schoon, en de oude paden leiden om',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geldapp-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Geld Echt', email: 'ge' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-03-03', tier: 'rtg' });
    assert.ok(reg.token, 'registreren hoort een token te geven');

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

    await page.goto(base + '/apps/geld.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#standen button', { timeout: 15000 });

    const knoppen = await page.evaluate(() =>
      [...document.querySelectorAll('#standen button')].map((b) => b.dataset.id));
    assert.deepEqual(knoppen, STANDEN,
      'de standenbalk hoort precies de tien standen plus het overzicht te dragen, in deze volgorde');

    /* Elke stand openen. "Iets tekenen" is hier de lat: een premium-stand op
       een RTG-pas toont de weigering van de server, en dat is ook iets -- een
       LEEG paneel is het enige dat altijd fout is. */
    for (const id of STANDEN) {
      await page.click('#standen button[data-id="' + id + '"]');
      await page.waitForTimeout(700);
      const beeld = await page.evaluate(() => ({
        hash: location.hash,
        tekst: (document.getElementById('paneel').innerText || '').trim().length,
        actief: (document.querySelector('#standen button[aria-current="true"]') || {}).dataset
      }));
      assert.equal(beeld.hash, '#' + id, 'het adres hoort de stand te dragen');
      assert.ok(beeld.tekst > 0, 'stand "' + id + '" tekende een leeg paneel');
      assert.equal(beeld.actief.id, id, 'de balk hoort de actieve stand te tonen');
    }

    /* En terug naar het overzicht: het wisselen zelf mag niets kapotmaken. */
    await page.click('#standen button[data-id="overzicht"]');
    await page.waitForTimeout(600);

    /* De omleidingen. De querystring hoort VOOR de hash mee te reizen; andersom
       is hij een stuk van de hash en komt hij nergens aan (die fout stond in de
       veilig-omleidingen een commit lang). */
    for (const [oud, stand] of Object.entries(OUDE_PADEN)) {
      await page.goto(base + oud + '?ref=toets', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#standen button', { timeout: 15000 });
      await page.waitForTimeout(400);
      const u = new URL(page.url());
      assert.equal(u.pathname, '/apps/geld.html', oud + ' hoort om te leiden naar de wereld');
      assert.equal(u.hash, '#' + stand, oud + ' hoort naar zijn eigen stand te wijzen');
      assert.equal(u.searchParams.get('ref'), 'toets', 'de querystring hoort mee te reizen');
    }

    /* De browser logt ELKE mislukte fetch als consolefout, ook de twee die
       hier de bedoeling zijn: mecenaat en logboek zijn premium, en de server
       weigert een RTG-pas met een 403. Die weigering is het juiste gedrag (de
       stand toont hem), dus alleen die vorm wordt gefilterd; elke andere
       consolefout blijft een zakker. */
    const echteFouten = fouten.filter((f) =>
      !/favicon/i.test(f) && !/Failed to load resource.*403/.test(f));
    assert.deepEqual(echteFouten, [], 'RTG Geld hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
