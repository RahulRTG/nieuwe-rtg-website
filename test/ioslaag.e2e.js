/* De iOS-laag (public/shared/ios.js): gooit hij niets weg dat de app nog nodig
   heeft, en ruimt hij op wat er weg moest?

   WAAROM DEZE TOETS BESTAAT. De laag bouwt de kopbalk van elke app-pagina om
   tot een iOS-navigatiebalk. De eerste versie VERVING die kop, en dat kostte
   stilletjes elk element dat geen knop was: #tel (ongelezen berichten), #titel,
   #wie, #filters. De app schrijft daarna nooit meer iets in een element dat
   niet bestaat -- geen uitzondering, geen rode toets, alleen een teller die
   eeuwig leeg blijft. Negentien pagina's waren zo stuk zonder dat iets het zei.

   WAAROM HIJ ZO IS OPGEBOUWD. Drie keer moest het meetgereedschap zelf worden
   gerepareerd voordat het iets bewees, en dat is het opschrijven waard:

   1. Eerst mat het de EINDTOESTAND van een uitgelogde pagina. Maar de kassa en
      de backoffice vervangen daar hun eigen body door de inlogdeur, dus de kop
      was al weg voordat er iets te meten viel. De mutatie kwam er glansrijk
      doorheen.
   2. Toen werden alle scripts geblokkeerd op een sterretjespatroon over .js --
      maar de server voegt de rij uitgestelde scripts samen tot EEN verzoek
      /scriptbundel.js?paden=..., en met die queryreeks matchte het patroon
      niet. Alles draaide gewoon door.
   3. En een pagina die location.replace() doet naar het inlogscherm, meet de
      kop van een ANDERE pagina.

   Vandaar deze opzet: elk script wordt leeggemaakt op resourceType, ios.js
   wordt daarna van zijn eigen adres geladen (inline mag niet van de CSP), en
   wie wegnavigeert telt niet mee. En als er nul pagina's gemeten zijn, zakt de
   toets -- een groene uitslag zonder metingen is geen groene uitslag.

   De mutatie die hem hoort te laten zakken: laat bouwBalk() in
   shared/ios/ios-02.js ook weggooien wat een id draagt (haal de draagtId-tak
   uit de opruimlus). Dan verliezen negentien pagina's een element.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

const pw = laadPlaywright({ eigenDriver: false });

/* Alle app-pagina's onder public/apps, als webpad. */
function appPaden(dir = path.join(PUB, 'apps'), uit = []) {
  for (const naam of fs.readdirSync(dir)) {
    const p = path.join(dir, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) appPaden(p, uit);
    else if (naam.endsWith('.html')) uit.push('/' + path.relative(PUB, p).split(path.sep).join('/'));
  }
  return uit.sort();
}

/* Welke id's staan er in de kopbalk van de RAUWE html? Dat is de lijst die na
   het omvormen nog steeds moet bestaan. */
function kopIds(webpad) {
  const html = fs.readFileSync(path.join(PUB, webpad.replace(/^\//, '')), 'utf8');
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/header>/i);
  if (!m) return [];
  const kop = m[1].slice(m[1].search(/<header/i));
  return [...kop.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
}

test('de iOS-laag gooit geen element met een id uit de kopbalk weg',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ios-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

    /* Alles wat JavaScript oplevert gaat eruit -- op resourceType, niet op
       extensie, want de scriptbundel draagt een queryreeks. Alleen de laag die
       we toetsen mag echt laden. */
    await ctx.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === '/shared/ios.js') return route.continue();
      if (route.request().resourceType() === 'script' || /\.js$/.test(u.pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      }
      return route.continue();
    });

    const fouten = [];
    let gemeten = 0;

    for (const pad of appPaden()) {
      const ids = kopIds(pad);
      if (!ids.length) continue;
      const page = await ctx.newPage();
      try {
        await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(120);
        // wegnavigeerd (inlogdeur)? dan meten we een andere pagina
        if (new URL(page.url()).pathname !== pad) { await page.close(); continue; }
        // stond de kop er sowieso niet? dan valt er niets te verliezen
        const voor = await page.evaluate((x) => x.filter((i) => !document.getElementById(i)), ids);
        if (voor.length) { await page.close(); continue; }

        /* Van zijn eigen adres laden en niet als inline blok: de CSP staat
           alleen 'self' plus een nonce toe. */
        await page.evaluate(() => new Promise((klaar) => {
          const s = document.createElement('script');
          s.src = '/shared/ios.js';
          s.onload = klaar; s.onerror = klaar;
          document.head.appendChild(s);
        }));
        await page.waitForTimeout(80);

        const na = await page.evaluate((x) => x.filter((i) => !document.getElementById(i)), ids);
        gemeten++;
        if (na.length) fouten.push(pad + ': ' + na.join(', '));
      } finally {
        await page.close();
      }
    }

    assert.ok(gemeten > 20, 'te weinig pagina\'s gemeten (' + gemeten + '): dan bewijst een groene uitslag niets');
    assert.deepEqual(fouten, [], 'deze pagina\'s verliezen een element uit hun kopbalk:\n' + fouten.join('\n'));
  } finally {
    if (browser) await browser.close();
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een app-pagina draagt geen woordmerk meer in zijn chrome',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ios-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const steek = ['/apps/vluchten.html', '/apps/agenda.html', '/apps/berichten.html', '/apps/rtgschool.html'];

    for (const pad of steek) {
      await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => ({
        ios: document.body.hasAttribute('data-ios'),
        merk: document.querySelectorAll('.os-merk, .os-merk-logo, .osbar, .os-kick, img[alt="RTG"]').length,
        eyInKop: document.querySelectorAll('body > header .ey').length,
        pil: !!document.querySelector('.ios-thuis'),
      }));
      assert.ok(r.ios, pad + ': de iOS-laag staat niet aan');
      assert.equal(r.merk, 0, pad + ': er staat nog een merkteken in de chrome');
      assert.equal(r.eyInKop, 0, pad + ': er staat nog een eyebrow in de kopbalk');
      assert.ok(r.pil, pad + ': geen home-indicator');
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een knoppengroep in de kop blijft een groep',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ios-'));
  const CODE = 'KANTOOR-IOSGROEP-1';
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  try {
    /* payroll.html stuurt zonder kantoorsessie naar de inlogdeur, en dan meet je
       de kop van een andere pagina. Dus eerst een sessie. */
    const tok = (await (await fetch(base + '/api/office/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE }) })).json()).token;
    assert.ok(tok, 'kantoorsessie');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('rtg_office_token', t); } catch (e) {} }, tok);
    const page = await ctx.newPage();

    /* WAAROM DEZE TOETS APART BESTAAT. De andere hierboven kijkt of elementen
       met een ID blijven bestaan, en dat was niet genoeg: de tabs van
       apps/payroll.html staan in een <nav> en worden gezocht met
       `nav [data-tab]`. Ze hebben geen id. Toen de laag knoppen LOS naar de
       actiebalk verhuisde, bestonden ze nog wel maar stond de <nav> er niet
       meer -- en de tabwissel deed niets, zonder foutmelding, want
       querySelectorAll geeft gewoon een lege lijst terug.

       Een groep verhuist daarom als geheel. Deze toets bewaakt dat via de
       kiezer die de pagina zelf gebruikt, niet via het bestaan van de knop. */
    await page.goto(base + '/apps/payroll.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
      losseKnoppen: document.querySelectorAll('[data-tab]').length,
      viaDeNav: document.querySelectorAll('nav [data-tab]').length
    }));
    assert.ok(r.losseKnoppen > 0, 'de tabknoppen bestaan');
    assert.equal(r.viaDeNav, r.losseKnoppen,
      'en ze zijn nog te vinden via de kiezer die het scherm gebruikt (nav [data-tab])');
  } finally {
    if (browser) await browser.close();
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
