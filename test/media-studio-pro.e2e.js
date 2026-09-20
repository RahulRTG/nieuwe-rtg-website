/* De Studio Pro met een echt bronbestand. Deze toets controleert de keten die
   voor een maker telt: openen, beeld tekenen, niet-destructief bewerken,
   herstellen, ondertitelen en een watermerkvrije master downloaden. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('MediaOS Studio Pro bewerkt en exporteert een echte foto en video',
  { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-studio-pro-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/media.html', { waitUntil: 'domcontentloaded' });
    await page.click('[data-media-ruimte="studio"]');
    await page.setInputFiles('#mediaBestand', path.join(__dirname, '..', 'public', 'images', 'start', 'dagdelen', 'hero-avond.jpg'));
    await page.waitForFunction(() => {
      const c = document.querySelector('#proCanvas');
      return c && c.width > 100 && c.height > 100 && !document.querySelector('#mediaProductie').hidden;
    }, null, { timeout: 15000 });
    assert.equal(await page.locator('#studioVlak').isVisible(), false,
      'na het kiezen van een bron verdwijnt het uploadvak en begint de werkbank direct');

    const voor = await page.$eval('#proCanvas', c => c.toDataURL('image/png').slice(-300));
    await page.locator('[data-pro-waarde="warmte"]').fill('40');
    await page.locator('[data-pro-waarde="warmte"]').dispatchEvent('change');
    await page.click('[data-pro-tab="lagen"]');
    await page.fill('#proTekst', 'Een avond om te bewaren');
    await page.locator('#proTekst').dispatchEvent('change');
    await page.fill('#proOndertitels', '00:00 - 00:03 Welkom bij RTG Studio Pro');
    await page.click('#proOndertitelPas');
    const na = await page.$eval('#proCanvas', c => c.toDataURL('image/png').slice(-300));
    assert.notEqual(na, voor, 'kleur en tekst veranderen werkelijk de canvaspixels');
    assert.equal(await page.$eval('[data-pro-waarde="warmte"]', e => e.value), '40');
    assert.match(await page.$eval('#proTekstSpoor', e => e.textContent), /ondertitelregel/);

    await page.click('#proUndo');
    assert.equal(await page.evaluate(() => RTGMediaEditor.staat().cues.length), 0,
      'ongedaan verwijdert de laatste niet-destructieve bewerking');
    await page.click('#proRedo');
    assert.equal(await page.evaluate(() => RTGMediaEditor.staat().cues.length), 1,
      'opnieuw zet de ondertitelbewerking terug');

    await page.click('[data-pro-tab="export"]');
    await page.selectOption('#proFotoFormaat', 'image/png');
    const downloadWacht = page.waitForEvent('download');
    await page.click('#proExport');
    const download = await downloadWacht;
    assert.match(download.suggestedFilename(), /RTG master\.png$/i, 'de master krijgt het gekozen verliesvrije formaat');

    /* Ook video gaat door dezelfde echte motor. Het bronbestand wordt hier in
       Chromium zelf opgenomen, zodat de toets geen ondoorzichtige fixture of
       extra codecprogramma nodig heeft. */
    const videoBron = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const x = c.getContext('2d'), stream = c.captureStream(15), rec = new MediaRecorder(stream);
      const delen = []; rec.ondataavailable = e => { if (e.data.size) delen.push(e.data); };
      const klaar = new Promise(resolve => { rec.onstop = () => resolve(new Blob(delen, { type: 'video/webm' })); });
      rec.start(); let n = 0;
      await new Promise(resolve => { const t = setInterval(() => { x.fillStyle = n % 2 ? '#801b39' : '#d1aa60'; x.fillRect(0, 0, 320, 180); x.fillStyle = '#fff'; x.font = '32px sans-serif'; x.fillText('RTG ' + n, 90, 100); if (++n > 12) { clearInterval(t); rec.stop(); resolve(); } }, 45); });
      const blob = await klaar, file = new File([blob], 'studio-proef.webm', { type: 'video/webm' });
      const b = await RTGMediaEditor.laad(file);
      document.querySelector('#proVan').value = '0'; document.querySelector('#proTot').value = String(b.duur);
      return { soort: b.soort, duur: b.duur, w: b.w, h: b.h };
    });
    assert.equal(videoBron.soort, 'video');
    assert.ok(videoBron.duur > 0, 'de videobron heeft een echte tijdlijn');
    await page.click('[data-pro-tab="kader"]');
    const keyframeDoel = await page.evaluate(() => {
      RTGMediaEditor.zoek(0); RTGMediaEditor.key(); RTGMediaEditor.zet('zoom', 135, true);
      const doel = Math.min(.3, RTGMediaEditor.bron().duur / 2);
      RTGMediaEditor.zoek(doel);
      return doel;
    });
    await page.waitForFunction(doel =>
      Math.abs(RTGMediaEditor.onderdelen().video.currentTime - doel) < .03,
    keyframeDoel, { timeout: 5000 });
    await page.evaluate(() => RTGMediaEditor.key());
    assert.equal(await page.evaluate(() => RTGMediaEditor.staat().keys.length), 2,
      'de video bewaart meerdere keyframes op de tijdlijn');
    await page.locator('[data-pro-waarde="snelheid"]').fill('200');
    await page.locator('[data-pro-waarde="snelheid"]').dispatchEvent('change');
    assert.equal(await page.evaluate(() => RTGMediaEditor.onderdelen().video.playbackRate), 2,
      'snelheidsregeling verandert de echte videospeler');

    await page.click('[data-pro-tab="export"]');
    await page.fill('#proExportNaam', 'RTG video master');
    await page.selectOption('#proProfiel', '720');
    await page.fill('#proTot', String(Math.min(.35, videoBron.duur)));
    const videoDownloadWacht = page.waitForEvent('download', { timeout: 15000 });
    await page.click('#proExport');
    const videoDownload = await videoDownloadWacht;
    assert.match(videoDownload.suggestedFilename(), /RTG video master\.webm$/i,
      'de bewerkte video wordt als lokale master zonder watermerk uitgevoerd');
    assert.deepEqual(fouten, [], 'de Studio Pro gaf browserfouten: ' + JSON.stringify(fouten).slice(0, 500));
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(child);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});
