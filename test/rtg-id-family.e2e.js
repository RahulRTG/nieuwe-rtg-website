/* De RTG ID-ballotage in haar echte browserstand: op een telefoon blijft de
   vraag boven de Edge-onderrand; op een breed scherm gebruikt identiteit links
   en gesprek rechts de ruimte. De proef vult uitsluitend twee niet-persoonlijke
   voorbeeldzinnen in en maakt geen account aan. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser
} = require('./helper');

const pw = laadPlaywright();

test('RTG ID vormt op telefoon en bureau een familie met de ene Edge',
  { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-id-vorm-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const maat of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport: maat });
      await context.addInitScript(() => {
        try { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      });
      const page = await context.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(srv.base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#agAnders', { state: 'visible', timeout: 15000 });
      await page.click('#agAnders');
      await page.waitForSelector('#agIn', { state: 'visible' });
      await page.fill('#agIn', 'ik wil me aanmelden');
      await page.click('#agGo');
      await page.waitForFunction(() => /Hoe gaat het vandaag/i.test(document.getElementById('agZin')?.textContent || ''));
      await page.fill('#agIn', 'goed');
      await page.click('#agGo');
      await page.waitForSelector('.ag-doos.ag-ballotage', { state: 'visible' });
      await page.waitForSelector('body[data-rtg-edge-2-rendered="true"]', { timeout: 15000 });

      const stand = await page.evaluate(() => {
        const rect = (el) => {
          const r = el && el.getBoundingClientRect();
          return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            width: r.width, height: r.height } : null;
        };
        const top = document.querySelector('.rtg-edge-top');
        const onder = document.querySelector('.rtg-edge-bottom');
        const vraag = document.getElementById('agZin');
        const rij = document.querySelector('.ag-doos.ag-ballotage .ag-rij');
        const stappen = document.getElementById('agStappen');
        const klok = document.querySelector('#gate>.os-lock .rtg-ring');
        const merk = document.querySelector('.rtg-edge-mark-lockup');
        const merkLink = document.querySelector('.rtg-edge-mark');
        const merkWoord = document.querySelector('.rtg-edge-mark-lockup strong');
        const verhaal = document.querySelector('.rtg-id-story');
        const verhaalKop = document.querySelector('.rtg-id-story h1');
        const intro = document.querySelector('.ag-doos.ag-ballotage .ag-intro');
        const kaart = document.querySelector('.ag-doos.ag-ballotage');
        const rail = document.querySelector('.rtg-edge-side');
        const commandBank = document.querySelector('#rtgCommand .cmd-bank');
        const commandBar = document.querySelector('#rtgCommand .cmd-balk');
        return {
          top: rect(top), onder: rect(onder), vraag: rect(vraag), rij: rect(rij),
          stappen: rect(stappen), klok: rect(klok),
          merk: rect(merk), merkTekst: merk && merk.textContent.replace(/\s+/g, ' ').trim(),
          verhaal: rect(verhaal), verhaalKop: rect(verhaalKop), kaart: rect(kaart),
          merkVlak: merkLink && getComputedStyle(merkLink).backgroundColor,
          woordVlak: merkWoord && getComputedStyle(merkWoord).backgroundColor,
          kaartKleur: kaart && getComputedStyle(kaart).backgroundColor,
          vraagKleur: vraag && getComputedStyle(vraag).backgroundColor,
          introKleur: intro && getComputedStyle(intro).backgroundColor,
          rijKleur: rij && getComputedStyle(rij).backgroundColor,
          railZichtbaar: rail && getComputedStyle(rail).visibility !== 'hidden',
          commandZichtbaar: [commandBank, commandBar].some(el => el && getComputedStyle(el).display !== 'none'),
          bovenkleur: top && getComputedStyle(top).backgroundColor,
          onderkleur: onder && getComputedStyle(onder).backgroundColor,
          label: stappen && stappen.getAttribute('aria-label'),
          randen: document.querySelectorAll('.rtg-edge-chrome').length
        };
      });

      assert.equal(stand.randen, 1, maat.width + ': precies een Edge-casco');
      assert.equal(stand.bovenkleur, stand.onderkleur, maat.width + ': boven en onder delen LivingOS-kleur');
      assert.equal(stand.label, 'Stap 1 van 4', maat.width + ': voortgang heeft betekenis');
      assert.ok(stand.merk && /Rahul Travel Group/i.test(stand.merkTekst),
        maat.width + ': het officiële woordmerk staat in de Edge-link');
      assert.equal(stand.merkVlak, 'rgba(0, 0, 0, 0)', maat.width + ': logo heeft geen eigen kleurvlak');
      assert.equal(stand.woordVlak, 'rgba(0, 0, 0, 0)', maat.width + ': woordmerk erft de balkkleur');
      assert.ok(stand.verhaal && stand.kaart && /244, 237, 225/.test(stand.kaartKleur),
        maat.width + ': verhaal en ivoorkleurige ballotagekaart staan in beeld');
      assert.equal(stand.vraagKleur, stand.kaartKleur,
        maat.width + ': achter de vraag ligt exact hetzelfde ivoor als op de kaart');
      assert.equal(stand.introKleur, stand.kaartKleur,
        maat.width + ': de vraagzone vormt geen lichter tekstvak');
      assert.equal(stand.rijKleur, 'rgba(0, 0, 0, 0)',
        maat.width + ': ook het antwoordveld voegt geen tweede vulkleur toe');
      assert.equal(stand.railZichtbaar, false, maat.width + ': geen tweede functierail tijdens RTG ID');
      assert.equal(stand.commandZichtbaar, false, maat.width + ': geen oude Command-laag tijdens RTG ID');
      assert.ok(stand.vraag && stand.rij && stand.stappen && stand.klok, maat.width + ': alle onderdelen staan in beeld');
      assert.ok(stand.vraag.top > stand.top.bottom - 1, maat.width + ': de vraag blijft onder Edge');
      assert.ok(stand.vraag.bottom <= stand.rij.top + 1, maat.width + ': de handeling volgt de vraag');
      assert.ok(stand.rij.bottom <= stand.stappen.top + 1, maat.width + ': voortgang volgt de handeling');
      assert.ok(stand.stappen.bottom < stand.onder.top + 1, maat.width + ': voortgang blijft boven Edge');
      if (maat.width < 900) {
        assert.ok(stand.vraag.left >= 12 && stand.vraag.right <= maat.width - 12,
          'telefoon: de vraag blijft binnen het leesvlak');
      } else {
        assert.ok(stand.klok.right < stand.vraag.left,
          'bureau: identiteit staat links en het gesprek rechts');
        const optischeTekstas = stand.verhaalKop.left + stand.verhaalKop.width * .43;
        assert.ok(Math.abs((stand.klok.left + stand.klok.right) / 2 - optischeTekstas) < 16,
        'bureau: de klok staat op het optische midden van de tekst (' +
          ((stand.klok.left + stand.klok.right) / 2).toFixed(1) + ' tegenover ' +
          optischeTekstas.toFixed(1) + ')');
      }
      assert.deepEqual(fouten, [], maat.width + ': geen paginof beloftefouten');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
