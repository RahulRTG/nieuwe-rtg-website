/* DE TWEE FOUNDATIONSCHERMEN DIE GEEN ENKELE TOETS AFLEGDE.

   De toegankelijkheidskeuring telt per scherm of een toets hem WERKELIJK
   aflegt -- niet of een veegtoets hem aantikt of een cache hem ophaalt. Op 27
   augustus 2026 zakte die poort op precies twee schermen, allebei uit de twaalf
   commits die main die ochtend binnenkreeg: registreren.html en mail.html van
   de Foundation. De routes eronder waren wel getoetst (het routejournaal staat
   op 100%), de schermen zelf niet -- en een scherm zonder toets is een scherm
   waarvan niemand weet of de knoppen werken.

   Beide lopen hier de weg die een mens loopt, zonder iets af te plakken:

   1. REGISTREREN. Open de voordeur, kies "Gezin", vul het formulier in en
      verstuur het. Dat maakt een ECHT gezin op de testserver aan; het scherm
      hoort daarna zelf door te sturen naar beheer.html. De pincontrole wordt
      ook geraakt: twee verschillende pincodes horen een foutmelding in het
      scherm te geven, niet een stille mislukking.

   2. MAIL. Met de gezinssessie die de app zelf gebruikt (rtf_sessie in
      localStorage, net als linkgezin.e2e.js) opent het postvak, laadt het eigen
      adres, gaat de schrijfdialoog open en dicht, en wordt er een bericht naar
      het EIGEN adres gestuurd -- de enige ontvanger die op een verse server
      gegarandeerd bestaat. Daarna hoort dat bericht in de inbox te staan en
      moet hij te openen zijn.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function metServer(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfmail-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    await fn({ browser, base });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('registreren: het gezinsformulier weigert scheve pincodes en maakt daarna echt een gezin',
  { skip: geenBrowser(pw) }, async () => {
  await metServer(async ({ browser, base }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    await pg.goto(base + '/apps/foundation/registreren.html', { waitUntil: 'domcontentloaded' });

    /* De keuze opent het paneel; tot die klik is het formulier verborgen. */
    await pg.click('#gezinKeuze');
    await pg.waitForSelector('#gezinPaneel:not([hidden])', { timeout: 15000 });

    const vul = async (pin2) => {
      await pg.fill('#gezinForm [name=gezinsnaam]', 'Gezin Toetsluis');
      await pg.fill('#gezinForm [name=naam]', 'Ouder Toetsluis');
      await pg.fill('#gezinForm [name=pin]', '1234');
      await pg.fill('#gezinForm [name=pinNogmaals]', pin2);
      const b1 = pg.locator('#gezinForm [name=bevoegdGezin]');
      const b2 = pg.locator('#gezinForm [name=privacyAkkoord]');
      if (!(await b1.isChecked())) await b1.check();
      if (!(await b2.isChecked())) await b2.check();
    };

    /* Eerst de scheve pin: de fout hoort IN het scherm te landen. */
    await vul('9999');
    await pg.click('#gezinForm [type=submit]');
    await pg.waitForFunction(() => (document.querySelector('#gezinFout') || {}).textContent !== '',
      null, { timeout: 15000 });
    const fout = await pg.textContent('#gezinFout');
    assert.ok(/pin/i.test(fout), 'de foutmelding gaat over de pincode: ' + fout);

    /* Dan goed: het scherm maakt het gezin en stuurt zelf door naar beheer. */
    await vul('1234');
    await pg.click('#gezinForm [type=submit]');
    await pg.waitForURL('**/beheer.html*', { timeout: 20000 });
    assert.match(pg.url(), /beheer\.html/, 'na registratie komt de beheerder op het beheerscherm uit');
    await ctx.close();
  });
});

test('mail: het postvak laadt het eigen adres, en een bericht aan jezelf komt echt aan',
  { skip: geenBrowser(pw) }, async () => {
  await metServer(async ({ browser, base }) => {
    const g = (await api(base, '/api/foundation/gezin/maak',
      { gezinsnaam: 'Posthuis', naam: 'Ouder Posthuis', pin: '1234',
        bevoegdGezin: true, privacyAkkoord: true })).body;
    assert.ok(g.code && g.token, 'het gezin bestaat: ' + JSON.stringify(g).slice(0, 120));

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((s) => {
      try { localStorage.setItem('rtf_sessie', s); localStorage.setItem('rtg_lang', 'nl'); } catch (e) {}
    }, JSON.stringify({ code: g.code, token: g.token }));
    const pg = await ctx.newPage();
    await pg.goto(base + '/apps/foundation/mail.html', { waitUntil: 'domcontentloaded' });

    /* Het adres komt van de server; tot dan staat er "Adres laden...". */
    await pg.waitForSelector('#adresKaart .adres', { timeout: 20000 });
    const adres = (await pg.textContent('#adresKaart .adres')).trim();
    assert.ok(adres.length > 3, 'het eigen adres staat op het scherm: ' + adres);

    /* De schrijfdialoog open, een bericht aan het EIGEN adres, en versturen. */
    await pg.click('#nieuw');
    await pg.waitForSelector('#schrijf[open]', { timeout: 10000 });
    await pg.fill('#naar', adres);
    await pg.fill('#onderwerp', 'Proefbericht');
    await pg.fill('#tekst', 'Dit bericht bewijst dat het scherm de hele weg aflegt.');
    await pg.click('#verstuur');

    /* Na versturen sluit de dialoog en staat het bericht in de eigen inbox. */
    /* Een gesloten <dialog> is per definitie onzichtbaar, dus wacht op de
       toestand en niet op zichtbaarheid. */
    await pg.waitForFunction(() => !document.querySelector('#schrijf').open, null, { timeout: 15000 });
    await pg.waitForFunction(() => /Proefbericht/.test(
      (document.querySelector('#inbox') || {}).textContent || ''), null, { timeout: 20000 });

    /* En hij is te openen: de leesdialoog toont onderwerp en tekst. */
    await pg.click('#inbox [data-i]');
    await pg.waitForSelector('#lezen[open]', { timeout: 10000 });
    const kop = await pg.textContent('#leesKop');
    assert.match(kop, /Proefbericht/, 'de leesdialoog toont het onderwerp: ' + kop);
    await ctx.close();
  });
});
