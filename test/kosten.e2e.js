/* HET KOSTENBORD IN EEN ECHTE BROWSER.

   test/kosten.test.js bewijst wat de SERVER doet. Dat is niet hetzelfde als wat
   een BROWSER doet: een scherm dat vier endpoints tegelijk ophaalt, uit hun
   antwoorden HTML bouwt en er formulieren onder zet, kan over de lijn helemaal
   kloppen en in een venster stukgaan op één veld dat null blijkt te zijn. Dat
   is precies wat er hier op het spel staat, want dit bord is de plek waar een
   mens besluit om andermans rekening te verhogen.

   Wat deze toets vastlegt:
     1. de pagina laadt zonder een enkele scriptfout, met een echte
        boardroom-sessie;
     2. het dekkingsblok staat er, met het voorbehoud eronder -- dat blok is de
        hele reden dat het percentage erboven mag staan;
     3. een tarief zetten VIA HET SCHERM komt echt aan en staat er daarna;
     4. de vier economieen en de firewall staan op ditzelfde scherm;
     5. wat het scherm niet weet, staat er ook echt.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('het kostenbord: laadt, toont het voorbehoud, en zet een tarief',
  { skip: !pw && 'Playwright niet beschikbaar' }, async () => {
  const srv = await startServer();
  const base = srv.base;
  let browser = null;
  try {
    const kantoor = await kantoorAlsPersoon(base);
    assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te zien');

    browser = await pw.chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const fouten = letOpFouten(page, []);
    /* De sessie wordt met addInitScript gezaaid en niet door eerst app.html te
       openen: die registreert een service worker, en daarna is elke navigatie
       een nevenverzoek in plaats van een bezoek (server/routelog.js). */
    await page.addInitScript((t) => {
      try { localStorage.setItem('rtg_office_token', t); } catch (e) {}
    }, kantoor);
    await page.goto(base + '/apps/kosten.html', { waitUntil: 'networkidle' });

    const tekst = await page.textContent('#main');
    assert.match(tekst, /Dekken de bijdragen de kosten/, 'het dekkingsblok staat er niet: ' + tekst.slice(0, 200));
    /* Het voorbehoud is geen versiering. Zonder dit blok staat er een percentage
       waarvan de noemer kosten bevat waarvan de teller de bijdrage mist. */
    assert.match(tekst, /Wat dit percentage niet zegt/);
    assert.match(tekst, /RTFoundation/);
    /* De vier economieen en de grens ertussen staan op HETZELFDE scherm als de
       doorbelasting, en dat is de bedoeling: een firewall die je elders moet
       zoeken, zoek je pas op als er al iets is misgegaan. */
    assert.match(tekst, /De vier economieen/);
    assert.match(tekst, /geen enkele relatie vastgelegd|Economische relaties/);

    // een tarief zetten via het scherm, en het moet er daarna echt staan
    await page.selectOption('#tSoort', 'ai-uitvoer');
    await page.fill('#tBedrag', '1500');
    await page.fill('#tBron', 'Prijslijst modelaanbieder, augustus 2026');
    await page.click('#tZet');
    await page.waitForFunction(() =>
      /Prijslijst modelaanbieder/.test(document.querySelector('#main').textContent), null, { timeout: 15000 });

    const na = await page.textContent('#main');
    assert.match(na, /Prijslijst modelaanbieder/, 'het gezette tarief staat niet op het scherm');
    /* En de server heeft het echt: het scherm zou het ook alleen maar kunnen
       tonen omdat het zijn eigen invoer terugtekent. */
    const controle = await fetch(base + '/api/office/kosten/tarieven', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor },
      body: '{}' }).then(r => r.json());
    const t = controle.tarieven.find(x => x.soort === 'ai-uitvoer');
    assert.equal(t.perEenheid, 1500);
    assert.match(t.bron, /Prijslijst modelaanbieder/);

    assert.deepEqual(fouten, [], 'scriptfouten op het kostenbord');
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});
