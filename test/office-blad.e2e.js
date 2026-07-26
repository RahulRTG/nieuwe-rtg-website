/* Scherm-test voor het rekenblad van RTG Office.

   test/rekenmotor.test.js bewijst dat de motor rekent; deze bewijst dat een
   mens er ook bij kan. Een formule intypen en de uitkomst in de cel zien, de
   functielijst doorzoeken en er een in de cel zetten, sorteren, filteren, en
   een grafiek die er echt komt te staan.

   De belangrijkste van de vijf is de eerste: de motor draait in de browser,
   waar de beveiligingsregels van de app het uitvoeren van tekst als code
   blokkeren. Dat is precies de fout die deze app eerder had -- in Node stond
   alles groen en op het scherm gaf elke formule een foutmelding.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');
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
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Rekenblad: formules, functies zoeken, sorteren, filteren en een grafiek',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-blad-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Blad E2E', email: 'bl' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1988-01-01', tier: 'rtg' });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    if (page.on) page.on('pageerror', e => fouten.push(e.message));
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/office.html', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#nieuwBlad', { timeout: 15000 });
    await page.click('#nieuwBlad');
    await page.waitForSelector('#blad td[data-ref="A1"]', { timeout: 10000 });

    // een cel vullen gaat via de formulebalk, net als bij een mens
    const zet = async (ref, wat) => {
      await page.click('#blad td[data-ref="' + ref + '"]');
      await page.fill('#celInvoer', wat);
      await page.press('#celInvoer', 'Enter');
    };
    const cel = (ref) => page.evaluate((r) =>
      document.querySelector('#blad td[data-ref="' + r + '"]').textContent, ref);

    for (const [ref, wat] of [['A1', 'Amsterdam'], ['A2', 'Berlijn'], ['A3', 'Cairo'],
      ['B1', '120'], ['B2', '80'], ['B3', '200']]) await zet(ref, wat);

    /* DE KERN: de motor rekent in de browser. Geen eval, dus geen botsing met
       de beveiligingsregels van de app -- en toch een uitkomst in de cel. */
    await zet('C1', '=SOM(B1:B3)');
    assert.equal(await cel('C1'), '400', 'de som staat in de cel: ' + (await cel('C1')));
    await zet('C2', '=VERT.ZOEKEN("Cairo";A1:B3;2)');
    assert.equal(await cel('C2'), '200', 'zoeken werkt ook op het scherm');
    await zet('C3', '=ALS(B1>100;"druk";"rustig")');
    assert.equal(await cel('C3'), 'druk');
    await zet('C4', '=1/0');
    assert.equal(await cel('C4'), '#DEEL/0!', 'een fout blijft zichtbaar, hij wordt geen nul');

    // de functie-zoeker zet een naam in de cel
    await page.click('#blad td[data-ref="D1"]');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#bladTools .tb')).find(b => b.textContent === 'Functies').click();
    });
    await page.waitForSelector('.bladpaneel .bplijst .tb', { timeout: 8000 });
    const aantal = await page.evaluate(() => document.querySelectorAll('.bladpaneel .bplijst .tb').length);
    assert.ok(aantal > 20, 'er staan echt functies in de lijst: ' + aantal);
    await page.fill('.bladpaneel .bpveld', 'MEDIAAN');
    await page.waitForFunction(() => document.querySelectorAll('.bladpaneel .bplijst .tb').length === 1,
      null, { timeout: 5000 });
    await page.click('.bladpaneel .bplijst .tb');
    assert.equal(await page.evaluate(() => document.querySelector('#celInvoer').value), '=MEDIAAN(',
      'de gekozen functie staat klaar in de cel');

    /* Sorteren verplaatst de rijen echt. Amsterdam/Berlijn/Cairo staat op
       120/80/200; hoog naar laag hoort Cairo bovenaan te zetten. */
    await page.click('#blad td[data-ref="B1"]');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#bladTools .tb')).find(b => b.textContent === 'Sorteren').click();
    });
    await page.waitForSelector('.bladpaneel .bprij .tb', { timeout: 8000 });
    await page.evaluate(() => {
      var v = document.querySelectorAll('.bladpaneel input[type="number"]');
      v[0].value = '1'; v[1].value = '3';
      Array.from(document.querySelectorAll('.bladpaneel .tb')).find(b => /hoog → laag/.test(b.textContent)).click();
    });
    await page.waitForFunction(() =>
      document.querySelector('#blad td[data-ref="A1"]').textContent === 'Cairo', null, { timeout: 8000 });
    assert.equal(await cel('B1'), '200', 'de hele rij is meeverhuisd, niet alleen de kolom');

    /* Filteren verbergt rijen uit BEELD, niet uit het document. */
    await page.click('#blad td[data-ref="B1"]');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#bladTools .tb')).find(b => b.textContent === 'Filter').click();
    });
    await page.waitForSelector('.bladpaneel .bpveld', { timeout: 8000 });
    await page.fill('.bladpaneel .bpveld', '>100');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.bladpaneel .tb')).find(b => b.textContent === 'Toepassen').click();
    });
    // na het sorteren staat er 200 / 120 / 80; boven de honderd blijven de
    // eerste twee over en verdwijnt de derde uit beeld
    await page.waitForFunction(() => !document.querySelector('#blad td[data-ref="A3"]'), null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => !!document.querySelector('#blad td[data-ref="A2"]')),
      'de rijen die wel voldoen staan er nog');

    /* En dit is het verschil met sorteren: de filter eraf halen brengt de rij
       terug, want hij was nooit weg. Uit beeld is niet uit het document. */
    await page.click('#blad td[data-ref="B1"]');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#bladTools .tb')).find(b => b.textContent === 'Filter').click();
    });
    await page.waitForSelector('.bladpaneel .bprij .tb', { timeout: 8000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.bladpaneel .tb')).find(b => b.textContent === 'Filter eraf').click();
    });
    await page.waitForFunction(() => !!document.querySelector('#blad td[data-ref="A3"]'), null, { timeout: 8000 });
    assert.equal(await cel('A3'), 'Berlijn', 'de verborgen rij staat er weer, met inhoud en al');

    // een grafiek komt er echt te staan, als SVG uit de eigen cellen
    await page.click('#blad td[data-ref="B1"]');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#bladTools .tb')).find(b => b.textContent === 'Grafiek').click();
    });
    await page.waitForSelector('.bladpaneel .bpdoek svg', { timeout: 8000 });
    const staven = await page.evaluate(() => document.querySelectorAll('.bpdoek .staaf').length);
    assert.ok(staven >= 1, 'er staan staven in de grafiek: ' + staven);
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.bladpaneel .tb')).find(b => b.textContent === 'Sluiten').click();
    });

    /* Kopiëren en plakken met verwijzingen die MEESCHUIVEN: =E1*2 een rij
       lager geplakt is =E2*2. Dat is de afspraak van elk rekenblad; zonder
       dit is plakken een leugen. En Ctrl+Z haalt de plak weer weg. */
    await zet('E1', '10');
    await zet('E2', '5');
    await zet('F1', '=E1*2');
    assert.equal(await cel('F1'), '20');
    await page.press('#blad td[data-ref="F1"]', 'Control+c');
    await page.click('#blad td[data-ref="F2"]');
    await page.press('#blad td[data-ref="F2"]', 'Control+v');
    await page.waitForFunction(() => document.querySelector('#blad td[data-ref="F2"]').textContent === '10',
      null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.querySelector('#celInvoer').value), '=E2*2',
      'de formule is meegeschoven, niet letterlijk gekopieerd');
    await page.press('#blad td[data-ref="F2"]', 'Control+z');
    await page.waitForFunction(() => document.querySelector('#blad td[data-ref="F2"]').textContent === '',
      null, { timeout: 5000 });

    /* Doorvoeren: de cel uitrollen over een reeks, met een verwijzing die
       per rij een stap meeschuift. */
    await zet('G1', '=E1+1');
    await page.click('#blad td[data-ref="G1"]');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#bladTools .tb')).find(b => b.textContent === 'Doorvoeren').click();
    });
    await page.waitForSelector('.bladpaneel .bprij .tb', { timeout: 8000 });
    await page.evaluate(() => {
      document.querySelector('.bladpaneel input[type="number"]').value = '2';
      Array.from(document.querySelectorAll('.bladpaneel .tb')).find(b => b.textContent === 'Omlaag doorvoeren').click();
    });
    await page.waitForFunction(() => document.querySelector('#blad td[data-ref="G2"]').textContent === '6',
      null, { timeout: 5000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
