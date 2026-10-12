/* ============================================================================
   DE STAND LIDMAATSCHAP IN RTG GELD -- de hele stroom in een echte browser.

   WAAROM DIT NAAST test/lidabonnement-deur.test.js STAAT. Die toets bewijst de
   DEUR van /api/mijn/abonnement (de sleutel komt uit de sessie, lid A raakt lid B
   niet). Hij kan niet bewijzen dat een lid zijn lidmaatschap ook kan ZIEN en
   OPZEGGEN, want daar was geen scherm voor (AFSPRAAK.md par. 14.1). Deze toets
   loopt de bedoeling van begin tot eind:

     1. een lid met een echt lidmaatschap (aanvraag + besluit van het kantoor)
        opent RTG Geld en ziet zijn pas en stand ACTIEF;
     2. het leest wat opzeggen doet -- en dat verandert NIETS (de server zegt
        daarna nog steeds ACTIEF);
     3. het bevestigt een keer, en het scherm toont OPZEGGEND met de einddatum;
     4. na herladen staat er nog steeds OPZEGGEND (persistent), en er is geen
        opzegknop meer;
     5. een lid zonder afspraak ziet de reden van de server en GEEN opzegknop.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai los: node --test test/geld-lidmaatschap.e2e.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stopHard, laadPlaywright, browserOpties, geenBrowser, letOpFouten,
  kantoorAlsPersoon, wachtTot } = require('./helper');

const pw = laadPlaywright();

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function registreer(base) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api(base, '/api/auth/register', { name: 'Lid ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'registreren geeft een token');
  return { token: reg.token, u };
}

/* De enige weg waarlangs een contract ontstaat: een aanvraag die het kantoor
   goedkeurt. Zelfde opbouw als test/lidabonnement-deur.test.js. */
async function lidMetAbonnement(base, office) {
  const lid = await registreer(base);
  const aanvraag = (await api(base, '/api/aanmelding/aanvraag',
    { pas: 'rtg', naam: 'Lid ' + lid.u, contact: lid.u + '@x.nl' }, lid.token)).body;
  const id = aanvraag.aanmelding && aanvraag.aanmelding.id;
  assert.ok(id, 'de aanvraag is binnen: ' + JSON.stringify(aanvraag).slice(0, 160));
  const besluit = await api(base, '/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' }, office);
  assert.equal(besluit.status, 200, 'het kantoor keurt goed');
  return lid;
}

async function pagina(browser, base, token) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await ctx.addInitScript((tok) => {
    try {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    } catch (e) {}
  }, token);
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  /* letOpFouten vangt alleen paginafouten; een CSP-schending of een mislukte
     fetch komt als console.error en hoort hier ook te zakken. */
  page.on('console', (m) => { if (m.type() === 'error') fouten.push('console: ' + m.text()); });
  await page.goto(base + '/apps/geld.html#lidmaatschap', { waitUntil: 'domcontentloaded' });
  return { page, fouten };
}

const stand = (page) => page.evaluate(() => {
  const el = document.getElementById('lmStand');
  return el ? el.dataset.stand : null;
});

test('RTG Geld, stand Lidmaatschap: zien, lezen wat opzeggen doet, opzeggen, en het blijft staan',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geldlid-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
    assert.ok(office, 'kantoor-inlog; staat RTG_DEMO aan?');
    const lid = await lidMetAbonnement(base, office);

    browser = await pw.chromium.launch(browserOpties(pw));
    const { page, fouten } = await pagina(browser, base, lid.token);

    // 1. zien
    await wachtTot(page, () => !!document.getElementById('lmStand'), null, { wat: 'het lidmaatschap' });
    assert.equal(await stand(page), 'ACTIEF');
    const tekst = await page.locator('#lmBeeld').innerText();
    assert.match(tekst, /RTG Pass/i, 'de naam van de pas staat erbij: ' + tekst.slice(0, 200));
    /* Het bedrag in de juiste eenheid: de server geeft euro's, het scherm toont het
       als euro's -- een factor honderd verkeerd zakt hier. */
    const vooraf = await api(base, '/api/mijn/abonnement', {}, lid.token);
    const mb = vooraf.body.abonnement.maandBedrag;
    if (mb != null) {
      const verwacht = Number(mb).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      assert.ok(tekst.includes(verwacht), 'het maandbedrag ' + verwacht + ' staat in beeld: ' + tekst.slice(0, 300));
    } else assert.match(tekst, /geen bedrag afgesproken/);

    // 2. lezen wat opzeggen doet -- en dat verandert niets; "Niet opzeggen" sluit het weer
    await page.click('#lmVoorbeeld');
    await page.waitForSelector('#lmLaat', { timeout: 10000 });
    await page.click('#lmLaat');
    assert.equal(await page.locator('#lmGevolgTekst').count(), 0, '"Niet opzeggen" sluit het gevolg');
    await page.click('#lmVoorbeeld');
    await page.waitForSelector('#lmGevolgTekst', { timeout: 10000 });
    const gevolg = await page.locator('#lmGevolgTekst').innerText();
    assert.match(gevolg, /facturen en bewijsstukken blijven/i,
      'wat er blijft (de zin van de server) staat erbij, niet alleen wat er weggaat: ' + gevolg.slice(0, 200));
    const tussen = await api(base, '/api/mijn/abonnement', {}, lid.token);
    assert.equal(tussen.body.abonnement.stand, 'ACTIEF', 'het voorbeeld heeft niets opgezegd');

    // 3. een bevestiging
    await page.click('#lmBevestig');
    await wachtTot(page, () => {
      const el = document.getElementById('lmStand');
      return !!el && el.dataset.stand === 'OPZEGGEND';
    }, null, { wat: 'de stand OPZEGGEND op het scherm' });
    assert.match(await page.locator('#lmUitslag').innerText(), /loopt tot/i, 'de einddatum staat in beeld');
    const server = await api(base, '/api/mijn/abonnement', {}, lid.token);
    assert.equal(server.body.abonnement.stand, 'OPZEGGEND', 'en de server zegt hetzelfde');

    // 4. herladen: het blijft staan, en er is niets meer op te zeggen
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wachtTot(page, () => !!document.getElementById('lmStand'), null, { wat: 'het lidmaatschap na herladen' });
    assert.equal(await stand(page), 'OPZEGGEND', 'na herladen nog steeds opgezegd');
    assert.equal(await page.locator('#lmVoorbeeld').count(), 0, 'geen opzegknop meer op een opgezegd lidmaatschap');

    const echt = fouten.filter((f) => !/favicon/i.test(f));
    assert.deepEqual(echt, [], 'geen consolefouten');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopHard(child);
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test('RTG Geld, stand Lidmaatschap: zonder afspraak de reden van de server en geen opzegknop',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geldlid0-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const lid = await registreer(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const { page, fouten } = await pagina(browser, base, lid.token);
    await wachtTot(page, () => {
      const v = document.getElementById('lmHoofd');
      return !!v && !/Laden/.test(v.innerText || '');
    }, null, { wat: 'het antwoord van de server' });
    /* Op het stuk dat ALLEEN de server zegt -- de terugvalzin van het scherm zegt
       ook "geen lidmaatschapsafspraak", en dan bewees deze regel niets. */
    assert.match(await page.locator('#lmHoofd').innerText(), /Vraag de ledenbalie/i,
      'de zin van de server staat er, met de weg erbij');
    assert.equal(await page.locator('#lmVoorbeeld').count(), 0, 'zonder afspraak geen opzegknop');
    assert.deepEqual(fouten.filter((f) => !/favicon/i.test(f)), [], 'geen consolefouten');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopHard(child);
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
