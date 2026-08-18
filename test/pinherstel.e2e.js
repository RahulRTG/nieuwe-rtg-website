/* DE PIN-HERSTELSTROOM, IN EEN ECHTE BROWSER, VAN LINK TOT NIEUWE PIN.

   WAAROM DEZE TOETS BESTAAT. /shared/pinherstel.js stond maandenlang in
   public/apps/app.html achter een scripttag die nooit gesloten werd:

     <script src="/shared/ios.js" defer>
     <script src="/shared/pinherstel.js" defer></script></script>

   Een HTML-lezer leest de inhoud van een script als RUWE TEKST tot het eerste
   sluitteken. De tweede regel werd daardoor de TEKST van het ios.js-element en
   nooit een element; omdat ios.js een src heeft, gooide de browser die tekst
   weg. Gevolg: window.RTGPinHerstel bestond niet. Beide aanroepers in
   app-main.js staan achter `if (window.RTGPinHerstel)` en zwegen dus netjes --
   de knop "Pin vergeten?" verscheen nooit, en de link uit de mail deed niets.

   Wat het NIET zag: algpin.test.js toetst /api/pin/vergeten en /api/pin/herstel
   en bleef groen, want de server mankeerde niets. blindevlek.test.js heeft er nu
   een scanner voor op de markup. Deze toets sluit de derde kant: de stroom zoals
   een lid hem loopt, in een browser die de pagina echt ontleedt.

   De twee helften, elk een eigen toets:
     1. de link uit de mail  -> het schermpje -> een nieuwe pin die echt werkt
     2. de knop "Pin vergeten?" in het pin-scherm -> diezelfde link

   Draait alleen waar een Chromium staat; anders overgeslagen.
   Draai: npm run e2e  --  of los:
   RTG_CHROMIUM=... node --experimental-sqlite --test test/pinherstel.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pinh-')); }
const pw = laadPlaywright();
const skip = geenBrowser(pw);

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}

/* Een lid met een gezette pin. RTG_DEV_LINKS=1 laat /api/pin/vergeten de link
   ook in het antwoord meegeven (devPinUrl); in productie staat dat uit en gaat
   hij alleen de mail in. Zie server/routes/algpin.js. */
async function lidMetPin(base, pin) {
  const u = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const reg = await api(base, '/api/auth/register', {
    name: 'Pin Lid', email: u + '@x.nl', phone: '0611111112', password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'registratie geeft een lid-token');
  assert.equal((await api(base, '/api/pin/zet', { pin }, reg.body.token)).status, 200, 'de pin staat');
  return reg.body.token;
}

async function omgeving(fn) {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEV_LINKS: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    await fn({ base, browser });
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

// een ingelogde pagina op de leden-app, met de fouten-vanger eraan
async function ingelogd(browser, base, token, pad) {
  const ctx = await browser.newContext();
  await ctx.addInitScript((t) => {
    localStorage.setItem('rtg_member_token', t);
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, token);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(base + pad, { waitUntil: 'load' });
  await page.waitForSelector('#gate', { state: 'hidden', timeout: 20000 });
  await page.waitForSelector('#app', { state: 'visible', timeout: 10000 });
  return { page, fouten };
}

const DIALOOG = 'div[role="dialog"][aria-label="Nieuwe algemene pin"]';

/* ---------------- 1. de link uit de mail doet echt iets ---------------- */
test('pin-herstel: de link uit de mail zet een nieuwe pin die werkt', { skip }, async () => {
  await omgeving(async ({ base, browser }) => {
    const OUD = '246810', NIEUW = '135791';
    const token = await lidMetPin(base, OUD);

    // dit is letterlijk wat er in de mail komt te staan
    const vergeten = await api(base, '/api/pin/vergeten', {}, token);
    assert.equal(vergeten.status, 200);
    assert.ok(vergeten.body.devPinUrl, 'de herstellink komt terug (RTG_DEV_LINKS=1)');
    assert.match(vergeten.body.devPinUrl, /\/apps\/app\.html\?pinherstel=.+/, 'de link wijst naar de leden-app');

    const link = new URL(vergeten.body.devPinUrl);
    const { page, fouten } = await ingelogd(browser, base, token, link.pathname + link.search);

    /* DIT is de bewering die maanden onwaar was: het schermpje komt op. Zonder
       de module gebeurde er hier helemaal niets -- geen fout, geen scherm. */
    await page.waitForSelector(DIALOOG, { timeout: 10000 });
    assert.equal(await page.textContent(DIALOOG + ' button'), 'Pin instellen', 'de knop staat er');

    /* De sleutel is eenmalig en hoort niet in de geschiedenis achter te blijven.
       Alleen HIJ gaat eruit: ?pas= is de app waar we in zitten en blijft staan. */
    const na = await page.evaluate(() => location.search);
    assert.ok(!na.includes('pinherstel'), 'de sleutel is uit het adres gehaald, was: ' + na);
    assert.match(na, /pas=rtg/, 'de pas-app blijft wel in het adres staan');

    await page.fill(DIALOOG + ' input', NIEUW);
    await page.click(DIALOOG + ' button');
    await page.waitForSelector(DIALOOG, { state: 'hidden', timeout: 10000 });

    // en nu de tanden: de oude pin is dood, de nieuwe opent
    assert.equal((await api(base, '/api/pin/check', { pin: OUD }, token)).status, 401, 'de oude pin doet niets meer');
    assert.equal((await api(base, '/api/pin/check', { pin: NIEUW }, token)).status, 200, 'de nieuwe pin bewijst');
    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens de stroom');
  });
});

/* ---------------- 2. de knop die de stroom begint ----------------
   Een prive-app opent pas na de algemene pin (app-main.js: `if (l.prive) return
   metAlgPin(openen)`). In dat scherm hoort "Pin vergeten?" te staan -- de enige
   plek waar een lid de stroom zelf kan beginnen. Stond hij er niet, dan was er
   geen weg terug, en dat is precies wat pinherstel.js moest voorkomen. */
test('pin-herstel: "Pin vergeten?" staat in het pin-scherm en start de stroom', { skip }, async () => {
  await omgeving(async ({ base, browser }) => {
    const token = await lidMetPin(base, '246810');
    const { page, fouten } = await ingelogd(browser, base, token, '/apps/app.html');

    // De drie hoofdwerelden hebben losse apptegels vervangen. Pinbeheer blijft
    // daarom als vaste, zichtbare ingang in het bedieningspaneel bereikbaar.
    await page.waitForFunction(() => document.getElementById('app')?.classList.contains('active'),
      null, { timeout: 60000 });
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForSelector('#rtgCommand .cmd-klok', { state: 'visible', timeout: 10000 });
    await page.click('#rtgCommand .cmd-klok');
    await page.waitForSelector('#shell', { state: 'visible', timeout: 10000 });
    await page.click('#osCcBtn');
    await page.waitForSelector('#osCcScrim.open', { timeout: 10000 });
    await page.click('#osCcPin');

    await page.waitForSelector('#osBelScrim.open', { timeout: 10000 });
    await page.waitForFunction(
      () => [...document.querySelectorAll('#osBelLijst button')].some(b => /vergeten/i.test(b.textContent)),
      undefined, { timeout: 10000 });

    // hem indrukken vraagt de link aan; met RTG_DEV_LINKS=1 gaat de app er
    // meteen heen, en dan staat het herstelscherm er
    await page.evaluate(() => {
      [...document.querySelectorAll('#osBelLijst button')].find(b => /vergeten/i.test(b.textContent)).click();
    });
    await page.waitForSelector(DIALOOG, { timeout: 15000 });
    assert.equal(await page.textContent(DIALOOG + ' button'), 'Pin instellen',
      'de knop brengt het lid bij het scherm dat de nieuwe pin zet');
    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens de stroom');
  });
});
