'use strict';
/* DE STAVING OP HET SCHERM: wat Rahul niet terugvond, staat onder zijn antwoord.

   De stuurlus geeft `staving` mee (server/kern/stuur/staving.js). Zonder scherm
   is dat een veld dat niemand leest. De Rahul-tab zet daarom onder het antwoord
   EEN ingetogen regel met wat NIET is teruggevonden in de gereedschappen van die
   beurt -- en niets als alles terugkwam, want een gevonden getal bewijst niet
   dat het in de juiste betekenis is gebruikt.

   Het antwoord van /api/fluister wordt in de browser nagemaakt: wat hier getoetst
   wordt is het SCHERM, niet het model. De server-kant staat in
   test/staving.test.js (toets 11 draait de echte stuurlus).

   MUTATIES GEZIEN ZAKKEN:
     a. rahul-tab.js geeft `noot` niet door aan voeg()        -> de regel ontbreekt
     b. helpers.noot() geeft ook zonder nietGevonden een regel -> tweede antwoord
     c. helpers.bericht() zet de noot zonder tekst() erin (geen escape) -> de
        <b> wordt een element in plaats van tekst */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, letOpFouten, wachtTot } = require('./helper');

const pw = laadScherm();

test('de Rahul-tab zet onder een antwoord wat niet is teruggevonden, en anders niets', { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-staving-scherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Staving Lid', email: 'staving' + process.pid + '@x.nl',
        phone: '0612345789', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }) });
    const reg = await r.json();
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);

    /* Twee antwoorden na elkaar: het eerste met iets dat niet terugkwam (en een
       stukje HTML dat als TEKST moet blijven), het tweede zonder. */
    const antwoorden = [
      { antwoord: 'Je hebt 3 afspraken en 99 herinneringen.', aiBeschikbaar: true,
        staving: { graad: 'onbekend', nietGevonden: ['99', '<b>x</b>'], ankers: [] } },
      { antwoord: 'Je hebt 3 afspraken.', aiBeschikbaar: true,
        staving: { graad: 'gemeten', nietGevonden: [], ankers: [] } }
    ];
    let n = 0;
    await ctx.route('**/api/fluister', (route) => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify(antwoorden[Math.min(n++, antwoorden.length - 1)]) }));

    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/mijn-neigingen.html', { waitUntil: 'domcontentloaded' });
    await wachtTot(page, () => !!window.RTGRahulTabHelpers && !!document.querySelector('.rtg-rahul-tab'),
      null, { wat: 'de Rahul-tab uit de gedeelde schil' });
    await page.locator('.rtg-rahul-tab').click();
    await wachtTot(page, () => { const p = document.querySelector('.rtg-rahul-page'); return !!p && !p.hidden; },
      null, { wat: 'het Rahul-paneel open' });

    const vraag = async (q) => {
      await page.locator('.rtg-rahul-page input[aria-label="Vraag Rahul"]').fill(q);
      await page.locator('.rtg-rahul-page input[aria-label="Vraag Rahul"]').press('Enter');
    };

    await vraag('Hoeveel afspraken heb ik?');
    await wachtTot(page, () => [...document.querySelectorAll('.rtg-command-msg')].some(m => /99 herinneringen/.test(m.textContent)),
      null, { wat: 'het eerste antwoord' });
    const noten = () => page.$$eval('.rtg-command-noot', (els) => els.map(e => e.textContent));
    const eerste = await noten();
    assert.equal(eerste.length, 1, 'onder het eerste antwoord staat een regel: ' + JSON.stringify(eerste));
    assert.match(eerste[0], /Niet teruggevonden in wat Rahul opzocht: 99, <b>x<\/b>\. Lees dat als onbekend\./);
    assert.equal(await page.$$eval('.rtg-command-noot b', (els) => els.length), 0,
      'wat uit het antwoord komt, is tekst en nooit opmaak');

    await vraag('En nu?');
    await wachtTot(page, () => [...document.querySelectorAll('.rtg-command-msg')]
      .some(m => /^RAHULJe hebt 3 afspraken\.$/.test(m.textContent.trim())), null, { wat: 'het tweede antwoord' });
    assert.equal((await noten()).length, 1, 'alles teruggevonden: dan komt er geen regel bij');
    assert.deepEqual(fouten, [], 'geen consolefouten');
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
