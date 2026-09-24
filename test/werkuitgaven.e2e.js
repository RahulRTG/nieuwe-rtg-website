/* ============================================================================
   HET WERK OS: DE MODULE UITGAVEN, IN EEN ECHTE BROWSER.

   De routes van een uitgave zijn beproefd in test/bedrijfuitgave.test.js. Deze
   toets gaat over de knoppen: kan een mens op het scherm een uitgave indienen,
   ziet hij waarom hij hem zelf niet goedkeurt, en kan een ANDER hem daarna
   goedkeuren en als betaald noteren -- zonder dat hij een route hoeft te kennen.

   En hij houdt vast dat het scherm de zin van de server voluit toont: een
   weigering van de grendel ("u diende deze uitgave in") hoort de mens te lezen,
   niet een algemene fout. Die zinnen zijn het halve product.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtOpTekst } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkuitgaven-'));

test('een uitgave gaat op het scherm van indienen via een ander naar betaald', { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, body) => fetch(base + '/api/bedrijf' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const w = await api('/werkruimte/maak', { naam: 'Uitgavebedrijf', land: 'NL' });
    const LIDID = {};
    async function lid(naam, rollen) {
      const a = await api('/lid/aanmeld', { werkruimte: w.werkruimte, naam });
      await api('/lid/besluit', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: a.lidId, akkoord: true });
      await api('/lid/rollen', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: a.lidId, rollen });
      LIDID[a.lidToken] = a.lidId;
      return { werkruimte: w.werkruimte, lidToken: a.lidToken };
    }
    const FIN = await lid('Fenna', ['financieel']);
    const CFO = await lid('Chris', ['directie']);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    async function als(sessie) {
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(s => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_werk_sessie', JSON.stringify(s)); }, sessie);
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.RTGWerkModules && window.RTGWerkModules.MODULES.uitgaven &&
        !document.getElementById('inhoud').hidden, null, { timeout: 15000 });
      await page.evaluate(() => {
        document.getElementById('tabModules').click();
        const k = document.getElementById('mKeuze'); k.value = 'uitgaven';
        k.dispatchEvent(new Event('change'));
      });
      await wachtOpTekst(page, /Uitgave indienen/, { in: '#mActie' });
    }
    const vul = (id, waarde) => page.evaluate(([i, v]) => { document.getElementById(i).value = v; }, [id, waarde]);
    async function druk(nr, verwacht) {
      await page.evaluate(() => { document.getElementById('melding').textContent = ''; });
      await page.click('#mActie [data-doe="' + nr + '"]');
      await wachtOpTekst(page, verwacht, { in: '#melding' });
    }
    const lijst = () => page.evaluate(() => document.getElementById('mLijst').innerText.replace(/\s+/g, ' '));

    /* ---- de keuzelijst kent de module, en de betaalwijze staat erbij ---- */
    await als(FIN);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#mKeuze option')].some(o => o.value === 'uitgaven')),
      'Uitgaven staat in de keuzelijst');
    await wachtOpTekst(page, /Betaalwijze/, { in: '#mExtra' });
    assert.match(await page.evaluate(() => document.getElementById('mExtra').innerText), /extern/, 'standaard buiten RTG');
    assert.match(await page.evaluate(() => document.getElementById('mExtra').innerText), /Tekenwijze[\s\S]*niet aan een entiteit gekoppeld/i,
      'de tekenwijze staat erbij, en zegt dat hij zonder koppeling niets doet');

    /* ---- indienen ---- */
    await vul('a_h0_omschrijving', 'Bureaustoelen');
    await vul('a_h0_begunstigde', 'Meubel BV');
    await vul('a_h0_bedrag', '420');
    await druk(0, /Ingediend/);
    await wachtOpTekst(page, /Bureaustoelen/, { in: '#mLijst' });
    const rij = await lijst();
    assert.match(rij, /wacht op goedkeuring/, 'de stand is berekend: ' + rij);
    assert.match(rij, /420\.00/);
    const id = await page.evaluate(() => (document.getElementById('mLijst').innerText.match(/id (\w+)/) || [])[1]);
    assert.ok(id, 'het id staat zichtbaar in de lijst, zodat een ander hem kan goedkeuren');

    /* ---- wie het recht niet draagt, leest waarom en blijft ingelogd ---- */
    await vul('a_h1_id', id);
    await druk(1, /recht "geld\.goedkeuren" niet/);
    assert.equal(await page.evaluate(() => !document.getElementById('inhoud').hidden && !!localStorage.getItem('rtg_werk_sessie')),
      true, 'een weigering op een recht is geen verkeerde sleutel: de sessie blijft');

    /* ---- een ander keurt goed en noteert betaald ---- */
    await als(CFO);
    await vul('a_h1_id', id);
    await druk(1, /./);
    await wachtOpTekst(page, /goedgekeurd/, { in: '#mLijst' });
    await vul('a_h2_id', id);
    await vul('a_h2_kenmerk', 'BANK-77');
    await druk(2, /Genoteerd als betaald/);
    await wachtOpTekst(page, /betaald \(extern, BANK-77\)/, { in: '#mLijst' });

    /* ---- de indiener keurt zijn eigen uitgave niet goed ---- */
    await vul('a_h0_omschrijving', 'Taxi');
    await vul('a_h0_begunstigde', 'Rit BV');
    await vul('a_h0_bedrag', '30');
    await druk(0, /Ingediend/);
    await wachtOpTekst(page, /Taxi/, { in: '#mLijst' });
    const eigen = await page.evaluate(() => (document.getElementById('mLijst').innerText.match(/Taxi[\s\S]*?id (\w+)/) || [])[1]);
    await vul('a_h1_id', eigen);
    await druk(1, /diende deze uitgave in/);

    /* ---- RTG Rekening staat standaard uit, en het scherm zegt dat ---- */
    await page.selectOption('#a_h3_wijze', 'rekening');
    await druk(3, /niet aangezet/);

    /* ---- de eigen tekengrens zet een ander ---- */
    await vul('a_h6_lidId', LIDID[CFO.lidToken]);
    await vul('a_h6_bedrag', '1');
    await druk(6, /eigen tekengrens zet een ander/);

    /* ---- de tekenwijze vraagt eerst een gekoppelde entiteit, en zegt dat ---- */
    await page.selectOption('#a_h4_wijze', 'bestuur');
    await druk(4, /niet aan een entiteit/);

    assert.deepEqual(fouten, [], 'geen scriptfouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
