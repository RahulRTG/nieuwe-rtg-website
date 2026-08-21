/* RTG SCAN in de leden-app (public/apps/app-main/app-main-56.js) -- LINK.md stap 4.

   WAT HIER ECHT GEBEURT, EN WAAROM DAT IN EEN BROWSER MOET. Hier stond een keten
   van als-dans: is het een tafel, dan het menu; een kascode, dan een tekstje; een
   entree, dan een ander tekstje. Elke nieuwe soort code kwam er als tak bij. Nu
   gaat elke gescande code langs EEN deur (/api/link/los), komt er een kaart met
   wie/wat/waarom/hoelang, en pas na een druk van een mens gebeurt er iets.

   Die weg is in Node niet te meten: de knop, de scanoverlay, de kaart en de
   toast zijn scherm. Deze toets loopt hem daarom in een echte browser, met de
   handmatige invoer van de scanoverlay als vervanger van de camera -- dezelfde
   weg die een mens neemt als zijn camera het niet doet.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop, wachtOpNetstilte, wachtOpRust } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function api(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function lid(base, naam) {
  const reg = (await api(base, '/api/auth/register', { name: naam, email: naam.replace(/\s/g, '') + Date.now() + '@x.nl',
    phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  await api(base, '/api/verify/upload', { image: KYC_PNG }, reg.token);
  const st = (await api(base, '/api/state', {}, reg.token)).body;
  return { token: reg.token, codenaam: st.state.user.codename };
}

/* Een ingelogde werktafel, zoals de rest van deze suite hem opzet: token in de
   opslag en de onboardingstatus vastgezet, anders staat de intakepoort over het
   scherm heen (zie de uitleg in test/appmenu.e2e.js). */
async function metApp(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-linkscan-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const a = await lid(base, 'Scan Anna');
    const b = await lid(base, 'Scan Boris');
    await api(base, '/api/pay/oplaad', { centen: 50000, idem: 'scan-op-' + Date.now() }, a.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/api/onboarding/status', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, a.token);
    const pg = await ctx.newPage();
    await pg.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await wachtOpNetstilte(pg);
    await wachtOpRust(pg);
    await fn({ pg, base, a, b });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

// de scanoverlay openen en met de hand een code invoeren (de weg zonder camera)
async function scan(pg, tekst) {
  await pg.evaluate(() => { const b = document.getElementById('scanBtn'); if (b) b.click(); });
  await pg.waitForSelector('.rtg-scan-ov', { timeout: 5000 });
  await pg.evaluate(() => { const a = document.querySelector('.rtg-scan-ov [data-hand]'); if (a) a.click(); });
  await pg.fill('.rtg-scan-hand input', tekst);
  await pg.click('.rtg-scan-hand button[type=submit]');
}

test('een gescande vraagcode wordt eerst een kaart en pas na een druk een betaling',
  { skip: geenBrowser(pw) }, async () => {
  await metApp(async ({ pg, base, a, b }) => {
    // Boris vraagt 18,50 voor diner; Anna scant dat in haar app
    const cap = (await api(base, '/api/link/cap/maak',
      { handeling: 'geld.ontvangen', centen: 1850, oms: 'diner' }, b.token)).body;
    const voorA = (await api(base, '/api/pay/overzicht', {}, a.token)).body.saldo;

    await scan(pg, cap.token);
    await pg.waitForSelector('.rtg-bedoeling', { timeout: 8000 });

    // de vijf vragen staan op het scherm, met de codenaam en niet de echte naam
    const kaart = await pg.evaluate(() => {
      const el = document.querySelector('.rtg-bedoeling .blad');
      return { tekst: el.innerText, knop: (el.querySelector('button.doen') || {}).textContent };
    });
    /* Hoofdletterongevoelig, want .rtg-bedoeling .van zet de codenaam in
       kapitalen (ONTWERP.md) en innerText geeft terug wat er STAAT. Een toets
       die daarop zakt, meet de vormtaal en niet de inhoud. */
    assert.match(kaart.tekst, new RegExp(b.codenaam.split(' ')[0], 'i'), 'van wie het komt');
    assert.ok(!kaart.tekst.includes('Scan Boris'), 'de echte naam blijft in de kluis');
    assert.match(kaart.tekst, /Betalen/);
    assert.match(kaart.tekst, /diner/);
    assert.match(kaart.tekst, /18,50/);
    assert.match(kaart.tekst, /De ander krijgt/);
    assert.equal((await api(base, '/api/pay/overzicht', {}, a.token)).body.saldo, voorA,
      'kijken kost nog niets');

    // en dan pas bevestigen
    await pg.click('.rtg-bedoeling button.doen');
    await wachtOpNetstilte(pg);
    assert.equal((await api(base, '/api/pay/overzicht', {}, a.token)).body.saldo, voorA - 1850,
      'na de druk is er betaald');
    assert.equal(await pg.locator('.rtg-bedoeling').count(), 0, 'en de kaart is weg');
  });
});

test('een QR die niet van ons is geeft geen kaart en geen fout, maar wat er stond',
  { skip: geenBrowser(pw) }, async () => {
  await metApp(async ({ pg }) => {
    await scan(pg, 'https://bushalte.example/dienstregeling');
    await wachtOpRust(pg);
    assert.equal(await pg.locator('.rtg-bedoeling').count(), 0,
      'een vreemde QR hoort geen bedoelingsscherm te krijgen');
  });
});

test('een pin van een ander wordt een kaart met een verbindknop', { skip: geenBrowser(pw) }, async () => {
  await metApp(async ({ pg, base, a, b }) => {
    const pin = (await api(base, '/api/member/pin', {}, b.token)).body;
    await scan(pg, 'rtg:pin:' + pin.pin);
    await pg.waitForSelector('.rtg-bedoeling', { timeout: 8000 });
    const tekst = await pg.evaluate(() => document.querySelector('.rtg-bedoeling .blad').innerText);
    assert.match(tekst, new RegExp(b.codenaam.split(' ')[0], 'i'));
    assert.match(tekst, /Nog niet verbonden/);
    await pg.click('.rtg-bedoeling button.doen');
    await wachtOpNetstilte(pg);
    const verzoeken = (await api(base, '/api/member/connections', {}, b.token)).body;
    assert.equal((verzoeken.requests || []).length, 1, 'Boris heeft het verzoek');
    assert.equal(verzoeken.requests[0].codename, a.codenaam);
  });
});

test('mijn koppelingen: wat openstaat is er weg te halen, wat gebeurd is blijft staan',
  { skip: geenBrowser(pw) }, async () => {
  /* De knop uit LINK.md par. 3.6, in een echte browser: intrekken sluit een
     deur, en de regel over wat er wel is gebeurd blijft er gewoon staan. */
  await metApp(async ({ pg, base, a, b }) => {
    // iets dat gebeurd is (een verzoek) en iets dat nog openstaat (een code)
    const pin = (await api(base, '/api/member/pin', {}, b.token)).body;
    await api(base, '/api/member/pin/connect', { pin: pin.toon }, a.token);
    await api(base, '/api/link/cap/maak', { handeling: 'geld.ontvangen', centen: 2500, oms: 'borrel' }, a.token);

    await pg.evaluate(() => document.getElementById('privKoppel').click());
    await pg.waitForSelector('.rtg-koppel .rtg-register', { timeout: 8000 });
    const voor = await pg.evaluate(() => document.querySelector('.rtg-koppel .blad').innerText);
    assert.match(voor, /NU OPEN/);
    assert.match(voor, /Verzoek verstuurd/);

    // de openstaande code intrekken
    await pg.click('.rtg-koppel button[data-trek]');
    await wachtOpNetstilte(pg);
    const na = await pg.evaluate(() => document.querySelector('.rtg-koppel .blad').innerText);
    assert.match(na, /geen code van je open/i, 'de code is weg');
    assert.match(na, /Verzoek verstuurd/, 'en wat er gebeurde staat er nog');
    assert.equal((await api(base, '/api/link/koppelingen', {}, a.token)).body.open.length, 0,
      'ook bij de server is hij weg');

    // en het verzoek intrekken laat zijn eigen regel staan
    await pg.click('.rtg-koppel button[data-bon]');
    await wachtOpNetstilte(pg);
    const slot = await pg.evaluate(() => document.querySelector('.rtg-koppel .blad').innerText);
    assert.match(slot, /Verzoek verstuurd/, 'de bon blijft');
    assert.match(slot, /staat niet meer open/i, 'met de reden waarom er niets meer kan');
    assert.equal(((await api(base, '/api/member/connections', {}, b.token)).body.requests || []).length, 0,
      'en de ander heeft geen verzoek meer');
  });
});
