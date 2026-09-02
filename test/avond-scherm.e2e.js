/* HET AVONDSCHERM (/apps/avond.html) IN EEN ECHTE BROWSER.

   test/avond.test.js bewijst dat de avondroutes de klok en het budget als
   GRENS behandelen en dat een tafel nooit verder komt dan `aangevraagd`. Dat
   zegt niets over het scherm: of het die weigering laat zien met het getal
   erbij, of de zin boven het plan van de server komt en niet uit het scherm,
   en of de staat per stap op het scherm dezelfde is als in het antwoord.
   scripts/schermen.js eist daarom een eigen tocht door de browser.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. DE KLOK IS EEN GRENS OP HET SCHERM. Om 19:30 thuis willen zijn geeft een
      409; het scherm toont die weigering MET hoeveel minuten het te laat is,
      en er komt geen plan op het scherm.
   2. HET BUDGET OOK. Een euro per persoon geeft een weigering die het bedrag
      noemt, en nog steeds geen plan.
   3. HET SCHERM MAAKT NIETS MOOIER DAN HET IS. De zin boven het plan is letterlijk
      `avond.zekerheid` uit het antwoord, en de staat per stap op het scherm is
      per soort precies zo vaak aanwezig als in het antwoord -- ook na het
      aanvragen, waar een tafel `aangevraagd` heet en niet `bevestigd`.
   4. AANVRAGEN IS EEN ECHTE HANDELING. Na de knop staat de avond op de server
      op een andere staat dan `voorstel`, en de knop zegt dat er niets meer aan
      te vragen valt.
   5. DE VOORKEUREN WORDEN ECHT BEWAARD. Wat op het tabblad wordt ingevuld en
      opgeslagen, komt via de API terug -- niet alleen als "Opgeslagen" op het
      scherm.

   Wat NIET is beproefd: de 428 van de gegevenspoort (het lid registreert met een
   telefoonnummer, dus die vraag komt hier niet), en de pols per zaak -- die laadt
   apart en een pols die niet komt hoort het plan niet te raken.

   Draai los: node --test test/avond-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Een avond: de klok en het budget weigeren met het getal, het plan spiegelt de server, aanvragen en voorkeuren werken echt',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-avond-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    let browser;
    try {
      const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: 'Avondganger', email: 'x' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const LID = reg.body.token;

      browser = await pw.chromium.launch(browserOpties(pw));
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, LID);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/avond.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#bPlan', { state: 'visible', timeout: 20000 });

      const tekst = (s) => page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      }, s);
      const verborgen = (s) => page.evaluate((sel) => {
        const el = document.querySelector(sel); return !el || el.hidden;
      }, s);
      const plan = (thuis, budget) => {
        const antwoord = page.waitForResponse((r) => r.url().endsWith('/api/avond/voorstel'), { timeout: 20000 });
        return page.locator('#start').fill('19:00')
          .then(() => page.locator('#thuis').fill(thuis))
          .then(() => page.locator('#personen').fill('2'))
          .then(() => page.locator('#budget').fill(budget))
          .then(() => page.locator('#bPlan').click())
          .then(() => antwoord);
      };

      /* ---- 1. de klok ---- */
      const klok = await plan('19:30', '120');
      assert.equal(klok.status(), 409, 'om 19:30 thuis willen zijn wordt geweigerd');
      await page.waitForFunction(() => {
        const m = document.querySelector('#melding'); return m && !m.hidden && m.textContent.trim().length > 5;
      }, null, { timeout: 15000 });
      const klokTekst = await tekst('#melding');
      assert.match(klokTekst, /thuis/i, 'de weigering zegt waar het om gaat: ' + klokTekst);
      assert.match(klokTekst, /\d+ minuten te laat/, 'en hoeveel minuten het te laat is: ' + klokTekst);
      assert.equal(await verborgen('#planVak'), true, 'bij een weigering komt er geen plan op het scherm');

      /* ---- 2. het budget ---- */
      const budget = await plan('00:30', '1');
      assert.equal(budget.status(), 409, 'een euro per persoon wordt geweigerd');
      assert.equal((await budget.json()).code, 'budget');
      await page.waitForFunction(() => /maximaal/.test((document.querySelector('#melding') || {}).textContent || ''),
        null, { timeout: 15000 });
      assert.match(await tekst('#melding'), /€ ?\d/, 'de budgetweigering noemt het bedrag');
      assert.equal(await verborgen('#planVak'), true, 'en ook nu geen plan');

      /* ---- 3. een voorstel, en het scherm spiegelt het antwoord ---- */
      const voorstel = await plan('00:30', '120');
      assert.equal(voorstel.status(), 200, 'met ruimte in het budget komt er een plan');
      const j = await voorstel.json();
      await page.waitForFunction(() => {
        const v = document.querySelector('#planVak'); return v && !v.hidden && document.querySelectorAll('#stappen .stap').length > 0;
      }, null, { timeout: 15000 });
      assert.equal(await tekst('#zekerheid'), String(j.avond.zekerheid).replace(/\s+/g, ' ').trim(),
        'de zin boven het plan komt van de server en niet uit het scherm');
      assert.match(j.avond.zekerheid, /voorstel|nog niets aangevraagd/i);

      const staten = () => page.$$eval('#stappen .staat', (els) => els.map((e) => e.textContent.trim()));
      const spiegel = async (avond, wanneer) => {
        const opScherm = await staten();
        assert.equal(opScherm.length, avond.stappen.length, wanneer + ': elke stap staat er precies een keer');
        for (const soort of ['voorstel', 'aangevraagd', 'bevestigd', 'mislukt']) {
          assert.equal(opScherm.filter((s) => s === soort).length,
            avond.stappen.filter((s) => s.staat === soort).length,
            wanneer + ': het scherm toont "' + soort + '" even vaak als de server');
        }
      };
      await spiegel(j.avond, 'na het voorstel');
      assert.ok(j.avond.stappen.every((s) => s.staat === 'voorstel'), 'een vers plan staat helemaal op voorstel');
      assert.equal(await verborgen('#balk'), false, 'de aanvraagbalk staat er');
      assert.match(await tekst('#balkBedrag'), /€ \d+,\d{2}\+? p\.p\./, 'het bedrag per persoon staat in de balk');
      const teDoen = j.avond.stappen.filter((s) => s.staat === 'voorstel' && !s.reden).length;
      assert.ok(teDoen > 0, 'er valt iets aan te vragen: ' + JSON.stringify(j.avond.stappen).slice(0, 200));
      assert.equal(await page.locator('#bVraag').isDisabled(), false, 'de aanvraagknop staat aan');

      /* ---- 4. aanvragen: aangevraagd is niet bevestigd ---- */
      const gevraagd = page.waitForResponse((r) => r.url().endsWith('/api/avond/aanvragen'), { timeout: 20000 });
      await page.locator('#bVraag').click();
      const a = await gevraagd;
      assert.equal(a.status(), 200, 'aanvragen via het scherm lukt');
      const na = await a.json();
      await page.waitForFunction(() => /aangevraagd en niet bevestigd/.test((document.querySelector('#melding') || {}).textContent || ''),
        null, { timeout: 15000 });
      await spiegel(na.avond, 'na het aanvragen');
      const eten = na.avond.stappen.filter((s) => s.soort === 'eten');
      assert.ok(eten.length && eten.every((s) => s.staat !== 'bevestigd'),
        'een tafel wordt aangevraagd, nooit bevestigd: ' + JSON.stringify(eten.map((s) => s.staat)));
      assert.equal(await page.locator('#bVraag').isDisabled(), true, 'na het aanvragen valt er niets meer aan te vragen');
      const bewaard = await post('/api/avond/mijn', {}, LID);
      const mijne = (bewaard.body.avonden || []).find((x) => x.id === j.avond.id);
      assert.ok(mijne, 'de avond staat op de server');
      assert.notEqual(mijne.staat, 'voorstel', 'en is daar niet meer een kaal voorstel');

      /* ---- het tabblad Mijn avonden leest dezelfde avond ---- */
      const lijst = page.waitForResponse((r) => r.url().endsWith('/api/avond/mijn'), { timeout: 20000 });
      await page.locator('[role="tab"][data-tab="mijn"]').click();
      assert.equal((await lijst).status(), 200);
      await page.waitForFunction((titel) => (document.querySelector('#mijnLijst') || {}).textContent.includes(titel),
        j.avond.titel, { timeout: 15000 });
      assert.equal(await verborgen('#balk'), true, 'buiten het plannen staat de aanvraagbalk niet in de weg');

      /* ---- 5. de voorkeuren worden bewaard ---- */
      const dna = page.waitForResponse((r) => r.url().endsWith('/api/avond/voorkeuren'), { timeout: 20000 });
      await page.locator('[role="tab"][data-tab="voorkeuren"]').click();
      assert.equal((await dna).status(), 200);
      await page.waitForSelector('#v_drank', { state: 'visible', timeout: 15000 });
      await page.locator('#v_drank').fill('bruiswater zonder ijs');
      await page.selectOption('#d_drank', 'altijd');
      const opslaan = page.waitForResponse((r) => r.url().endsWith('/api/avond/voorkeuren') && r.request().postData().includes('"zet"'),
        { timeout: 20000 });
      await page.locator('#bDna').click();
      assert.equal((await opslaan).status(), 200, 'opslaan via het scherm lukt');
      await page.waitForFunction(() => /Opgeslagen/.test((document.querySelector('#melding') || {}).textContent || ''),
        null, { timeout: 15000 });
      const terug = await post('/api/avond/voorkeuren', {}, LID);
      const drank = (terug.body.profiel.soorten || []).find((s) => s.id === 'drank');
      assert.equal(drank && drank.waarde, 'bruiswater zonder ijs', 'de voorkeur staat op de server');
      assert.equal(drank && drank.delen, 'altijd', 'en de deelstand ook');

      assert.deepEqual(fouten, [], 'geen JS-fouten op het avondscherm: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
