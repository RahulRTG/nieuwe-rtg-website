/* De laatste drie schermen zonder eigen toets: RTG Camera, RTG Eye en het
   tweede scherm.

   WAAROM DEZE DRIE OVERBLEVEN, en waarom dat geen toeval is: twee ervan vragen
   de CAMERA (`getUserMedia`) en de derde is een tweede scherm dat pas iets
   toont na een leveranciers-inlog op hetzelfde toestel. Geen van drieen doet
   iets zinnigs in een kale browser -- en dus is er nooit een toets voor
   geschreven. Dat is precies de reden dat ze hier wel een krijgen: een scherm
   waar nooit een toets langskomt, is een scherm waarvan niemand weet of hij
   nog opengaat.

   WAT ER GETOETST WORDT, en dat is bewust niet "hij ziet er goed uit":

   1. RTG CAMERA MET EEN NEP-CAMERA. Chromium kan een testcamera leveren
      (--use-fake-device-for-media-stream). Daarmee is te zien of de zoeker
      echt beeld krijgt, en niet alleen of de knop er staat.
   2. RTG EYE ZONDER PDA-INLOG ZEGT WELKE SLEUTEL HIJ MIST. Leeg blijven en
      wegsturen zien er van buiten hetzelfde uit en zijn allebei fout; wat een
      mens nodig heeft is de zin die vertelt waar hij dan wel moet zijn.
   3. HET TWEEDE SCHERM ZONDER LEVERANCIER-INLOG doet hetzelfde.

   Draait alleen waar een browser is; anders overgeslagen.
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

test('de laatste drie schermen: camera met beeld, en twee poorten die zeggen wat ze missen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-drie-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    /* De nep-camera. Zonder deze twee vlaggen vraagt Chromium toestemming die
       niemand kan geven, en dan toetst deze toets alleen het foutpad -- dat is
       ook nuttig, maar het bewijst niet dat de zoeker werkt. */
    browser = await pw.chromium.launch({ args: ['--no-sandbox',
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const ctx = await browser.newContext({ permissions: ['camera'] });
    const fouten = [];

    /* ---- 1. RTG Camera ---- */
    const cam = await ctx.newPage();
    letOpFouten(cam, fouten);
    await cam.goto(base + '/apps/camera.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    /* Wachten tot de zoeker echt BEELD heeft: videoWidth is nul tot de stroom
       loopt. Dat is de toestand, en niet een aantal milliseconden. */
    const beeld = await cam.waitForFunction(() => {
      const v = document.querySelector('video');
      return !!(v && v.videoWidth > 0) ? { breed: v.videoWidth, hoog: v.videoHeight } : false;
    }, { timeout: 20000 }).then(h => h.jsonValue());
    assert.ok(beeld.breed > 0 && beeld.hoog > 0, 'de zoeker krijgt beeld: ' + JSON.stringify(beeld));
    // en de melding "geen camera" staat dan NIET aan
    assert.equal(await cam.locator('#geenCam.aan').count(), 0, 'geen valse foutmelding terwijl er beeld is');

    /* ---- 2. RTG Eye zonder PDA-inlog ---- */
    const oog = await ctx.newPage();
    letOpFouten(oog, fouten);
    await oog.goto(base + '/apps/oog.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await oog.waitForSelector('#vPoort:not(.weg)', { timeout: 20000 });
    const oogTekst = await oog.textContent('#vPoort');
    assert.match(oogTekst, /personeel|PDA/i,
      'RTG Eye zegt welke sleutel hij mist in plaats van leeg te blijven: ' + oogTekst.slice(0, 120));

    /* ---- 3. Het tweede scherm zonder leverancier-inlog ---- */
    const tweede = await ctx.newPage();
    letOpFouten(tweede, fouten);
    await tweede.goto(base + '/apps/scherm.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await tweede.waitForSelector('#poort', { timeout: 20000 });
    const schermTekst = await tweede.textContent('#poort');
    assert.match(schermTekst, /leverancier/i, 'het tweede scherm noemt de inlog die hij nodig heeft');
    assert.match(schermTekst, /Tweede scherm/i, 'en waar je hem vandaan opent');

    assert.deepEqual(fouten, [], 'geen paginafouten op deze drie: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
