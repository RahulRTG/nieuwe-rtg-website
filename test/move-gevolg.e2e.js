/* RTG MOVE: WAT ALS HET UITLOOPT -- de tweede vraag van Move op het scherm.

   `/api/move/gevolg` bestond, was getoetst (test/move-keten.test.js toets 3) en
   had GEEN scherm: geen enkel bestand in public/ riep hem aan. Voor een lid
   bestond "wat breekt er als iets verschuift" dus niet. Deze toets loopt die
   vraag nu af zoals een lid hem stelt: twee echte, betaalde afspraken, een
   overgang op het scherm, een gekozen uitloop, en het antwoord.

   Wat hier vaststaat:
   - de minuten komen van de reiziger (een keuzelijst) en worden nooit geraden;
   - het geraakte onderdeel is het onderdeel waar je NAARTOE gaat;
   - het antwoord is een VOORSTEL met het adres van de app waar het echte werk
     hoort, en het scherm zegt er hardop bij dat er niets verzet is;
   - valt de server weg, dan zegt het scherm dat het niet lukte en kan het
     opnieuw (de knop komt terug), in plaats van een kale fout.

   Draai los: node --test test/move-gevolg.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, stopNet, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/move.html';
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function post(base, pad, lijf, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
}

async function proeflid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'mvg' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(r.status, 200, 'proeflid: ' + JSON.stringify(r.data));
  return r.data.token;
}

async function boek(base, tok, code, dienst, d, tijd) {
  const r = await post(base, '/api/booking/request', { supplierCode: code, serviceId: dienst, date: d, time: tijd }, tok);
  assert.equal(r.status, 200, 'boeking bij ' + code + ': ' + JSON.stringify(r.data));
  assert.equal((await post(base, '/api/booking/pay', { ref: r.data.boeking.ref }, tok)).status, 200, 'betaald bij ' + code);
  return r.data.boeking.ref;
}

test('Move rekent een gekozen uitloop door en zet een voorstel klaar zonder iets te verzetten',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  let browser;
  let gestopt = false;
  try {
    const base = srv.base;
    const tok = await proeflid(base);
    const d = morgen();
    /* Drie soorten overgang in een reis, zodat het scherm ze moet ONDERSCHEIDEN:
       training 10:00-11:00 en massage 11:15 (krap, wordt door uitloop
       onhaalbaar), massage naar een charter om 14:00 (ruim, blijft ruim), en de
       charter naar een training om 17:00 -- na een vlucht weet niemand wanneer
       je het vliegveld uit bent, dus die overgang is NIET TE BEPALEN. */
    await boek(base, tok, 'KAITO', 's1', d, '10:00');
    await boek(base, tok, 'SERENA', 'w1', d, '11:15');
    const ch = await post(base, '/api/member/vluchten/charter',
      { soort: 'privejet', bestemming: 'Parijs Le Bourget', datum: d, tijd: '14:00' }, tok);
    assert.equal(ch.status, 200, 'charter: ' + JSON.stringify(ch.data));
    await boek(base, tok, 'KAITO', 's1', d, '17:00');

    /* De route zelf, met een onderdeel dat niet in de reis staat: een
       weigering met een zin, geen 500. */
    const vreemd = await post(base, '/api/move/gevolg', { kenmerk: 'bestaat-niet', minuten: 30 }, tok);
    assert.equal(vreemd.status, 404, 'een onbekend onderdeel wordt geweigerd');
    assert.match(String(vreemd.data && vreemd.data.error), /niet in deze reis/i);
    const zonderMin = await post(base, '/api/move/gevolg', { kenmerk: 'x' }, tok);
    assert.equal(zonderMin.status, 400, 'zonder minuten geen gevolg: Move raadt geen vertraging');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => {
      try { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); } catch (e) {}
    }, tok);
    await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.naad .uitloop button', { timeout: 20000 });

    const vraag = (await page.locator('.naad .uitloop label').first().textContent()).trim();
    assert.match(vraag, /loopt .+ uit\?/i, 'de vraag noemt het onderdeel waar je vandaan komt: "' + vraag + '"');

    const gevolgVraag = page.waitForResponse(r => r.url().endsWith('/api/move/gevolg'));
    await page.locator('.naad .uitloop select').first().selectOption('45');
    await page.locator('.naad .uitloop button').first().click();
    const antwoord = await gevolgVraag;
    assert.equal(antwoord.status(), 200, 'het scherm vraagt de echte route');
    const verstuurd = JSON.parse(antwoord.request().postData() || '{}');
    assert.equal(verstuurd.minuten, 45, 'de minuten komen uit de keuze van de reiziger');

    await page.waitForSelector('.gevolg li', { timeout: 10000 });
    const gevolg = page.locator('.gevolg').first();
    const kop = (await gevolg.locator('.kop').textContent()).trim();
    assert.match(kop, /45 minuten uitloop raakt 1 overgang\./i, 'de kop telt wat de uitloop RAAKT, niet alle regels: "' + kop + '"');
    assert.match(kop, /1 overgang niet te bepalen/i, 'en zegt hardop wat Move niet kan wegen: "' + kop + '"');
    assert.equal(await gevolg.locator(':scope > ul > li').count(), 3, 'een regel per overgang na de verstoring');
    const geraakt = gevolg.locator(':scope > ul > li[data-geraakt="ja"]');
    assert.equal(await geraakt.count(), 1, 'precies een van de drie wordt geraakt');
    const tekst = (await geraakt.first().textContent()).trim();
    assert.match(tekst, /massage/i, 'het geraakte onderdeel is waar je naartoe gaat: "' + tekst + '"');
    assert.match(tekst, /krap \u2192 onhaalbaar/i, 'en het wordt onhaalbaar: "' + tekst + '"');
    assert.match(tekst, /niets verzet/i, 'het scherm zegt dat er niets verzet is: "' + tekst + '"');
    const onbekend = (await gevolg.locator(':scope > ul > li').nth(2).textContent()).trim();
    assert.match(onbekend, /niet te bepalen \u2192 niet te bepalen/i, 'onbekend blijft onbekend op het scherm: "' + onbekend + '"');
    assert.doesNotMatch(onbekend, /ruim|geen gevolg/i, 'en wordt nooit een geruststelling: "' + onbekend + '"');
    const href = await geraakt.first().locator('a').getAttribute('href');
    assert.equal(href, '/apps/reizen.html#reizen', 'het voorstel wijst naar de plek waar de afspraak staat');
    /* EN DIE PLEK BESTAAT EN TOONT HEM. Hier stond /apps/portaal.html, en deze
       toets keurde die link goed terwijl hij 404 gaf: een adres vergelijken is
       geen adres volgen. Nu wordt hij gevolgd, tot de afspraak er staat. */
    const ander = await ctx.newPage();
    const r404 = await ander.goto(base + href, { waitUntil: 'domcontentloaded' });
    assert.equal(r404.status(), 200, 'de bestemming bestaat');
    await ander.waitForFunction(() => /massage/i.test(document.body.innerText || ''), null, { timeout: 20000 });
    await ander.close();

    /* HERSTEL: valt de server weg, dan geen kale fout maar een zin, en de knop
       komt terug zodat de reiziger het opnieuw kan proberen. */
    /* Wachten tot de server echt weg is, niet een vaste 400 ms. */
    await stopNet(srv.child); gestopt = true;
    await page.locator('.naad .uitloop button').first().click();
    await page.waitForFunction(() => /niet gelukt/i.test((document.querySelector('.gevolg') || {}).textContent || ''),
      null, { timeout: 10000 });
    assert.equal(await page.locator('.naad .uitloop button').first().isEnabled(), true, 'de knop is weer te gebruiken');
    assert.deepEqual(fouten.filter(f => !/Failed to fetch|ERR_CONNECTION|net::/i.test(f)), [],
      'geen paginafout buiten de weggevallen verbinding zelf');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    if (!gestopt) stop(srv);
  }
});
