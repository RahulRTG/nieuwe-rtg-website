/* ============================================================================
   DE CSP ZOALS EEN BROWSER HEM ERVAART.

   Een Content-Security-Policy is de enige beveiliging in dit huis die je niet
   kunt aantonen door de code te lezen. Wat telt is wat de BROWSER weigert, en
   of de pagina daarna nog werkt. Twee dingen kunnen misgaan en ze zien er van
   buiten hetzelfde uit:

     1. de regel is te slap -- hij staat er, maar laat alles door;
     2. de regel is te streng -- hij blokkeert iets van onszelf, en de pagina
        verliest stil haar opmaak of een stuk gedrag.

   Deze toets meet allebei. Hij luistert in de pagina naar
   `securitypolicyviolation` -- de gebeurtenis die de browser zelf afvuurt bij
   elke blokkade -- en eist er NUL. Daarnaast leest hij de kop en eist dat
   script-src en style-src geen 'unsafe-inline' dragen.

   WAAROM securitypolicyviolation EN NIET de console. Een CSP-blokkade komt ook
   in de console terecht, maar daar staat hij tussen alle andere meldingen en is
   hij afhankelijk van de formulering van de browser. De gebeurtenis draagt de
   geschonden richtlijn en het geblokkeerde adres als velden. Dat is een feit en
   geen tekstzoektocht.

   Draait alleen waar een browser is; anders overgeslagen.
   Draai: npm run e2e
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

/* De vlaggenschepen, plus de voordeur zelf. Die laatste staat er met opzet bij:
   de kop van middleware/voordeur.js beschrijft hoe "/" ooit terugviel op de
   losse CSP en daarmee de zwakste regel van het hele huis kreeg. */
const PAGINAS = ['/', '/apps/app.html', '/apps/index.html', '/apps/boardroom.html',
  '/apps/leverancier.html', '/apps/backoffice.html', '/apps/personeel.html',
  '/apps/rtmail.html', '/apps/salon.html', '/apps/office.html', '/apps/berichten.html',
  '/apps/metier.html', '/apps/genootschap.html', '/apps/vonk.html', '/apps/muziek.html',
  '/apps/theater.html', '/apps/clips.html', '/apps/ov.html', '/apps/wbw.html',
  '/apps/passkeys.html', '/apps/ghost.html', '/apps/flits.html', '/apps/podium.html',
  '/apps/foundation/index.html', '/apps/foundation/school.html', '/site/404.html'];

test('de CSP: geen unsafe-inline, en geen enkele blokkade van ons eigen werk',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-csp-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext();
    const alles = [];
    for (const pad of PAGINAS) {
      const page = await ctx.newPage();
      /* Vroeg genoeg om de eerste stijl van de pagina nog mee te krijgen: dit
         draait voor elk script van de pagina zelf. */
      await page.addInitScript(() => {
        window.__cspFouten = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__cspFouten.push({
            richtlijn: e.effectiveDirective || e.violatedDirective,
            bron: String(e.blockedURI || '').slice(0, 120),
            regel: e.lineNumber, bestand: String(e.sourceFile || '').slice(0, 160)
          });
        });
      });
      const antwoord = await page.goto(srv.base + pad, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const kop = antwoord.headers()['content-security-policy'] || '';
      assert.ok(kop, pad + ' draagt een Content-Security-Policy');

      const stuk = (naam) => {
        const m = new RegExp('(?:^|;)\\s*' + naam + '\\s([^;]*)').exec(kop);
        return m ? m[1].trim() : null;
      };
      const script = stuk('script-src');
      assert.ok(script && !/'unsafe-inline'/.test(script),
        pad + ': script-src zonder unsafe-inline, maar is: ' + script);
      assert.ok(/'nonce-/.test(script), pad + ': script-src draagt een nonce, maar is: ' + script);
      const stijl = stuk('style-src');
      assert.ok(stijl && !/'unsafe-inline'/.test(stijl),
        pad + ': style-src zonder unsafe-inline, maar is: ' + stijl);

      /* Even laten draaien: veel opmaak wordt pas door een script gezet, en een
         blokkade daarvan komt dus na het laden. Wachten op de netwerkrust is
         hier het juiste signaal -- daarna is alles wat de pagina zelf ophaalt
         binnen. */
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      const fouten = await page.evaluate(() => window.__cspFouten || []);
      for (const f of fouten) alles.push(pad + ' -> ' + f.richtlijn + ' blokkeerde ' + f.bron +
        (f.bestand ? ' (' + f.bestand + ':' + f.regel + ')' : ''));
      await page.close();
    }
    assert.deepEqual(alles, [],
      'de browser blokkeerde ' + alles.length + ' keer iets van onszelf:\n  ' + alles.join('\n  '));
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
