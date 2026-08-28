/* DE HELE KETEN, IN EEN ECHTE BROWSER: van een positie op het toestel tot een
   waarneming op de server -- en het bewijs dat er onderweg geen coördinaat mee
   gaat (PLAATS.md par. 1).

   Waarom dit naast test/plaats.test.js staat. Die toets bewijst dat de SERVER
   een coördinaat weigert, en dat de rekenregel op het toestel klopt. Wat hij
   niet kan bewijzen is wat er werkelijk over de lijn gaat als een echte browser
   een echte positie krijgt. Dat is precies de bewering die dit huis verkoopt
   ("uw medewerkers verlaten uw toestel niet"), dus die hoort gemeten te worden
   op de plek waar hij waar of onwaar wordt: de netwerklaag.

   DE MOTOR KOMT UIT DE PAGINA ZELF, en dat was hier ooit anders. Toen fase 1
   alleen de laag opleverde, injecteerde deze toets shared/plaats.js met een
   scripttag, met de aantekening dat hij de echte pagina hoorde te openen zodra
   fase 2 hem aan de schermen zou hangen. Dat is gebeurd (app.html laadt hem
   sinds fase 2c), en de injectie is niet alleen overbodig maar ook GEVAARLIJK
   gebleken: app.html navigeert kort na het laden zelf door (?pas=rtg), en een
   addScriptTag die daar tussenin valt sterft aan "Execution context was
   destroyed". Los gedraaid haalde die race het meestal; in de volle e2e-ronde
   niet. Een toets die soms rood is, leert mensen rood te negeren.

   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

/* Een geolocation die een vaste plek teruggeeft, midden in de zone die het
   stadsweefsel zaait rond Ibiza-stad. watchPosition roept meteen terug: dat is
   wat een toestel met een verse fix ook doet. */
const GPS = (lat, lng) => `(function () {
  const p = { coords: { latitude: ${lat}, longitude: ${lng}, accuracy: 12 } };
  const g = {
    getCurrentPosition: function (ok) { ok(p); },
    watchPosition: function (ok) { setTimeout(function () { ok(p); }, 30); return 1; },
    clearWatch: function () {}
  };
  Object.defineProperty(navigator, 'geolocation', { get: function () { return g; } });
  try { localStorage.setItem('rtg_os_gps', '1'); } catch (e) {}
})();`;

async function api(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) });
  return r.json();
}

test('plaats: een hek passeren levert een waarneming op, en geen coordinaat over de lijn',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Plaats Lid',
      email: 'plaatsmotor' + process.pid + '@x.nl', password: 'geheim123',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    // waar liggen de zones, en welke ligt om het middelpunt heen
    const h = await api(base, '/api/plaats/hekken', { doel: 'stad' }, reg.token);
    assert.equal(h.status, 200);
    assert.ok(h.hekken.length, 'het weefsel levert zones als hek');
    const zone = h.hekken[0];
    const midden = zone.punten.reduce((a, p) => ({ lat: a.lat + p.lat / zone.punten.length,
      lng: a.lng + p.lng / zone.punten.length }), { lat: 0, lng: 0 });

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(GPS(midden.lat, midden.lng));
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ELK verzoek naar de plaatslaag meelezen. Dit is de eigenlijke meting: niet
       "wat kwam er aan" (dat kan de server hebben opgeschoond) maar "wat is er
       verstuurd". */
    const verstuurd = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/plaats/')) verstuurd.push({ url: r.url(), body: r.postData() || '' });
    });

    /* Met ?pas=rtg erbij, want app.html zet die parameter er anders zelf op met
       een navigatie -- en elke evaluate die daar tussenin valt sterft aan
       "Execution context was destroyed". Dat is geen kapotte pagina maar een
       toets die op het verkeerde moment kijkt. */
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'load' });
    /* Wachten op wat de PAGINA levert, en niets injecteren. Dat is meteen de
       scherpere toets: hij zakt nu ook als iemand de scripttag uit app.html
       haalt, en dat kon hij hiervoor niet zien. */
    await page.waitForFunction(() => !!window.RTGPlek && !!window.RTGPlaats,
      null, { timeout: 20000 });

    // een venster openen, want zonder toestemming hoort er niets waargenomen te worden
    const v = await api(base, '/api/plaats/venster', { doel: 'stad', bron: 'schermtoets', minuten: 60 }, reg.token);
    assert.equal(v.status, 200);

    const gestart = await page.evaluate(() => window.RTGPlaats.start('stad'));
    assert.equal(gestart.ok, true, 'de motor start: ' + JSON.stringify(gestart));

    // de watch tikt na 30 ms; even ruimte geven voor de peiling en het verzoek
    await page.waitForFunction(() => window.RTGPlaats.stand().binnen.length > 0,
      null, { timeout: 10000 });

    const stand = await api(base, '/api/plaats/stand', {}, reg.token);
    assert.ok(stand.waarnemingen.length >= 1, 'de server kreeg een waarneming');
    assert.equal(stand.waarnemingen[0].wat, 'binnen');
    assert.equal(stand.waarnemingen[0].hek, zone.id);

    /* EN DE KERNBEWERING. Geen enkel verzoek naar de plaatslaag droeg een
       positie. Zou de motor ooit "voor de zekerheid" de coördinaat meesturen,
       dan zakt deze regel -- en niet pas als iemand het toevallig merkt. */
    assert.ok(verstuurd.length >= 2, 'er zijn verzoeken gedaan (hekken + waarneem)');
    for (const req of verstuurd) {
      for (const veld of ['lat', 'lng', 'lon', 'coords', 'accuracy', 'nauwkeurig']) {
        assert.ok(!req.body.includes('"' + veld + '"'),
          'verzoek naar ' + req.url + ' droeg ' + veld + ': ' + req.body);
      }
      // en ook niet als los getal: de breedtegraad van de zone hoort er niet in te staan
      assert.ok(!req.body.includes(String(midden.lat).slice(0, 7)),
        'verzoek naar ' + req.url + ' droeg een coordinaat als getal: ' + req.body);
    }

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
  }
});
