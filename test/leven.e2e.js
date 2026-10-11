/* Schermtoets voor het werkblad RTG Leven ("Mijn leven" in LivingOS).

   Vier dingen worden hier tegen een echte server en een echte browser bewaakt:
   het levens-command-center dat LEVEN.md par. 4 op dit adres belooft (de lijn
   uit /api/leven/cockpit, zonder nvt-fasen en met de herkomst van het
   geboortejaar), Ontdekken uit echte zaken in plaats van een verzonnen
   restaurant, de bank die langs de Edge bereikbaar blijft, en de avond die van
   avond.html blijft (SCHERMEIGENAAR.json). Daarnaast blijven scores,
   voortgangsbalken en terugkom-lokkertjes verboden.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopNet, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { haalSessies } = require('../scripts/lib/proefsessies');

const pw = laadPlaywright();

test('RTG Leven opent op de levenslijn uit de cockpit, toont echte zaken en laat de avond aan avond.html',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leven-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Leven Echt', email: 'le' + t + '@e.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123',
        geboortedatum: '1994-05-05', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'registreren hoort een token te geven');

    /* Het contract onder het paneel: de lijn als controleerbare fasenlijst. */
    const lijnReactie = await fetch(base + '/api/leven/lijn', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: '{}'
    });
    const lijn = await lijnReactie.json();
    assert.equal(lijnReactie.ok, true, 'de bestaande levenslijn blijft bereikbaar voor gekoppelde clients');
    assert.ok(Array.isArray(lijn.fasen) && lijn.fasen.length > 0,
      'de levenslijn blijft een controleerbare fasenlijst leveren');

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

    /* Een zaak die nu GEEN reserveringen aanneemt, langs de echte route van
       de manager. Zonder zo'n zaak kan de filter op Ontdekken niet zakken: als
       alles open is, verandert er niets. */
    const { sessies } = await haalSessies(base, ['zaak']);
    assert.ok(sessies.zaak, 'de manager van KIKUNOI hoort in te kunnen loggen');
    const dicht = await fetch(base + '/api/supplier/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessies.zaak.waarde },
      body: JSON.stringify({ reservationsOpen: false })
    });
    assert.equal(dicht.ok, true, 'de manager zet de reserveringen dicht');

    await page.goto(base + '/apps/leven.html', { waitUntil: 'domcontentloaded' });

    /* 1. HET LEVENS-COMMAND-CENTER (LEVEN.md par. 1.5 en par. 4: "het command
       center op /apps/leven.html"). Het paneel leest /api/leven/cockpit en rekent
       niets bij: wat er staat is wat de server zei. Een nieuw lid zonder
       termijnen hoort de rustzin te krijgen, en de fasen met staat 'nvt' staan
       er NIET (par. 1.1: grijs is hoe een norm eruitziet).
       Mutatie gezien: in leven.js het filter `f.staat!=='nvt'` weggehaald --
       de fasenvergelijking zakt. */
    await page.waitForSelector('.lv-lijn [data-rust], .lv-lijn [data-uitzondering]', { timeout: 15000 });
    const cockpit = await (await fetch(base + '/api/leven/cockpit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: '{}'
    })).json();
    const lijnBeeld = await page.evaluate(() => ({
      tab: (document.querySelector('#lvTabs') || {}).innerText || '',
      rust: !!document.querySelector('.lv-lijn [data-rust]'),
      fasen: Array.from(document.querySelectorAll('.lv-lijn [data-fase-id]')).map((e) => e.dataset.faseId),
      geboorte: ((document.querySelector('.lv-lijn [data-fase-id="geboorte"]') || {}).innerText || '')
    }));
    assert.match(lijnBeeld.tab, /Mijn lijn/, 'het werkblad opent op de levenslijn');
    assert.equal(lijnBeeld.rust, cockpit.uitzonderingen.length === 0,
      'zonder uitzondering zegt het scherm dat u vandaag niets hoeft te doen');
    assert.deepEqual(lijnBeeld.fasen, cockpit.lijn.fasen.filter((f) => f.staat !== 'nvt').map((f) => f.id),
      'precies de fasen die spelen of speelden, in de volgorde van de server, zonder nvt');
    assert.ok(lijnBeeld.fasen.includes('geboorte'), 'het opgegeven geboortejaar staat op de lijn');
    /* De herkomst bereikt het scherm: dit lid liet nooit een paspoort zien. */
    await page.click('.lv-lijn [data-fase-id="geboorte"] summary');
    const herkomst = await page.locator('.lv-lijn [data-fase-id="geboorte"] details').innerText();
    assert.match(herkomst, /zelf opgaf/, 'een opgegeven geboortejaar staat er als opgegeven');
    assert.doesNotMatch(herkomst, /geverifieerd/i, 'en niet als geverifieerd paspoortgegeven');

    /* 2. ONTDEKKEN UIT ECHTE ZAKEN. Hier stond een vast sjabloon met een
       verzonnen restaurant ("Maison Noire", "beschikbaar om 19:30") en vier
       filterknoppen die niets deden. Nu toont het paneel wat /api/foodcourt en
       /api/uitgaan teruggeven, en filtert de knop op het enige veld dat de
       server ervoor levert.
       Mutatie gezien: de filter in tekenResto() uitgeschakeld (`!alleen||true`)
       -- de vergelijking na het aantikken zakt zodra er een gesloten zaak is. */
    /* DE BANK IS BEREIKBAAR LANGS DE EDGE. Zodra de adaptieve Edge staat,
       verbergt hij de eigen balken van een scherm (rtg-adaptive-edge.css) en
       neemt hij hun knoppen over -- maar alleen van een balk die hij kent. De
       bank van Leven stond daar niet bij, dus Bestellen, Uitgaan, Verblijf,
       Mijn plannen en Instellingen waren voor een lid onbereikbaar. Daarom
       wordt hier gewisseld zoals een mens het doet: Acties, en dan de knop.
       Mutatie gezien: `data-rtg-edge-controls` van de bank gehaald -- de klik
       op "Ontdekken" in het Edge-blad vindt niets. */
    const kies = async (naam) => {
      await page.getByRole('button', { name: 'Acties' }).click();
      await page.locator('.rtg-adaptive-controls button', { hasText: naam }).first().click({ timeout: 8000 });
    };
    await kies('Ontdekken');
    await page.waitForSelector('.lv-ontdek [data-restaurants] h2', { timeout: 15000 });
    const lees = async (pad) => (await fetch(base + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: '{}'
    })).json();
    const fc = await lees('/api/foodcourt');
    assert.ok(fc.restaurants.some((r) => !r.reserverenOpen) && fc.restaurants.some((r) => r.reserverenOpen),
      'de proef heeft een open en een gesloten zaak nodig, anders kan de filter niet zakken');
    const namen = () => page.$$eval('.lv-ontdek [data-resto] h3', (l) => l.map((e) => e.textContent));
    assert.deepEqual(await namen(), fc.restaurants.slice(0, 4).map((r) => r.naam), 'de restaurants zijn die van het foodcourt');
    await page.click('.lv-ontdek [data-filter="reserveerbaar"]');
    assert.equal(await page.getAttribute('.lv-ontdek [data-filter]', 'aria-pressed'), 'true');
    assert.deepEqual(await namen(), fc.restaurants.filter((r) => r.reserverenOpen).slice(0, 4).map((r) => r.naam),
      'de filter laat alleen zaken staan die reserveringen aannemen');
    const ontdekTekst = await page.locator('.lv-ontdek').innerText();
    for (const verzonnen of ['Maison Noire', 'Beschikbaar om 19:30', 'The Residence', 'Salon Privé']) {
      assert.equal(ontdekTekst.includes(verzonnen), false, 'geen verzonnen aanbod: ' + verzonnen);
    }
    if (!fc.restaurants.length) assert.match(ontdekTekst, /geen restaurants/, 'een lege bron zegt dat hij leeg is');

    /* 3. De avondplanner blijft van avond.html (SCHERMEIGENAAR.json): Leven
       opent de eigenaar en bouwt haar niet opnieuw. */
    await kies('Uw avond');
    await page.waitForSelector('.rv-pane iframe[src="/apps/avond.html"]', { timeout: 15000 });
    const beeld = await page.evaluate(() => ({
      balk: !!document.querySelector('progress, [role="progressbar"]'),
      tekst: (document.querySelector('.lv-app').innerText || '').toLowerCase(),
      eigenSamensteller: !!document.querySelector('[data-composer]'),
      tab: (document.querySelector('#lvTabs') || {}).innerText || ''
    }));
    assert.equal(beeld.eigenSamensteller, false, 'Leven bouwt de avond-samensteller niet opnieuw');
    assert.match(beeld.tab, /Uw avond/, 'het paneel heet naar wat het is, niet "Vandaag"');
    assert.equal(beeld.balk, false, 'geen voortgangsbalk over een leven');

    /* par. 2.9 en 2.4, op de getoonde tekst -- ook die van de lijn. "van de 10"
       vangt de teller die een levenslijn ongemerkt in een score verandert. */
    const alleTekst = beeld.tekst + ' ' + (lijnBeeld.geboorte || '').toLowerCase() + ' ' + herkomst.toLowerCase();
    for (const woord of ['streak', 'op rij', 'dagdoel', 'badge', 'punten', 'score',
      'van de 10', '% voltooid', 'beter dan']) {
      assert.equal(alleTekst.includes(woord), false,
        'het scherm hoort geen "' + woord + '" te tonen (LEVEN.md par. 2.4 en 2.9)');
    }

    /* En in het paneel staat de echte planner, met het expliciete akkoord. */
    const kader = page.frameLocator('.rv-pane iframe[src="/apps/avond.html"]');
    await kader.locator('#bPlan').waitFor({ timeout: 15000 });
    assert.equal(await kader.locator('#bPlan').count(), 1, 'de planner van avond.html staat in het paneel');

    /* 4. Het foodcourt zelf zei "Nu gesloten voor reserveringen" op het veld
       van de BESTELLINGEN (`open`), terwijl de tijdsloten op dat van de
       reserveringen weigeren. Een zaak met dichte reserveringen stond er dus als
       reserveerbaar, en elk tijdslot bleek vol.
       Mutatie gezien: in foodcourt.html terug naar `r.open` -- de dichte zaak
       draagt het label niet meer. */
    await page.goto(base + '/apps/foodcourt.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.resto[data-code="KIKUNOI"]', { timeout: 15000 });
    const labels = await page.$$eval('.resto', (l) => l.map((e) => [e.dataset.code, !!e.querySelector('.dicht')]));
    for (const [code, dichtLabel] of labels) {
      const r = fc.restaurants.find((x) => x.code === code);
      assert.equal(dichtLabel, !r.reserverenOpen, code + ': het label volgt de reserveringen, niet de bestellingen');
    }

    const echteFouten = fouten.filter((f) => !/favicon/i.test(f));
    assert.deepEqual(echteFouten, [], 'het scherm hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopNet(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
