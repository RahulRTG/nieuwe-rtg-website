/* Schermtoets voor de Regie van de zaak: hetzelfde scherm hangt in de zaak-app
   (leverancier.html, breed) en in de personeels-PDA (personeel.html, duimstand),
   en beide moeten opkomen zonder onopgevangen JS-fouten.

   WAAROM DIT EEN SCHERMTOETS NODIG HEEFT. Het scherm staat in vier
   deelbestanden die bij de build aaneen worden geplakt, en de werkplekken
   hangen in een tekenaarstabel die over twee van die delen loopt. Een knip op
   de verkeerde plek geeft een ReferenceError op precies één knop -- op de
   server is dan alles groen. De toets klikt daarom elke werkplek aan.

   Draait alleen waar Playwright (of onze eigen CDP-driver) beschikbaar is.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })).json();
}

/* De manager-inlog van een demozaak: dezelfde weg die test/apps-ui.e2e.js loopt. */
async function managerToken(base) {
  const roster = await post(base, '/api/supplier/roster', { code: 'KIKUNOI' });
  const man = (roster.staff || []).find(x => x.role === 'manager');
  assert.ok(man, 'de demozaak heeft een manager op het rooster');
  const login = await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
  assert.ok(login.token, 'de manager kan inloggen');
  return login.token;
}

async function metScherm(opts) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regie-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    const token = await managerToken(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage(opts.viewport ? { viewport: opts.viewport } : {});
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((kv) => {
      for (const k in kv) localStorage.setItem(k, kv[k]);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, opts.sleutels(token));
    /* `domcontentloaded` en niet `load`: `load` wacht op ELK subverzoek -- elk
       plaatje, elk lettertype -- terwijl beide aanroepers hieronder als eerste
       op het echte teken wachten (de poort die dichtgaat, `#gate` verborgen).
       Onder belasting valt `load` om op zijn eigen tijdslimiet, en dan is de
       uitslag rood zonder dat er iets stuk is (TAKEN.md 4.39). */
    await page.goto(base + opts.pad, { waitUntil: 'domcontentloaded' });
    await opts.doe(page);
    assert.deepEqual(fouten, [], 'geen JS-fouten op ' + opts.pad);
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('Zaak-app: de Regie komt op en elke werkplek tekent',
  { skip: geenBrowser(pw) }, async () => {
  await metScherm({
    pad: '/apps/leverancier.html',
    sleutels: (t) => ({ rtg_sup_token: t }),
    doe: async (page) => {
      await page.waitForSelector('#gate', { state: 'hidden', timeout: 20000 });
      /* De Regie zit onder "Meer" (MAIN_TABS is home/kassa/ai/gchat/meer). We
         klikken hem via de knop die dat scherm zelf tekent -- en via evaluate,
         want op een breed scherm ligt die knop achter de meer-weergave en gaat
         het ons hier om wat er DAARNA getekend wordt, niet om de navigatie. */
      await page.waitForFunction(() => !!document.querySelector('[data-goto2="regie"]'), null, { timeout: 15000 });
      await page.evaluate(() => document.querySelector('[data-goto2="regie"]').click());
      await page.waitForSelector('#regieWrap .zc-rail button', { timeout: 15000 });
      /* De stand komt uit /api/supplier/command/start; staat er nog "Laden",
         dan is het verzoek wel gedaan maar niet beantwoord. */
      await page.waitForFunction(() => {
        const e = document.querySelector('#regieWrap .zc-vak');
        return e && !/Laden/.test(e.textContent);
      }, null, { timeout: 15000 });
      const werkplekken = await page.evaluate(() =>
        [...document.querySelectorAll('#regieWrap .zc-rail button')].map(b => b.dataset.w));
      assert.deepEqual(werkplekken, ['nu', 'lijst', 'recht', 'zoek', 'regels'],
        'de brede stand toont vijf werkplekken: ' + werkplekken.join(','));
      for (const w of werkplekken) {
        await page.click('#regieWrap .zc-rail button[data-w="' + w + '"]');
        await page.waitForFunction(() => {
          const e = document.querySelector('#regieWrap .zc-vak');
          return e && e.textContent.trim().length > 0 && !/Laden/.test(e.textContent);
        }, null, { timeout: 10000 });
      }
    }
  });
});

test('Personeels-PDA: dezelfde Regie in duimstand, met drie werkplekken',
  { skip: geenBrowser(pw) }, async () => {
  await metScherm({
    pad: '/apps/personeel.html',
    viewport: { width: 390, height: 844 },
    sleutels: (t) => ({ rtg_pda_token: t, rtg_pda_code: 'KIKUNOI' }),
    doe: async (page) => {
      /* DE ECHTE WEG OP EEN TELEFOON LOOPT NIET LANGS DE TABBALK. De Werk-OS-laag
         (shared/werkos) neemt op de personeels-app de schil over: hij verbergt de
         tabbalk (`body.wos .tabbar{display:none !important}`, werkos-01.js:17) en
         bouwt er een springboard van tegels uit -- de tabknoppen blijven het
         model, ze zijn alleen niet meer wat je aanraakt.

         Dus toetsen we wat een medewerker echt doet: de tegel op het beginscherm
         aantikken. Wachten op de tabknop zou hier eeuwig duren, en dat zou niets
         zeggen over de Regie. */
      await page.waitForSelector('#gate', { state: 'hidden', timeout: 40000 });
      const tegel = page.locator('nav.wos-grid button.wos-app', { hasText: 'Regie' });
      await tegel.first().waitFor({ state: 'visible', timeout: 25000 });
      await tegel.first().click();
      await page.waitForSelector('#pdRegieWrap .zc-rail button', { timeout: 15000 });
      await page.waitForFunction(() => {
        const e = document.querySelector('#pdRegieWrap .zc-vak');
        return e && !/Laden/.test(e.textContent);
      }, null, { timeout: 15000 });
      const werkplekken = await page.evaluate(() =>
        [...document.querySelectorAll('#pdRegieWrap .zc-rail button')].map(b => b.dataset.w));
      assert.deepEqual(werkplekken, ['nu', 'lijst', 'zoek'],
        'op de telefoon staan er drie: ' + werkplekken.join(','));
      /* De duimstand moet ook echt smal zijn: één kolom tegels naast elkaar,
         niet de brede rasterindeling. */
      const breed = await page.evaluate(() => {
        const t = document.querySelector('#pdRegieWrap .zc-tegel');
        return t ? Math.round(t.getBoundingClientRect().width) : 0;
      });
      assert.ok(breed > 100 && breed < 260, 'de tegels zijn duimbreed (' + breed + 'px)');
      for (const w of werkplekken) {
        await page.click('#pdRegieWrap .zc-rail button[data-w="' + w + '"]');
        await page.waitForFunction(() => {
          const e = document.querySelector('#pdRegieWrap .zc-vak');
          return e && e.textContent.trim().length > 0 && !/Laden/.test(e.textContent);
        }, null, { timeout: 10000 });
      }
    }
  });
});
