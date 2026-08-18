/* ============================================================================
   SCHERM-TOETS VOOR /apps/camera.html -- de app uit de oorspronkelijke klacht.

   WAAROM DEZE ER NOG NIET WAS, EN WAAROM DAT ERG IS. De klacht waar deze ronde
   mee begon was "alle camera's doen het nergens". De oorzaak is gemeten en
   gerepareerd, en test/media.e2e.js dekt de MEDIAPOORT grondig -- maar geen
   enkele toets legde de weg van dit SCHERM af. scripts/schermen.js zei het ook:
   /apps/camera.html stond in de lijst "geen enkele toets legt dit scherm af".
   Van alle apps waar dat voor gold, was dit de pijnlijkste.

   DRIE BEWERINGEN, EN DE TWEEDE IS DE KLACHT ZELF.

   1. MET een camera gaat het beeld open: de videostroom komt binnen en de
      "geen camera"-melding blijft weg.
   2. ZONDER camera blijft het scherm niet leeg maar NOEMT het de oorzaak.
      Dit is de klacht in zijn oorspronkelijke vorm: er gebeurde niets en
      niemand zei waarom. De tekst moet dus veranderen ten opzichte van de
      standaardtekst die in de HTML staat, en de oorzaak van de mediapoort
      bevatten -- leeg blijven en zwijgen zien er van buiten hetzelfde uit.
   3. De fototips en de looks werken ZONDER camera. Dat is geen bijzaak: de
      pagina belooft het letterlijk ("Rahul's fototips werken ondertussen
      gewoon"), en een belofte in een melding is een bewering.

   WAAROM 1 EN 2 BEIDE MOETEN. Zonder 1 zou 2 ook slagen op een camera-app die
   nooit een beeld geeft; zonder 2 zou 1 slagen terwijl de app op een telefoon
   stil leeg blijft. Precies dat tweede was de klacht.

   DE NEPCAMERA. Chromium geeft met --use-fake-device-for-media-stream een
   testbeeld en met --use-fake-ui-for-media-stream automatisch toestemming. Voor
   bewering 2 draait een TWEEDE browser zonder die vlaggen: dan is er werkelijk
   geen camera, en dat is de situatie die een desktop zonder webcam ook heeft.
   Welke fout welke stand oplevert, staat gemeten bij bewering 2 zelf.

   Draait alleen waar een browser beschikbaar is.
   ========================================================================== */
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

/* De standaardtekst uit de HTML. Bewering 2 eist dat die VERVANGEN wordt; stond
   hier alleen "de melding is zichtbaar", dan zou de toets ook groen blijven met
   de nietszeggende openingstekst erin. */
const STANDAARDTEKST = 'Geef de browser toegang tot de camera';

test('camera.html: het beeld opent, en zonder camera zegt het scherm WAAROM',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-camerascherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser = null;
  try {
    /* ---- 1) MET camera: het beeld komt binnen ---- */
    browser = await pw.chromium.launch({ args: ['--no-sandbox',
      '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
    let ctx = await browser.newContext({ permissions: ['camera'] });
    let page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/camera.html', { waitUntil: 'domcontentloaded' });

    /* Wachten op de STROOM en niet op een klok: een videostroom die er is, heeft
       een srcObject met een spoor. Een vaste wacht zou op een rustige machine te
       lang zijn en onder belasting te kort (eerlijkheidspunt 6.5). */
    await page.waitForFunction(() => {
      const v = document.querySelector('#beeld');
      return !!(v && v.srcObject && v.srcObject.getVideoTracks && v.srcObject.getVideoTracks().length);
    }, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => document.querySelector('#geenCam').classList.contains('aan')),
      false, 'met een werkende camera hoort de "geen camera"-melding weg te blijven');

    /* ---- 3) de looks werken, en die hebben geen camera nodig ----

       WAT IK HIER EERST TOETSTE EN WAAROM HET FOUT WAS. Mijn eerste assertie was
       dat getComputedStyle(#beeld).filter zou veranderen. Die bleef `none -> none`
       en dat was geen bug in de app maar in mijn aanname: een look zet geen
       CSS-filter maar de REGELAARS (bel, con, warm, verzadiging ...), en het
       beeldeffect gaat daarna door pixelbewerking naar een canvas -- `teken()`
       stopt zelfs meteen als er nog geen opname is. Dus is er in de live-zoeker
       niets aan de video te zien, en hoort dat ook niet.

       Wat een look wel doet, is de schuiven op zijn waarden zetten. Die zijn
       zichtbaar en de pagina nodigt er zelf toe uit ("schuif gerust bij"). Voor
       "zw" staat verzadiging op -100, en dat is een getal uit de LOOKS-tabel en
       niet "iets anders dan eerst" -- een assertie die alleen verschil eist,
       slaagt ook op de verkeerde waarde. */
    const verzVoor = await page.evaluate(() => Number(document.querySelector('#rVerz').value));
    await page.evaluate(() => { document.querySelector('[data-look="zw"]').click(); });
    const verzNa = await page.evaluate(() => Number(document.querySelector('#rVerz').value));
    assert.equal(verzNa, -100,
      'de look "Editorial Z/W" hoort de verzadiging op -100 te zetten (stond op ' + verzVoor + ', werd ' + verzNa + ')');
    assert.equal(await page.evaluate(() => document.querySelector('[data-look="zw"]').getAttribute('aria-pressed')),
      'true', 'de gekozen look hoort zich als ingedrukt te melden');
    assert.equal(await page.evaluate(() => document.querySelector('[data-look="origineel"]').getAttribute('aria-pressed')),
      'false', 'en de vorige look hoort dat niet meer te doen');

    /* het raster is een knop met een aria-toestand; die moet meebewegen */
    const rasterVoor = await page.evaluate(() => document.querySelector('#raster').classList.contains('aan'));
    await page.evaluate(() => { document.querySelector('#rasterKnop').click(); });
    assert.notEqual(await page.evaluate(() => document.querySelector('#raster').classList.contains('aan')),
      rasterVoor, 'de rasterknop hoort het raster echt om te zetten');
    assert.equal(await page.evaluate(() => document.querySelector('#rasterKnop').getAttribute('aria-pressed')),
      String(!rasterVoor), 'en de knop hoort zijn toestand te melden aan een schermlezer');

    assert.deepEqual(fouten, [], 'de pagina logde fouten: ' + JSON.stringify(fouten).slice(0, 400));
    await ctx.close();

    /* ---- 2) ZONDER camera: het scherm noemt de oorzaak ----

       WELK SCENARIO, EN WAAROM DIT ERVAN OVER IS. Ik begon met "toestemming
       geweigerd" en die weg gaf hier NotSupportedError -- nagemeten in drie
       standen: met nepapparaat en geweigerd geeft Chromium NotSupportedError,
       ZONDER nepapparaat en geweigerd geeft hij NotFoundError, en met toestemming
       lukt het gewoon. Die eerste is dus een eigenaardigheid van het nepapparaat
       en niet wat een echte weigering oplevert; een toets die daarop staat, toetst
       mijn opzet en niet de app.

       Wat hier WEL echt is: geen camera in de machine. Dat is een gewone situatie
       (een desktop zonder webcam) en de melding hoort dan te zeggen dat het
       apparaat er niet is. De NotSupportedError-vondst is niet weggegooid: hij
       staat nu in de vertaaltabel van shared/media.js, met de meting erbij. */
    await browser.close();
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    ctx = await browser.newContext({ permissions: [] });
    page = await ctx.newPage();
    const fouten2 = [];
    letOpFouten(page, fouten2);
    await page.goto(base + '/apps/camera.html', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => document.querySelector('#geenCam').classList.contains('aan'),
      null, { timeout: 15000 });
    const tekst = await page.evaluate(() => document.querySelector('#geenCamTekst').textContent);
    assert.ok(!tekst.startsWith(STANDAARDTEKST),
      'het scherm laat de nietszeggende openingstekst staan in plaats van de OORZAAK te noemen: ' + tekst);
    /* De oorzaak moet ERIN staan, en niet de algemene "dit huis kent die fout
       niet"-tak zijn. Die tak is eerlijk en hij hoort hier niet te vallen: geen
       apparaat is een oorzaak die de mediapoort kent. */
    assert.ok(!/kent de fout niet|niet kent/i.test(tekst),
      'de melding viel terug op de onbekende-fout-tak terwijl "geen apparaat" een bekende oorzaak is: ' + tekst);
    assert.match(tekst, /camera|apparaat|toestel/i, 'de melding noemt de oorzaak niet: ' + tekst);
    /* De belofte uit diezelfde melding: de tips blijven werken. */
    assert.match(tekst, /fototips/, 'de melding belooft de fototips niet meer, terwijl het scherm ze wel toont');
    assert.deepEqual(fouten2, [],
      'de pagina logde fouten terwijl ze juist netjes had moeten melden: ' + JSON.stringify(fouten2).slice(0, 400));
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
