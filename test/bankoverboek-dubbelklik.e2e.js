/* Een dubbelklik op Overboeken boekt een keer (public/apps/geld/bankb.js).

   De knop maakte zijn herhaalsleutel PER KLIK. De server is idempotent op de
   sleutel (kern/bank/overboeken.js), maar twee kliks met twee sleutels zijn
   voor hem twee opdrachten: een dubbelklik op een trage verbinding boekte het
   bedrag twee keer over. De sleutel hoort bij de BEDOELING: dezelfde velden
   houden hem tot de server antwoordt. Gevonden bij de voltooiproef van de bank
   (scripts/lib/voltooi/bank.js), die op routeniveau meet en deze klik dus niet
   ziet. Het antwoord wordt hier vertraagd, zodat de tweede klik zeker valt
   terwijl de eerste nog loopt. Draait alleen waar een browser is. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, kantoorAlsPersoon, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const post = (base, pad, lijf, tok) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(lijf || {}) }).then((r) => r.json());

test('een dubbelklik op Overboeken en op Pas uitgeven stuurt een sleutel en boekt een keer', { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const kantoor = await kantoorAlsPersoon(base);
    assert.ok(kantoor, 'een herleidbaar mens van het kantoor zet de ledenbank live');
    assert.equal((await post(base, '/api/office/bank/leden', { aan: true }, kantoor)).ledenAan, true);
    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
    const tok = (await post(base, '/api/auth/register', { name: 'Banklid', email: 'dk' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).token;
    await post(base, '/api/bank/akkoord', {}, tok);
    await post(base, '/api/bank/rekening/open', { soort: 'spaar', idem: 'spaar-' + u }, tok);
    const ov = await post(base, '/api/bank/overzicht', {}, tok);
    const betaal = ov.rekeningen.find((r) => r.soort === 'betaal'), spaar = ov.rekeningen.find((r) => r.soort === 'spaar');
    const st = await post(base, '/api/bank/storten', { iban: betaal.iban, centen: 5000, route: 'ideal', idem: 'stort-' + u }, tok);
    assert.ok(st.ok, 'gestort: ' + JSON.stringify(st).slice(0, 160));

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext();
    await ctx.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, tok);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const sleutels = [];
    await page.route('**/api/bank/overboek', async (route) => {
      sleutels.push(JSON.parse(route.request().postData() || '{}').idem);
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    await page.goto(base + '/apps/geld.html#bank', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bkOdoe', { timeout: 20000 });
    await page.selectOption('#bkOvan', betaal.iban);
    await page.selectOption('#bkOnaar', spaar.iban);
    await page.fill('#bkObed', '12');
    await page.dblclick('#bkOdoe');
    await page.waitForTimeout(1500);

    assert.equal(sleutels.length, 2, 'beide kliks gingen naar de server');
    assert.equal(sleutels[0], sleutels[1], 'twee kliks, een bedoeling, een sleutel');
    const na = await post(base, '/api/bank/overzicht', {}, tok);
    assert.equal(na.rekeningen.find((r) => r.iban === spaar.iban).saldoCenten, 1200, 'een keer overgeboekt');
    assert.equal(na.rekeningen.find((r) => r.iban === betaal.iban).saldoCenten, 3800);

    /* Dezelfde regel op Pas uitgeven: die knop vraagt niets (geen prompt) en
       is dus het makkelijkst dubbel te tikken. */
    const pasSleutels = [];
    await page.route('**/api/bank/pas/uitgeven', async (route) => {
      pasSleutels.push(JSON.parse(route.request().postData() || '{}').idem);
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    await page.dblclick('[data-bkpas="' + betaal.iban + '"]');
    await page.waitForTimeout(1500);
    assert.equal(pasSleutels.length, 2);
    assert.equal(pasSleutels[0], pasSleutels[1], 'twee tikken op Pas uitgeven, een sleutel');
    const passen = await post(base, '/api/bank/passen', {}, tok);
    assert.equal((passen.passen || []).filter((p) => p.iban === betaal.iban).length, 1, 'een pas uitgegeven: ' + JSON.stringify(passen).slice(0, 200));
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
