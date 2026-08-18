/* ============================================================================
   HET GOVERNANCE-SCHERM

   De grendels zelf staan in test/rtfos-governance.test.js. Dit gaat over de
   vraag of het scherm ze TOONT -- en dat is bij deze laag een ander soort fout
   dan een kapotte knop. Een bestuursscherm dat een besluit netjes opslaat maar
   het quorum nergens laat zien, werkt prima en is precies waardeloos: de
   secretaris weet dan niet waarop hij wordt afgerekend. Wat je niet ziet,
   controleer je niet.

   Twee dingen worden hier afgelopen:
     1. HET QUORUM STAAT MET ZIJN NOEMER IN BEELD ("2 van 5, quorum 3"), en de
        weigering zegt hetzelfde in woorden.
     2. DE BELANGHEBBENDE WORDT OP HET SCHERM GEWEIGERD. Dat is de handeling die
        alleen op het scherm bestaat: drie invoervelden die samen een stemming
        zijn, en een foutzin die op de goede plek moet landen.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfosgovs-'));
const OFFICE_CODE = 'RTFOSGOVS-KEURING';

test('het governance-scherm toont het quorum met zijn noemer, en weigert de belanghebbende',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  let browser;
  try {
    const token = await kantoorAlsPersoon(srv.base);
    assert.ok(token, 'geen kantoorsessie');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(srv.base + '/apps/foundation/os-bestuur.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(srv.base + '/apps/foundation/os-bestuur.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#vgMaak', { timeout: 15000 });

    // een landelijke vergadering van vijf bestuurders
    await page.selectOption('#vgSoort', 'landelijk');
    await page.fill('#vgDatum', '2026-09-14');
    await page.fill('#vgOmvang', '5');
    await page.click('#vgMaak');
    await page.waitForSelector('[data-pres]', { timeout: 15000 });

    /* HET QUORUM MET ZIJN NOEMER. "quorum 3" alleen zegt de secretaris niets;
       hij moet zien hoeveel er zijn en hoeveel er waren. */
    const leeg = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    // /i, want de pil met het quorum staat in kapitalen op het scherm
    assert.match(leeg, /0 van 5, quorum 3/i, 'het quorum staat niet met zijn noemer in beeld');

    // twee aanwezigen: nog steeds geen besluit, en het scherm zegt waarom
    const kaart = await page.getAttribute('[data-pres]', 'data-pres');
    await page.fill('#v-' + kaart + ' .vAanw', 'rahul, nadia');
    await page.click('[data-pres]');
    await page.waitForFunction(() => /2 van 5, quorum 3/i.test(document.body.innerText), null, { timeout: 15000 });

    await page.fill('#v-' + kaart + ' .bOnd', 'jaarplan');
    await page.fill('#v-' + kaart + ' .bTekst', 'het jaarplan wordt vastgesteld');
    await page.fill('#v-' + kaart + ' .bVoor', 'rahul, nadia');
    await page.click('[data-besl]');
    await page.waitForSelector('.melder.fout', { timeout: 15000 });
    const tekort = await page.textContent('.melder.fout');
    assert.match(tekort, /2 van de 5/, 'de weigering noemt niet hoeveel er waren');
    assert.match(tekort, /er zijn er 3 nodig/, 'de weigering noemt niet hoeveel er nodig waren');

    // drie aanwezigen, maar een van hen heeft een belang bij dit punt
    await page.fill('#v-' + kaart + ' .vAanw', 'rahul, nadia, joost');
    await page.click('[data-pres]');
    await page.waitForFunction(() => /3 van 5, quorum 3/i.test(document.body.innerText), null, { timeout: 15000 });

    await page.fill('#v-' + kaart + ' .bOnd', 'opdracht aan bureau Joost');
    await page.fill('#v-' + kaart + ' .bTekst', 'de opdracht gaat naar het bureau van Joost');
    await page.fill('#v-' + kaart + ' .bVoor', 'rahul, nadia, joost');
    await page.fill('#v-' + kaart + ' .bBelang', 'joost');
    await page.click('[data-besl]');
    await page.waitForFunction(() => /belanghebbend/.test(
      (document.querySelector('.melder.fout') || {}).textContent || ''), null, { timeout: 15000 });
    const belang = await page.textContent('.melder.fout');
    assert.match(belang, /joost/i, 'de weigering noemt niet wie het betreft');

    // op onthouding lukt het wel, en het besluit komt in beeld met de stemverhouding
    await page.fill('#v-' + kaart + ' .bVoor', 'rahul, nadia');
    await page.click('[data-besl]');
    await page.waitForFunction(() => /aangenomen/i.test(document.body.innerText), null, { timeout: 15000 });
    const na = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(na, /opdracht aan bureau Joost/i, 'het besluit staat niet op het scherm');
    assert.match(na, /2 voor, 0 tegen/i, 'de stemverhouding staat niet bij het besluit');
    assert.match(na, /belang: joost/i, 'het vastgelegde belang staat niet bij het besluit');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
