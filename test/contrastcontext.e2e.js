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
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, wachtOpNetstilte, letOpFouten } = require('./helper');
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

    /* Injecteer de historische verkeerde tekstinkt expliciet. De huidige Living-
       kleuren hebben goed contrast en mogen geen defectfixture zijn. Zo blijft
       de negatieve proef onafhankelijk van een toekomstige paletverbetering. */
    await page.evaluate(() => {
      document.body.setAttribute('data-rtg-skin', 'heritage');
      document.body.setAttribute('data-rtg-world', 'living');
      const kaart = document.createElement('div');
      kaart.className = 'donkere-kaart';
      kaart.style.background = '#171310';
      kaart.style.padding = '20px';
      kaart.style.cssText += ';position:fixed;top:150px;left:30px;z-index:9999';
      const regel = document.createElement('p');
      regel.id = 'meetregel';
      regel.style.color = '#5e5c57';
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
    assert.match(waar, /muted=\s*#cbbdab/i, 'de gemelde tokenwaarde is niet die van LivingOS');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(srv);
  }
});

/* De twee echte regressies deelden hun oorzaak: lokale donkere inkt bleef
   staan nadat de kaart de donkere wereldgrond kreeg. Meet de echte ingelogde
   routes, inclusief de Vitaal-omleiding, en niet een nagebouwde kleurfixture. */
test('Bestellen en Vitaal houden leesbare inhoud in alle drie de thema’s',
  { skip: geenBrowser(pw) }, async (t) => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Contrastproef', email: 'contrast' + Date.now() + '@x.nl',
        phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'een echte proefsessie is vereist');
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const thema of ['champagne', 'bordeaux', 'royal']) {
      const ctx = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce',
        viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript(({ token, thema }) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_thema_v2', thema);
      }, { token: reg.token, thema });
      try {
        for (const route of ['bestellen', 'vitaal']) await t.test(thema + ' / ' + route, async () => {
          const page = await ctx.newPage(), fouten = [];
          letOpFouten(page, fouten);
          try {
            await page.goto(srv.base + '/apps/' + route + '.html', { waitUntil: 'domcontentloaded' });
            const sel = route === 'bestellen' ? '#ontdekGroepen button' : '#log .stil';
            await page.waitForFunction(({ route, sel }) => {
              const els = [...document.querySelectorAll(sel)];
              return route === 'bestellen' ? els.length === 3 :
                els.length === 1 && els[0].textContent === 'Nog niets. Zo hoort het.';
            }, { route, sel });
            if (route === 'vitaal') assert.equal(new URL(page.url()).hash, '#vitaal');
            await page.locator(sel).first().scrollIntoViewIfNeeded();
            await wachtOpNetstilte(page);
            await page.evaluate(() => document.fonts.ready);
            const keur = await page.evaluate(KEUR);
            assert.deepEqual(keur.contrast, [], JSON.stringify(keur.contrast));
            assert.deepEqual(fouten, [], 'geen paginafouten');
          } finally { await page.close(); }
        });
      } finally { await ctx.close(); }
    }
  } finally {
    if (browser) await browser.close();
    await stop(srv);
  }
});
