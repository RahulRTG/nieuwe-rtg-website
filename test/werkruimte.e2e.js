/* Scherm-test voor de RTG Werkruimte: stap 5 (werkruimtes bewaren en
   terughalen) en stap 6 (het commandopalet) uit WERKRUIMTE.md.

   Wat hier bewezen wordt is dat de kamer ECHT terugkomt -- niet dat er een
   knop staat. Een werkruimte die je kunt bewaren maar niet terugkrijgt is
   erger dan geen werkruimte: dan denk je dat je werk veilig staat.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopHard, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Werkruimte: een kamer bewaren, leeghalen en met een klik terughalen',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wr-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });
    await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtg-surface[data-actief]', { timeout: 15000 });

    // de ruimte begint met twee surfaces
    const begin = await page.evaluate(() => RTGSchil.surfaces.map(s => s.id));
    assert.deepEqual(begin.sort(), ['agenda', 'reizen'], 'de tafel hoort niet leeg te beginnen');

    /* De Edge-randen zijn de enige navigator. Het werkvlak begint er direct
       naast en toont op desktop twee apps naast elkaar; op een telefoon vult
       precies de actieve app het hele overblijvende vlak. */
    const maten = async () => page.evaluate(() => {
      const pak = (s) => { const r = document.querySelector(s).getBoundingClientRect();
        return { x:r.x, y:r.y, width:r.width, height:r.height }; };
      return { scherm:{ width:innerWidth, height:innerHeight }, ruimte:pak('.rtg-werkruimte'),
        zichtbaar:[...document.querySelectorAll('.rtg-surface[data-edge-visible]')].map((e) => {
          const r=e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height };
        }), rand:{ boven:pak('.rtg-edge-top'), links:pak('.rtg-edge-side'), onder:pak('.rtg-edge-bottom') } };
    });
    const randKlopt = (m) => {
      assert.ok(Math.abs(m.ruimte.x - m.rand.links.width) < 1, JSON.stringify(m));
      assert.ok(Math.abs(m.ruimte.y - m.rand.boven.height) < 1);
      assert.ok(Math.abs(m.ruimte.width + m.rand.links.width - m.scherm.width) < 1);
      assert.ok(Math.abs(m.ruimte.height + m.rand.boven.height + m.rand.onder.height - m.scherm.height) < 1);
    };
    await page.waitForFunction(() => {
      const r = document.querySelector('.rtg-surface[data-edge-visible]').getBoundingClientRect();
      const w = document.querySelector('.rtg-werkruimte').getBoundingClientRect();
      return Math.abs(r.width * 2 - w.width) < 1;
    }, null, { timeout: 5000 });
    let m = await maten(); randKlopt(m);
    assert.equal(m.zichtbaar.length, 2, 'desktop toont de gekozen indeling met twee apps');
    assert.ok(Math.abs(m.zichtbaar[0].width * 2 - m.ruimte.width) < 1);
    assert.ok(Math.abs(m.zichtbaar[0].height - m.ruimte.height) < 1);
    await page.setViewportSize({ width:390, height:844 });
    /* Wacht tot Chromium de nieuwe CSS-viewport werkelijk publiceert en stuur
       daarna dezelfde resize die een echt venster geeft. Onder zware parallelle
       CI-belasting kon Playwright eerder doorlopen terwijl die ene gebeurtenis
       nog samengevoegd was; de geometrie-eis hieronder blijft ongewijzigd. */
    await page.waitForFunction(() => innerWidth === 390 && innerHeight === 844);
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await page.waitForFunction(() => {
      const v = document.querySelectorAll('.rtg-surface[data-edge-visible]');
      if (v.length !== 1) return false;
      const r = v[0].getBoundingClientRect(), w = document.querySelector('.rtg-werkruimte').getBoundingClientRect();
      return Math.abs(r.width - w.width) < 1 && Math.abs(r.height - w.height) < 1;
    });
    m = await maten(); randKlopt(m);
    assert.equal(m.zichtbaar.length, 1);
    assert.ok(Math.abs(m.zichtbaar[0].width - m.ruimte.width) < 1);
    assert.ok(Math.abs(m.zichtbaar[0].height - m.ruimte.height) < 1);
    await page.setViewportSize({ width:1440, height:900 });
    await page.evaluate(() => RTGEdge.setLayout(2));
    await page.waitForFunction(() => {
      const v = document.querySelectorAll('.rtg-surface[data-edge-visible]');
      if (v.length !== 2) return false;
      const r = v[0].getBoundingClientRect(), w = document.querySelector('.rtg-werkruimte').getBoundingClientRect();
      return Math.abs(r.width * 2 - w.width) < 1;
    });

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
    await page.click('.rtg-edge-menu');
    await page.click('[data-edge-ruimte="Mijn Directie"]');
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

    // ---- stap 6: het palet zit nu in de dunne linkerrand ----
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.rtg-edge-index[aria-hidden="false"] .rtg-edge-find input', { timeout: 5000 });
    await page.fill('.rtg-edge-find input', 'Bestanden');
    await page.waitForSelector('.rtg-edge-group a[data-tool="bestanden"]:not([hidden])', { timeout: 5000 });
    const eerste = await page.textContent('.rtg-edge-group a[data-tool="bestanden"] b');
    assert.equal(eerste.trim(), 'Bestanden', 'wat je typt hoort bovenaan te staan');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => RTGSchil.surfaces.some(s => s.id === 'bestanden'), { timeout: 8000 });
    assert.equal(await page.getAttribute('.rtg-edge-index', 'aria-hidden'), 'true',
      'het palet hoort dicht te gaan zodra de opdracht is uitgevoerd');

    // Escape sluit zonder iets te doen
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.rtg-edge-index[aria-hidden="false"]', { timeout: 5000 });
    const voor = await page.evaluate(() => RTGSchil.surfaces.length);
    await page.keyboard.press('Escape');
    assert.equal(await page.getAttribute('.rtg-edge-index', 'aria-hidden'), 'true');
    assert.equal(await page.evaluate(() => RTGSchil.surfaces.length), voor,
      'Escape hoort niets te openen');

    assert.deepEqual(fouten, [], 'de werkruimte hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    /* Eerst wachten tot de server echt weg is. Alleen child.kill() verstuurt
       het signaal; onder runnerdruk schreef het proces daarna nog in TMP en
       verloor rmSync de race met ENOTEMPTY. */
    await stopHard(child);
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
