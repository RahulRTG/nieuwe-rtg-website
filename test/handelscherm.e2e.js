/* Scherm-test: RTG Handel in een echte browser (Playwright).

   De endpoints van de handelsketen liggen vast in test/handelsketen.test.js.
   Dit legt de andere helft vast: dat een mens de keten ook echt kan lopen. Twee
   dingen die een servertoets per definitie niet ziet:

   1. Dat de aanvraag vanaf het SCHERM ontstaat -- soort bedrijf kiezen, een
      regel toevoegen, uitzetten -- en daarna in "Wat u vraagt" staat.
   2. Dat de knoppen van de tegenpartij verschijnen zonder dat het scherm de
      levensloop naspeelt. De server stuurt per handel een `mag`-lijst mee; de
      pagina tekent alleen die knoppen. Ziet de wasserij "Offerte uitbrengen",
      dan is die lijn heel.

   Beide zaken draaien in hun eigen browsercontext, want ze hebben elk hun eigen
   zaak-sessie in localStorage. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-e2e-handel-')); }
function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende pad */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadPlaywright();

async function api(base, pad, body) {
  const r = await fetch(base + '/api' + pad, {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify(body || {})
  });
  return r.json().catch(() => ({}));
}
async function beheerToken(base, code) {
  const roster = await api(base, '/supplier/roster', { code });
  const mgr = (roster.staff || []).find(m => m.role === 'manager');
  const login = await api(base, '/supplier/login', { code, staffId: mgr.id, pin: '1234' });
  return login.token;
}
async function zaakPagina(browser, base, token, fouten) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  letOpFouten(page, fouten);
  await page.addInitScript((t) => {
    localStorage.setItem('rtg_sup_token', t);
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, token);
  await page.goto(base + '/apps/handel.html', { waitUntil: 'load' });
  return page;
}

test.test('RTG Handel in de browser: de beachclub zet een aanvraag uit en de wasserij ziet hem staan',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const fouten = [];
  try {
    const club = await beheerToken(base, 'VORA');
    const was = await beheerToken(base, 'LAVANDA');
    assert.ok(club && was, 'beide demozaken horen een beheerder met PIN 1234 te hebben');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });

    /* ---- de koper: een aanvraag uitzetten, helemaal vanaf het scherm ---- */
    const clubPagina = await zaakPagina(browser, base, club, fouten);
    // op een <option> wachten gaat niet: die telt in een browser nooit als
    // zichtbaar. Wachten tot de lijst gevuld IS, is de bewering die we bedoelen.
    await clubPagina.waitForFunction(() => document.querySelectorAll('#hGenre option').length > 0,
      null, { timeout: 12000 });
    /* De keuzelijst staat per SECTOR gegroepeerd; dat is de eerste plek waar de
       sectorlaag uit het genre-register echt werk doet. Zonder kopjes zijn het
       72 losse regels en is kiezen geen kiezen. */
    const kopjes = await clubPagina.locator('#hGenre optgroup').count();
    assert.ok(kopjes > 5, 'de soorten bedrijf horen per sector gegroepeerd te staan (kreeg ' + kopjes + ' kopjes)');
    assert.equal(await clubPagina.locator('#hGenre optgroup[label="Bouw & vakwerk"] option[value="wasserij"]').count(), 1,
      'een wasserij hoort onder haar eigen sector te staan');
    await clubPagina.selectOption('#hGenre', 'wasserij');
    await clubPagina.fill('#hTitel', 'Linnen voor het weekend');
    await clubPagina.fill('#hWat', 'servetten');
    await clubPagina.fill('#hAantal', '800');
    await clubPagina.click('#hRegel');
    // de regel hoort meteen zichtbaar te zijn; zonder regel weigert de server
    await clubPagina.waitForSelector('#hRegels .item', { timeout: 5000 });
    assert.match(await clubPagina.textContent('#hRegels'), /800 stuk servetten/);

    await clubPagina.fill('#hOphalen', 'dinsdag 09:00');
    await clubPagina.click('#hZet');
    await clubPagina.waitForSelector('#hKoper .item', { timeout: 8000 });
    const bijKoper = await clubPagina.textContent('#hKoper');
    assert.match(bijKoper, /Linnen voor het weekend/);
    assert.match(bijKoper, /staat open/, 'een verse aanvraag hoort als open te staan');
    assert.match(bijKoper, /Wasserij/i, 'de aanvraag hoort te tonen aan welk soort bedrijf hij is gericht');

    /* ---- de leverancier: ziet hem staan, met de knop die de server toestaat ---- */
    const wasPagina = await zaakPagina(browser, base, was, fouten);
    await wasPagina.waitForSelector('#hOpen .item', { timeout: 12000 });
    const bijWas = await wasPagina.textContent('#hOpen');
    assert.match(bijWas, /Linnen voor het weekend/, 'de wasserij hoort de aanvraag te zien zonder te zijn aangewezen');
    assert.match(bijWas, /Vora Beach Club/, 'met de naam van de vragende zaak erbij');
    assert.ok(await wasPagina.locator('#hOpen [data-stap="offreren"]').count() > 0,
      'de wasserij hoort de knop "Offerte uitbrengen" te krijgen');
    // en niet de knoppen die verderop in de keten horen
    assert.equal(await wasPagina.locator('#hOpen [data-stap="factureren"]').count(), 0,
      'factureren hoort pas te kunnen als er geleverd is');

    /* ---- offerte uitbrengen vanaf het scherm, en de koper ziet de prijs ---- */
    await wasPagina.fill('#hOpen [data-in$=":prijs"]', '240');
    await wasPagina.click('#hOpen [data-stap="offreren"]');
    await wasPagina.waitForTimeout(600);

    await clubPagina.reload({ waitUntil: 'load' });
    await clubPagina.waitForSelector('#hKoper [data-gun]', { timeout: 12000 });
    assert.match(await clubPagina.textContent('#hKoper'), /Lavanda Wasserij/);
    assert.match(await clubPagina.textContent('#hKoper'), /240[.,]00/);

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    await stop({ child });
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
