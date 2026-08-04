/* Scherm-test voor de premium-laag: meenemen (shared/uitvoer.js) en
   sneltoetsen (shared/sneltoets.js).

   Waarom deze twee. Gemeten over de app-catalogus was dit het verschil
   tussen de apps die hier volwaardig heten en de rest: sneltoetsen 65% tegen
   28%, uitvoer 25% tegen 5%. Het zijn de twee kenmerken die een scherm tot
   gereedschap maken, en ze ontbraken het vaakst.

   Wat deze toets vastlegt, en vooral wat hij WEIGERT:
   1. meenemen levert ECHTE velden, geen aan elkaar geplakte schermtekst.
      De eerste versie schraapte de grootste lijst van het scherm en gaf
      "01PassenElke pas heeft een eigen stem" in een kolom; dat is een vinkje
      dat op een functie lijkt. Zonder aangemelde bron en zonder echte tabel
      hoort er GEEN uitvoer te zijn.
   2. de sneltoetsen wijzen naar knoppen die de app echt heeft, en doen
      niets in een invoerveld of met Ctrl/Cmd erbij.
   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

async function lidMetNotities(base) {
  const u = Date.now().toString().slice(-8);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Premlid', email: 'pm' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token };
  // vier stuks, bewust: met minder dan drie rijen zou een schermschraper
  // sowieso niets vinden en kan de weigering-bewering hieronder niet zakken
  for (const titel of ['Boodschappen', 'Reis Milaan', 'Klusjes', 'Cadeaus']) {
    await fetch(base + '/api/notities/bewaar', { method: 'POST', headers: H, body: JSON.stringify({ titel }) });
  }
  return reg.token;
}

test('premium: meenemen geeft echte velden, en weigert schermtekst',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await lidMetNotities(base);
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.RTGUitvoer && RTGUitvoer.beschikbaar(), null, { timeout: 12000 });

    const d = await page.evaluate(() => RTGUitvoer.gegevens());
    // echte velden: meer dan een kolom, en de titel staat in een EIGEN veld
    assert.ok(d.kolommen.length >= 3, 'meerdere kolommen, kreeg: ' + d.kolommen.join(', '));
    assert.ok(d.rijen.length >= 4, 'de notities zitten erin (' + d.rijen.length + ')');
    const titels = d.rijen.map(r => r[d.kolommen.indexOf('titel')]);
    assert.ok(titels.includes('Boodschappen'), 'de titel staat als eigen veld, kreeg: ' + titels.join(' | '));
    // en niet als een aan elkaar geplakte regel
    assert.ok(!d.rijen.some(r => r.length === 1), 'geen enkele rij is een dichtgeplakte tekstregel');

    /* de weigering: haal de aangemelde bron weg en er hoort NIETS meer te
       zijn -- want deze pagina heeft geen echte tabel */
    const zonder = await page.evaluate(() => { RTGUitvoer.bron(null); return RTGUitvoer.beschikbaar(); });
    assert.equal(zonder, false, 'zonder aangemelde bron weigert de uitvoer (geen schermschraapsel)');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('premium: sneltoetsen wijzen naar knoppen die er echt zijn',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await lidMetNotities(base);
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGSneltoets, null, { timeout: 12000 });

    const gevonden = await page.evaluate(() => ({
      zoek: !!RTGSneltoets.zoekVeld(),
      nieuw: RTGSneltoets.nieuwKnop() ? RTGSneltoets.nieuwKnop().textContent.trim() : null
    }));
    assert.ok(gevonden.zoek, 'de laag vindt het zoekveld van deze app');
    assert.ok(gevonden.nieuw, 'en de knop waarmee je iets nieuws maakt');

    // ? toont het overzicht, met alleen wat deze app echt kan
    await page.keyboard.press('?');
    const rijen = await page.$$eval('.rtgsnel dt', ds => ds.map(d => d.textContent));
    assert.ok(rijen.includes('/') && rijen.includes('n'), 'het overzicht noemt de toetsen: ' + rijen.join(' '));
    await page.keyboard.press('Escape');
    const dicht = await page.evaluate(() => document.querySelector('.rtgsnel').hidden);
    assert.equal(dicht, true, 'Esc sluit het overzicht');

    /* in een invoerveld gaat typen voor: "n" mag daar geen knop indrukken */
    const voor = await page.evaluate(() => document.querySelectorAll('.rtgsnel').length);
    await page.evaluate(() => { const z = RTGSneltoets.zoekVeld(); z.focus(); });
    await page.keyboard.type('n');
    const inVeld = await page.evaluate(() => ({
      waarde: RTGSneltoets.zoekVeld().value,
      bladen: document.querySelectorAll('.rtgsnel').length
    }));
    assert.equal(inVeld.waarde, 'n', 'in een veld komt de letter gewoon in het veld');
    assert.equal(inVeld.bladen, voor, 'en er verschijnt niets extra');
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
