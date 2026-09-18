/* DRAAGT EEN CONTRASTMELDING GENOEG OM HEM TE KUNNEN REPAREREN?

   Deze toets bestaat door een rode CI die achteraf niet meer te herleiden was.
   `Schermtoetsen deel 1 van 4` zakte op 2,09:1, de herstart slaagde, en het
   scherm bleef daarna vijf rondes achter elkaar groen. Wat er in de melding
   stond was een verhouding en twee kleuren; wat er NIET in stond is de enige
   vraag die ertoe doet -- stond de INKT van de ene wereld op de KAART van een
   andere, of was het iets heel anders?

   De wereldtokens hangen aan twee attributen tegelijk
   (`body[data-rtg-skin][data-rtg-world]`) en er zijn drie plekken die de wereld
   schrijven. Welke stand er gold op het moment van meten is een halve seconde
   later niet meer te zien. Dus wordt hij nu MEEGESCHREVEN.

   WAT HIER BEWUST NIET GEBEURT: de oorzaak van die 2,09:1 repareren. Die is niet
   gereproduceerd, en een reparatie die je niet hebt zien werken is een gok met
   de toon van een oplossing. Wat hier wordt aangetoond is dat de VOLGENDE rode
   zichzelf verklaart.

   De opstelling bouwt de gemelde vorm na: de lichte LivingOS-inkt op een donkere
   kaart. Dat reproduceert het SYMPTOOM en niet de oorzaak, en dat is precies
   genoeg om de vangst te beproeven.

   Draait alleen waar een browser is. Los: node --test test/contrastcontext.e2e.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, wachtOpNetstilte } = require('./helper');
const { BRON } = require('../scripts/a11ykeuring');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contrastcontext-'));
const KEUR = '(function(){' + BRON + '\nreturn window.__a11yKeur()})()';

test('een contrastmelding noemt de wereld, de tokens en de ondergrond',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();

    /* Hetzelfde meetscherm als test/a11y-hermeet.e2e.js, en om dezelfde reden:
       het is zelf schoon, dus wat er gemeten wordt komt van deze toets en niet
       van de pagina. Meldt het scherm zelf iets, dan zegt de toets dat. */
    await page.goto(srv.base + '/site/404.html', { waitUntil: 'domcontentloaded' });
    await wachtOpNetstilte(page);
    const schoon = await page.evaluate(KEUR);
    assert.equal(schoon.contrast.reduce((n, v) => n + v.aantal, 0), 0, 'het meetscherm is zelf niet schoon');

    /* DE STIJL LAADT PLAYWRIGHT, NIET DE PAGINA ZELF.

       Hier stond een <link> met een eigen onload-belofte eromheen. Dat HING: een
       page.evaluate kent geen tijdslimiet, dus als onload en onerror allebei
       uitblijven wacht de toets oneindig -- geen rode uitslag, geen groene, een
       toets die niets meet en die niemand kan laten zakken. Dat is de ergste
       soort: hij ziet er in een lijst uit als een toets.

       De inhoud als tekst injecteren werkt hier NIET: het huis draait op
       `default-src 'self'` en een inline <style> wordt door de CSP geweigerd
       (`page.addStyleTag: Event`). Dus gaat hij als URL naar dezelfde herkomst --
       toegestaan door de CSP, en Playwright wacht zelf op het laden. Geen eigen
       belofte, geen oneindige wacht. */
    await page.addStyleTag({ url: srv.base + '/shared/rtg-heritage.css' });

    /* De gemelde vorm nagebouwd: de Heritage-skin met LivingOS erop (de lichte
       kamer), en daarin een kaart die donker is. De tekst pakt --rtg-world-muted
       en staat daarmee op 2,09:1 -- precies het beeld uit de rode CI. */
    await page.evaluate(() => {
      document.body.setAttribute('data-rtg-skin', 'heritage');
      document.body.setAttribute('data-rtg-world', 'living');
      const kaart = document.createElement('div');
      kaart.className = 'donkere-kaart';
      kaart.style.background = '#171310';
      kaart.style.padding = '20px';
      const regel = document.createElement('p');
      regel.id = 'meetregel';
      regel.style.color = 'var(--rtg-world-muted)';
      regel.style.fontSize = '14px';
      regel.textContent = 'Een regel om aan te meten';
      kaart.appendChild(regel);
      document.body.appendChild(kaart);
    });
    const uit = await page.evaluate(KEUR);

    const gevonden = uit.contrast.reduce((n, v) => n + v.aantal, 0);
    assert.ok(gevonden > 0, 'de opstelling levert geen contrastfout op; dan bewijst deze toets niets');
    const waar = uit.contrast.map(v => v.waar.join(' ')).join(' ');
    assert.match(waar, /#meetregel/, 'de melding noemt het element niet');

    /* DE VIER DINGEN DIE ER EERST NIET IN STONDEN. Elk van de vier beantwoordt
       een vraag die je bij een rode CI als eerste stelt en die uit een
       verhouding alleen nooit te beantwoorden was. */
    assert.match(waar, /wereld=living/, 'de wereld staat niet in de melding');
    assert.match(waar, /skin=heritage/, 'de skin staat niet in de melding');
    assert.match(waar, /muted=/, 'de wereldtokens staan niet in de melding');
    assert.match(waar, /grond van: [^|\]]*donkere-kaart/, 'het element dat de ondergrond zet, staat er niet bij');

    /* En de token die de melding noemt is de ECHTE waarde van deze wereld, niet
       een naam die toevallig meeloopt: zonder deze rij zou `muted=` ook groen
       blijven met een lege of doorgegeven waarde. */
    assert.match(waar, /muted=\s*#51493f/i, 'de gemelde tokenwaarde is niet die van LivingOS');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(srv);
  }
});
