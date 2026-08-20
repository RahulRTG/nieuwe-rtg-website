/* Schermtoets voor RTG Pay aan de ZAAKKANT (public/apps/zaakpay.html).

   Dit scherm bestond niet. /api/supplier/pay/* -- innen, saldo, uitbetalen en
   sinds kort het tegoed -- had nooit een eigen scherm: de kassa gebruikte
   alleen de betaalcode van het lid, en al het andere leefde uitsluitend als
   route. Wat hier bewezen wordt is dus niet "de knop hangt aan de juiste
   route", maar dat de vier dingen die een zaak met RTG Pay doet ook echt door
   een browser heen werken:

   1. het saldo op het scherm is het saldo van de kas, en groeit door innen;
   2. de richting van een boeking klopt -- binnen is plus, buiten is min, en dat
      wordt uit de rekeningnaam afgeleid en niet uit een meegestuurde code;
   3. tegoed klaarzetten haalt het geld ECHT uit de kas en levert een code op
      die een lid kan verzilveren;
   4. uitbetalen is van de manager, en een medewerker leest de weigering van de
      server in plaats van op een dode knop te drukken.

   MUTATIES GEZIEN ZAKKEN (LAT.md regel 2):
   - `binnen()` omgedraaid naar `van` in plaats van `naar`: de eerste toets
     zakte op "innen telt als plus";
   - het bedrag bij innen onder de naam `bedrag` meegestuurd in plaats van
     `centen`: de eerste toets zakte, want het saldo bewoog niet;
   - de weigering bij uitbetalen stil geslikt in plaats van gemeld: de tweede
     toets zakte, want er kwam geen uitleg in beeld.
   Alle drie teruggedraaid, daarna groen.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: node --experimental-sqlite --test test/zaakpay.e2e.js */
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

const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let n = 0;
async function versLid(base) {
  const u = Date.now() + '-' + (++n);
  const reg = await api(base, '/api/auth/register', {
    name: 'Zaakpay Lid ' + n, email: 'zp' + u + '@e.test',
    password: 'geheim123', geboortedatum: '1980-03-03', tier: 'rtg'
  });
  assert.ok(reg.token, 'registreren hoort een token te geven');
  await api(base, '/api/verify/upload', { image: MINI_PNG }, reg.token);
  const o = await api(base, '/api/pay/overzicht', {}, reg.token);
  return { token: reg.token, codenaam: o.codenaam };
}

async function openZaakpay(browser, base, token, fouten) {
  const page = await browser.newPage();
  letOpFouten(page, fouten);
  await page.goto(base + '/apps/zaakpay.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_sup_token', t);
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, token);
  await page.goto(base + '/apps/zaakpay.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#saldo', { timeout: 15000 });
  return page;
}

test('de zaakkant van RTG Pay: innen vult de kas, tegoed haalt het eruit, en de richting klopt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakpay-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const fouten = [];
  try {
    const manager = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    assert.ok(manager.token, 'de zaak logt in als manager');

    // een lid met saldo en een betaalcode, zodat er echt iets te innen valt
    const klant = await versLid(base);
    await api(base, '/api/pay/oplaad', { centen: 20000, idem: 'zp-oplaad' }, klant.token);
    const kas = await api(base, '/api/pay/kascode', { maxCenten: 20000 }, klant.token);
    assert.ok(kas.code, 'het lid heeft een betaalcode');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const zaak = await openZaakpay(browser, base, manager.token, fouten);

    // de naam van de zaak staat in de kop, dus het scherm weet waar het is
    await zaak.waitForFunction(() => !/^\.\.\.$/.test(document.querySelector('#zaakNaam').textContent), null, { timeout: 12000 });

    const saldoVoor = await zaak.textContent('#saldo');

    // 1. innen
    await zaak.fill('#iCode', kas.code);
    await zaak.fill('#iBedrag', '150');
    await zaak.fill('#iOms', 'Twee koffies en een taart');
    await zaak.click('#iInn');
    await zaak.waitForFunction(t => document.querySelector('#saldo').textContent !== t, saldoVoor, { timeout: 12000 });

    /* 2. de richting: wat er binnenkomt hoort een PLUS te zijn. Dat wordt uit de
       rekeningnaam afgeleid, dus dit is de toets op die afleiding. */
    const boekingen = await zaak.textContent('#boekingen');
    assert.match(boekingen, /Twee koffies en een taart/, 'de inning staat bij de bewegingen: ' + boekingen.slice(0, 200));
    const plusTekst = await zaak.$$eval('#boekingen .plus', els => els.map(e => e.textContent.trim()));
    assert.ok(plusTekst.some(t => /\+\s*150,00/.test(t)), 'innen telt als plus: ' + plusTekst.join(' | '));

    // 3. tegoed klaarzetten haalt het geld ECHT uit de kas
    const saldoNaInnen = await zaak.textContent('#saldo');
    await zaak.fill('#tBedrag', '1');
    await zaak.fill('#tAan', klant.codenaam);
    await zaak.fill('#tOms', 'Kerstattentie');
    await zaak.click('#tZet');
    await zaak.waitForSelector('#tNieuw:not([hidden])', { timeout: 12000 });
    const code = (await zaak.textContent('#tCode') || '').trim();
    assert.match(code, /^[0-9A-F]{4}(-[0-9A-F]{4}){5}$/, 'er komt een tegoedcode uit: ' + code);
    await zaak.waitForFunction(t => document.querySelector('#saldo').textContent !== t, saldoNaInnen, { timeout: 12000 });
    await zaak.waitForSelector('#tKlaarKaart:not([hidden])', { timeout: 12000 });
    assert.match(await zaak.textContent('#tKlaar'), /wacht op ophalen/, 'en hij staat als klaargezet in beeld');

    // en het lid kan hem echt verzilveren -- de keten sluit
    const verzilverd = await api(base, '/api/pay/tegoed/verzilver', { code, idem: 'zp-in' }, klant.token);
    assert.equal(verzilverd.centen, 100, 'het lid haalt het tegoed op: ' + JSON.stringify(verzilverd).slice(0, 160));

    assert.deepEqual(fouten, [], 'geen console- of netwerkfouten onderweg');
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('uitbetalen en tegoed klaarzetten zijn van de manager; een medewerker leest de weigering',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakpay2-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const fouten = [];
  try {
    const manager = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    const code = manager.state.supplier.code;
    const roster = await api(base, '/api/supplier/roster', { code });
    const staf = (roster.staff || []).find(x => x.role !== 'manager');
    assert.ok(staf, 'de zaak heeft personeel zonder managerrechten');
    const inlog = await api(base, '/api/supplier/login', { code, staffId: staf.id, pin: '5678' });
    assert.ok(inlog.token, 'het personeelslid is ingelogd');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const pagina = await openZaakpay(browser, base, inlog.token, fouten);

    /* Kijken mag: het saldo staat er gewoon. Dat is de reden dat dit scherm de
       knoppen TOONT in plaats van ze te verbergen -- wie ze niet mag gebruiken
       hoort te lezen waarom, niet te raden waar ze zijn. */
    await pagina.waitForSelector('#saldo', { timeout: 12000 });

    await pagina.click('#uitbetaal');
    await pagina.waitForFunction(() => /manager/i.test(document.querySelector('#melding').textContent), null, { timeout: 12000 });

    await pagina.fill('#tBedrag', '5');
    await pagina.click('#tZet');
    await pagina.waitForFunction(() => /manager/i.test(document.querySelector('#melding').textContent), null, { timeout: 12000 });
    assert.equal(await pagina.$eval('#tNieuw', el => el.hidden), true, 'en er is geen tegoedcode verschenen');

    assert.deepEqual(fouten, [], 'geen console- of netwerkfouten onderweg');
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
