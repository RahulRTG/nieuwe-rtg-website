/* HET SCHERM VAN RTG CONCERN IN EEN ECHTE BROWSER: van naam tot entiteit met bron.

   WAAROM DEZE TOETS BESTAAT

   test/concern.test.js toetst de kern, test/concern-routes.e2e.js de deur --
   allebei zonder browser. Het scherm /apps/concern.html legde geen enkele
   toets af; scripts/schermen.js telde hem als scherm zonder eigen toets. En
   juist dit scherm belooft iets dat een API-toets niet kan zien: dat het NIETS
   zelf rekent en elk oordeel, elke bron en elke grens uit het antwoord van de
   server toont (LAT-regel 4).

   WAT DIT VASTLEGT, EN WELKE GRENS

   1. EEN BEDRIJF IS NIET EEN KVK (CONCERN.md). De entiteit begint met een
      naam; de rechtsvormen komen van de server en volgen het gekozen land;
      een registratie is een FEIT dat je vastlegt, en een tweede inschrijving
      komt naast de eerste te staan in plaats van erover heen.
   2. EEN JURIDISCH GEGEVEN HEEFT EEN BRON (wet 4). De registratie die de
      ondernemer zelf invult staat op het scherm met het label "Ingevuld", en
      de route die het scherm gebruikt weigert een bron zonder herkomst.
   3. DE AI IS HIER GEEN JURIDISCHE AUTORITEIT. De stand van zaken toont een
      percentage met de grens erbij dat het geen juridisch oordeel is; de UBO
      wordt uit het belang GEREKEND (60% > 25%) en het scherm zegt dat de
      opgave zelf bij het handelsregister gebeurt.
   4. EEN LEGE NAAM VERLAAT HET SCHERM NIET: het scherm vraagt om een naam en
      stuurt niets naar de server.

   5. HET SCHERM VERVERST ZICHZELF NA EEN HANDELING, zonder herlaad. Dat was
      stuk toen deze toets werd geschreven (2 september 2026): de iOS-schil
      verplaatst de kop-<h1> als grote titel naar het begin van <main>, en
      omdat de inhoud direct in main stond wiste elke herlaad() met innerHTML
      die titel mee; het volgende $('#titel') gaf null, de TypeError werd door
      elke knop gevangen en als melding getoond, en #hoofd bleef staan zoals
      hij was. Sindsdien staat de inhoud in een eigen #hoofd IN main. Deze
      toets wacht na elke klik op het scherm zelf, zonder page.reload -- en
      dat is de bewering: zet je de inhoud weer direct in main, dan zakt hij.

   Verder niet beproefd: uitnodigen en de werknemerskant (het accepteren
   gebeurt op een ander scherm) en de impact-, fusie- en uitdienstroutes (die
   hebben op dit scherm geen knop).

   Draai los: node --test test/concern-scherm.e2e.js */
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

/* Een handeling op dit scherm: de knop, de aanroep die hij hoort te doen, en
   daarna het scherm ZELF dat het gevraagde toont -- geen page.reload, want dat
   zou precies het gebrek uit punt 5 van de kop verbergen. */
async function handel(page, knop, pad, zichtbaar) {
  const antwoord = page.waitForResponse(r => r.url().endsWith(pad));
  await page.locator(knop).click();
  const status = (await antwoord).status();
  await page.waitForFunction((re) => new RegExp(re).test(document.querySelector('#hoofd').textContent),
    zichtbaar, { timeout: 20000 });
  assert.doesNotMatch(await page.locator('#melding').textContent(), /Cannot set properties|TypeError/,
    'het scherm ving een fout bij het verversen (zie punt 5 van de kop)');
  return status;
}

test('RTG Concern: een ondernemer begint een entiteit, legt een registratie met bron vast en ziet de UBO gerekend',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-concern-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    let browser;
    try {
      const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
      const reg = await post(base, '/api/auth/register', { name: 'Ondernemer', email: 'cn' + u + '@x.nl',
        phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const lid = reg.body.token;

      browser = await pw.chromium.launch(browserOpties(pw));

      /* ---- de deur: zonder account is er een uitweg en geen formulier ---- */
      {
        const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
        await ctx.addInitScript(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); });
        const page = await ctx.newPage();
        const fouten = letOpFouten(page, []);
        await page.goto(base + '/apps/concern.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => /Log eerst in/.test(document.querySelector('#hoofd').textContent), null, { timeout: 20000 });
        assert.equal(await page.locator('#hoofd a[href="/apps/app.html"]').count(), 1, 'de uitweg is de inlog');
        assert.equal(await page.locator('#nNaam').count(), 0, 'en er staat geen formulier voor wie niet is aangemeld');
        assert.deepEqual(fouten, [], 'geen JS-fouten op de dichte deur: ' + fouten.join(' | '));
        await ctx.close();
      }

      const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, lid);
      const page = await ctx.newPage();
      const fouten = letOpFouten(page, []);
      const nieuwVerzoeken = [];
      page.on('request', r => { if (r.url().endsWith('/api/concern/entiteit/nieuw')) nieuwVerzoeken.push(r.url()); });

      await page.goto(base + '/apps/concern.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#nNaam', { state: 'visible', timeout: 20000 });
      assert.match(await page.locator('#hoofd .groet').first().textContent(), /Nog geen entiteit/, 'de lege stand');

      /* ---- de rechtsvormen komen van de server en volgen het land ----
         Ook in de LEGE stand staan ze er meteen: herlaad() keerde bij `leeg`
         eerst terug voor vulRechtsvormen() en de lijst kwam pas na een
         aanraking van het land (gemeten op 2 september 2026, sindsdien
         gerepareerd). Hier wordt dus NIET eerst het land aangeraakt. */
      await page.waitForFunction(() => document.querySelectorAll('#nRv option').length > 1, null, { timeout: 20000 });
      const nl = await page.$$eval('#nRv option', els => els.map(e => e.value));
      assert.ok(nl.includes('bv'), 'voor NL staat de B.V. in de lijst: ' + nl.join(','));
      await page.fill('#nLand', 'DE');
      await page.dispatchEvent('#nLand', 'change');
      await page.waitForFunction(() => [...document.querySelectorAll('#nRv option')].some(o => o.value === 'de-gmbh'),
        null, { timeout: 20000 });
      const de = await page.$$eval('#nRv option', els => els.map(e => e.value));
      assert.ok(!de.includes('bv'), 'een Nederlandse B.V. staat niet in de Duitse lijst: ' + de.join(','));
      await page.fill('#nLand', 'NL');
      await page.dispatchEvent('#nLand', 'change');
      await page.waitForFunction(() => [...document.querySelectorAll('#nRv option')].some(o => o.value === 'bv'),
        null, { timeout: 20000 });

      /* ---- 4. een lege naam verlaat het scherm niet ---- */
      await page.locator('#nKnop').click();
      await page.waitForFunction(() => /Hoe heet deze entiteit\?/.test(document.querySelector('#melding').textContent),
        null, { timeout: 10000 });
      assert.equal(nieuwVerzoeken.length, 0, 'zonder naam gaat er niets naar de server');

      /* ---- 1. de entiteit begint met een naam ---- */
      await page.fill('#nNaam', 'Noordzee Hotels BV');
      await page.selectOption('#nRv', 'bv');
      assert.equal(await handel(page, '#nKnop', '/api/concern/entiteit/nieuw', 'Uw concern is opgebouwd'), 200,
        'de entiteit is aangemaakt via het scherm');
      assert.equal(nieuwVerzoeken.length, 1, 'precies een aanroep, met de naam');
      const entiteitVak = () => page.locator('#hoofd .vak', { hasText: 'De entiteit' });
      let ent = await entiteitVak().textContent();
      assert.match(ent, /Noordzee Hotels BV/, 'de naam staat op het scherm');
      assert.match(ent, /Besloten vennootschap/, 'de rechtsvorm staat er in woorden, uit de server');
      assert.match(ent, /rechtspersoon/, 'en of het een rechtspersoon is');
      assert.match(ent, /Nog geen registratie vastgelegd/, 'zonder inschrijving bestaat zij toch: een bedrijf is niet een KvK');
      assert.match(ent, /Elk juridisch gegeven krijgt een bron/, 'de bronregel staat op het scherm voor het invullen');

      /* ---- 3. de stand van zaken draagt zijn grens ---- */
      const stand = await page.locator('#hoofd .vak', { hasText: 'Stand van zaken' }).textContent();
      assert.match(stand, /\d+%/, 'er staat een percentage');
      assert.match(stand, /geen juridisch oordeel/i, 'en de grens dat dit geen juridisch oordeel is: ' + stand.slice(-200));
      const overzicht = await page.locator('#hoofd .vak').first().textContent();
      assert.match(overzicht, /1\s*Entiteiten/, 'de telling van het concern komt van de server');

      /* ---- 2. een registratie is een feit met een bron ---- */
      await page.fill('#regNr', '12345678');
      await page.fill('#regNaam', 'KvK');
      assert.equal(await handel(page, '#regKnop', '/api/concern/entiteit/registratie', '12345678'), 200,
        'de registratie is vastgelegd via het scherm');
      const regel = entiteitVak().locator('.regel', { hasText: '12345678' });
      assert.equal(await regel.count(), 1, 'de inschrijving staat als regel op het scherm');
      assert.match(await regel.textContent(), /KvK/, 'met het register erbij');
      assert.equal((await regel.locator('.bron').textContent()).trim(), 'Ingevuld',
        'en met zijn bron: door de ondernemer zelf ingevuld');

      // een tweede inschrijving komt ernaast, de eerste blijft
      await page.fill('#regNr', '87654321');
      await page.fill('#regNaam', 'Vestigingsregister');
      assert.equal(await handel(page, '#regKnop', '/api/concern/entiteit/registratie', '87654321'), 200);
      ent = await entiteitVak().textContent();
      assert.match(ent, /12345678/, 'de eerste inschrijving is er nog');
      assert.match(ent, /87654321/, 'en de tweede staat ernaast');

      /* De route die het scherm gebruikt weigert een bron zonder herkomst: een
         "register" zonder te zeggen welk register is een woord en geen bron. */
      const ents = await post(base, '/api/concern/entiteiten', {}, lid);
      const entId = ents.body.entiteiten[0].id;
      const zonderHerkomst = await post(base, '/api/concern/entiteit/registratie',
        { entiteit: entId, nummer: '11112222', register: 'KvK', bronSoort: 'register' }, lid);
      assert.equal(zonderHerkomst.status, 400, 'een registerbron zonder herkomst wordt geweigerd: ' + JSON.stringify(zonderHerkomst.body));
      assert.match(zonderHerkomst.body.error || '', /herkomst/);
      const beeld = await post(base, '/api/concern/entiteit', { entiteit: entId }, lid);
      assert.equal(beeld.body.entiteit.registraties.length, 2, 'en de server telt er precies twee');
      assert.equal(beeld.body.entiteit.registraties[0].bron.soort, 'mens', 'met de bron die het scherm meegaf');

      /* ---- 3. bestuur en UBO: gerekend, niet geoordeeld ---- */
      await page.fill('#bWie', 'marco');
      assert.equal(await handel(page, '#bKnop', '/api/concern/feit/zet', 'marco'), 200, 'de bestuurder is vastgelegd');
      const bestuur = await page.locator('#hoofd .vak', { hasText: 'Bestuur en bevoegdheid' }).textContent();
      assert.match(bestuur, /marco/);
      assert.match(bestuur, /alleen bevoegd/, 'met zijn bevoegdheid');

      await page.fill('#aWie', 'marco');
      await page.fill('#aPct', '60');
      assert.equal(await handel(page, '#aKnop', '/api/concern/feit/zet', '60%'), 200, 'het belang is vastgelegd');
      const ubo = await page.locator('#hoofd .vak', { hasText: 'Uiteindelijk belang' }).textContent();
      assert.match(ubo, /marco/);
      assert.match(ubo, /60%/, 'de UBO is uit het belang gerekend');
      assert.match(ubo, /meer dan 25%/, 'met de regel erbij waarmee dat is gerekend');
      assert.match(ubo, /handelsregister/i, 'en de grens: de opgave zelf doet u bij het handelsregister');

      // een vestiging erbij, en de telling beweegt mee
      await page.fill('#vNaam', 'Amsterdam');
      await page.fill('#vPlaats', 'Amsterdam');
      assert.equal(await handel(page, '#vKnop', '/api/concern/vestiging/nieuw', '1\\s*Locaties'), 200, 'de vestiging is geopend');
      assert.match(await page.locator('#hoofd .vak', { hasText: 'Vestigingen' }).textContent(), /Amsterdam/);

      assert.deepEqual(fouten, [], 'geen JS-fouten op het concern-scherm: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
