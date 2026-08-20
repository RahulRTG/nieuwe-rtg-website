/* Schermtoets voor apps/toestemming.html. Dit scherm belooft twee dingen die
   allebei op het scherm zelf waar moeten zijn:

   1. wat er staat is compleet EN het zegt waar het ophoudt (een lijst zonder die
      grens leest als "dit is alles", en dat is precies de schijnzekerheid die
      een consent-overzicht gevaarlijk maakt);
   2. de intrekknop raakt de bron, niet alleen de lijst. Daarom wordt na de tik
      bij de EIGEN app van die laag nagekeken of het er echt af is.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('Toestemming: de lijst toont wie wat mag, en intrekken raakt de bron',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tstscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Toestem Lid', email: 'tstscherm@x.nl', phone: '0612345866',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token);
    const api = (pad, body) => fetch(base + '/api/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then(r => r.json());

    // twee toestemmingen aanzetten, elk in hun eigen laag
    const kliniek = (await api('care', {})).aanbieders.find(a => a.soort === 'kliniek');
    await api('care/intake/deel', { aanbiederId: kliniek.id, medisch: 'bloedverdunner' });
    await api('toestellen/koppel', { naam: 'Horloge' });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/toestemming.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const e = document.getElementById('lijst');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, null, { timeout: 15000 });

    /* 1. beide toestemmingen staan er, met wie, wat en welke kant het op gaat. */
    const lijst = await page.textContent('#lijst');
    assert.match(lijst, new RegExp(kliniek.naam), 'de kliniek staat er met naam');
    assert.match(lijst, /Horloge/, 'en het gekoppelde toestel ook');
    assert.match(lijst, /Ziet/, 'een kliniek ZIET iets');
    assert.match(lijst, /Schrijft/, 'een toestel SCHRIJFT iets, en dat is niet hetzelfde');

    /* 2. en het scherm zegt waar de lijst ophoudt. Zonder dat leest hij als
       "dit is alles wat er over u bekend is", en dat is hij niet. */
    await openDeel(page, 'Waar deze lijst ophoudt');
    const grenzen = await page.textContent('#grenzen');
    assert.match(grenzen, /Salon|veiligheidskring|boeking/i, 'de uitzonderingen staan er met reden');
    assert.match(await page.textContent('#voorbehoud'), /toets mee/i,
      'en er staat bij dat er iets op de lijst let');

    /* 3. intrekken, en dan bij de BRON kijken. */
    await openDeel(page, 'Wat er nu mag');
    const knop = page.locator('#lijst [data-intrek^="care-intake"]');
    await knop.scrollIntoViewIfNeeded();
    await knop.click();
    await page.waitForFunction((naam) => {
      const e = document.getElementById('lijst');
      return e && !e.textContent.includes(naam);
    }, kliniek.naam, { timeout: 10000 });

    const bijDeBron = await api('care', {});
    assert.equal((bijDeBron.intakes || []).length, 0,
      'de deling is ook bij Zorg zelf weg, en niet alleen van dit scherm');
    assert.match(await page.textContent('#lijst'), /Horloge/, 'de andere toestemming staat er nog gewoon');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
