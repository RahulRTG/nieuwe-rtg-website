/* Muisvrij bedienen, in een echte browser.

   De zinsontleding is los getoetst (test/handenvrij.test.js). Wat die test NIET
   kan zien is of het geheel er ook echt staat: of de balk verschijnt op een
   gewone app-pagina, of typen zonder de muis in de balk belandt, en of een
   gesproken zin een tab op de pagina daadwerkelijk aanklikt. Dat is precies wat
   hier gebeurt, met de eigen browser-driver (of Playwright, als dat er is).

   De microfoon zelf toetsen we hier niet: die zit achter een browser-permissie
   en echte audio. Wel toetsen we de weg erna, door dezelfde functie te roepen
   die de mond gebruikt (Handenvrij.zeg), zodat de hele keten van zin naar
   handeling in een echte pagina bewezen is.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
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

test('de muisvrije balk werkt in een echte pagina', { skip: pw ? false : 'geen browser beschikbaar' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hv-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Handenvrij Tester', email: 'hv' + u + '@x.nl', phone: '061' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
      })
    }).then(r => r.json());
    assert.ok(reg.token, 'het lid moet een token krijgen');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    page.on('pageerror', e => fouten.push(e.message));
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);

    /* Het leden-OS: een gewone pagina, niet een die hier speciaal voor gemaakt is.
       Deze heeft echte tabs, dus hier is te zien of de balk zelf plekken vindt
       zonder dat de pagina er iets voor doet. */
    await page.route('**/api/onboarding/status', r => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true })
    }));
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 20000 });

    /* 1. de balk hangt klaar (via metgezel -> handenvrij -> handenvrij-balk),
       maar staat niet uit zichzelf op het scherm: sinds "Losse knoppen weg"
       is er geen vaste balk meer. Je roept Rahul, en dan is hij er. Beide
       kanten horen hier vast te liggen, anders sluipt de balk zo weer terug. */
    await page.waitForSelector('.hv-balk input', { state: 'attached', timeout: 15000 });
    assert.equal(await page.evaluate(() => document.querySelector('.hv-balk').classList.contains('hv-weg')),
      true, 'de balk hoort weg te staan tot je Rahul roept');
    await page.evaluate(() => window.RTGRahul.open());
    await page.waitForSelector('.hv-balk input', { state: 'visible', timeout: 15000 });

    // 2. typen zonder de muis: een losse letter belandt in de balk
    await page.click('h1, body');
    await page.keyboard.press('r');
    const na = await page.evaluate(() => ({
      focus: document.activeElement === document.querySelector('.hv-balk input'),
      waarde: document.querySelector('.hv-balk input').value
    }));
    assert.ok(na.focus, 'een losse letter hoort de balk te focussen');
    assert.equal(na.waarde, 'r', 'en de letter hoort erin te staan');

    /* 3. de plekken van deze pagina zijn gevonden zonder dat de pagina meewerkt:
       puur uit de DOM (tabs, data-tab, navigatielinks). Dit is de reden dat
       spraaknavigatie op 150+ pagina's werkt zonder ze een voor een aan te raken. */
    const plekken = await page.evaluate(() => (window.Handenvrij.plekken() || []).map(p => p.naam));
    assert.ok(plekken.length > 2, 'verwacht meerdere plekken uit de DOM, kreeg ' + JSON.stringify(plekken));

    // 4. een getypte of gesproken sprong voert die plek uit, precies een keer
    const geklikt = await page.evaluate(() => {
      let raak = 0;
      window.Handenvrij.plek('Testplek', function () { raak++; });
      window.Handenvrij.zeg('ga naar Testplek');
      return raak;
    });
    assert.equal(geklikt, 1, 'de sprong hoort de plek precies een keer uit te voeren');

    // 5. en een echte tab uit de DOM wordt ook echt aangeklikt
    const tabRaak = await page.evaluate((naam) => {
      var p = (window.Handenvrij.plekken() || []).filter(function (x) { return x.naam === naam; })[0];
      if (!p) return 'plek weg';
      var raak = 0;
      document.addEventListener('click', function () { raak++; }, { once: true, capture: true });
      p.doen();
      return raak;
    }, plekken[0]);
    assert.equal(tabRaak, 1, 'de plek uit de DOM hoort echt een klik te geven, kreeg ' + tabRaak);

    // 6. de vaste bewegingen raken de pagina, niet de server
    const gescrold = await page.evaluate(() => {
      document.body.style.minHeight = '4000px';
      window.scrollTo(0, 0);
      window.Handenvrij.zeg('omlaag');
      return new Promise(r => setTimeout(() => r(window.scrollY), 700));
    });
    assert.ok(gescrold > 50, 'omlaag hoort echt te scrollen, kreeg ' + gescrold);

    /* 7. het voelt als een gesprek: jouw zin staat er meteen als eigen bubbel,
       daarna komt Rahul met een bubbel aan zijn kant. Niet een regel die de
       vorige wist, maar beurten die blijven staan. */
    await page.evaluate(() => { document.querySelector('.hv-balk input').value = 'hoe staat mijn saldo ervoor'; });
    await page.click('.hv-balk button[type="submit"]');
    await page.waitForSelector('.hv-chat .hv-beurt.ik .hv-bel', { state: 'visible', timeout: 5000 });
    const mijn = await page.evaluate(() => document.querySelector('.hv-chat .hv-beurt.ik .hv-bel').textContent);
    assert.match(mijn, /saldo/, 'jouw eigen zin hoort meteen in het gesprek te staan');
    await page.waitForSelector('.hv-chat .hv-beurt.hij .hv-bel', { state: 'visible', timeout: 20000 });
    const beurten = await page.evaluate(() => ({
      ik: document.querySelectorAll('.hv-chat .hv-beurt.ik').length,
      hij: document.querySelectorAll('.hv-chat .hv-beurt.hij').length,
      tikt: document.querySelectorAll('.hv-tikt').length,
      koppen: document.querySelectorAll('.hv-beurt.hij .hv-kop').length
    }));
    assert.ok(beurten.ik >= 1, 'minstens een eigen beurt');
    assert.ok(beurten.hij >= 1, 'minstens een beurt van Rahul');
    assert.equal(beurten.tikt, 0, 'de drie puntjes horen weg te zijn als het antwoord er is');
    assert.ok(beurten.koppen >= 1, 'Rahul hoort zijn gezicht bij zijn beurt te hebben');

    /* 8. de geldgrens, in de browser. We tellen de verzoeken naar Rahul: een
       gesproken betaalopdracht mag er GEEN veroorzaken zolang geld-met-de-mond
       uitstaat. Dit is de enige toets die echt bewijst dat er niets de deur
       uitgaat; de rest kijkt naar tekst op het scherm. */
    let naarRahul = 0;
    await page.route('**/api/fluister', async r => {
      naarRahul++;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ antwoord: 'geregeld' }) });
    });

    // gesproken (hardop=true) betaalopdracht, met de standaardinstelling
    await page.evaluate(() => { window.__handenvrijKamer.doe('boek een taxi naar huis', true); });
    await new Promise(r => setTimeout(r, 900));
    assert.equal(naarRahul, 0, 'een gesproken boeking mag Rahul niet eens bereiken');
    const klaarGezet = await page.evaluate(() => document.querySelector('.hv-balk input').value);
    assert.match(klaarGezet, /taxi/, 'de zin hoort klaargezet te staan om zelf te versturen');

    // getypt mag wel: dat is juist de weg die we willen
    await page.evaluate(() => { window.__handenvrijKamer.doe('boek een taxi naar huis', false); });
    await page.waitForFunction(() => document.querySelectorAll('.hv-beurt.hij').length > 0, { timeout: 5000 });
    assert.equal(naarRahul, 1, 'getypt gaat gewoon door');

    // met de mond aan: eerst een bevestiging, en pas daarna gaat het uit
    await page.evaluate(() => { sessionStorage.setItem('rtg_handenvrij_geldmond', '1'); });
    await page.reload({ waitUntil: 'load' });
    // na het herladen hangt de balk weer weg; roep Rahul opnieuw
    await page.waitForSelector('.hv-balk input', { state: 'attached', timeout: 15000 });
    await page.evaluate(() => window.RTGRahul.open());
    await page.waitForSelector('.hv-balk input', { state: 'visible', timeout: 15000 });
    let naarRahul2 = 0;
    await page.route('**/api/fluister', async r => {
      naarRahul2++;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ antwoord: 'geregeld' }) });
    });
    await page.evaluate(() => { window.__handenvrijKamer.doe('betaal de rekening', true); });
    await page.waitForSelector('.hv-kaart', { state: 'visible', timeout: 5000 });
    assert.equal(naarRahul2, 0, 'ook met de mond aan gaat er eerst niets uit');
    await page.click('.hv-kaart button.ja');
    await page.waitForFunction(() => window.__hvTeller === undefined || true, { timeout: 1000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 800));
    assert.equal(naarRahul2, 1, 'pas na de extra bevestiging gaat het door');

    // 9. en dit alles zonder onopgevangen JS-fouten
    assert.deepEqual(fouten, [], 'geen paginafouten');
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
