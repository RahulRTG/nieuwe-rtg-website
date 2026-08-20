/* Schermtoets voor het tegoed op RTG Pay (public/apps/pay.html).

   Waarom dit náást test/paytegoed.test.js staat, dat de routes al afloopt: een
   scherm dat 200 geeft en netjes rendert kan nog steeds dood zijn. De routes
   waren er in deze ronde eerder dan de knoppen, en precies daartussen zit de
   fout die geen API-toets ziet -- een verkeerde veldnaam in de body, een knop
   die aan niets hangt, een lijst die nooit wordt bijgewerkt. Wat hier bewezen
   wordt gaat dan ook over de KETEN door het scherm heen:

   1. een lid zet tegoed klaar en krijgt een code te zien die hij kan doorgeven;
   2. een tweede lid tikt die code in en het bedrag staat op zijn saldo;
   3. wat er voor JOU klaarstaat is EEN knop -- geen code overtikken;
   4. de vakken die niets te zeggen hebben, staan er niet (uitzonderingsgestuurd).

   MUTATIES GEZIEN ZAKKEN (LAT.md regel 2):
   - het bedrag onder de verkeerde naam meesturen (`bedrag:` in plaats van
     `centen:` bij pay/tegoed/koop): beide toetsen zakten, want er kwam geen
     code in beeld;
   - `d.voorMij` vervangen door `d.gekocht` in verversTegoed(): de tweede toets
     zakte op de knop die het bedrag noemt, de eerste bleef terecht groen.
   Beide teruggedraaid, daarna groen.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: node --experimental-sqlite --test test/paytegoed.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

/* Een piepklein geldig PNG'je: RTG Pay vraagt een rtg-lid eenmalig zijn
   paspoort voordat de wallet opengaat. Het scherm loopt die poort af zoals een
   mens dat doet. */
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let n = 0;
async function versLid(base) {
  const u = Date.now() + '-' + (++n);
  const reg = await api(base, '/api/auth/register', {
    name: 'Tegoed Scherm ' + n, email: 'tgs' + u + '@e.test',
    password: 'geheim123', geboortedatum: '1980-03-03', tier: 'rtg'
  });
  assert.ok(reg.token, 'registreren hoort een token te geven');
  await api(base, '/api/verify/upload', { image: MINI_PNG }, reg.token);
  const o = await api(base, '/api/pay/overzicht', {}, reg.token);
  return { token: reg.token, codenaam: o.codenaam };
}

async function openPay(browser, base, token, fouten) {
  const page = await browser.newPage();
  letOpFouten(page, fouten);
  await page.goto(base + '/apps/pay.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_member_token', t);
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, token);
  await page.goto(base + '/apps/pay.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#vPay:not([hidden])', { timeout: 15000 });
  return page;
}

/* NAVIGEREN ZOALS EEN GEBRUIKER. pay.html doet mee aan het deelmenu
   (shared/deelmenu.js): een pagina met veel kopjes wordt een balk met EEN deel
   tegelijk, en alles buiten het open deel staat op display:none. De eerste
   versie van deze toets vulde meteen #gBedrag in en liep dertig seconden vast op
   "element is not visible" -- terecht, want zo ziet een mens dat veld ook niet.
   Dus eerst het deel openen, en met een KLIK op de balk in plaats van met
   RTGDeel.open(): dan wordt meteen bewezen dat het nieuwe kopje ook echt een
   eigen deel is geworden. */
async function openDeel(page, patroon) {
  await page.waitForSelector('.rtgdeel-balk button', { timeout: 15000 });
  for (const knop of await page.$$('.rtgdeel-balk button')) {
    const t = ((await knop.textContent()) || '').trim();
    if (patroon.test(t)) { await knop.click(); return t; }
  }
  throw new Error('geen deel gevonden voor ' + patroon);
}

test('tegoed op het scherm: klaarzetten geeft een code, verzilveren zet hem op het saldo van de ander',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tegoed-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const fouten = [];
  try {
    const gever = await versLid(base);
    const krijger = await versLid(base);
    await api(base, '/api/pay/oplaad', { centen: 10000, idem: 'e2e-oplaad' }, gever.token);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const paginaA = await openPay(browser, base, gever.token, fouten);

    /* Leeg is leeg: zolang er niets klaarstaat en niets is klaargezet, staan
       beide vakken er niet. Dit hoort VOORAF gemeten te worden -- anders
       bewijst "hij staat er na afloop" niet dat hij eerst weg was. */
    assert.equal(await paginaA.$eval('#gVoorMij', el => el.hidden), true, 'niets voor jou: geen vak');
    assert.equal(await paginaA.$eval('#gGekocht', el => el.hidden), true, 'niets klaargezet: geen vak');

    const deel = await openDeel(paginaA, /tegoed/i);
    assert.match(deel, /tegoed/i, 'het tegoed heeft een eigen deel in de balk: ' + deel);

    // 1. klaarzetten, vrij (zonder codenaam), en de code komt in beeld
    await paginaA.fill('#gBedrag', '25');
    await paginaA.fill('#gOms', 'Voor de koffie');
    await paginaA.click('#gZet');
    await paginaA.waitForSelector('#gNieuw:not([hidden])', { timeout: 12000 });
    const code = (await paginaA.textContent('#gCode') || '').trim();
    assert.match(code, /^[0-9A-F]{4}(-[0-9A-F]{4}){5}$/, 'de code staat leesbaar op het scherm: ' + code);

    // het saldo van de gever is met precies dat bedrag gedaald
    await paginaA.waitForFunction(() => document.querySelector('#pSaldo').textContent.startsWith('75,00'), null, { timeout: 12000 });
    // en de bon staat nu wel in "klaargezet door jou"
    await paginaA.waitForSelector('#gGekocht:not([hidden])', { timeout: 12000 });
    const klaar = await paginaA.textContent('#gGekocht');
    assert.match(klaar, /25,00 eur/, 'de klaargezette bon staat er met zijn bedrag: ' + klaar.slice(0, 160));
    assert.match(klaar, /wacht op ophalen/, 'en met wat hij doet');

    // 2. het tweede lid tikt de code in en verzilvert
    const paginaB = await openPay(browser, base, krijger.token, fouten);
    assert.equal(await paginaB.$eval('#pSaldo', el => el.textContent.startsWith('0,00')), true, 'de ontvanger begint op nul');
    await openDeel(paginaB, /tegoed/i);
    await paginaB.fill('#gIn', code);
    await paginaB.click('#gVerzilver');
    await paginaB.waitForFunction(() => document.querySelector('#pSaldo').textContent.startsWith('25,00'), null, { timeout: 12000 });

    // en een tweede keer levert niets op: de bon is op
    await paginaB.fill('#gIn', code);
    await paginaB.click('#gVerzilver');
    await paginaB.waitForFunction(() => /al gebruikt/i.test(document.querySelector('#melding').textContent), null, { timeout: 12000 });
    assert.equal(await paginaB.$eval('#pSaldo', el => el.textContent.startsWith('25,00')), true, 'en het saldo bewoog niet');

    assert.deepEqual(fouten, [], 'geen console- of netwerkfouten onderweg');
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('tegoed op naam is EEN knop bij de ontvanger, zonder code overtikken',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tegoed-e2e2-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const fouten = [];
  try {
    const gever = await versLid(base);
    const krijger = await versLid(base);
    await api(base, '/api/pay/oplaad', { centen: 10000, idem: 'e2e2-oplaad' }, gever.token);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const paginaA = await openPay(browser, base, gever.token, fouten);
    await openDeel(paginaA, /tegoed/i);
    await paginaA.fill('#gBedrag', '12,50');
    await paginaA.fill('#gAan', krijger.codenaam);
    await paginaA.fill('#gOms', 'Fijne dag');
    await paginaA.click('#gZet');
    await paginaA.waitForSelector('#gNieuw:not([hidden])', { timeout: 12000 });

    const paginaB = await openPay(browser, base, krijger.token, fouten);
    await openDeel(paginaB, /tegoed/i);
    /* Het gerichte tegoed staat er zonder dat er iets is ingetikt: dat is het
       hele verschil met een vrije bon, en de reden dat `voorMij` bestaat. */
    await paginaB.waitForSelector('#gVoorMij:not([hidden]) [data-in]', { timeout: 12000 });
    const knop = await paginaB.textContent('#gVoorMij [data-in]');
    assert.match(knop, /12,50 eur/, 'de knop noemt het bedrag: ' + knop);
    await paginaB.click('#gVoorMij [data-in]');
    await paginaB.waitForFunction(() => document.querySelector('#pSaldo').textContent.startsWith('12,50'), null, { timeout: 12000 });

    // en daarna is het vak weer weg, want er staat niets meer klaar
    await paginaB.waitForFunction(() => document.querySelector('#gVoorMij').hidden === true, null, { timeout: 12000 });

    assert.deepEqual(fouten, [], 'geen console- of netwerkfouten onderweg');
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
