/* HET LEDENSCHERM VAN RTG COMMERCE IN EEN ECHTE BROWSER: de mand en de weg terug.

   WAAROM DEZE TOETS BESTAAT

   test/commerce-scherm.e2e.js legt het ONDERNEMERSscherm af
   (/apps/leverancier-commerce.html). Het ledenscherm /apps/commerce.html --
   de etalage, de mand en het retourformulier -- had geen enkele toets die de
   weg werkelijk aflegde; scripts/schermen.js telde hem als scherm zonder
   eigen toets. De commerce-kern heeft servertoetsen genoeg, maar die bewijzen
   niet dat een lid met zijn sessie de mand vult langs dezelfde API en daarna
   op het scherm leest wat COMMERCE.md belooft.

   WAT DIT VASTLEGT, EN WELKE GRENS

   1. EEN MAND IS NIET EEN BEVESTIGING (COMMERCE.md par. 5). Met twee
      verkopers in de mand toont het scherm twee afrekeningen, elk met zijn
      eigen deur, en de zin van de server dat elk zijn eigen deel bevestigt en
      RTG niets namens hen. Er staat nergens een knop "betaal alles".
   2. WAT NIET TE KOOP IS KRIJGT GEEN KNOP MAAR EEN REDEN. De etalage van een
      restaurant toont zijn zaak onder "staat er niet bij" met de uitleg
      erbij, en zonder "In de mand".
   3. EEN RETOUR WORDT KLAARGEZET EN NIET UITGEVOERD (COMMERCE.md par. 6,
      GELD.md par. 3). Een aanvraag zonder bestelkenmerk wordt geweigerd MET
      reden op het scherm; een goede aanvraag staat daarna in de stand
      "gevraagd", zonder besluit, zonder bedrag dat als betaald leest en
      zonder knop waarmee de koper hem zelf verder duwt -- en de server weigert
      dat laatste ook als je het buiten het scherm om probeert.

   NIET BEPROEFD: de overdracht naar de deur van het domein (shared/overdracht.js
   heeft zijn eigen toets) en de verkoperskant van de retour (die staat achter
   supplierAuth, in test/commerce-retour.test.js).

   Draai los: node --test test/commerce-mand-scherm.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('RTG Commerce: een lid vult zijn mand bij twee verkopers, leest dat RTG niets bevestigt, en zet een retour klaar',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-commerce-mand-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    let browser;
    try {
      const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
      const reg = await post(base, '/api/auth/register', { name: 'Koper', email: 'cm' + u + '@x.nl',
        phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const lid = reg.body.token;

      /* Een TWEEDE verkoper met iets dat te bevestigen is, uit dezelfde bron
         als het scherm (het aanbod van de server) en niet uit een vaste code:
         de koopbaar-id's veranderen per server, en welke zaken er zijn is van
         de zaaiset. Maison Solène is de eerste (die heeft ook retour). */
      const aanbod = await post(base, '/api/commerce/aanbod', {}, lid);
      const tweede = (aanbod.body.koopbaren || []).find(k => k.aanbieder && k.aanbieder.code
        && k.aanbieder.code !== 'MAISON' && (k.werkwoorden || []).includes('bevestig')
        && !k.prijsvraag && k.prijs && k.prijs.bedrag > 0 && !k.prijs.vanaf);
      assert.ok(tweede, 'de zaaiset heeft een tweede verkoper met iets dat te kopen is');

      browser = await pw.chromium.launch(browserOpties(pw));
      const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, lid);
      const page = await ctx.newPage();
      const fouten = letOpFouten(page, []);
      /* EEN ANDERE VERKOPER KIEZEN, EN WACHTEN OP DIE VERKOPER. tekenEtalage()
         zet eerst "Laden…" en vervangt #etalage pas als het antwoord er is; wie
         alleen op een .waarom of een knop wacht, kan de etalage van de VORIGE
         verkoper te pakken krijgen. Onder belasting gebeurde dat ook (gate van
         2 september 2026: de "Op aanvraag"-regel van de eerste verkoper stond
         nog toen KIKUNOI gekozen was). Daarom: het antwoord voor precies deze
         code afwachten, en daarna de kop "Te koop" van de nieuwe etalage. */
      const kies = async (code) => {
        const klaar = page.waitForResponse(r => r.url().endsWith('/api/commerce/etalage')
          && String(r.request().postData() || '').includes('"' + code + '"'), { timeout: 20000 });
        await page.selectOption('#kies', code);
        assert.equal((await klaar).status(), 200, 'de etalage van ' + code + ' komt van de server');
        await page.waitForFunction(() => /^Te koop/.test((document.querySelector('#etalage') || { textContent: '' }).textContent.trim()),
          null, { timeout: 15000 });
      };
      await page.goto(base + '/apps/commerce.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('#kies option[value]').length > 0
        && document.querySelectorAll('#meters .meter').length === 8, null, { timeout: 20000 });
      assert.match(await page.locator('#meting-n').textContent(), /\d+ koopbaren/, 'de meting telt de levende koopbaren');

      /* ---- 2. niet te koop: een reden, geen knop ---- */
      await kies('KIKUNOI');
      const waaroms = await page.locator('#etalage .waarom').allTextContents();
      assert.ok(waaroms.some(w => /Een zaak is geen artikel/.test(w)),
        'de reden komt van de server en staat op het scherm: ' + waaroms.join(' | '));
      assert.equal(await page.locator('#etalage [data-in]').count(), 0, 'wat niet te koop is krijgt geen "In de mand"');

      /* ---- 1. de mand: twee verkopers, twee deuren, geen "betaal alles" ---- */
      await kies('MAISON');
      await page.waitForSelector('#etalage [data-in]', { state: 'visible', timeout: 20000 });
      const eerste = page.locator('#etalage .rij').filter({ has: page.locator('[data-retour]') }).first();
      assert.ok(await eerste.count(), 'Maison Solène heeft een artikel dat terug kan');
      const eersteTitel = (await eerste.locator('h3').first().textContent()).trim();

      let gezet = page.waitForResponse(r => r.url().endsWith('/api/commerce/mand/zet'));
      await eerste.locator('[data-in]').click();
      assert.equal((await gezet).status(), 200, 'in de mand via het scherm lukt');
      await page.waitForFunction(() => document.querySelectorAll('#mand .afrek').length === 1, null, { timeout: 15000 });
      let mand = await page.locator('#mand').textContent();
      assert.match(mand, /Maison Solène/, 'de afrekening draagt de naam van de verkoper');
      assert.match(mand, new RegExp(eersteTitel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'en de regel die erin ging');
      assert.match(mand, /in totaal, maar dat is een optelsom om te tonen, geen bedrag dat je in één keer bevestigt/,
        'het totaal zegt zelf dat het geen bedrag is dat je in een keer bevestigt');
      assert.match(mand, /Bevestigen doe je bij de verkoper zelf/, 'de deur staat bij de verkoper');
      assert.equal(await page.locator('#mand button:not(.ga)').count(), 0,
        'in de mand staan alleen deuren per verkoper, geen andere knop');

      await kies(tweede.aanbieder.code);
      const tweedeKnop = page.locator('#etalage [data-in="' + tweede.id + '"]');
      await tweedeKnop.waitFor({ state: 'visible', timeout: 20000 });
      gezet = page.waitForResponse(r => r.url().endsWith('/api/commerce/mand/zet'));
      await tweedeKnop.click();
      assert.equal((await gezet).status(), 200);
      await page.waitForFunction(() => document.querySelectorAll('#mand .afrek').length === 2, null, { timeout: 15000 });
      mand = await page.locator('#mand').textContent();
      assert.match(mand, /Deze mand loopt over 2 verkopers\. Elk bevestigt zijn eigen deel; RTG bevestigt niets namens hen\./,
        'de zin van de server over twee verkopers staat op het scherm: ' + mand.slice(-300));
      assert.ok(await page.locator('#mand .afrek .deur .ga').count() >= 2, 'elke verkoper heeft zijn eigen deur');
      assert.doesNotMatch(mand, /betaal alles|alles bevestigen|alles afrekenen/i, 'en nergens een knop die alles in een keer doet');
      assert.equal(await page.locator('#mand button:not(.ga)').count(), 0);

      /* ---- 3. de weg terug: klaargezet, nooit uitgevoerd ---- */
      await kies('MAISON');
      const rij = page.locator('#etalage .rij').filter({ has: page.locator('[data-retour]') }).first();
      await rij.locator('[data-retour]').waitFor({ state: 'visible', timeout: 20000 });
      await rij.locator('[data-retour]').click();
      const vorm = rij.locator('.retourvorm');
      await vorm.locator('[data-veld="doe"]').waitFor({ state: 'visible', timeout: 10000 });

      // zonder bestelkenmerk: geweigerd, met de reden op het scherm
      let gevraagd = page.waitForResponse(r => r.url().endsWith('/api/commerce/retour/vraag'));
      await vorm.locator('[data-veld="doe"]').click();
      assert.equal((await gevraagd).status(), 400, 'een retour zonder bestelkenmerk wordt geweigerd');
      await page.waitForFunction(() => /Welke bestelling\?/.test(document.querySelector('#melding').textContent),
        null, { timeout: 10000 });
      assert.equal(await page.locator('#retour .rij').count(), 0, 'en er staat geen aanvraag');

      await vorm.locator('[data-veld="ref"]').fill('ORD-2026-0001');
      await vorm.locator('[data-veld="grond"]').selectOption('defect');
      await vorm.locator('[data-veld="bedrag"]').fill('12,50');
      gevraagd = page.waitForResponse(r => r.url().endsWith('/api/commerce/retour/vraag'));
      await vorm.locator('[data-veld="doe"]').click();
      const antwoord = await gevraagd;
      assert.equal(antwoord.status(), 200, 'de aanvraag is klaargezet');
      const retour = (await antwoord.json()).retour;
      assert.equal(retour.centen, 1250, 'euro\'s op het scherm, centen op de server');
      await page.waitForSelector('#retour .rij', { state: 'visible', timeout: 15000 });
      const weg = await page.locator('#retour .rij').first().textContent();
      assert.match(weg, /Kapot of werkt niet/, 'de grond staat er in woorden');
      assert.match(weg, /bestelling ORD-2026-0001/, 'met het kenmerk van de verkoper');
      assert.match(weg, /nog niet door de verkoper nagekeken/, 'en RTG doet niet alsof het de bestelling kent');
      assert.equal((await page.locator('#retour .rij .stap .nu').first().textContent()).trim(), 'gevraagd',
        'de stand is gevraagd, de eerste van de weg terug');
      assert.equal(await page.locator('#retour [data-verstuurd]').count(), 0,
        'de koper krijgt geen knop om hem zelf verder te duwen zolang de verkoper niets heeft gezegd');
      assert.equal(await page.locator('#retour .klaar').count(), 0, 'en er staat geen bedrag dat als betaald leest');
      assert.doesNotMatch(weg, /Uitgevoerd/);

      /* Ook buiten het scherm om: de koper zet de aanvraag niet zelf op
         "verstuurd" voordat de verkoper hem heeft aanvaard. */
      const duw = await post(base, '/api/commerce/retour/verstuurd', { id: retour.id }, lid);
      assert.equal(duw.status, 409, 'de server weigert de sprong: ' + JSON.stringify(duw.body));
      const mijn = await post(base, '/api/commerce/retour/mijn', {}, lid);
      const r = (mijn.body.retouren || []).find(x => x.id === retour.id);
      assert.ok(r && r.stand === 'gevraagd' && r.besluit === null, 'de aanvraag staat klaar en er is niets uitgevoerd: ' + JSON.stringify(r).slice(0, 200));

      // leegmaken sluit de ronde: de mand is weer leeg, ook op de server
      const geleegd = page.waitForResponse(r2 => r2.url().endsWith('/api/commerce/mand/leeg'));
      await page.locator('#leeg').click();
      assert.equal((await geleegd).status(), 200);
      await page.waitForFunction(() => /Je mand is leeg\./.test(document.querySelector('#mand').textContent), null, { timeout: 15000 });
      const leeg = await post(base, '/api/commerce/mand', {}, lid);
      assert.equal(leeg.body.leeg, true, 'de server is het ermee eens');

      assert.deepEqual(fouten, [], 'geen JS-fouten op het commerce-scherm: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
