/* DE LIJST OP HET SCHERM -- want een knop die niemand heeft zien werken, is
   geen knop (LAT.md regel 10).

   De server-kant van de afspeellijsten staat in test/medialijsten.test.js.
   Deze toets doet wat een lid doet: de app openen, een lijst maken, er via de
   stuk-hub een stuk in zetten en hem daarna terugzien met dat stuk erin. Zonder
   deze ronde zou een tikfout in public/apps/media/lijst.js de hele laag
   onbruikbaar maken terwijl elke unittest groen blijft.

   De stukken komen uit de demo-seed van het huis (server/seed/media.js): vijf
   uitgaven uit de eigen klankmotor. Dat is met opzet de enige vorm die dit huis
   zelf kan opwekken -- een geseede clip zou eeuwig "maker offline" zijn.

   Draai: npm run e2e (of los: node --test test/medialijst.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('een lid maakt een lijst en zet er een stuk in',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-medialijst-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const lid = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lijstlid', email: 'ml' + u + '@x.nl', phone: '06' + u,
        password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    assert.ok(lid.token, 'het lid is ingelogd');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);

    await page.goto(base + '/apps/media.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.stuk .t', { timeout: 20000 });
    const eersteTitel = await page.$eval('.stuk .t', e => e.textContent);
    assert.ok(eersteTitel, 'er staat werk in de wereld');

    // 1) een lijst maken
    await page.click('#lijstKnop');
    await page.waitForSelector('#lijstNaam', { timeout: 10000 });
    assert.match(await page.$eval('#ladeVlak h3', e => e.textContent), /Uw lijsten/);
    await page.fill('#lijstNaam', 'De rit naar Ibiza');
    await page.locator('#ladeVlak .knop', { hasText: 'Maak lijst' }).click();
    await page.waitForFunction(() => /De rit naar Ibiza/.test(document.querySelector('#ladeVlak').textContent),
      null, { timeout: 10000 });

    // 2) via de stuk-hub een stuk erin zetten
    await page.locator('#ladeVlak .knop', { hasText: 'Sluit' }).first().click();
    await page.locator('.stuk .rij .knop', { hasText: 'Alles hierover' }).first().click();
    await page.waitForSelector('#ladeVlak h3', { timeout: 10000 });
    await page.locator('#ladeVlak .knop', { hasText: 'In lijst' }).click();
    await page.waitForFunction(() => /In welke lijst/.test(document.querySelector('#ladeVlak').textContent),
      null, { timeout: 10000 });
    await page.locator('#ladeVlak .knop', { hasText: 'De rit naar Ibiza' }).click();
    await page.waitForFunction(() => /In "De rit naar Ibiza" gezet/.test(document.querySelector('#melding').textContent),
      null, { timeout: 10000 });

    /* 3) en hij staat er ook echt in. Eerst de lade dicht: die staat als
       role="dialog" over het scherm en vangt anders de tik op de kopknop --
       precies zoals Playwright dat meldt ("intercepts pointer events"). */
    await page.locator('#ladeVlak .knop', { hasText: 'Sluit' }).first().click();
    await page.click('#lijstKnop');
    /* Wachten op de KADER-kaart en niet op de naam: de lade houdt zijn vorige
       inhoud tot het antwoord binnen is, en die vorige inhoud (de keuzelijst)
       droeg dezelfde naam. Een toets die op die naam wacht, meet dus het oude
       scherm en gaat te vroeg door. */
    await page.waitForSelector('#ladeVlak .kader .stil', { timeout: 10000 });
    const telRegel = await page.$eval('#ladeVlak .kader .stil', e => e.textContent);
    assert.match(telRegel, /^1 stukken/, 'de lijst draagt één stuk: ' + telRegel);

    await page.locator('#ladeVlak .knop', { hasText: 'Open' }).first().click();
    await page.waitForSelector('#ladeVlak .stukken .stuk', { timeout: 10000 });
    const inLijst = await page.$eval('#ladeVlak .stukken .stuk .t', e => e.textContent);
    assert.equal(inLijst, eersteTitel, 'en het is het stuk dat we erin zetten');

    /* 4) en de luisterkamer opent ook echt. Twee browsers tegen elkaar
       aanzetten hoort in een eigen toets; hier gaat het erom dat samen.js
       laadt, de lijn opzet en een kamer opent zonder fout -- zonder dit
       rondje is die hele knop nooit door iets aangeraakt. */
    await page.locator('#ladeVlak .knop', { hasText: 'Sluit' }).first().click();
    await page.click('#samenKnop');
    await page.waitForFunction(() => /Luisterkamers/.test(document.querySelector('#ladeVlak').textContent),
      null, { timeout: 10000 });
    await page.locator('#ladeVlak .knop', { hasText: 'Begin een kamer' }).click();
    await page.waitForFunction(() => /U bent de gastheer/.test(document.querySelector('#ladeVlak').textContent),
      null, { timeout: 10000 });
    assert.match(await page.$eval('#ladeVlak h3', e => e.textContent), /Luisterkamer van/);

    assert.deepEqual(fouten, [], 'geen fout op de pagina');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
