/* Scherm-test voor de tekstverwerker en de presentatie van RTG Office.

   Wat hier bewezen wordt:
   - zoeken en vervangen raakt alleen TEKST, nooit de opmaak: na "haven" naar
     "kade" staat de kop er nog als kop;
   - de inhoudsopgave komt uit de koppen en ververst bij een tweede klik;
   - een dia dupliceren, het thema van het deck kiezen, en presenteren met de
     spreektimer die meeloopt;
   - de afdrukknop bestaat en de hand-out draagt GEEN sprekersnotities -- dat
     is de belofte die je maar één keer kunt breken.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
function browserOpties() {
  const opties = { args: ['--no-sandbox'] };
  const kandidaten = [process.env.RTG_BROWSER_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const gevonden = kandidaten.find(p => fs.existsSync(p));
  if (gevonden) opties.executablePath = gevonden;
  return opties;
}
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Office-suite: tekstverwerker met zoeken/vervangen en inhoudsopgave, presentatie met thema en timer',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-office-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Suite E2E', email: 'os' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1987-05-05', tier: 'rtg' });

    browser = await pw.chromium.launch(browserOpties());
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/office.html', { waitUntil: 'domcontentloaded' });

    /* ---- de tekstverwerker ---- */
    await page.waitForSelector('#nieuwTekst', { timeout: 15000 });
    await page.click('#nieuwTekst');
    await page.click('#officeOpmaak > summary');
    await page.waitForSelector('#tekstTools .tb', { timeout: 10000 });
    await page.evaluate(() => {
      document.querySelector('#tekst').innerHTML =
        '<h1>De haven</h1><p>De haven ligt stil.</p><h2>Aankomst</h2><p>Wie de haven kent, vaart hier binnen.</p>';
      document.querySelector('#tekst').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.fill('#titel', 'Havenmemo');

    // zoeken en vervangen: alleen de tekst, nooit de opmaak
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#tekstTools .tb')).find(b => b.textContent === 'Zoeken').click();
    });
    await page.waitForSelector('.bladpaneel .bpveld', { timeout: 8000 });
    const velden = await page.$$('.bladpaneel .bpveld');
    await velden[0].fill('haven');
    await page.waitForFunction(() => /3 keer gevonden/.test(document.querySelector('.bladpaneel .bpstil').textContent),
      null, { timeout: 5000 });
    await velden[1].fill('kade');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.bladpaneel .tb')).find(b => b.textContent === 'Vervang alles').click();
    });
    await page.waitForFunction(() => /3 keer vervangen/.test(document.querySelector('.bladpaneel .bpstil').textContent),
      null, { timeout: 5000 });
    const naVervang = await page.evaluate(() => ({
      tekst: document.querySelector('#tekst').textContent,
      kop: document.querySelector('#tekst h1') ? document.querySelector('#tekst h1').textContent : null
    }));
    assert.ok(!/haven/.test(naVervang.tekst), 'elke "haven" is vervangen');
    assert.equal(naVervang.kop, 'De kade', 'ook in de kop, en de kop is nog steeds een kop');

    // de inhoudsopgave komt uit de koppen, en een tweede klik ververst hem
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#tekstTools .tb')).find(b => b.textContent === 'Inhoud').click();
    });
    await page.waitForSelector('#tekst .rtg-toc', { timeout: 5000 });
    let toc = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#tekst .rtg-toc p')).map(p => p.textContent));
    assert.deepEqual(toc.slice(1), ['De kade', 'Aankomst'], 'de koppen staan in de inhoudsopgave: ' + toc.join(' | '));
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#tekstTools .tb')).find(b => b.textContent === 'Inhoud').click();
    });
    const aantalToc = await page.evaluate(() => document.querySelectorAll('#tekst .rtg-toc').length);
    assert.equal(aantalToc, 1, 'verversen vervangt de oude inhoudsopgave; er komt er geen tweede bij');

    // de afdrukknop staat er (het afdrukken zelf is de dialoog van de browser)
    await page.click('#officeMeer > summary');
    assert.ok(await page.evaluate(() => !!document.getElementById('printBtn')));

    /* De formele werkstroom is menselijk: eerst ter beoordeling, daarna een
       expliciete bevestiging van de eigenaar. */
    await page.click('#faseHoofd');
    await page.waitForFunction(() => document.querySelector('#faseBadge').dataset.fase === 'beoordeling',
      null, { timeout: 8000 });
    page.once('dialog', d => d.accept());
    await page.click('#faseHoofd');
    await page.waitForFunction(() => document.querySelector('#faseBadge').dataset.fase === 'goedgekeurd',
      null, { timeout: 8000 });

    /* Een tweede venster mag de zichtbare oude stand nooit stil overschrijven.
       De lokale wijziging blijft staan tot de gebruiker kiest. */
    const tekstId = await page.getAttribute('#docTabs .office-tab[data-actief="1"]', 'data-tab');
    const actueel = await api(base, '/api/kantoorpakket/open', { id: tekstId }, reg.token);
    await api(base, '/api/kantoorpakket/bewaar', { id: tekstId, verwachtGewijzigd: actueel.gewijzigd,
      titel: 'Havenmemo', inhoud: { tekst: '<h1>Nieuwste serverversie</h1><p>Extern gecontroleerd.</p>' } }, reg.token);
    await page.evaluate(() => {
      document.querySelector('#tekst').innerHTML += '<p>Lokale, nog niet bewaarde regel.</p>';
      document.querySelector('#tekst').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('#conflictScrim.open', { timeout: 8000 });
    assert.match(await page.textContent('#conflictUitleg'), /niet overschreven/i);
    await page.click('#conflictNieuwste');
    await page.waitForFunction(() => /Extern gecontroleerd/.test(document.querySelector('#tekst').textContent),
      null, { timeout: 8000 });

    /* ---- de presentatie ---- */
    await page.click('#editTerug');
    await page.waitForSelector('#nieuwPres', { timeout: 10000 });
    await page.click('#nieuwPres');
    await page.waitForSelector('#diaTitel', { timeout: 10000 });
    assert.equal(await page.locator('#docTabs .office-tab').count(), 2,
      'document en presentatie blijven als twee werkbare Office-tabs open');
    await page.locator('#docTabs .office-tab').first().click();
    await page.waitForFunction(() => document.querySelector('#titel').value === 'Havenmemo', null, { timeout: 8000 });
    await page.locator('#docTabs .office-tab').last().click();
    await page.waitForFunction(() => document.querySelector('#titel').value === 'Nieuwe presentatie', null, { timeout: 8000 });
    await page.fill('#diaTitel', 'Welkom aan boord');
    await page.fill('#diaNotitie', 'GEHEIM: alleen voor de spreker');
    await page.evaluate(() => { document.querySelector('#diaDup').click(); });
    await page.waitForFunction(() => document.querySelectorAll('#diaRail .mini-dia').length === 2,
      null, { timeout: 5000 });

    await page.selectOption('#deckThema', 'bordeaux');
    await page.click('#presBtn');
    await page.waitForSelector('#toonDia.aan', { timeout: 8000 });
    const klasse = await page.evaluate(() => document.querySelector('#toonDia').className);
    assert.ok(/t-bordeaux/.test(klasse), 'het deck draagt zijn thema: ' + klasse);
    assert.ok(/1 van 2 · 00:0/.test(await page.evaluate(() => document.querySelector('#tdTeller').textContent)),
      'de spreektimer loopt mee in de teller');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => /2 van 2/.test(document.querySelector('#tdTeller').textContent),
      null, { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#toonDia').classList.contains('aan'),
      null, { timeout: 5000 });

    /* De hand-out, via de ECHTE afdrukknop (met de printdialoog vervangen door
       niets): elke dia een blok, en de sprekersnotitie gaat NIET mee. */
    const handout = await page.evaluate(() => {
      window.print = function () {};                    // geen dialoog in de test
      document.getElementById('printBtn').click();
      const ho = document.getElementById('handout');
      return {
        bestaat: !!ho,
        blokken: ho ? ho.querySelectorAll('.hdia').length : 0,
        tekst: ho ? ho.textContent : '',
        klas: document.body.className
      };
    });
    assert.equal(handout.bestaat, true, 'de afdrukknop bouwt een hand-out');
    assert.equal(handout.blokken, 2, 'elke dia een blok');
    assert.ok(/Welkom aan boord/.test(handout.tekst), 'de titel staat erin');
    assert.ok(!/GEHEIM/.test(handout.tekst),
      'de sprekersnotitie staat er NIET in: een hand-out is voor de zaal');
    assert.ok(/afdruk-aan/.test(handout.klas), 'en de pagina staat in de afdrukstand');
    // na de bezem is alles weer gewoon scherm
    await page.waitForFunction(() => !document.getElementById('handout') &&
      !document.body.classList.contains('afdruk-aan'), null, { timeout: 5000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
