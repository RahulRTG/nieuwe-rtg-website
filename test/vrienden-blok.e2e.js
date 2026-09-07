/* ============================================================================
   RTG VRIENDEN: HET HELE SCRIPTBLOK DRAAIT, EN NIET ALLEEN HET BEGIN.

   WAT HIER FOUT GING, want dat bepaalt wat deze toets moet meten.

   apps/foundation/vrienden.html heeft een scriptblok van bijna driehonderd
   regels. Ergens in het midden stond `$('#pinNoodKnop').addEventListener(...)`
   en die knop bestond niet meer: bij een eerdere opruiming ("vijf gelijke
   knoppen betekent dat er geen belangrijk is") was hij uit de opmaak gevallen
   terwijl zijn code bleef staan. Die ene regel gooide, en JavaScript stopt dan
   met de REST VAN HET BLOK. Alles daaronder is nooit uitgevoerd:

     laad()          -- de contactenlijst, de eigen pin, verhalen en snaps
     startStream()   -- de EventSource voor inkomende oproepen en meldingen
     setInterval     -- de verversing per twaalf seconden
     en de listeners van chat, foto's, de tekenstudio, snaps, verhalen,
     audiobellen en videobellen

   Het scherm zag er intussen normaal uit: kopjes, lege lijsten, geen melding.
   Dat is precies de faalvorm die dit huis het duurst betaalt -- geen fout, geen
   klacht, alleen een functie die er niet is.

   WAAROM "GEEN JS-FOUT" ALS TOETS NIET GENOEG IS. Zet iemand morgen een andere
   `$('#bestaatNiet')` boven in het blok, dan is de uitkomst dezelfde stille
   halve app. Een toets die alleen `fouten.length === 0` nakijkt, zou de bug van
   gisteren vangen en die van morgen niet. Deze toets meet daarom of het EINDE
   van het blok is bereikt, langs drie sporen die alle drie uit de laatste
   regels komen:

     1. `laad()` heeft gedraaid            -> /api/rtf/social/connections is opgehaald
     2. `startStream()` heeft gedraaid     -> /api/rtf/social/stream is geopend
     3. de listeners na de kapotte regel   -> hun elementen bestaan EN de
                                              handelingen die ze openen werken

   Spoor 3 kijkt naar elementen die uitsluitend door dat late deel worden
   bediend. Bestaat er een en doet hij niets, dan is dat een dode knop; dat is
   waarom de toets er ook op TIKT en niet alleen telt.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

/* De elementen die pas NA de kapotte regel worden opgezocht of gebonden. Wie
   deze lijst inkort, moet zich afvragen of hij het einde van het blok nog meet.
   `pinNoodKnop` staat er als eerste: dat is de knop die ontbrak. */
const NA_DE_BREUK = ['#pinNoodKnop', '#chatSend', '#chatX', '#chatBel', '#chatVideo',
  '#snapBtn', '#stWis', '#studioX', '#snapX', '#storyX', '#storyPlus', '#belWeg',
  '#inkJa', '#inkNee', '#fotoIn'];

test('RTG Vrienden: het scriptblok loopt tot het einde -- lijst, stream, verversing en de late knoppen',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrienden-blok-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const g = await (await fetch(base + '/api/foundation/gezin/maak', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gezinsnaam: 'Fam Vriend', naam: 'Papa', pin: '1234',
        bevoegdGezin: true, privacyAkkoord: true }) })).json();
    assert.ok(g && g.token, 'proefgezin aangemaakt');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    /* De sessie moet er staan VOORDAT de pagina laadt: foundation/sessie.js
       beslist bij het inlezen al over zijn deur. */
    await ctx.addInitScript((s) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(s));
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: g.token, profiel: { naam: 'Papa', beheerder: true } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const paden = [];
    page.on('request', (r) => { const u = r.url().replace(base, '');
      if (u.startsWith('/api/rtf/social')) paden.push(u.split('?')[0]); });

    await page.goto(base + '/apps/foundation/vrienden.html', { waitUntil: 'domcontentloaded' });

    // 1. laad() -- zonder deze aanroep blijft de contactenlijst voor altijd leeg
    await page.waitForFunction(() => !!window.__vriendenGeladen ||
      document.querySelector('#vrienden') !== null, null, { timeout: 15000 });
    await page.waitForTimeout(3500);
    assert.ok(paden.includes('/api/rtf/social/connections'),
      'laad() heeft gedraaid: de contactenlijst is opgehaald. Zo niet, dan is het scriptblok eerder gestopt.');

    // 2. startStream() -- de laatste regels op een na
    assert.ok(paden.some((p) => p.includes('/social/stream')),
      'startStream() heeft gedraaid: de EventSource is geopend');

    // 3. de elementen die het late deel bedient
    const ontbreekt = await page.evaluate((lijst) => lijst.filter((s) => !document.querySelector(s)), NA_DE_BREUK);
    assert.deepEqual(ontbreekt, [],
      'elk element dat na de breuk wordt gebonden bestaat; ontbreekt er een, dan gooit die regel en valt de rest weg');

    // en ze doen ook iets: het chatvenster gaat open en weer dicht
    await page.evaluate(() => { const o = document.querySelector('#chatOv'); if (o) o.classList.add('open'); });
    await page.click('#chatX');
    assert.equal(await page.evaluate(() => document.querySelector('#chatOv').classList.contains('open')), false,
      'de sluitknop van de chat is gebonden -- die listener staat na de breuk');

    /* 4. de verversing per twaalf seconden -- de allerlaatste regel van het
       blok (`setInterval(... laad(), 12000)`). Hij staat er apart omdat hij
       NA startStream() komt: draait hij, dan is het blok tot de laatste regel
       uitgevoerd. De dertien seconden wachten zijn de prijs van dat bewijs. */
    const voorVerversing = paden.filter((p) => p === '/api/rtf/social/connections').length;
    await page.waitForTimeout(13000);
    assert.ok(paden.filter((p) => p === '/api/rtf/social/connections').length > voorVerversing,
      'de verversing per twaalf seconden loopt: het blok is tot zijn laatste regel uitgevoerd');

    // 5. geen kale JS-fout; dit is de ondergrens, niet de toets
    assert.deepEqual(fouten, [], 'geen niet-opgevangen fout op het scherm');

    /* 6. DE ZELFIJKING: DEZE TOETS MOET HET DEFECT KUNNEN ZIEN.

       Een toets die je niet hebt zien zakken is geen toets (LAT.md regel 9).
       Hier wordt de bug van 7 september 2026 kunstmatig teruggezet -- de pagina
       wordt onderweg geserveerd ZONDER `id="pinNoodKnop"` -- en dan hoort
       spoor 1 en 2 te verdwijnen: geen contactenlijst, geen stream. Zien we ze
       toch, dan meten de asserts hierboven iets anders dan ze beweren.

       Het gebeurt met een onderschepte respons en niet met een bestandswijziging:
       zo kan deze proef nooit een kapot bestand achterlaten. */
    const zonderKnop = [];
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx2.addInitScript((s) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(s));
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: g.token, profiel: { naam: 'Papa', beheerder: true } });
    await ctx2.route('**/apps/foundation/vrienden.html', async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace('id="pinNoodKnop"', 'id="pinNoodKnopWEG"');
      await route.fulfill({ response: res, body: html, headers: { ...res.headers(), 'content-length': undefined } });
    });
    const page2 = await ctx2.newPage();
    page2.on('request', (r) => { const u = r.url().replace(base, '');
      if (u.startsWith('/api/rtf/social')) zonderKnop.push(u.split('?')[0]); });
    await page2.goto(base + '/apps/foundation/vrienden.html', { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(4000);
    assert.ok(!zonderKnop.includes('/api/rtf/social/connections'),
      'ZELFIJKING: zonder #pinNoodKnop hoort het blok af te breken vóór laad(). ' +
      'Draait laad() daar wél, dan meet spoor 1 hierboven niet wat het beweert.');
    await ctx2.close();
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
