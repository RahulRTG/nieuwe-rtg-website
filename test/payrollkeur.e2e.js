/* Scherm-toets op het AANMERKEN van een regelpakket (payroll.html, tab "Loonrun (OS)").

   WAAROM DIT BESTAND ER IS, en het is een onaangename reden. Twee keer in een
   ronde is hier een API-vorm veranderd, zijn de servertoetsen keurig
   meegenomen, en is het scherm dat ervan leest blijven staan. Beide keren was
   het geldig JavaScript dat een veld las dat er niet meer was of een verzoek
   stuurde dat de server sinds kort weigert -- dus scripts/check.js zag het
   niet, en geen enkele toets raakte die knoppen aan. (payroll.html wordt wel
   geopend door de veegrondes ioslaag/paginas, maar die kijken of de pagina
   leeft, niet wat de knoppen doen.)

   EN WAAROM HIJ ER EERST NIET KWAM. De eerste poging liep vast: het klikpad
   had een confirm() en een prompt(), allebei blokkeren ze de JavaScript van de
   pagina, dus de klik die ze opende loste pas op als ze weg waren en alles wat
   deze toets daarna vroeg kwam achter die klik in de rij. Dat is niet met een
   truc op te lossen -- de vorm was fout. De bevestiging staat nu in het scherm
   zelf (een blok dat openklapt met de verklaring, een veld voor de reden en
   twee knoppen), en daarmee is dit pad gewoon te lopen.

   DRIE BEWERINGEN:
   1. de zelfverklaring van het pakket staat op het scherm VOORDAT je klikt;
   2. wie geen reden opgeeft, merkt niets aan -- en hoort dat ook;
   3. wie er wel een opgeeft, merkt het pakket aan; de server kent hem daarna
      met diezelfde reden, en het scherm toont hem.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('de knop Aanmerken vraagt in het scherm wat de server vraagt',
  { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keur-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-KEUR-1' } });
  let browser = null;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const kantoor = await kantoorAlsPersoon(srv.base);
    assert.ok(kantoor, 'de eigenaar staat als persoon in de backoffice');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((tk) => { try { localStorage.setItem('rtg_office_token', tk); } catch (e) {} }, kantoor);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/payroll.html', { waitUntil: 'domcontentloaded' });
    /* Wachten tot de openingsanimatie klaar is: ios.js zet een transform op de
       BODY, en zolang die loopt kan Playwright niet vaststellen dat een knop
       klikbaar is. Dezelfde val staat beschreven in test/werkblad.e2e.js. */
    await page.waitForFunction(() => getComputedStyle(document.body).transform === 'none',
      null, { timeout: 15000 }).catch(() => {});
    await page.click('nav [data-tab="os"]');
    await page.waitForSelector('#osRegels [data-keur]', { timeout: 20000 });

    await t.test('de zelfverklaring van het pakket staat er voordat je klikt', async () => {
      const tekst = await page.$eval('#osRegels', el => el.innerText);
      assert.match(tekst, /Dit pakket meldt zelf/, 'de waarschuwing staat op het scherm: ' + tekst.slice(0, 200));
      assert.match(tekst, /Handboek Loonheffingen/, 'met de tekst van het pakket zelf');
      assert.equal(await page.isHidden('#osRegels .keurvak'), true, 'het bevestigblok staat nog dicht');
    });

    await t.test('zonder reden wordt er niets aangemerkt', async () => {
      await page.click('#osRegels [data-keur]');
      await page.waitForSelector('#osRegels .keurvak:not([hidden])', { timeout: 10000 });
      const vak = await page.$eval('#osRegels .keurvak', el => el.innerText);
      assert.match(vak, /alleen met een reden/, 'het blok zegt wat er nodig is: ' + vak.slice(0, 160));
      assert.match(vak, /echt geld naar medewerkers/, 'en wat aanmerken betekent');

      await page.click('#osRegels [data-keur-ja]');          // leeg veld
      /* payroll.html meldt in #osMelding en niet in #melding -- dat laatste is
         de opzet van kantoren.html. Een toets die op de verkeerde bak wacht,
         wacht voor niets: hij liep hier tien seconden en zei toen "time-out",
         wat op alles kan wijzen behalve op de echte oorzaak. */
      await page.waitForFunction(() => {
        const m = document.querySelector('#osMelding');
        return m && m.textContent.includes('geen reden');
      }, null, { timeout: 10000 });

      const na = (await post('/api/office/payroll/regels', { land: 'NL' }, kantoor)).body;
      assert.ok((na.pakketten || []).every(p => p.stand !== 'goedgekeurd'),
        'en de server kent nog steeds geen aangemerkt pakket');
    });

    await t.test('met een reden gaat hij aan, en de reden blijft staan', async () => {
      await page.fill('#osRegels [data-reden]', 'tegen het Handboek gelegd op 9 augustus');
      await page.click('#osRegels [data-keur-ja]');
      /* innerText geeft de GERENDERDE tekst, en de pil staat door de CSS in
         kapitalen -- daarom hoofdletterongevoelig. Een toets die op
         'aangemerkt door' wacht terwijl er AANGEMERKT DOOR staat, wacht voor
         niets en meldt daarna een time-out die naar van alles wijst. */
      await page.waitForFunction(() => {
        const e = document.querySelector('#osRegels');
        return e && /aangemerkt door/i.test(e.innerText);
      }, null, { timeout: 15000 });

      const na = (await post('/api/office/payroll/regels', { land: 'NL' }, kantoor)).body;
      const p = (na.pakketten || []).find(x => x.stand === 'goedgekeurd');
      assert.ok(p, 'de server kent het pakket nu als aangemerkt -- het scherm deed niet alsof');
      assert.equal(p.ondanksWaarschuwing, 'tegen het Handboek gelegd op 9 augustus', 'met precies de reden uit het veld');
      assert.equal(p.opDemoTabellen, true, 'en het merk dat het om ongecontroleerde tabellen gaat');
      assert.match(await page.$eval('#osRegels', el => el.innerText), /uitdrukkelijk aangemerkt/i,
        'en het scherm toont die reden ook');
    });

    assert.deepEqual(fouten, [], 'geen paginafouten onderweg');
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
