/* ============================================================================
   DE BRUG, IN EEN ECHTE BROWSER: van een lopende dienst tot een waarneming --
   met een mens die ja zegt in het midden (PLAATS.md fase 2c).

   test/plaatsdienstbrug.test.js bewijst de serverkant: dat de zaak geen venster
   opent, dat het lid zijn eigen dienst kan zien, en dat er na het uitklokken
   niets meer ligt. Wat die toets NIET kan bewijzen is het stuk waar het hier om
   draait: dat er een MENS tussen zit. Een app die stilletjes zelf op "ja" drukt
   zou daar precies zo doorheen komen.

   Vandaar deze toets. Hij meet drie dingen die alleen in een browser bestaan:

     1. het aanbod verschijnt, en zolang niemand tikt gebeurt er NIETS --
        geen venster, geen waarneming, geen aanraking van de geolocation-API;
     2. na de tik gaat het venster open, start de motor, en komt er een
        waarneming binnen die geen coördinaat draagt;
     3. na het uitklokken sluit de app zijn eigen venster.

   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const ZAAK = 'KIKUNOI';

/* Een toestel dat op de werkplek staat. watchPosition antwoordt meteen: dat is
   wat een toestel met een verse fix ook doet. De schakelaar staat aan, want de
   vraag van shared/plek.js is elders al getoetst (gpsschakelaar.e2e.js) en zou
   hier alleen maar een tweede kaartje voor de eerste zetten. */
const GPS = (lat, lng) => `(function () {
  window.__gpsAanrakingen = 0;
  const p = { coords: { latitude: ${lat}, longitude: ${lng}, accuracy: 10 } };
  const g = {
    getCurrentPosition: function (ok) { window.__gpsAanrakingen++; ok(p); },
    watchPosition: function (ok) { window.__gpsAanrakingen++; setTimeout(function () { ok(p); }, 30); return 1; },
    clearWatch: function () {}
  };
  Object.defineProperty(navigator, 'geolocation', { get: function () { return g; } });
  try { localStorage.setItem('rtg_os_gps', '1'); } catch (e) {}
})();`;

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return r.json().catch(() => ({}));
}

test('plaats: een lopende dienst wordt aangeboden, en pas na de tik gaat er iets aan',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-brug-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // een lid dat ook medewerker is, en dat ingeklokt staat
    const roster = await api(base, '/api/supplier/roster', { code: ZAAK });
    const man = roster.staff.find(x => x.role === 'manager');
    const baas = (await api(base, '/api/supplier/login', { code: ZAAK, staffId: man.id, pin: '1234' })).token;
    const nieuw = await api(base, '/api/supplier/staff/add', { name: 'Brug Scherm', role: 'staff', func: 'Balie' }, baas);
    const st = nieuw.staff, staffPin = nieuw.pin;
    const u = String(process.pid) + String(Date.now()).slice(-6);
    const reg = await api(base, '/api/auth/register', { name: 'Brug Scherm', email: 'bs' + u + '@voorbeeld.test',
      password: 'bruggeheim123', geboortedatum: '1992-02-02', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    const k = await api(base, '/api/account/koppel', { soort: 'personeel', code: ZAAK, staffId: st.id, pin: staffPin }, reg.token);
    assert.ok(k.ok, 'het lid is gekoppeld als medewerker');
    const werker = (await api(base, '/api/supplier/login', { code: ZAAK, staffId: st.id, pin: staffPin })).token;
    const klok = await api(base, '/api/staff/clock', {}, werker);
    assert.equal(klok.actie, 'in', 'de medewerker staat ingeklokt');

    // waar ligt de zaak? dat is het hek waar het toestel in hoort te staan
    const h = await api(base, '/api/plaats/hekken', { doel: 'dienst' }, reg.token);
    const hek = (h.hekken || []).find(x => x.id === 'leverancier:' + ZAAK);
    assert.ok(hek, 'de werkplek staat als hek in de lijst');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route('**/api/onboarding/status', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await ctx.addInitScript(GPS(hek.punten[0].lat, hek.punten[0].lng));
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const verstuurd = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/plaats/')) verstuurd.push({ url: r.url(), body: r.postData() || '' });
    });

    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });

    /* 1. HET AANBOD KOMT, EN ZOLANG NIEMAND TIKT GEBEURT ER NIETS. Dit is het
       stuk dat een servertoets niet kan zien: een app die stilletjes zelf ja
       zegt, zou daar precies zo doorheen komen. */
    await page.waitForSelector('.rtgdienst', { timeout: 20000 });
    const tekst = await page.locator('.rtgdienst p').textContent();
    assert.match(tekst, /dienst bij/, 'het aanbod noemt de dienst: ' + tekst);
    assert.match(tekst, /niet waar je bent geweest/,
      'en het zegt wat er NIET gebeurt, vóórdat iemand ja zegt');

    await page.waitForTimeout(600);
    const voor = await api(base, '/api/plaats/stand', {}, reg.token);
    assert.equal(voor.vensters.length, 0, 'zonder tik ligt er geen toestemming');
    /* En de plaatslaag heeft niets waargenomen. Bewust NIET gemeten op
       window.__gpsAanrakingen: op dit scherm draait ook apps/geo.js, en die mag
       met de schakelaar aan gewoon een positie vragen voor de afstanden in de
       partnerlijst. Die aanraking optellen bij deze zou betekenen dat de toets
       iets anders meet dan hij beweert -- en dan bewijst hij niets over de brug. */
    assert.equal(verstuurd.filter(r => r.url.includes('/waarneem')).length, 0,
      'zonder tik is er niets waargenomen');

    // 2. NA DE TIK: venster open, motor aan, waarneming binnen
    await page.click('.rtgdienst .ja');
    await page.waitForFunction(() => window.RTGPlaats && window.RTGPlaats.stand().binnen.length > 0,
      null, { timeout: 15000 });
    const na = await api(base, '/api/plaats/stand', {}, reg.token);
    assert.equal(na.vensters.length, 1, 'de toestemming ligt er nu');
    assert.equal(na.vensters[0].bron, 'dienst bij ' + ZAAK, 'met de reden erbij');
    const w = na.waarnemingen.find(x => x.hek === 'leverancier:' + ZAAK);
    assert.ok(w, 'en er is een waarneming van de werkplek');
    assert.equal(w.wat, 'binnen');

    // en de prikklok kan de vraag nu beantwoorden
    const opnieuw = await api(base, '/api/staff/clock', {}, werker);   // uit
    assert.equal(opnieuw.actie, 'uit');
    const weerIn = await api(base, '/api/staff/clock', {}, werker);    // in
    assert.equal(weerIn.plek.gemeten, true, 'de prikklok heeft nu iets om naar te kijken');
    assert.equal(weerIn.plek.bevestigd, true, 'en het toestel stond op de werkplek');

    /* 3. UITGEKLOKT IS UITGEKEKEN. De app sluit zijn eigen venster zodra de
       reden ervoor weg is -- dat is "toestemming heeft altijd een einde" op zijn
       concreetst. */
    await api(base, '/api/staff/clock', {}, werker);                   // uit, en zo laten
    await page.evaluate(() => window.RTGPlaatsDienst.ronde());
    await page.waitForTimeout(800);
    const eind = await api(base, '/api/plaats/stand', {}, reg.token);
    assert.equal(eind.vensters.length, 0, 'het venster is dicht');
    assert.equal(eind.waarnemingen.length, 0, 'en er ligt geen waarneming meer');

    /* EN DE KERNBEWERING VAN DE HELE LAAG, over de hele keten: geen enkel
       verzoek droeg een coördinaat. */
    assert.ok(verstuurd.length >= 3, 'er is met de plaatslaag gepraat');
    for (const req of verstuurd) {
      for (const veld of ['lat', 'lng', 'coords', 'accuracy', 'nauwkeurig']) {
        assert.ok(!req.body.includes('"' + veld + '"'),
          'verzoek naar ' + req.url + ' droeg ' + veld + ': ' + req.body);
      }
    }
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
