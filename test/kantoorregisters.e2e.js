/* ============================================================================
   HET PLATFORMREGISTER EN HET ROUTEDOSSIER WORDEN ZELF AFGELEGD.

   WAAROM DEZE TOETS ER IS, EN HOE HIJ IS ONTSTAAN. Beide schermen zijn deze
   maand gebouwd om te kunnen zien wat dit huis van zichzelf weet. Ze hadden
   geen enkele toets die ze opende. Dat bleef onzichtbaar zolang de e2e-ronde
   omviel; zodra hij weer draaide meldde scripts/schermen.js precies drie
   schermen zonder eigen toets, en twee ervan waren deze. Een meetscherm dat
   zelf ongemeten is, is het slechtste wat deze stapel kan opleveren.

   WAT HIJ VASTHOUDT -- en dat is meer dan "de pagina laadt":

     1. Beide schermen tonen ECHTE getallen van de server, geen nul en geen
        "Laden". Nul staat er ook als het scherm stuk is.
     2. Het platformregister beantwoordt de vier vragen waarvoor het bestaat:
        wat is het, wat doet het, staat het aan, en wat weten we ervan.
     3. Waar de status ONGEMETEN is, staat erbij dat dat een uitspraak over ONS
        is en niet over het ding. Precies die zin is de reden dat dit register
        geen geruststellende catalogus werd.
     4. Filteren werkt en verandert de telling. Een filter dat niets doet is
        erger dan geen filter: het suggereert dat je hebt gekeken.
     5. Het routedossier opent een route en toont zijn assen.

   MUTATIEBEWIJS (LAT.md regel 2 en 9: een toets die je niet hebt zien zakken is
   geen toets). Twee keer gebroken, twee keer gezakt:

     de zin "uitspraak over ons meetwerk" uit de UITLEG halen  -> 3 subtoetsen
        Het register leest dan als een oordeel over de app in plaats van over
        ons meetwerk. Dat is geen tekstkwestie: het is de reden dat dit scherm
        geen geruststellende catalogus werd.

     de status van de lijstregel weghalen                      -> 2 subtoetsen
        "Leden-app (algemeen) draagt geen status" -- en dat is precies de ene
        ontwerpregel van dit register: elk ding draagt er een.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, kantoorAlsPersoon, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

async function kantoorScherm(base, pad, kantoor, browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
  await ctx.addInitScript((tok) => {
    try { localStorage.setItem('rtg_office_token', tok); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
  }, kantoor);
  const page = await ctx.newPage();
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  return page;
}

test('het platformregister zegt van elk ding wat het is, wat het doet, of het aan staat en wat we ervan weten',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-platformreg-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-REG-1' } });
  let browser;
  try {
    const kantoor = await kantoorAlsPersoon(srv.base);
    assert.ok(kantoor, 'de eigenaar staat als persoon in de backoffice');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await kantoorScherm(srv.base, '/apps/platformregister.html', kantoor, browser);
    const fouten = [];
    letOpFouten(page, fouten);
    await page.waitForFunction(() => {
      const el = document.querySelector('#paginatel');
      return el && el.textContent && !/geen resultaten/.test(el.textContent);
    }, null, { timeout: 30000 });

    await t.test('de samenvatting draagt echte getallen en niet nul', async () => {
      const tekst = await page.$eval('#samenvatting', el => el.innerText);
      const getallen = (tekst.match(/\d[\d.]*/g) || []).map(x => Number(x.replace(/\./g, '')));
      assert.ok(getallen.some(n => n > 100),
        'er hoort een aantal van honderden dingen te staan, niet nul: ' + tekst.slice(0, 200));
    });

    await t.test('elk ding op de lijst draagt een naam, wat het doet, een stand en een status', async () => {
      const rijen = await page.$$eval('.ding', els => els.slice(0, 12).map(el => ({
        soort: (el.querySelector('.srt') || {}).textContent || '',
        naam: (el.querySelector('.nm') || {}).textContent || '',
        doet: (el.querySelector('.dt') || {}).textContent || '',
        stand: (el.querySelector('.knop') || {}).textContent || '',
        status: (el.querySelector('.rtg-status') || {}).textContent || ''
      })));
      assert.ok(rijen.length >= 5, 'er staan dingen op de lijst, nu ' + rijen.length);
      /* ELK DING DRAAGT EEN STATUS -- de ene ontwerpregel van dit register. Zonder
         die regel is het een catalogus, en aan een catalogus van 477 dingen heb
         je niets. */
      for (const r of rijen) {
        assert.ok(r.naam.trim(), 'een ding zonder naam: ' + JSON.stringify(r));
        assert.ok(r.status.trim(), r.naam + ' draagt geen status');
        assert.ok(r.stand.trim(), r.naam + ' zegt niet of hij aan staat');
      }
    });

    await t.test('de kaart van een ding beantwoordt de vier vragen, in die volgorde', async () => {
      await page.click('.ding');
      await page.waitForSelector('#kaart[open]', { timeout: 10000 });
      const kaart = await page.evaluate(() => ({
        naam: document.querySelector('#kNaam').textContent,
        soort: document.querySelector('#kSoort').textContent,
        labels: [...document.querySelectorAll('#kLijf .lb')].map(el => el.textContent),
        lijf: document.querySelector('#kLijf').innerText
      }));
      assert.ok(kaart.naam.trim() && kaart.soort.trim(), 'de kaart noemt het ding bij naam en soort');
      for (const vraag of ['Wat het doet', 'Aan of uit', 'Status', 'Waar']) {
        assert.ok(kaart.labels.includes(vraag), 'de kaart mist "' + vraag + '": ' + kaart.labels.join(' | '));
      }
      assert.strictEqual(kaart.labels.indexOf('Wat het doet') < kaart.labels.indexOf('Status'), true,
        'wat het doet komt voor de status; anders leest de kaart als een keuringsrapport');
      await page.click('#kSluit');
    });

    await t.test('waar de status ONGEMETEN is, staat erbij dat dat over ONS gaat', async () => {
      /* De zin die dit register van een geruststellende catalogus onderscheidt.
         Verdwijnt hij, dan leest "ongemeten" als een oordeel over de app. */
      await page.selectOption('#staat', 'ongemeten');
      await page.click('#zoeken');
      await page.waitForTimeout(800);
      const aantal = await page.$$eval('.ding', els => els.length);
      if (!aantal) return t.diagnostic('geen enkel ding staat op ongemeten; niets te controleren');
      await page.click('.ding');
      await page.waitForSelector('#kaart[open]', { timeout: 10000 });
      const lijf = await page.$eval('#kLijf', el => el.innerText);
      assert.match(lijf, /ongemeten/i);
      assert.match(lijf, /uitspraak over ons/i,
        'de uitleg bij ongemeten hoort te zeggen dat het over ons meetwerk gaat: ' + lijf.slice(0, 300));
      await page.click('#kSluit');
    });

    await t.test('een filter verandert de telling, anders suggereert het dat je hebt gekeken', async () => {
      await page.click('#wis');
      await page.waitForTimeout(800);
      const alles = await page.$eval('#filteruitleg', el => el.textContent);
      await page.selectOption('#staat', 'gezakt').catch(() => {});
      await page.fill('#zoek', 'bank');
      await page.click('#zoeken');
      await page.waitForTimeout(800);
      const gefilterd = await page.$eval('#filteruitleg', el => el.textContent);
      assert.notStrictEqual(alles, gefilterd, 'het filter verandert niets: "' + alles + '"');
      assert.match(gefilterd, /van \d/, 'de uitleg zegt hoeveel van hoeveel: ' + gefilterd);
    });

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    srv.child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('het routedossier opent een route en toont zijn assen',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-routedossier-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-REG-2' } });
  let browser;
  try {
    const kantoor = await kantoorAlsPersoon(srv.base);
    assert.ok(kantoor, 'de eigenaar staat als persoon in de backoffice');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await kantoorScherm(srv.base, '/apps/routedossier.html', kantoor, browser);
    const fouten = [];
    letOpFouten(page, fouten);
    await page.waitForFunction(() => {
      const el = document.querySelector('#paginatel');
      return el && el.textContent && !/geen resultaten/.test(el.textContent);
    }, null, { timeout: 30000 });

    await t.test('de lijst draagt duizenden routes, en dat getal komt van de server', async () => {
      const tel = await page.$eval('#paginatel', el => el.textContent);
      const n = Number((tel.match(/([\d.]+) routes/) || [0, '0'])[1].replace(/\./g, ''));
      assert.ok(n > 1000, 'er horen duizenden routes te staan, nu: ' + tel);
    });

    await t.test('een route opent en toont per as wat er van bekend is', async () => {
      await page.click('#lijst > *');
      await page.waitForSelector('#dossier[open]', { timeout: 10000 });
      const d = await page.evaluate(() => ({
        pad: document.querySelector('#dPad').textContent,
        methode: document.querySelector('#dMethode').textContent,
        lijf: document.querySelector('#dLijf').innerText
      }));
      assert.match(d.pad, /^\//, 'het dossier noemt het pad: ' + d.pad);
      assert.match(d.methode, /GET|POST|PUT|DELETE|PATCH/, 'en de methode: ' + d.methode);
      assert.ok(d.lijf.length > 80, 'het dossier zegt bijna niets: ' + d.lijf.slice(0, 120));
      await page.click('#dSluit');
    });

    await t.test('zoeken op een pad levert alleen dat pad op', async () => {
      await page.fill('#zoek', '/api/health');
      await page.click('#zoeken');
      await page.waitForTimeout(800);
      const uitleg = await page.$eval('#filteruitleg', el => el.textContent);
      assert.match(uitleg, /van [\d.]+/, 'de uitleg zegt hoeveel van hoeveel: ' + uitleg);
      const paden = await page.$$eval('#lijst > *', els => els.slice(0, 10).map(el => el.innerText));
      assert.ok(paden.length, 'zoeken op /api/health levert niets op');
      for (const p of paden) assert.match(p, /health/i, 'een resultaat dat niet bij de zoekterm hoort: ' + p);
    });

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    srv.child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
