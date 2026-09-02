/* HET RELATIESCHERM (/apps/mijn-relaties.html) IN EEN ECHTE BROWSER.

   test/appstore-lab-toestemming-routes.test.js bewijst de drie routes over
   HTTP: de relaties zijn die van de lezer, /gevolgen voert niets uit, /sluit
   trekt in bij de laag. Dit bestand dubbelt dat niet; het gaat over het SCHERM,
   want daar zit de tik die niet terug te draaien is. scripts/schermen.js eist
   een eigen tocht door de browser.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. LID B ZIET LID A NIET. Terwijl lid A een relatie met RTG heeft, opent lid
      B het scherm en ziet nul partijen -- met de zin dat er niets openstaat, en
      met de lijst van wat het scherm NIET dekt, want een lege pagina zonder
      die lijst leest als "niemand raakt mij aan".
   2. GEVOLGEN TONEN VERANDERT NIETS. De knop "Sluit deze relatie" haalt de
      voorbeschouwing op en zet die IN de kaart: wat ingetrokken wordt, en even
      groot wat er niet mee ophoudt. De oorspronkelijke sluitknop gaat weg
      zolang de voorbeschouwing staat (twee knoppen die allebei sluiten heten,
      waarvan een de gevolgen overslaat, is precies de tik die je hier niet wilt
      kunnen maken), en de relatie staat via de API nog gewoon aan. "Laat maar"
      zet alles terug.
   3. PAS DE BEVESTIGING SLUIT. De rode bevestigknop gaat naar /relatie/sluit,
      het scherm meldt hoeveel er is ingetrokken, de kaart verdwijnt, en de API
      kent de relatie niet meer.

   Wat NIET is beproefd: een relatie met een niet-intrekbare rij (de zaaiset
   heeft er geen die een vers lid zelf kan aanzetten), en de storingsregel
   bovenaan (die vraagt een laag die niet leest).

   Draai los: node --test test/mijn-relaties-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Wie heeft toegang tot mij: lid B ziet lid A niet, gevolgen tonen verandert niets, pas de bevestiging sluit',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-relaties-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const nieuwLid = async (naam) => {
      const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: naam, email: 'x' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      return reg.body.token;
    };
    const heeftRtg = async (token) => {
      const r = await post('/api/toestemming/relaties', {}, token);
      assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
      return (r.body.relaties || []).some((x) => x.partij === 'rtg');
    };
    let browser;
    try {
      const A = await nieuwLid('Lid A');
      const B = await nieuwLid('Lid B');
      /* De commerciele toestemming is de kortste weg naar een rij met een
         partij: standaard uit, aan met een handeling van het lid zelf, en hij
         landt onder partij 'rtg'. Alleen lid A zet hem aan. */
      const aan = await post('/api/mijn/post/zet', { soort: 'aanbiedingen', kanalen: ['email'], bron: 'toets' }, A);
      assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
      assert.equal(await heeftRtg(A), true, 'lid A heeft nu een relatie met RTG');

      browser = await pw.chromium.launch(browserOpties(pw));
      const open = async (token) => {
        const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
        await ctx.addInitScript((t) => {
          localStorage.setItem('rtg_member_token', t);
          localStorage.setItem('rtg_lang', 'nl');
          localStorage.setItem('rtg_cookieinfo_v1', '1');
        }, token);
        const page = await ctx.newPage();
        const fouten = [];
        letOpFouten(page, fouten);
        const geladen = page.waitForResponse((r) => r.url().endsWith('/api/toestemming/relaties'), { timeout: 20000 });
        await page.goto(base + '/apps/mijn-relaties.html', { waitUntil: 'domcontentloaded' });
        assert.equal((await geladen).status(), 200, 'het scherm leest de relaties met de ledensessie');
        await page.waitForFunction(() => document.querySelectorAll('#grenzen .grens').length >= 4, null, { timeout: 15000 });
        return { ctx, page, fouten };
      };
      const tekst = (page, s) => page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      }, s);

      /* ---- 1. lid B ---- */
      const b = await open(B);
      assert.equal(await b.page.locator('article.partij').count(), 0, 'lid B ziet geen enkele partij');
      assert.match(await tekst(b.page, '#lijst'), /niets open bij een partij/, 'en het scherm zegt dat er niets openstaat');
      assert.ok(!(await tekst(b.page, 'body')).includes('Aanbiedingen en reisvoorstellen'),
        'de toestemming van lid A staat niet op het scherm van lid B');
      assert.match(await tekst(b.page, '#grenzen'), /Wat dit scherm niet dekt/, 'de grenzen van het scherm staan erbij');
      assert.deepEqual(b.fouten, [], 'geen JS-fouten bij lid B: ' + b.fouten.join(' | '));
      await b.ctx.close();

      /* ---- 2. lid A: gevolgen tonen verandert niets ---- */
      const a = await open(A);
      const page = a.page;
      const kaart = page.locator('article.partij');
      assert.equal(await kaart.count(), 1, 'lid A ziet precies zijn ene partij');
      assert.equal(await tekst(page, 'article.partij .naam'), 'Rahul Travel Group');
      assert.equal(await tekst(page, 'article.partij .telling'), '1 toestemming');
      assert.match(await tekst(page, 'article.partij .mag .wat'), /Aanbiedingen/);

      const sluitKnop = kaart.locator('.acties button', { hasText: 'Sluit deze relatie' });
      const gevolgen = page.waitForResponse((r) => r.url().endsWith('/api/toestemming/relatie/gevolgen'), { timeout: 20000 });
      await sluitKnop.click();
      const g = await gevolgen;
      assert.equal(g.status(), 200, 'de voorbeschouwing wordt opgehaald');
      const gj = await g.json();
      await page.waitForSelector('article.partij .gevolg', { state: 'visible', timeout: 15000 });
      assert.equal(await tekst(page, 'article.partij .gevolg h3'),
        'Dit gebeurt er: ' + gj.sluit.length + ' toestemming wordt ingetrokken');
      assert.equal(await kaart.locator('.gevolg ul').first().locator('li').count(), gj.sluit.length);
      assert.match(await tekst(page, 'article.partij .gevolg'), /Wat hier niet mee ophoudt/);
      assert.ok(await kaart.locator('.gevolg li.waarschuw').count() >= 3, 'wat niet gerekend is staat er even groot bij');
      assert.equal(await sluitKnop.isVisible(), false,
        'zolang de voorbeschouwing staat is de eerste sluitknop weg');
      assert.equal(await heeftRtg(A), true, 'gevolgen tonen heeft niets ingetrokken');

      await kaart.locator('.gevolg button', { hasText: 'Laat maar' }).click();
      await page.waitForFunction(() => !document.querySelector('article.partij .gevolg'), null, { timeout: 10000 });
      assert.equal(await sluitKnop.isVisible(), true, 'na "Laat maar" staat de sluitknop er weer');
      assert.equal(await heeftRtg(A), true, 'en er is nog steeds niets ingetrokken');

      /* ---- 3. pas de bevestiging sluit ---- */
      const nogEens = page.waitForResponse((r) => r.url().endsWith('/api/toestemming/relatie/gevolgen'), { timeout: 20000 });
      await sluitKnop.click();
      await nogEens;
      await page.waitForSelector('article.partij .gevolg', { state: 'visible', timeout: 15000 });
      const bevestig = kaart.locator('.gevolg button', { hasText: /^Ja, sluit deze 1 / });
      assert.equal(await bevestig.count(), 1, 'de bevestigknop noemt het aantal');
      const gesloten = page.waitForResponse((r) => r.url().endsWith('/api/toestemming/relatie/sluit'), { timeout: 20000 });
      await bevestig.click();
      const s = await gesloten;
      assert.equal(s.status(), 200, 'sluiten via het scherm lukt');
      assert.equal((await s.json()).gesloten, 1);
      await page.waitForFunction(() => {
        const m = document.querySelector('#melding');
        return m && m.classList.contains('zien') && /1 toestemming\(en\) ingetrokken/.test(m.textContent);
      }, null, { timeout: 15000 });
      await page.waitForFunction(() => document.querySelectorAll('article.partij').length === 0, null, { timeout: 15000 });
      assert.match(await tekst(page, '#lijst'), /niets open bij een partij/, 'na het sluiten zegt het scherm dat er niets meer openstaat');
      assert.equal(await heeftRtg(A), false, 'de relatie is op de server ingetrokken');

      assert.deepEqual(a.fouten, [], 'geen JS-fouten bij lid A: ' + a.fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
