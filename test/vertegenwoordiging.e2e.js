/* HET MACHTIGINGSSCHERM (/apps/vertegenwoordiging.html) IN EEN ECHTE BROWSER.

   test/vertegenwoordiging.test.js bewijst de zeven regels van de laag met een
   mutatie, en test/vertegenwoordiging.e2e.test.js bewijst dat een verzoek over
   HTTP werkelijk bij die regels aankomt. Geen van beide zegt iets over het
   SCHERM, en juist hier zit de helft die nergens anders bestaat: wat een client
   te zien krijgt vóórdat hij tekent. scripts/schermen.js eist daarom een eigen
   tocht door de browser -- en die eis is terecht, want dit scherm stond eerst
   in de lijst "legt geen enkele toets werkelijk af".

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. EEN LEEG TEAM IS EEN MEDEDELING EN GEEN GEBREK. Het scherm zegt met zoveel
      woorden dat er niets namens u gebeurt zolang er geen machtiging is. Een
      leeg vlak zou de client laten denken dat het scherm stuk is.
   2. `klaarzetten` STAAT OP HET SCHERM EN NIET ALLEEN IN DE API. Een bevoegdheid
      die alleen mag voorbereiden draagt het merk "legt alleen voor". Dat is
      precies waar een client zich op verkijkt, en het is de enige plek waar dat
      verschil zichtbaar wordt.
   3. DE SIMULATIE TOONT WAT ER MET ZEKERHEID NIET OPENGAAT, compleet. Alle zeven
      dingen uit NOOIT staan op het scherm, delegatie incluis. Die helft
      ontbreekt bij elke machtiging die ik ken en is de helft die de client het
      hardst nodig heeft; ontbreekt hij, dan is het scherm een aanvaardknop met
      een verhaaltje erboven.
   4. AANVAARDEN DOET DE CLIENT, IN DE BROWSER, EN HET VERANDERT DE SERVER ECHT.
      Niet "Aanvaard." in een meldingsbalk, maar de stand die daarna uit /mijn
      komt. Dit is regel 5 van CARRIERE.md par. 6a op het scherm.
   5. DE EIGEN GRENS RAAKT OOK WAT AL LOOPT. De client vinkt een bevoegdheid uit,
      bewaart, en de machtiging die al actief is wordt smaller. Een grens die
      alleen nieuwe machtigingen tegenhoudt, beschermt precies de mens niet die
      er al een heeft (regel 6).

   Wat NIET is beproefd: de 18+-poort zelf (die staat in de e2e-suite hiernaast,
   en hier worden beide partijen juist wél gekeurd zodat er iets te zien is), en
   het intrekken vanaf de kant van de vertegenwoordiger.

   Draai los: node --test test/vertegenwoordiging.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  keurLidGoed } = require('./helper');

const pw = laadPlaywright();
const NOOIT = require('../server/kern/vertegenwoordiging/bevoegdheden').NOOIT;

test('Het team om mij heen: een voorstel, de volle nee-lijst, aanvaarden door de client, en een grens die ook het lopende raakt',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vtg-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    let browser;
    try {
      /* Beide partijen door de keuring: `volwassen()` vraagt 18 jaar EN dat RTG
         het identiteitsbewijs heeft gezien (A3). Zonder deze stap laadt het
         scherm prima en is er niets te zien -- dan zou deze toets op de poort
         zakken in plaats van op het scherm. */
      const client = (await post('/api/auth/register', { name: 'Talent Scherm', email: 'vtgscherm1@x.nl',
        phone: '0612349001', password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg' })).body;
      const agent = (await post('/api/auth/register', { name: 'Waarnemer Scherm', email: 'vtgscherm2@x.nl',
        phone: '0612349002', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' })).body;
      assert.ok(client.token && agent.token, 'beide leden zijn aangemeld');
      const clientCode = (await post('/api/state', {}, client.token)).body.state.user.codename;
      await keurLidGoed(base, client.token, clientCode, '1990-03-03');
      await keurLidGoed(base, agent.token,
        (await post('/api/state', {}, agent.token)).body.state.user.codename, '1984-04-04');

      browser = await pw.chromium.launch(browserOpties());
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript((token) => {
        try { localStorage.setItem('rtg_member_token', token); } catch (e) {}
      }, client.token);
      const page = await ctx.newPage();
      letOpFouten(page);

      /* 1. Leeg is een mededeling. */
      await page.goto(base + '/apps/vertegenwoordiging.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#team .leeg, #team .kaart');
      assert.match(await page.textContent('#team'), /er gebeurt niets namens u|staat niemand naast u/i,
        'een leeg team hoort te zeggen dat er niets namens u gebeurt, niet leeg te blijven');

      /* De vertegenwoordiger stelt voor -- dat is zijn handeling en niet die van
         de client, dus hij gaat langs de API en niet langs dit scherm. */
      const tot = new Date(Date.now() + 90 * 86400000).toISOString();
      const voorstel = await post('/api/vertegenwoordiging/voorstel', { client: clientCode,
        hoedanigheid: 'zaakwaarnemer',
        bevoegdheden: ['aanbod.ontvangen', 'aanbod.bespreken', 'contract.opstellen'],
        tot }, agent.token);
      assert.equal(voorstel.status, 200, 'het voorstel komt erdoor: ' + JSON.stringify(voorstel.body).slice(0, 200));

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#team .kaart');
      const kaart = await page.textContent('#team .kaart');
      assert.match(kaart, /voorgesteld/, 'de kaart draagt de stand voorgesteld');

      /* 2. `klaarzetten` is zichtbaar, en precies op de goede regels. */
      const merken = await page.$$eval('#team .kaart li', els => els.map(e => ({
        naam: (e.querySelector('b') || {}).textContent || '',
        merk: !!e.querySelector('.merk')
      })));
      const merkVan = n => (merken.find(m => m.naam === n) || {}).merk;
      assert.equal(merkVan('Over een aanbod onderhandelen'), true,
        'een bevoegdheid die alleen mag voorbereiden hoort "legt alleen voor" te dragen');
      assert.equal(merkVan('Een concept opstellen'), true, 'een concept opstellen legt ook alleen voor');
      assert.equal(merkVan('Aanbiedingen ontvangen'), false,
        'een bevoegdheid die NIET alleen voorbereidt, hoort dat merk juist niet te dragen');

      /* 3. De simulatie toont de volle nee-lijst. */
      await page.click('#team .kaart [data-sim]');
      await page.waitForSelector('#sim[open] .lijst.nee li');
      const nee = await page.textContent('#sim .lijst.nee');
      for (const n of NOOIT) {
        assert.ok(nee.includes(n.wat),
          'de simulatie hoort "' + n.wat + '" te tonen; wat er niet opengaat is de helft die de client nodig heeft');
      }
      assert.match(await page.textContent('#simInhoud'), /machtigen/i,
        'dat een vertegenwoordiger niemand anders mag machtigen, hoort op het scherm te staan');

      /* 4. Aanvaarden doet de client, en de server verandert echt. */
      await page.click('#simJa');
      await page.waitForFunction(() => !document.querySelector('#sim[open]'));
      await page.waitForSelector('#team .kaart .stand.actief');
      const naAanvaard = await post('/api/vertegenwoordiging/mijn', {}, client.token);
      const m = naAanvaard.body.team[0];
      assert.equal(m.stand, 'actief', 'na de knop staat de machtiging op de SERVER op actief');

      /* 5. De eigen grens raakt ook wat al loopt. De grens is een WEIGERLIJST en
         geen toestemmingslijst -- "deze bevoegdheden geeft u aan niemand" --
         dus aanvinken is verbieden. Ik had het eerst omgekeerd, en de toets
         zakte terecht: het scherm zegt het met zoveel woorden boven de vinkjes. */
      await page.check('[data-grens="contract.opstellen"]');
      await page.check('[data-grens="aanbod.bespreken"]');
      await page.click('#grensOp');
      await page.waitForFunction(() =>
        document.querySelectorAll('#team .kaart li').length === 1);
      const naGrens = (await post('/api/vertegenwoordiging/mijn', {}, client.token)).body.team[0];
      const sleutels = naGrens.bevoegdheden.map(b => b.sleutel || b.naam);
      assert.equal(naGrens.bevoegdheden.length, 1,
        'de eigen grens hoort de LOPENDE machtiging te versmallen, niet alleen nieuwe');
      assert.ok(String(sleutels).includes('aanbod.ontvangen'),
        'wat de client wel toestond, blijft staan: ' + JSON.stringify(sleutels));
    } finally {
      if (browser) await browser.close().catch(() => {});
      stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });
