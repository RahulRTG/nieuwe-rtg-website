/* De professionele laag van het Onderzoekslab gebruikt de centrale Design
   System-owner. Deze schermproef bewaakt de grens die een broncontrole niet
   kan bewijzen: de echte pagina laadt het component, tekent de KPI's en toont
   de melding zonder tijdens runtime een eigen stijlblad te maken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, kantoorAlsPersoon, laadPlaywright, browserOpties,
  geenBrowser, letOpFouten, wachtTot } = require('./helper');

const pw = laadPlaywright();

test('Onderzoekslab gebruikt zijn centrale DS-owner zonder runtime-stijlinjectie',
  { skip: geenBrowser(pw) }, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lab-pro-ds-'));
    const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } });
    let browser;
    try {
      const token = await kantoorAlsPersoon(srv.base);
      assert.ok(token, 'een herleidbare kantoorsessie voor het Onderzoekslab');
      browser = await pw.chromium.launch(browserOpties(pw));
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce'
      });
      await context.addInitScript((t) => {
        localStorage.setItem('rtg_office_token', t);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_lang', 'nl');
      }, token);
      const page = await context.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(srv.base + '/apps/lab.html', { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.querySelectorAll('#labKpi .labkpi').length === 4,
        null, { wat: 'de vier KPI-kaarten uit de bestaande Lab-gegevens' });

      const stand = await page.evaluate(async () => {
        window.LabPro.meld('Project veilig vastgelegd');
        const melding = document.querySelector('.labmeld');
        const kpis = document.querySelector('.labkpis');
        const ingespoten = [...document.querySelectorAll('style')]
          .some((s) => s.textContent.includes('.labkpis') || s.textContent.includes('.labmeld'));
        const stijlverzoeken = performance.getEntriesByType('resource')
          .map((r) => new URL(r.name).pathname)
          .filter((p) => p.endsWith('.css'));
        const stijlbladen = [...document.querySelectorAll('link[rel="stylesheet"]')];
        const stijlteksten = await Promise.all(stijlbladen.map(async (l) => {
          try { return await (await fetch(l.href)).text(); } catch (_) { return ''; }
        }));
        return {
          owner: document.body.classList.contains('ds-onderzoekslab'),
          component: stijlbladen
            .some((l) => new URL(l.href).pathname === '/ds/componenten/onderzoekslab.css') ||
            stijlverzoeken.includes('/ds/componenten/onderzoekslab.css') ||
            stijlteksten.some((css) => css.includes('.ds-onderzoekslab .labkpis')),
          stijlbronnen: stijlbladen.map((l) => new URL(l.href).pathname),
          stijlverzoeken,
          ingespoten,
          kpiWeergave: getComputedStyle(kpis).display,
          meldingRol: melding.getAttribute('role'),
          meldingAan: melding.classList.contains('aan'),
          meldingBeweging: getComputedStyle(melding).transitionDuration
        };
      });

      assert.equal(stand.owner, true, 'het scherm draagt de begrensde DS-owner');
      assert.equal(stand.component, true, 'de centrale componentbron is geladen: ' + JSON.stringify({ links: stand.stijlbronnen, requests: stand.stijlverzoeken }));
      assert.equal(stand.ingespoten, false, 'lab-pro maakt geen runtime-stijlblad');
      assert.equal(stand.kpiWeergave, 'grid', 'de centrale eigenaar tekent de KPI-band');
      assert.equal(stand.meldingRol, 'status', 'de rustige melding blijft schermlezerfeedback');
      assert.equal(stand.meldingAan, true, 'de bestaande meldingsfunctie blijft bruikbaar');
      assert.ok(parseFloat(stand.meldingBeweging) <= 0.001,
        'reduced motion begrenst de overgang tot hooguit 1 ms: ' + stand.meldingBeweging);
      assert.deepEqual(fouten, [], 'het geconsolideerde scherm geeft geen browserfouten');
      await context.close();
    } finally {
      if (browser) await browser.close().catch(() => {});
      await stop(srv);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
