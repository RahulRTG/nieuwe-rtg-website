/* De werktafel start bij een kale /apps/app.html EEN keer op, niet twee keer.

   WAT ER MIS WAS. Bijna elk scherm linkt terug naar de kale /apps/app.html.
   Zonder ?pas= startte de werktafel dan volledig op -- 174 scripts, 2,4 MB
   JavaScript, 56 API-verzoeken -- haalde /api/state op, ontdekte de pas van het
   lid en deed location.replace('?pas=rtg'). Daarna startte alles een tweede
   keer. SCHILHERSTART.json telde het: 18 API-verzoeken die in elke ronde dubbel
   gingen, alle achttien door die ene herlading.

   DE REPARATIE (app.html, "de pas van deze werktafel"): zodra de server de
   sessie op een pas heeft bevestigd, onthoudt de werktafel die pas, en een
   volgende kale /apps/app.html zet het adres in de kop van de pagina goed --
   met replaceState, zonder navigatie. Het geheugen is een VOORSCHOT en geen
   besluit: restoreSession() toetst opnieuw en stuurt door als het niet klopt.

   Drie proeven, en de derde is de belangrijkste: een fout geheugen mag een lid
   nooit in de verkeerde pas-app laten staan. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function maakLid(base) {
  const post = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(pad + ' gaf ' + r.status + ': ' + (j && j.error || ''));
    return j;
  };
  const naam = 'Werktafel Proef';
  const acc = await post('/api/auth/register', { name: naam, email: 'werktafelpas' + Date.now().toString(36) + '@voorbeeld.test',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const status = await post('/api/onboarding/status', {}, acc.token);
  await post('/api/onboarding/teken', { naam, akkoord: true, contractVersion: status.contract.versie }, acc.token);
  return acc.token;
}

/* Open de kale werktafel en tel de DOCUMENTEN: een nieuwe performance.timeOrigin
   in het hoofdkader. framenavigated alleen gaat ook af bij replaceState, en dat
   is precies de weg die de reparatie neemt -- die mag hier niet als herlading
   tellen. */
async function openKaal(page, base) {
  const origins = new Set();
  const lees = () => page.evaluate(() => performance.timeOrigin).then((t) => origins.add(t)).catch(() => {});
  const opNav = (f) => { if (f === page.mainFrame()) lees(); };
  page.on('framenavigated', opNav);
  await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return !!(app && app.classList.contains('active') && window.RTGCommand && window.RTGCommand.actief());
  }, null, { timeout: 30000 });
  await lees();
  page.off('framenavigated', opNav);
  return { documenten: origins.size, adres: await page.evaluate(() => location.pathname + location.search) };
}

test('werktafel: een kale /apps/app.html start een keer op, en een fout geheugen herstelt zich',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werktafelpas-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await maakLid(srv.base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((t) => {
      if (sessionStorage.getItem('proef-gezet')) return;
      sessionStorage.setItem('proef-gezet', '1');
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* 1. De eerste keer weet de werktafel de pas nog niet: hij laadt zoals
          vroeger, stuurt door, en onthoudt daarna wat de server bevestigde. */
    const eerste = await openKaal(page, srv.base);
    assert.equal(eerste.adres, '/apps/app.html?pas=rtg', 'de eerste keer eindigt op de pas van het lid');
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_werktafel_pas')), 'rtg',
      'na een bevestigde sessie onthoudt de werktafel de pas');

    /* 2. Elke volgende kale werktafel: een document, geen herlading. */
    const tweede = await openKaal(page, srv.base);
    assert.equal(tweede.documenten, 1, 'een kale /apps/app.html kost een document en geen twee');
    assert.equal(tweede.adres, '/apps/app.html?pas=rtg', 'het adres staat goed zonder navigatie');

    /* 3. Een geheugen dat niet meer klopt (een andere pas, bijvoorbeeld na een
          besluit van RTG) is geen besluit: restoreSession stuurt door naar de
          pas die de SERVER zegt, en het geheugen schuift mee. */
    await page.evaluate(() => localStorage.setItem('rtg_werktafel_pas', 'business'));
    const fout = await openKaal(page, srv.base);
    assert.equal(fout.adres, '/apps/app.html?pas=rtg', 'een fout geheugen eindigt toch op de pas van de sessie');
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_werktafel_pas')), 'rtg',
      'en het geheugen is daarna weer juist');

    assert.deepEqual(fouten, [], 'geen paginafouten');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
