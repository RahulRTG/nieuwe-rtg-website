/* DE WERKPLEK VAN EEN ZAAK BIJ RTG SERVICE.

   De routes bestonden al, maar een zaak kon er alleen langs de API bij -- en dat
   is geen kanaal maar een belofte. Deze toetsen leggen vast wat het scherm wel
   en niet doet:

   1. Het VRAAGT niet wie u bent. Geen veld voor een klantnummer, een zaakcode of
      een contactpersoon; de sessie weet dat al.
   2. Het belooft niet dat alles werkt. Zonder storing die uw meldingen raakt
      staat er niets -- geen groen vinkje, want beschikbaarheid wordt niet per
      zaak gemeten.
   3. De zaak kiest geen prioriteit. Hij vinkt aan wat hij WEET (er ligt werk
      stil, er staat geld vast); de weging gebeurt op de server.
   4. Een bevestiging staat bovenaan en zegt wat er opengaat voordat er iets
      opengaat.

   Draait alleen waar Playwright met een passende browser staat; anders
   overgeslagen. Draai: npm run e2e */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, kantoorAlsPersoon } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadScherm();

async function api(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  return r.json();
}

async function metWerkplek(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkplek-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const rs = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const man = (rs.staff || []).find(s => s.role === 'manager');
    assert.ok(man, 'geen manager bij KIKUNOI');
    const lg = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    assert.ok(lg.token, 'de manager logt in');
    const balie = await kantoorAlsPersoon(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lg.token);
    const page = await ctx.newPage();
    await fn(page, base, lg.token, balie);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

test('een zaak meldt iets zonder ergens een klantnummer in te tikken', { skip: geenBrowser(pw) }, async () => {
  await metWerkplek(async (page, base, zaakToken) => {
    await page.goto(base + '/apps/leverancier-service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mStuur', { timeout: 20000 });

    /* GEEN IDENTITEITSVELD. Elk invoerveld hier hoort bij de MELDING; er is er
       geen waarin de zaak zichzelf moet aanwijzen. */
    const velden = await page.$$eval('input, select, textarea',
      els => els.map(e => (e.placeholder || e.getAttribute('aria-label') || e.id || '')));
    assert.equal(velden.filter(v => /klantnummer|zaakcode|contactpersoon|uw code/i.test(v)).length, 0,
      'het scherm vraagt de zaak alsnog om zichzelf aan te wijzen: ' + JSON.stringify(velden));

    await page.selectOption('#mOnderwerp', 'betaling');
    await page.fill('#mTitel', 'Onze uitbetaling van vrijdag is niet aangekomen');
    await page.check('#mGeld');
    await page.click('#mStuur');
    await page.waitForFunction(() => /Genoteerd als SUP-/.test(document.body.textContent), null, { timeout: 20000 });

    const mijn = await api(base, '/api/supplier/service/mijn', {}, zaakToken);
    assert.equal(mijn.zaken.length, 1, JSON.stringify(mijn).slice(0, 200));
    assert.equal(mijn.zaken[0].doelgroep, 'zaak');
    assert.equal(mijn.zaken[0].team, 'zakelijk');
    /* De zaak vinkte "er staat geld vast" aan en koos GEEN prioriteit; de server
       heeft gewogen. */
    assert.notEqual(mijn.zaken[0].prioriteit, 'P0');
  });
});

test('zonder storing staat er geen geruststelling', { skip: geenBrowser(pw) }, async () => {
  await metWerkplek(async (page, base) => {
    await page.goto(base + '/apps/leverancier-service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#mStuur', { timeout: 20000 });
    const tekst = await page.textContent('#blad');
    assert.doesNotMatch(tekst, /alles werkt|RTG werkt normaal|geen storingen/i,
      'het scherm belooft beschikbaarheid die niemand per zaak meet');
  });
});

test('een storing die de zaak raakt staat er wel, met het nummer erbij', { skip: geenBrowser(pw) }, async () => {
  await metWerkplek(async (page, base, zaakToken, balie) => {
    const z = (await api(base, '/api/supplier/service/open',
      { onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }, zaakToken)).zaak;
    await api(base, '/api/office/service/bundel', { zaken: [z.id], incident: 'RTG-0042' }, balie);

    await page.goto(base + '/apps/leverancier-service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /RTG-0042/.test(document.body.textContent), null, { timeout: 20000 });
    assert.match(await page.textContent('#blad'), /Storing RTG-0042/);
  });
});

test('de zaak bevestigt toegang, en ziet eerst wat er opengaat', { skip: geenBrowser(pw) }, async () => {
  await metWerkplek(async (page, base, zaakToken, balie) => {
    const z = (await api(base, '/api/supplier/service/open',
      { onderwerp: 'zaak', titel: 'Onze werkruimte doet raar' }, zaakToken)).zaak;
    const v = await api(base, '/api/office/service/bevestiging/vraag',
      { id: z.id, capabilities: ['organisatie.stand'], reden: 'de werkruimte reageert niet sinds vanmorgen' }, balie);
    assert.ok(v.bevestiging, JSON.stringify(v).slice(0, 200));

    await page.goto(base + '/apps/leverancier-service.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-ja]', { timeout: 20000 });
    const tekst = await page.textContent('#blad');
    assert.match(tekst, /vraagt toegang/i, 'de zaak ziet niet dat er iemand toegang vraagt');
    assert.match(tekst, /organisatie\.stand/, 'de zaak ziet niet wat er opengaat');
    assert.match(tekst, /reageert niet sinds vanmorgen/, 'de zaak ziet de reden niet');

    /* En er is nog NIETS open voordat er is gedrukt. */
    const voor = await api(base, '/api/office/service/machtigingen', {}, balie);
    assert.equal(voor.machtigingen.length, 0, 'er ging iets open voordat de zaak bevestigde');

    await page.click('[data-ja]');
    await page.waitForFunction(() => /Bevestigd\./.test(document.body.textContent), null, { timeout: 20000 });
    const na = await api(base, '/api/office/service/machtigingen', {}, balie);
    assert.equal(na.machtigingen.length, 1, 'de bevestiging leverde geen machtiging op');
    assert.deepEqual(na.machtigingen[0].capabilities, ['organisatie.stand']);
  });
});
