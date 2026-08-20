/* DE CONTACTPIN OP HET SCHERM (apps/app.html, sociale balk in De Salon).

   test/contactpin.test.js bewijst dat de kern en de routes kloppen. Dat zegt
   nog niets over de belofte zelf: "iemand toevoegen met je eigen pin, of met
   de QR". Die belofte leeft in een paneel dat opengaat, een pin die er echt
   staat, een QR die getekend wordt, en twee knoppen die in de goede volgorde
   staan. Een groene servertoets bij een leeg paneel is precies de leugen die
   SCHERMLEUGEN.json bedoelt.

   Wat hier gemeten wordt:
   1. het paneel toont de EIGEN pin (niet de puntjes van de plaatshouder);
   2. de QR wordt echt getekend, met onze eigen codec -- geen vreemde server,
      geen leeg beeld;
   3. de pin van een ander invullen laat eerst zien WIE het is en verstuurt
      niets; pas de tweede knop stuurt het verzoek;
   4. de LEVENDE code wordt echt getekend en komt van de server, en de
      aan/uit-schakelaar maakt de vaste pin ook werkelijk onvindbaar.

   Scannen met de camera staat er niet bij: die kan deze omgeving niet leveren.
   De weg van de gescande tekst naar de pin ligt vast in test/rtgcode.test.js.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadScherm, startServer, stop } = require('./helper');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

/* Een browser die bij DEZE playwright hoort is er niet overal; op een machine
   met een eigen Chrome/Chromium wijzen we hem gewoon aan. Zelfde patroon en
   dezelfde omgevingsvariabele als test/office-suite.e2e.js. */
function browserOpties() {
  const opties = { args: ['--no-sandbox'] };
  const kandidaten = [process.env.RTG_BROWSER_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const gevonden = kandidaten.find(p => fs.existsSync(p));
  if (gevonden) opties.executablePath = gevonden;
  return opties;
}

async function api(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  return r.json();
}

/* Twee leden via de demo-inlog (RTG_DEMO=1): die geeft vaste sleutels, zodat de
   toets niet hoeft te wachten tot de ledengids een vers lid geindexeerd heeft.
   Dezelfde keuze en dezelfde reden als in test/comm.e2e.js. */
async function metTweeLeden(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pinui-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    const A = await api(base, '/api/login', { tier: 'rtg', pasApp: 'rtg' });
    const B = await api(base, '/api/login', { tier: 'business', pasApp: 'business' });
    assert.ok(A.token && B.token, 'demo-inlog voor beide leden (staat RTG_DEMO=1 aan?)');
    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // de intake legt anders een blad over het scherm; zelfde mock als appmenu.e2e.js
    await ctx.route('**/api/onboarding/status', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, A.token);
    await fn({ base, ctx, A, B });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

async function salonPaneel(ctx, base) {
  const page = await ctx.newPage();
  await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
  /* De tabbar is met opzet VERBORGEN: sinds WERELD.md is de werktafel het
     beginscherm en spiegelt de OS-laag dit model, waarbij een tik op een tegel
     terugloopt naar deze knop (button.click(), zie app-main-23.js). We nemen
     dus dezelfde ingang als het scherm zelf; klikken met de muis kan niet, want
     de knop is onzichtbaar. Zelfde aanpak als test/gereedschap.e2e.js. */
  await page.waitForSelector('.tabbar button[data-tab="salon"]', { state: 'attached', timeout: 60000 });
  await page.evaluate(() => document.querySelector('.tabbar button[data-tab="salon"]').click());
  await page.waitForSelector('#scAddBtn', { timeout: 60000 });
  await page.click('#scAddBtn');            // de la met zoeken en de pin gaat open
  await page.waitForSelector('#scPin.open #scPinCode', { timeout: 60000 });
  return page;
}

test('de sociale balk toont je eigen pin en tekent er een echte QR van',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metTweeLeden(async ({ base, ctx, A }) => {
    const page = await salonPaneel(ctx, base);

    // 1. de pin staat er echt, en het is dezelfde als die de server kent
    await page.waitForFunction(() => {
      const el = document.getElementById('scPinCode');
      return el && /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(el.textContent.trim());
    }, null, { timeout: 30000 });
    const opScherm = (await page.textContent('#scPinCode')).trim();
    const vanServer = await api(base, '/api/member/pin', {}, A.token);
    assert.equal(opScherm, vanServer.toon, 'het scherm toont de pin die de server bewaart');

    // 2. de QR wordt getekend, in eigen huis (een data-URL, geen vreemde bron)
    assert.equal(await page.getAttribute('#scPinQrBeeld', 'hidden'), '', 'de QR staat eerst dicht');
    await page.click('#scPinQr');
    await page.waitForFunction(() => {
      const b = document.getElementById('scPinQrBeeld');
      return b && !b.hidden && String(b.src || '').startsWith('data:image/png');
    }, null, { timeout: 30000 });
    const maat = await page.evaluate(() => {
      const b = document.getElementById('scPinQrBeeld');
      return { lang: b.src.length, breed: b.naturalWidth };
    });
    assert.ok(maat.lang > 500, 'de QR is een echt beeld en geen lege bron');
    assert.ok(maat.breed > 40, 'en hij is ook echt geladen (' + maat.breed + 'px)');
    await page.close();
  });
});

test('een pin invullen laat eerst zien wie het is; pas de tweede knop verstuurt',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metTweeLeden(async ({ base, ctx, B }) => {
    const page = await salonPaneel(ctx, base);
    const zijnPin = (await api(base, '/api/member/pin', {}, B.token)).toon;
    const zijnNaam = (await api(base, '/api/member/connections', {}, B.token)).codename;

    await page.fill('#scPinIn', zijnPin);
    await page.click('#scPinGo');
    await page.waitForSelector('#scPinRes .sc-hit', { timeout: 30000 });
    assert.match(await page.textContent('#scPinRes'), new RegExp(zijnNaam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'het scherm zegt eerst wie er achter de pin zit');

    // ZOEKEN IS GEEN VERSTUREN. Dit is de belofte uit LIFE.md ("bevestigen doet
    // de mens") en dus hoort er op dit moment nog niets bij de ander te staan.
    const stil = await api(base, '/api/member/connections', {}, B.token);
    assert.equal((stil.requests || []).length, 0, 'kijken wie het is stuurt niets');

    await page.click('#scPinRes [data-pinvz]');
    await page.waitForFunction(() => /verbonden|aangevraagd|wacht/i.test(
      (document.getElementById('scPinRes') || {}).textContent || ''), null, { timeout: 30000 });
    const na = await api(base, '/api/member/connections', {}, B.token);
    assert.equal((na.requests || []).length, 1, 'en nu pas staat het verzoek er');
    await page.close();
  });
});

test('de scanknop opent de HUISOVERLAY, met de handinvoer als uitweg',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* Dit scherm had een eigen camerablad -- een <video> in het vriendenblok met
     een RTGScanner eromheen -- en dus geen handinvoer. Dat was de laatste tweede
     uitvoering van iets dat het huis al heeft (shared/scanknop.js), en de reden
     dat het ertoe doet is geen netheid maar een uitweg: zonder werkende camera
     kwam je hier nergens.

     In een toets is dat meteen de enige begaanbare weg -- er is geen camera --
     dus wat hier gebeurt is precies wat een mens doet van wie de camera het niet
     doet: het venster openen, "of typ de code" kiezen, en plakken. */
  await metTweeLeden(async ({ base, ctx, B }) => {
    const page = await salonPaneel(ctx, base);
    const zijnPin = (await api(base, '/api/member/pin', {}, B.token)).toon;
    const zijnNaam = (await api(base, '/api/member/connections', {}, B.token)).codename;

    await page.click('#scPinScan');
    await page.waitForSelector('.rtg-scan-ov', { timeout: 30000 });
    await page.click('.rtg-scan-ov [data-hand]');

    // een code die niet van ons is: de overlay BLIJFT staan, zodat je opnieuw kunt
    await page.fill('.rtg-scan-hand input', 'https://voorbeeld.test/iets');
    await page.click('.rtg-scan-hand button[type=submit]');
    await page.waitForTimeout(600);
    assert.ok(await page.$('.rtg-scan-ov'), 'een vreemde QR gooit het venster niet dicht');

    // en dan de echte pin
    await page.fill('.rtg-scan-hand input', 'rtg:pin:' + zijnPin);
    await page.click('.rtg-scan-hand button[type=submit]');
    await page.waitForSelector('#scPinRes .sc-hit', { timeout: 30000 });
    assert.match(await page.textContent('#scPinRes'), new RegExp(zijnNaam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'de gescande pin komt op dezelfde trefferregel uit als een getypte');

    // en ook hier: scannen is geen versturen
    const stil = await api(base, '/api/member/connections', {}, B.token);
    assert.equal((stil.requests || []).length, 0, 'een scan stuurt nog niets');
    await page.close();
  });
});

test('de levende code wordt getekend, en de schakelaar maakt de vaste pin onvindbaar',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metTweeLeden(async ({ base, ctx, A, B }) => {
    const page = await salonPaneel(ctx, base);
    await page.waitForFunction(() => /-/.test((document.getElementById('scPinCode') || {}).textContent || ''),
      null, { timeout: 30000 });

    // 1. de levende code: een echt getekende QR, met de aftelring eronder
    await page.click('#scPinLive');
    await page.waitForSelector('#scPinLiveDoek canvas', { timeout: 30000 });
    const live = await page.evaluate(() => {
      const cs = document.querySelectorAll('#scPinLiveDoek canvas');
      return { aantal: cs.length, breed: cs[0] ? cs[0].width : 0 };
    });
    assert.equal(live.aantal, 2, 'de code en de aftelring staan er allebei');
    assert.ok(live.breed > 40, 'de code is echt getekend (' + live.breed + 'px)');

    /* 2. de schakelaar. Het scherm bevestigt met een confirm(); dat is hier de
          mens die ja zegt. Daarna hoort de vaste pin voor een ANDER lid
          onvindbaar te zijn -- en dat vragen we aan de server, niet aan het
          scherm, want het scherm kan van alles beweren. */
    const pin = (await api(base, '/api/member/pin', {}, A.token)).toon;
    assert.equal((await api(base, '/api/member/pin/zoek', { pin }, B.token)).codename !== undefined, true,
      'vooraf is hij gewoon te vinden');
    page.on('dialog', d => d.accept());
    await page.click('#scPinUit');
    await page.waitForFunction(() => {
      const n = document.getElementById('scPinUitNoot');
      return n && !n.hidden;
    }, null, { timeout: 30000 });
    const na = await fetch(base + '/api/member/pin/zoek', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + B.token },
      body: JSON.stringify({ pin }) });
    assert.equal(na.status, 404, 'met de pin uit is hij onvindbaar, en met dezelfde stilte');
    await page.close();
  });
});
