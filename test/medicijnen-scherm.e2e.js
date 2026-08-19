/* Schermtoets voor apps/medicijnen.html.

   De belofte van dit scherm is een NEGATIEVE: RTG bepaalt niets. Dat is precies
   het soort belofte dat je op het scherm moet nakijken, want een motor die zich
   inhoudt en een scherm dat er alsnog een advies bij zet, is voor een lezer
   hetzelfde probleem. Er wordt hier dus niet alleen gekeken of het werkt, maar
   ook of er NIET staat wat er niet mag staan.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('Medicijnen: uw eigen lijst, en nergens een dosering van RTG',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-medscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Med Lid', email: 'medscherm@x.nl', phone: '0612345866',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/medicijnen.html', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const e = document.getElementById('vandaag');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, { timeout: 15000 });

    /* 1. de grens staat er op een leeg scherm, voordat er iets is misgegaan. */
    const grens = await page.textContent('#grens');
    assert.match(grens, /niet over uw medicijnen/i);
    assert.match(grens, /apotheek/i, 'met een echte weg ernaartoe, niet alleen een disclaimer');

    /* 2. een middel erbij, met de tijden van het lid zelf. */
    await openDeel(page, 'Een middel erbij');
    await page.locator('#mNaam').fill('Metoprolol');
    await page.locator('#mSterkte').fill('50 mg');
    await page.locator('#mMomenten').fill('08:00, 20:00');
    const maak = page.locator('#mMaak');
    await maak.scrollIntoViewIfNeeded();
    await maak.click();
    await page.waitForFunction(() => /Metoprolol/.test(document.getElementById('lijst').textContent),
      { timeout: 10000 });

    await openDeel(page, 'Vandaag');
    const vandaag = await page.textContent('#vandaag');
    assert.match(vandaag, /08:00/);
    assert.match(vandaag, /20:00/);
    /* De negatieve belofte, op het scherm: nergens een opdracht om iets in te
       nemen. Dat zou een doseerinstructie zijn. */
    assert.ok(!/neem\b|innemen nu|moet u innemen/i.test(vandaag),
      'het scherm zegt wat er staat, niet wat u moet doen: ' + vandaag.slice(0, 120));

    /* 3. de voorraad: eerst niet ingevuld, en dat staat er ook. Geen nul. */
    await openDeel(page, 'Wat u gebruikt');
    const voorId = await page.getAttribute('[data-voorraad]', 'data-voorraad');
    assert.match(await page.textContent('#lijst'), /niet ingevuld/i,
      'een voorraad die niemand heeft ingevuld, staat er als niet ingevuld');

    await page.locator('[data-vveld="' + voorId + '"]').fill('20');
    const bijwerk = page.locator('[data-voorraad="' + voorId + '"]');
    await bijwerk.scrollIntoViewIfNeeded();
    await bijwerk.click();
    await page.waitForFunction(() => /10 dagen/.test(document.getElementById('lijst').textContent),
      { timeout: 10000 });
    assert.match(await page.textContent('#lijst'), /afgetekend/i,
      'en het scherm zegt HOE er geteld is, want die telling is onvolledig als u niet aftekent');

    /* 4. aftekenen op het scherm haalt er een af. */
    await openDeel(page, 'Vandaag');
    const af = page.locator('[data-af]').first();
    await af.scrollIntoViewIfNeeded();
    await af.click();
    await page.waitForFunction(() => /Terugdraaien/.test(document.getElementById('vandaag').textContent),
      { timeout: 10000 });
    await openDeel(page, 'Wat u gebruikt');
    await page.waitForFunction(() => /Nog <b>19<\/b>|Nog 19/.test(document.getElementById('lijst').innerHTML),
      { timeout: 10000 });

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
