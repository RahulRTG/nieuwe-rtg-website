/* DE TWEE LOOPBAANSCHERMEN IN EEN ECHTE BROWSER.

   test/carriereledger.test.js bewijst het besluit en test/carriereledger.e2e.test.js
   dat een verzoek over HTTP bij dat besluit aankomt. Geen van beide zegt iets
   over het SCHERM, en `schermenZonderToets` in NORM.json staat op een HARDE NUL:
   elk scherm dat bestaat, hoort ooit door een toets te zijn geopend. Deze twee
   stonden na het bouwen van het ledger in die lijst.

   HET TWEEDE SCHERM IS DE REDEN DAT DIT GEEN LAADPROEF IS. /apps/loopbaanbewijs.html
   bestaat voor iemand ZONDER RTG-account: een club, een bond, een sponsor, een
   visumloket. Een toets die die pagina alleen opent, bewijst niets over waar hij
   voor is. Deze loopt daarom de hele keten -- lid, feit, deelcode, tonen -- en
   kijkt in een browser ZONDER token of er staat wat er hoort te staan.

   VIER DINGEN DIE HIER VASTLIGGEN, en alle vier staan ze nergens anders:

   1. EEN LEEG LEDGER IS EEN UITNODIGING EN GEEN GEBREK. Het scherm zegt dat uw
      loopbaan hier begint; een leeg vlak zou lezen als een kapot scherm.
   2. DE ZEVEN VOORRADEN STAAN ER ZONDER TOTAAL. Dat is CARRIERE.md par. 4.1 op
      het scherm: geen cijfer op een mens, ook niet opgeteld.
   3. WAT EEN BEVESTIGING NIET ZEGT, STAAT ER NAAST WAT ZIJ WEL ZEGT. Dat blok is
      de helft die een lezer het hardst nodig heeft, en het is de helft die overal
      ontbreekt.
   4. DE ONTVANGER ZIET EEN REGEL EN NOOIT DE LOOPBAAN. Het scherm toont het ene
      gedeelde feit; de tweede regel van hetzelfde ledger komt er niet in voor.

   Draai los: node --test test/loopbaan.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Mijn loopbaan en het deelbewijs: van een leeg ledger naar een regel die een vreemde kan nakijken',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-loopbaan-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    let browser;
    try {
      const lid = (await post('/api/auth/register', { name: 'Talent Loopbaan', email: 'lb1@x.nl',
        phone: '0612349501', password: 'geheim12345', geboortedatum: '1995-05-05', tier: 'rtg' })).body;
      assert.ok(lid.token, 'het lid is aangemeld');

      browser = await pw.chromium.launch(browserOpties());
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript((token) => {
        try { localStorage.setItem('rtg_member_token', token); } catch (e) {}
      }, lid.token);
      const page = await ctx.newPage();
      letOpFouten(page);

      /* 1. Leeg is een uitnodiging. */
      await page.goto(base + '/apps/loopbaan.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#reeks .leeg, #reeks .kaart');
      assert.match(await page.textContent('#reeks'), /begint hier|jaren geleden/i,
        'een leeg ledger hoort te zeggen dat het hier begint, niet leeg te blijven');

      /* 2. Zeven voorraden, en nergens een totaal. */
      const voorraden = await page.textContent('#voorraden');
      for (const k of ['vermogen', 'netwerk', 'publiek', 'financieel', 'eigendom', 'bewijs', 'reputatie']) {
        assert.match(voorraden, new RegExp(k, 'i'), 'de voorraad ' + k + ' hoort op het scherm te staan');
      }
      assert.equal(/totaal|score|niveau \d|\d+\s*%/i.test(voorraden), false,
        'CARRIERE.md par. 4.1: er komt geen samengesteld getal over een mens op dit scherm');

      /* 3. Een feit erbij, langs de server, en een bevestiging van het kantoor --
         zo staat er iets op het scherm dat NIET van het lid zelf komt. */
      const zet = await post('/api/carriere/ledger/zet',
        { kapitaal: 'vermogen', wat: 'Nederlands kampioen junior', op: '2025-06-14' }, lid.token);
      assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
      const tweede = await post('/api/carriere/ledger/zet',
        { kapitaal: 'netwerk', wat: 'Iets dat een vreemde niet hoeft te zien', op: '2021-01-01' }, lid.token);
      assert.equal(tweede.status, 200);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#reeks .kaart');
      const reeks = await page.textContent('#reeks');
      assert.match(reeks, /Nederlands kampioen junior/);
      assert.match(reeks, /Nog niemand heeft dit bevestigd/i,
        'een regel zonder bevestiging hoort dat te zeggen in plaats van te zwijgen');

      /* 4. Delen: de code gaat EEN keer over het scherm. */
      const feitId = (await post('/api/carriere/ledger/mijn', {}, lid.token)).body.feiten
        .find(f => f.wat.startsWith('Nederlands')).id;
      const deel = await post('/api/carriere/ledger/deel', { id: feitId, dagen: 30, voor: 'Bond X' }, lid.token);
      assert.equal(deel.status, 200);
      assert.ok(deel.body.code, 'er komt een code terug');

      /* 5. En nu de andere kant: een browser ZONDER token, zoals een bond hem
         opent. Een eigen context, want een gedeelde zou de sessie van het lid
         meenemen en dan bewijst dit scherm niets. */
      const gastCtx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      const gast = await gastCtx.newPage();
      letOpFouten(gast);
      await gast.goto(base + '/apps/loopbaanbewijs.html#code=' + encodeURIComponent(deel.body.code),
        { waitUntil: 'domcontentloaded' });
      await gast.waitForSelector('#uit .kaart');
      const bewijs = await gast.textContent('#uit');

      assert.match(bewijs, /Nederlands kampioen junior/, 'de ontvanger ziet het gedeelde feit');
      assert.equal(bewijs.includes('Iets dat een vreemde niet hoeft te zien'), false,
        'de ontvanger ziet EEN regel en nooit de loopbaan eromheen');
      assert.match(bewijs, /Wat dit niet zegt/i,
        'het voorbehoud hoort even groot op het scherm te staan als het feit zelf');
      assert.match(bewijs, /door de mens zelf opgegeven/i,
        'zonder bevestiging hoort er te staan dat het van de mens zelf komt');
      assert.equal(/inloggen|log in/i.test(bewijs), false,
        'dit scherm bestaat juist voor iemand zonder RTG-account');
    } finally {
      if (browser) await browser.close().catch(() => {});
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });
