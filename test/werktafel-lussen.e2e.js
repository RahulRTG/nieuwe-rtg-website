/* DE LUSSEN VAN DE WERKTAFEL OP EEN TELEFOON: een wereld openen, erin rondgaan,
   en weer terugkomen -- met de knoppen die een mens werkelijk gebruikt.

   Vier fouten die samen het gevoel gaven dat je "niet fatsoenlijk door de app
   kunt drukken", en die geen bestaande toets zag omdat elke toets de wereld
   LOS opende (niet in de schil) of Home via de console aanriep in plaats van
   via de balk onderin:

   1) ELKE WERELD HING TWAALF SECONDEN op "... wordt klaargezet". In de schil
      staat een wereld in een iframe, en shared/rtg-vandaag-luxe.js commit daar
      met opzet NIET; shared/rtg-world-start.js wachtte toch op zijn vlag en
      viel pas na de noodtimer door.
   2) TERUG VEEGDE JE DE APP UIT. Het eerste laden van een iframe zet geen stap
      in de geschiedenis (shared/command/bladstand.js).
   3) HOME GING DE SCHIL UIT, naar de LivingOS-momentenfeed, ook vanuit TravelOS:
      de Edge van app.html is die van LivingOS (shared/command.js).
   4) DE KOP ZEI "LIVINGOS" boven elke wereld, en "Dit scherm" in het menu toonde
      de LivingOS-functies (bladstand.js + rtg-edge-smart-menu).

   DE MUTATIES, elk nagetrokken: haal in rtg-world-start.js de uitweg voor
   `geschikt()` weg (1 zakt op de tijd), zet in bladstand.js wachtpost() uit
   (2 zakt: de pagina verlaat app.html), haal de vangfase-luisteraar uit
   command.js (3 zakt op de URL), of laat kopwereld() altijd 'living' zetten
   (4 zakt op het label), of zet in rtg-edge-smart-menu `blad` op null (4b zakt).

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function lid(base) {
  const u = Date.now().toString(36);
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Lussen Proef', email: 'lussen' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then((x) => x.json());
  assert.ok(r.token, 'registratie hoort een token te geven');
  const status = await fetch(base + '/api/onboarding/status', { method: 'POST',
    headers: { Authorization: 'Bearer ' + r.token } }).then((x) => x.json());
  const t = await fetch(base + '/api/onboarding/teken', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
    body: JSON.stringify({ naam: 'Lussen Proef', akkoord: true, contractVersion: status.contract.versie }) });
  assert.equal(t.status, 200, 'de proefgebruiker hoort de overeenkomst te kunnen tekenen');
  return r.token;
}

test('werktafel op een telefoon: wereld open, erin, terug, Home -- en je blijft in de app',
  { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lussen-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const token = await lid(srv.base);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#rtgCommand[data-stand="open"] .cmd-leeg', { timeout: 20000 });
    const label = () => page.evaluate(() => ({
      wereld: document.body.getAttribute('data-rtg-blad-wereld'),
      kop: getComputedStyle(document.querySelector('.rtg-edge-mark'), '::after').content
    }));
    assert.equal((await label()).wereld, 'geen', 'op het beginscherm kies je nog een wereld');

    // 1) Een wereld openen: het laadscherm in het blad gaat binnen seconden weg, niet na twaalf.
    const begin = Date.now();
    await page.locator('.cmd-leeg button[data-url="/apps/reizen.html"]').click();
    const blad = page.frameLocator('.cmd-pane.actief iframe');
    await blad.locator('body[data-rtg-world-start="ready"]').waitFor({ state: 'attached', timeout: 20000 });
    const duur = Date.now() - begin;
    assert.ok(duur < 8000, 'TravelOS hing ' + duur + ' ms op het laadscherm (de noodtimer staat op 12 s)');

    // 4) De kop noemt de wereld waar je bent.
    assert.deepEqual(await label(), { wereld: 'travel', kop: '"TravelOS"' });

    // 2) Terug binnen de wereld, en dan terug naar de lege tafel -- niet de app uit.
    await blad.locator('a[href="/apps/reisboek.html"]').first().click();
    await page.waitForFunction(() => /reisboek/.test(document.querySelector('.cmd-pane.actief iframe')
      .contentWindow.location.pathname), null, { timeout: 20000 });
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => /reizen/.test(document.querySelector('.cmd-pane.actief iframe')
      .contentWindow.location.pathname), null, { timeout: 20000 });
    await page.evaluate(() => history.back());
    await page.waitForSelector('#rtgCommand .cmd-leeg', { timeout: 20000 });
    assert.equal(new URL(page.url()).pathname, '/apps/app.html', 'terug verliet de app');
    assert.equal(await page.locator('.cmd-pane').count(), 0);

    // 3) Home in de balk onderin brengt je naar de lege keuze, in de schil.
    await page.locator('.cmd-leeg button[data-url="/apps/kantoor.html"]').click();
    await page.waitForSelector('.cmd-pane.actief iframe', { timeout: 20000 });
    assert.equal((await label()).wereld, 'work');
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
    await page.waitForSelector('#rtgCommand .cmd-leeg', { timeout: 20000 });
    assert.equal(new URL(page.url()).pathname, '/apps/app.html', 'Home ging de schil uit');
    assert.equal((await label()).wereld, 'geen');

    // 4b) "Dit scherm" in het menu hoort bij het actieve blad.
    await page.locator('.cmd-leeg button[data-url="/apps/reizen.html"]').click();
    await page.waitForSelector('.cmd-pane.actief iframe', { timeout: 20000 });
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
    await page.waitForSelector('.rtg-edge-here-list .rtg-edge-here-action', { timeout: 20000 });
    const hier = await page.locator('.rtg-edge-here-list').innerText();
    assert.match(hier, /Vluchten/, 'in TravelOS hoort "Dit scherm" TravelOS-functies te tonen');
    assert.doesNotMatch(hier, /Routes vergelijken/, 'de LivingOS-functies horen niet in TravelOS');

    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
