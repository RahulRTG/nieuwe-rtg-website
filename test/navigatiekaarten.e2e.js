/* DE KAARTEN OP HET SCHERM (apps/navigatie.html, paneel "Kaarten").

   test/navigatie-index.test.js en test/navigatiegebiednet.test.js bewijzen dat
   de catalogus, de licentiepoort en de motor per gebied kloppen. Dat zegt nog
   niets over de belofte zelf: *ik zie welke kaarten RTG kan leveren en kies
   zelf welke ik wil hebben*. Die belofte leeft in een paneel dat opengaat, een
   lijst die gevuld wordt, een knop die zijn stand omzet en een keuze die
   blijft staan. Een groene servertoets bij een leeg paneel is precies de
   leugen die SCHERMLEUGEN.json bedoelt.

   Wat hier gemeten wordt:
   1. het paneel toont de gebieden uit de index, met de stand erbij
      (aangeboden tegenover gebouwd -- die twee mogen nooit een vinkje worden);
   2. kiezen werkt echt: de knop gaat om, de server weet het, en na opnieuw
      openen staat het er nog;
   3. een gebied dat niet te kiezen is, heeft een knop die niet kan EN een
      reden op het scherm (GRAMMATICA.md: een verhindering draagt een reden);
   4. zonder locatie is het paneel nog steeds te bereiken. Dat is geen
      randgeval: de poort dekt het hele scherm, en juist voordat je op reis
      gaat wil je de kaart van je bestemming binnenhalen.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const fixture = require('./navigatie-index-fixture');
const { leesBronindex } = require('../scripts/navigatie-index.js');
const { bouwPakket } = require('./navigatie-pakket-fixture');

/* De wereld: een echte gebiedsindex in RTG_DATA_DIR plus EEN gebouwd pakket,
   zodat het scherm de twee standen naast elkaar moet tonen. De index komt uit
   het importscript en niet met de hand -- anders toetst dit scherm een vorm
   die het script nooit schrijft. */
function zetWereld(TMP) {
  const nav = path.join(TMP, 'navigatie');
  fs.mkdirSync(nav, { recursive: true });
  const index = leesBronindex(fixture.tekst());
  fs.writeFileSync(path.join(nav, 'gebieden.json'), JSON.stringify(index));
  bouwPakket({ map: nav, code: 'europe-netherlands', lat: 52.36, lng: 4.89,
    plaats: 'Amsterdam', land: 'Netherlands', bron: 'OpenStreetMap', licentie: 'ODbL 1.0' });
  return index;
}

async function metLid(fn, { gps = true } = {}) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-navkaarten-'));
  const index = zetWereld(TMP);
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    const inlog = await fetch(base + '/api/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    assert.ok(inlog.token, 'demo-inlog voor een lid (staat RTG_DEMO=1 aan?)');
    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } },
      gps ? { permissions: ['geolocation'], geolocation: { latitude: 52.36, longitude: 4.89 } } : {}));
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, inlog.token);
    await fn({ base, ctx, token: inlog.token, index });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

/* Het paneel openen langs de knop in de kop. `click()` via de DOM en niet met
   de muis: de schil (basis.js, randen.js) verbouwt de kop met `defer` en kan
   er een laag over zetten -- dat kostte eerder zestig klikpogingen op een
   cookiebalk (SERVICE.md par. 13). De knop zelf is wat we toetsen, niet de
   z-index van de schil. */
async function paneelOpen(page) {
  await page.waitForSelector('#kaartenKnop', { state: 'attached', timeout: 60000 });
  await page.evaluate(() => document.getElementById('kaartenKnop').click());
  await page.waitForSelector('#kaartenPaneel.zien .kaartrij', { timeout: 60000 });
}

test('het kaartenpaneel toont de gebieden uit de index, met aangeboden en gebouwd apart',
  { skip: geenBrowser(pw) }, async () => {
  await metLid(async ({ base, ctx, index }) => {
    const page = await ctx.newPage();
    await page.goto(base + '/apps/navigatie.html', { waitUntil: 'domcontentloaded' });
    await paneelOpen(page);

    const rijen = await page.evaluate(() => [...document.querySelectorAll('#kaartenPaneel .kaartrij')]
      .map(el => ({
        naam: el.querySelector('.naam b').textContent.trim(),
        stand: el.querySelector('.stand').textContent.trim(),
        knop: el.querySelector('button').textContent.trim(),
        uit: el.querySelector('button').disabled
      })));
    assert.ok(rijen.length >= 4, 'de lijst is gevuld: ' + JSON.stringify(rijen));
    /* Elk gebied uit de index staat er, en geen gebied dat de index WEIGERDE.
       De botsende codes horen dus nergens op het scherm. */
    const namen = rijen.map(r => r.naam);
    for (const g of index.gebieden) assert.ok(namen.includes(g.naam), g.naam + ' staat op het scherm');
    assert.equal(namen.includes('A-B'), false, 'een geweigerd gebied komt niet op het scherm');

    /* DE TWEE STANDEN STAAN APART. Precies een gebied is gebouwd in deze
       wereld; de rest is aangeboden. Zou het scherm die twee samenvatten, dan
       belooft het een kaart die niemand heeft gebouwd. */
    const gebouwd = rijen.filter(r => r.stand === 'Gebouwd');
    assert.equal(gebouwd.length, 1, 'een gebouwd gebied: ' + JSON.stringify(rijen.map(r => r.naam + '=' + r.stand)));
    assert.equal(gebouwd[0].naam, 'Netherlands');
    assert.ok(rijen.some(r => r.stand === 'Aangeboden'), 'en de rest staat als aangeboden');

    /* En de kop zegt de aantallen, want "200 landen" naast "2 gebouwd" is de
       eerlijke mededeling. */
    const uitleg = await page.textContent('#kaartenUitleg');
    assert.match(uitleg, /gebouwd/);
    assert.match(uitleg, /volgende stap/, 'en dat het pakket nog niet op het toestel staat: ' + uitleg);
  });
});

test('kiezen gaat om, de server weet het, en het blijft staan na opnieuw openen',
  { skip: geenBrowser(pw) }, async () => {
  await metLid(async ({ base, ctx, token }) => {
    const page = await ctx.newPage();
    await page.goto(base + '/apps/navigatie.html', { waitUntil: 'domcontentloaded' });
    await paneelOpen(page);

    const kies = '#kaartenPaneel button[data-code="europe-netherlands"]';
    assert.equal(await page.getAttribute(kies, 'aria-pressed'), 'false', 'nog niet gekozen');
    await page.evaluate((s) => document.querySelector(s).click(), kies);
    await page.waitForFunction((s) => {
      const b = document.querySelector(s);
      return b && b.getAttribute('aria-pressed') === 'true';
    }, kies, { timeout: 30000 });

    /* DE SERVER WEET HET, en dat is de bewering: een knop die alleen in de
       browser omgaat, is een knop die niets doet. */
    const bij = await fetch(base + '/api/nav/gebieden', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: '{}' }).then(r => r.json());
    assert.deepEqual(bij.mijn, ['europe-netherlands'], 'de server bewaart de keuze');

    // en na sluiten en opnieuw openen staat hij er nog
    await page.evaluate(() => document.getElementById('kaartenSluit').click());
    await page.evaluate(() => document.getElementById('kaartenKnop').click());
    await page.waitForSelector('#kaartenPaneel.zien .kaartrij', { timeout: 60000 });
    assert.equal(await page.getAttribute(kies, 'aria-pressed'), 'true', 'de keuze blijft staan');

    // weghalen kan ook, en dan is hij bij de server ook weg
    await page.evaluate((s) => document.querySelector(s).click(), kies);
    await page.waitForFunction((s) => document.querySelector(s).getAttribute('aria-pressed') === 'false',
      kies, { timeout: 30000 });
    const na = await fetch(base + '/api/nav/gebieden', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: '{}' }).then(r => r.json());
    assert.deepEqual(na.mijn, [], 'weggehaald bij de server');
  });
});

test('een gebied dat niet te kiezen is, heeft een knop die niet kan EN een reden op het scherm',
  { skip: geenBrowser(pw) }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await page.goto(base + '/apps/navigatie.html', { waitUntil: 'domcontentloaded' });
    await paneelOpen(page);
    /* `oceania-zonder-url` staat in de index zonder downloadadres: RTG kan hem
       nooit bouwen, dus kiezen zou een verzoek zijn dat niemand kan
       inwilligen. Hij staat er WEL -- weglaten roept de vraag op waarom hij
       ontbreekt -- met de reden erbij. */
    const rij = await page.evaluate(() => {
      const b = document.querySelector('#kaartenPaneel button[data-code="oceania-zonder-url"]');
      if (!b) return null;
      const el = b.closest('.kaartrij');
      return { uit: b.disabled, reden: el.querySelector('.naam small').textContent.trim() };
    });
    assert.ok(rij, 'het gebied staat op het scherm');
    assert.equal(rij.uit, true, 'de knop kan niet');
    assert.match(rij.reden, /downloadadres/, 'en de reden staat er, niet alleen grijs: ' + rij.reden);
  });
});

test('zonder locatie is het kaartenpaneel nog steeds te bereiken',
  { skip: geenBrowser(pw) }, async () => {
  /* De poort dekt het hele scherm (inset 0, z-index 20), dus de knop in de kop
     lag eronder. Welke kaarten je wilt hebben, hangt niet af van waar je nu
     staat -- en juist voor een reis wil je de kaart van je bestemming al
     binnenhalen. De poort biedt hem daarom zelf aan. */
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await page.goto(base + '/apps/navigatie.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#poort.zien', { timeout: 60000 });
    await page.waitForSelector('#poortKaarten:not([hidden])', { timeout: 60000 });
    /* Met de MUIS, want dit gaat juist over de vraag of hij bereikbaar is:
       een evaluate().click() zou over een dekkende laag heen klikken en dus
       precies het defect verbergen dat deze toets meet. */
    await page.click('#poortKaarten');
    await page.waitForSelector('#kaartenPaneel.zien .kaartrij', { timeout: 60000 });
    const zichtbaar = await page.evaluate(() => {
      const el = document.querySelector('#kaartenPaneel .kaartrij button');
      const r = el.getBoundingClientRect();
      const boven = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { hoog: r.height, bovenop: !!(boven && el.contains(boven)) || boven === el };
    });
    assert.ok(zichtbaar.hoog >= 24, 'de knop is te raken (>=24px): ' + zichtbaar.hoog);
    assert.equal(zichtbaar.bovenop, true, 'en er ligt niets over de knop heen');
  }, { gps: false });
});
