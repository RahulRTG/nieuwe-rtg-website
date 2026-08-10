/* Scherm-test voor de RTG Werkruimte: stap 5 (werkruimtes bewaren en
   terughalen) en stap 6 (het commandopalet) uit WERKRUIMTE.md.

   Wat hier bewezen wordt is dat de kamer ECHT terugkomt -- niet dat er een
   knop staat. Een werkruimte die je kunt bewaren maar niet terugkrijgt is
   erger dan geen werkruimte: dan denk je dat je werk veilig staat.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
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

test('Werkruimte: een kamer bewaren, leeghalen en met een klik terughalen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wr-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });
    await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtg-surface', { timeout: 15000 });

    // de ruimte begint met twee surfaces
    const begin = await page.evaluate(() => RTGSchil.surfaces.map(s => s.id));
    assert.deepEqual(begin.sort(), ['agenda', 'reizen'], 'de tafel hoort niet leeg te beginnen');

    // er komt er een bij, en dan bewaren we de kamer
    await page.evaluate(() => RTGSchil.open('office', { naam: 'Documenten', url: '/apps/office.html', kort: 'Documenten' }));
    await page.evaluate(() => RTGSchil.bewaarRuimte('Mijn Directie'));
    const bewaard = await page.evaluate(() => RTGSchil.ruimtes);
    assert.deepEqual(bewaard, ['Mijn Directie']);

    // alles dicht: de kamer is nu echt weg van het scherm
    await page.evaluate(() => RTGSchil.surfaces.forEach(s => RTGSchil.sluit(s.id)));
    assert.equal(await page.evaluate(() => RTGSchil.surfaces.length), 0);

    /* EN NU TERUG. Dit is waar het om gaat: een klik en de hele kamer staat er,
       met dezelfde apps op dezelfde adressen. */
    await page.click('[data-ruimtes] [data-ruimte="Mijn Directie"]');
    await page.waitForFunction(() => RTGSchil.surfaces.length === 3, { timeout: 8000 });
    const terug = await page.evaluate(() => RTGSchil.surfaces.map(s => ({ id: s.id, url: s.url })));
    assert.deepEqual(terug.map(s => s.id).sort(), ['agenda', 'office', 'reizen']);
    assert.deepEqual(terug.find(s => s.id === 'office').url, '/apps/office.html',
      'een teruggehaalde surface hoort dezelfde app te openen, niet een lege doos');

    /* WAT ER NIET IN MAG. Een werkruimte is een meubelplan; zou er inhoud of
       een sessie in staan, dan was hij een tweede administratie en een
       sluiproute langs de rechten. */
    const opslag = await page.evaluate(() => localStorage.getItem('rtg_werkruimtes_v1'));
    const plan = JSON.parse(opslag);
    for (const s of plan['Mijn Directie']) {
      assert.deepEqual(Object.keys(s).filter(k => !['id', 'naam', 'url', 'zoom', 'vak'].includes(k)), [],
        'een bewaarde surface hoort alleen een meubelplan te zijn: ' + JSON.stringify(s));
    }

    // ---- stap 6: het palet ----
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palet:not([hidden])', { timeout: 5000 });
    await page.fill('#paletIn', 'Veilig');
    await page.waitForFunction(() =>
      document.querySelectorAll('#paletLijst li[role="option"]').length > 0, { timeout: 5000 });
    const eerste = await page.textContent('#paletLijst li[role="option"] span');
    assert.equal(eerste.trim(), 'Veilig', 'wat je typt hoort bovenaan te staan');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => RTGSchil.surfaces.some(s => s.id === 'veilig'), { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.getElementById('palet').hidden), true,
      'het palet hoort dicht te gaan zodra de opdracht is uitgevoerd');

    // Escape sluit zonder iets te doen
    await page.keyboard.press('Control+k');
    await page.waitForSelector('#palet:not([hidden])', { timeout: 5000 });
    const voor = await page.evaluate(() => RTGSchil.surfaces.length);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.getElementById('palet').hidden), true);
    assert.equal(await page.evaluate(() => RTGSchil.surfaces.length), voor,
      'Escape hoort niets te openen');

    assert.deepEqual(fouten, [], 'de werkruimte hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
