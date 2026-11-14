/* Echte bureau-PDA-flows op één gedeelde controller; geïsoleerde serverdata. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { alleenDs, beeld } = require('./lib/ds-toets');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

// Onafhankelijk productcontract: elk bureau heeft zijn eigen inhoud en uitvoer.
const BUREAUS = [
  { id: 'studio', pad: '/apps/studio-pda.html', ey: 'RTG Ontwerpstudio', h1: 'Studio PDA', api: '/api/office/studio', velden: ['silhouet','aandrijving'], kolommen: ['naam','discipline','status','huis','collectie','silhouet','aandrijving','kleuren','kritiek','aangemaakt','bijgewerkt'] },
  { id: 'hardware', pad: '/apps/hardware-pda.html', ey: 'RTG Hardwarelab', h1: 'Hardware PDA', api: '/api/office/hardware', velden: ['behuizing','chip'], kolommen: ['datum','naam','discipline','status','huis','behuizing','chip'] },
  { id: 'architect', pad: '/apps/architect-pda.html', ey: 'RTG Architectenbureau', h1: 'Architect PDA', api: '/api/office/architect', velden: ['typologie','constructie'], kolommen: ['naam','discipline','project','huis','status','typologie','constructie','aangemaakt'] }
];

test('de drie bureau-PDA’s behouden aanmaken, conceptdetails, filters en echte uitvoer',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bureau-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  let browser;
  try {
    const login = await (await fetch(base + '/api/office/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'RTG-OFFICE' })
    })).json();
    assert.ok(login.token, 'de kantoorinlog geeft een token');

    browser = await pw.chromium.launch(browserOpties(pw));
    for (const b of BUREAUS) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const fouten = [];
      letOpFouten(page, fouten);
      /* De verzoeken meelezen: zo bewijzen we dat dit scherm ECHT zijn eigen
         bureau aanspreekt en niet dat van de buurman -- de fout die je bij een
         samengevoegde werking het eerst zou maken. */
      const geraakt = new Set();
      page.on('request', (r) => { const u = r.url(); if (u.includes('/api/office/')) geraakt.add(new URL(u).pathname); });
      await page.addInitScript((t) => {
        localStorage.setItem('rtg_office_token', t);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, login.token);

      const lijstAntwoord = page.waitForResponse(r => r.url() === base + b.api && r.request().method() === 'POST');
      await page.goto(base + b.pad, { waitUntil: 'domcontentloaded' });
      const begin = await (await lijstAntwoord).json();
      await page.waitForFunction(() => {
        const c = window.RTGDesktopHome?.current;
        return document.body.dataset.rtgDesktopState === 'ready' && c?.runtime && c.cards && c.frame && document.querySelector('.ios-thuis');
      });
      await page.waitForFunction(() => {
        const e = document.querySelector('#pLijst');
        return e && !/Laden/.test(e.textContent);
      }, null, { timeout: 20000 });

      await alleenDs(page);
      assert.equal(await page.textContent('.ey'), b.ey, b.id + ': eigen eyebrow');
      assert.equal(await page.textContent('main h1'), b.h1, b.id + ': eigen titel');
      assert.ok(geraakt.has(b.api), b.id + ' vraagt zijn eigen bureau op (' + [...geraakt].join(',') + ')');
      for (const ander of BUREAUS) {
        if (ander.id === b.id) continue;
        assert.equal(geraakt.has(ander.api), false, b.id + ' hoort ' + ander.api + ' niet aan te spreken');
      }

      /* De drie routes delen nu de canonieke DS-filterbediening. Deze proef
         bewaakt dezelfde uniformiteit én de werkelijk bedienbare selectie;
         de vroegere lokale radius/uppercase-regels zijn bewust verwijderd. */
      const chip = await page.evaluate(() => {
        const c = document.querySelector('#pFilters .chip');
        if (!c) return null;
        return { canonical: c.classList.contains('ds-chip'),
          pressed: c.getAttribute('aria-pressed'), height: c.getBoundingClientRect().height };
      });
      assert.ok(chip, b.id + ': de disciplinerij is getekend');
      assert.equal(chip.canonical, true, b.id + ': gedeelde DS-filter');
      assert.equal(chip.pressed, 'true', b.id + ': Alle is herkenbaar geselecteerd');
      assert.ok(chip.height >= 44, b.id + ': toegankelijk DS-aanraakvlak');

      const [discipline, ander] = begin.disciplines;
      assert.ok(discipline && ander, b.id + ': twee echte disciplines voor de filterproef');
      async function maak(cat, naam) {
        await page.selectOption('#pCat', cat.id);
        await page.fill('#pNaam', naam);
        await page.fill('#pBrief', 'Een rustig ontwerp voor dagelijks gebruik.');
        const [response] = await Promise.all([
          page.waitForResponse(r => r.url() === base + b.api + '/concept' && r.request().method() === 'POST'),
          page.click('#pMaak')
        ]);
        assert.equal(response.status(), 200);
        const ontwerp = (await response.json()).ontwerp;
        assert.equal(ontwerp.naam, naam);
        assert.equal(ontwerp.discipline, cat.id);
        await page.waitForFunction(id => document.querySelector('[data-concept="' + id + '"]')?.textContent === 'Herteken', ontwerp.id);
        assert.equal(await page.inputValue('#pNaam'), '');
        return ontwerp;
      }
      const eigen = await maak(discipline, 'PDA ' + b.id + '; "licht"');
      const andere = await maak(ander, 'PDA ' + b.id + ' andere discipline');
      await page.click('#pFilters [data-f="' + discipline.id + '"]');
      assert.equal(await page.getAttribute('#pFilters [data-f="' + discipline.id + '"]', 'aria-pressed'), 'true');
      const kaart = page.locator('#pLijst > .ds-sectie').filter({ has: page.locator('[data-concept="' + eigen.id + '"]') });
      assert.equal(await kaart.isVisible(), true);
      for (const veld of b.velden) assert.ok((await kaart.textContent()).includes(eigen.concept[veld]), b.id + ': zichtbaar conceptdetail ' + veld);
      assert.equal(await page.locator('[data-concept="' + andere.id + '"]').count(), 0);
      const namen = [eigen.naam, ...begin.ontwerpen.filter(o => o.discipline === discipline.id).map(o => o.naam)].sort();
      assert.equal(await page.locator('#pLijst > .ds-sectie').count(), namen.length);

      for (const width of [390, 820, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await alleenDs(page);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          b.id + ': geen horizontaal inhoudsverlies op ' + width);
        const iconen = await page.locator('#pLijst .gl-inline, #pFilters .gl-inline').evaluateAll(lijst => lijst.map(el => {
          const r = el.getBoundingClientRect(), css = getComputedStyle(el);
          return { breed: r.width, hoog: r.height, tekst: parseFloat(css.fontSize), verborgen: el.getAttribute('aria-hidden') };
        }));
        assert.ok(iconen.length, b.id + ': echte discipline- en concepticonen');
        for (const icoon of iconen) {
          assert.ok(icoon.breed > 0 && icoon.breed <= icoon.tekst * 1.2 && icoon.hoog > 0 && icoon.hoog <= icoon.tekst * 1.2,
            b.id + ': pictogram blijft bij de tekstmaat op ' + width + ': ' + JSON.stringify(icoon));
          assert.equal(icoon.verborgen, 'true', 'de naastliggende tekst geeft de betekenis');
        }
        await beeld(page, b.id + '-pda-' + width);
        const knop = page.locator('.rtguitvoer-knop');
        await knop.click();
        const dialoog = page.locator('.rtguitvoer-laag');
        await dialoog.waitFor({ state: 'visible' });
        const toestand = await dialoog.evaluate(el => {
          const r = el.querySelector('.rtguitvoer-blad').getBoundingClientRect();
          return { rol: el.getAttribute('role'), modaal: el.getAttribute('aria-modal'),
            focus: document.activeElement.getAttribute('data-vorm'),
            inBeeld: r.left >= 0 && r.right <= innerWidth + .5 && r.top >= 0 && r.bottom <= innerHeight + .5 };
        });
        assert.deepEqual(toestand, { rol: 'dialog', modaal: 'true', focus: 'csv', inBeeld: true }, b.id + ': export bereikbaar op ' + width);
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(() => document.activeElement.classList.contains('rtguitvoer-sluit')), true);
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-vorm')), 'csv');
        if (width === 390) for (const vorm of ['json','csv']) {
          const [download] = await Promise.all([page.waitForEvent('download'), dialoog.locator('[data-vorm="' + vorm + '"]').click()]);
          assert.equal(download.suggestedFilename(), 'rtg-' + b.id + '-pda.' + vorm);
          const bestand = path.join(TMP, b.id + '.' + vorm);
          await download.saveAs(bestand);
          const inhoud = fs.readFileSync(bestand, 'utf8');
          if (vorm === 'json') {
            const regels = JSON.parse(inhoud);
            assert.deepEqual(regels.map(r => r.naam).sort(), namen, 'uitvoer volgt echte disciplinefilter');
            assert.deepEqual(Object.keys(regels[0]), b.kolommen);
            const regel = regels.find(r => r.naam === eigen.naam);
            for (const veld of b.velden) assert.equal(regel[veld], eigen.concept[veld]);
          } else {
            assert.equal(inhoud.split('\r\n')[0], b.kolommen.join(';'));
            assert.ok(inhoud.includes('"' + eigen.naam.replace(/"/g, '""') + '"'), 'CSV bewaart puntkomma en aanhalingstekens');
            assert.equal(inhoud.includes(andere.naam), false);
          }
          assert.match(await dialoog.textContent(), new RegExp(namen.length + ' regels meegenomen als ' + vorm.toUpperCase()));
        }
        await page.keyboard.press('Escape');
        await dialoog.waitFor({ state: 'hidden' });
        assert.equal(await knop.evaluate(el => document.activeElement === el), true, 'Escape herstelt focus naar Meenemen');
      }
      await page.click('#pFilters [data-f=""]');
      assert.equal(await page.locator('[data-concept="' + andere.id + '"]').count(), 1, 'Alle herstelt ook de andere discipline');

      assert.deepEqual(fouten, [], 'geen JS-fouten op ' + b.pad);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
