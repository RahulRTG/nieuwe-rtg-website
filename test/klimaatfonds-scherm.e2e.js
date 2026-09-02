/* HET KLIMAATFONDS (/apps/foundation/klimaatfonds.html) IN EEN ECHTE BROWSER.

   Het Klimaatfonds is een VENSTER op het Living Lab en geen tweede lab: de
   bewonersdeuren van kern/livinglab (thema aandragen, stemmen, overzicht)
   staan op de route beproefd. Wat daar niet uit blijkt is of het scherm die
   grenzen ook TOONT -- of een te korte vraag met de zin van de server wordt
   geweigerd, of het scherm de alias vraagt in plaats van er een te verzinnen,
   of een tweede stem van dezelfde alias werkelijk niet telt, en of het
   venster alleen de duurzaamheidsvragen laat zien uit een lijst die meer
   bevat. scripts/schermen.js eist daarom een eigen tocht door de browser.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. EEN TE KORTE VRAAG WORDT GEWEIGERD MET DE ZIN VAN DE SERVER. "Te kort"
      geeft een 400 en het scherm toont "Welke vraag leeft er in de buurt?";
      de lijst blijft zoals hij was.
   2. EEN VRAAG AANDRAGEN IS EEN ECHTE HANDELING. Na de knop staat de vraag in
      het lab (scherm en server), met "nog geen onderzoek" en nul steun.
   3. HET FILTER IS EEN BEELD: een vraag over mobiliteit die in hetzelfde lab
      staat, verschijnt niet in dit venster -- en staat wel in het antwoord
      van de server.
   4. DE ALIAS WORDT GEVRAAGD EN NIET VERZONNEN. Stemmen zonder alias opent
      het aliasveld en stuurt NIETS naar /stem; met een alias telt de stem
      (0 -> 1), en een tweede stem van dezelfde alias wordt geweigerd met
      "U heeft al op dit thema gestemd" en telt niet (blijft 1).
   5. HET WERK DAT ERUIT VOORTKOMT: een lopend duurzaamheidsproject staat in
      de werklijst met een knop "Hieraan geven" die naar het geverscherm wijst
      met het project-id erin; zonder ledensessie zegt die kaart dat je moet
      inloggen, terwijl de rest van het venster gewoon werkt.

   Wat NIET is beproefd: de studies-balk (er loopt in deze toets geen
   onderzoek, dus het scherm zegt dat er geen loopt) en het labfonds -- dat
   staat met opzet niet op dit scherm.

   Draai los: node --test test/klimaatfonds-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, wachtTot, wachtOpTekst, tekstVan } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/foundation/klimaatfonds.html';
const OFFICE_CODE = 'KLIMAAT-SCHERM';
const VRAAG = 'Hoeveel koeler is een straat met bomen dan een straat zonder?';
const FIETSVRAAG = 'Waar kan ik mijn fiets stallen bij het station?';

test('Klimaatfonds: een te korte vraag weigert met reden, een vraag komt in het lab, het filter is een beeld, de alias wordt gevraagd en een stem telt een keer',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-klimaat-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const lid = async (naam) => {
      const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: naam, email: 'x' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      return { token: reg.body.token, codenaam: reg.body.state.user.codename };
    };
    let browser;
    try {
      const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
      assert.ok(kantoor, 'geen kantoorsessie; het lab en het project komen daar vandaan');

      /* Het lab waar dit venster op staat. */
      const lab = await post('/api/lab2/lab/maak', { stad: 'Beverwijk', naam: 'Living Lab Beverwijk' }, kantoor);
      assert.equal(lab.status, 200, JSON.stringify(lab.body).slice(0, 160));
      const LAB = lab.body.lab.id;
      /* Een vraag van een ANDERE soort in hetzelfde lab: die hoort hier niet in
         beeld, en wel in het antwoord van de server. */
      const fiets = await post('/api/lab2/bewoner/thema', { labId: LAB, vraag: FIETSVRAAG, soort: 'mobiliteit' });
      assert.equal(fiets.status, 200, JSON.stringify(fiets.body).slice(0, 160));
      assert.equal(fiets.body.thema.soort, 'mobiliteit');

      /* Een lopend duurzaamheidsproject van de stichting. Een project dat nooit
         beoordeeld is mag geen geld ontvangen, dus wie het indient keurt het
         niet zelf goed -- vandaar een tweede mens in het bestuur. */
      const stad = await post('/api/rtfos/stad/maak', { naam: 'Beverwijk' }, kantoor);
      assert.equal(stad.status, 200, JSON.stringify(stad.body).slice(0, 160));
      const STAD = stad.body.stad.id;
      await post('/api/rtfos/stad/status', { id: STAD, status: 'actief' }, kantoor);
      const tweede = await lid('Tweede Bestuurder');
      await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, tweede.token);
      const bestuur2 = (await post('/api/account/start', { rol: 'kantoor' }, tweede.token)).body.token;
      assert.ok(bestuur2, 'de tweede kantoormedewerker kreeg geen sessie');
      const geef = await post('/api/office/boardroom/toegang/geef', { codenaam: tweede.codenaam }, kantoor);
      assert.equal(geef.status, 200, 'boardroom-toegang geven mislukte: ' + JSON.stringify(geef.body).slice(0, 160));
      const project = await post('/api/rtfos/project/maak', { stad: STAD, naam: 'Groene daken Beverwijk',
        soort: 'duurzaam', budget: 0 }, kantoor);
      assert.equal(project.status, 200, JSON.stringify(project.body).slice(0, 160));
      const PROJECT = project.body.project.id;
      await post('/api/rtfos/project/status', { id: PROJECT, status: 'aanvraag' }, kantoor);
      await post('/api/rtfos/project/status', { id: PROJECT, status: 'beoordeling' }, kantoor);
      const goed = await post('/api/rtfos/project/status', { id: PROJECT, status: 'goedgekeurd' }, bestuur2);
      assert.equal(goed.status, 200, 'goedkeuren door de tweede bestuurder mislukte: ' + JSON.stringify(goed.body).slice(0, 160));
      const actief = await post('/api/rtfos/project/status', { id: PROJECT, status: 'actief' }, bestuur2);
      assert.equal(actief.status, 200, 'het project werd niet actief: ' + JSON.stringify(actief.body).slice(0, 160));

      const bewoner = await lid('Buurvrouw Bo');

      browser = await pw.chromium.launch(browserOpties(pw));

      /* 5a. Zonder ledensessie: het venster werkt, de werklijst vraagt om inloggen. */
      const gast = await browser.newContext({ viewport: { width: 900, height: 1000 } });
      await gast.addInitScript(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl'); });
      const zonder = await gast.newPage();
      await zonder.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await zonder.waitForSelector('#labs [data-lab]', { state: 'visible', timeout: 20000 });
      await zonder.locator('#labs [data-lab="' + LAB + '"]').click();
      await wachtOpTekst(zonder, /Log in met je eigen RTG-account/, { in: '#werklijst' });
      assert.ok(!(await tekstVan(zonder, '#werklijst')).includes('Groene daken'), 'zonder sessie stond het project toch in de werklijst');
      await gast.close();

      /* De bewoner, met sessie en zonder alias. */
      const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.removeItem('rtf_lab_alias');
      }, bewoner.token);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      const verzoeken = [];
      page.on('request', (r) => { try { verzoeken.push(new URL(r.url()).pathname); } catch (e) { /* geen url */ } });
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#labs [data-lab]', { state: 'visible', timeout: 20000 });
      assert.match(await tekstVan(page, '#labs'), /Beverwijk/);
      await page.locator('#labs [data-lab="' + LAB + '"]').click();
      await wachtTot(page, () => { const i = document.querySelector('#inhoud'); return i && !i.classList.contains('verborgen'); },
        null, { wat: 'de inhoud na het kiezen van een lab' });
      await wachtOpTekst(page, /Nog geen vraag over duurzaamheid/, { in: '#themas' });

      /* 3. Het filter is een beeld: de fietsvraag staat er niet, en wel op de server. */
      assert.ok(!(await tekstVan(page, '#themas')).includes('fiets'), 'een vraag over mobiliteit stond in het klimaatvenster');
      const opServer = await post('/api/lab2/bewoner/themas', { labId: LAB });
      assert.ok((opServer.body.themas || []).some((t) => t.vraag === FIETSVRAAG), 'de fietsvraag staat niet op de server; dan zegt het filter hierboven niets');

      /* 1. Een te korte vraag: geweigerd met de zin van de server. */
      await page.locator('#nieuwIdee').fill('Te kort');
      const teKort = page.waitForResponse((r) => r.url().endsWith('/api/lab2/bewoner/thema'), { timeout: 15000 });
      await page.locator('#stuur').click();
      assert.equal((await teKort).status(), 400, 'een vraag van zeven tekens kwam erdoor');
      await wachtOpTekst(page, /Welke vraag leeft er in de buurt/, { in: '#melding' });
      assert.match(await tekstVan(page, '#themas'), /Nog geen vraag over duurzaamheid/, 'de lijst veranderde na een geweigerde vraag');

      /* 2. Een echte vraag: een echte handeling. */
      await page.locator('#nieuwIdee').fill(VRAAG);
      const gezet = page.waitForResponse((r) => r.url().endsWith('/api/lab2/bewoner/thema'), { timeout: 15000 });
      await page.locator('#stuur').click();
      assert.equal((await gezet).status(), 200, 'de vraag aandragen via het scherm lukt');
      await wachtOpTekst(page, /straat met bomen/, { in: '#themas' });
      assert.equal(await tekstVan(page, '#melding'), '', 'de weigering van daarnet bleef staan na een gelukte vraag');
      assert.equal(await page.locator('#nieuwIdee').inputValue(), '', 'het vraagveld is niet leeggemaakt');
      assert.equal(await page.locator('#themas [data-stem]').count(), 1, 'het venster toont niet precies de ene duurzaamheidsvraag');
      assert.equal(await tekstVan(page, '#themas [data-stem] b'), '0');
      assert.match(await tekstVan(page, '#themas'), /nog geen onderzoek/);
      const naAandragen = await post('/api/lab2/bewoner/themas', { labId: LAB });
      const thema = (naAandragen.body.themas || []).find((t) => t.vraag === VRAAG);
      assert.ok(thema, 'de vraag staat niet in het lab op de server');
      assert.equal(thema.soort, 'duurzaam', 'het venster droeg zijn soort niet mee');

      /* 4. De alias wordt gevraagd, en een stem telt een keer. */
      const voorStem = verzoeken.filter((p) => p === '/api/lab2/bewoner/stem').length;
      await page.locator('#themas [data-stem]').click();
      await wachtTot(page, () => { const a = document.querySelector('#aliasrij'); return a && !a.classList.contains('verborgen'); },
        null, { wat: 'het aliasveld na een stem zonder alias' });
      await wachtOpTekst(page, /Een stem draagt een naam of alias/, { in: '#melding' });
      assert.equal(verzoeken.filter((p) => p === '/api/lab2/bewoner/stem').length, voorStem,
        'zonder alias ging er toch een stem naar de server');
      assert.equal(await tekstVan(page, '#themas [data-stem] b'), '0', 'een stem zonder alias telde');

      await page.locator('#alias').fill('Buurvrouw');
      await page.locator('#aliasOk').click();
      await wachtTot(page, () => { const a = document.querySelector('#aliasrij'); return a && a.classList.contains('verborgen'); },
        null, { wat: 'het aliasveld dicht na "Onthoud dit"' });
      const stem1 = page.waitForResponse((r) => r.url().endsWith('/api/lab2/bewoner/stem'), { timeout: 15000 });
      await page.locator('#themas [data-stem]').click();
      assert.equal((await stem1).status(), 200, 'stemmen met een alias lukt');
      await wachtTot(page, () => { const b = document.querySelector('#themas [data-stem] b'); return b && b.textContent.trim() === '1'; },
        null, { wat: 'de teller op 1' });

      const stem2 = page.waitForResponse((r) => r.url().endsWith('/api/lab2/bewoner/stem'), { timeout: 15000 });
      await page.locator('#themas [data-stem]').click();
      assert.equal((await stem2).status(), 409, 'een tweede stem van dezelfde alias kwam erdoor');
      await wachtOpTekst(page, /al op dit thema gestemd/, { in: '#melding' });
      assert.equal(await tekstVan(page, '#themas [data-stem] b'), '1', 'de tweede stem van dezelfde alias telde mee');
      const geteld = (await post('/api/lab2/bewoner/themas', { labId: LAB })).body.themas.find((t) => t.id === thema.id);
      assert.equal(geteld.stemmen, 1, 'de server telde de tweede stem wel');

      /* 5b. Het werk dat eruit voortkomt, met sessie. */
      await wachtOpTekst(page, /Groene daken Beverwijk/, { in: '#werklijst' });
      const knop = page.locator('#werklijst a.kfknop');
      assert.equal(await knop.count(), 1);
      assert.equal((await knop.textContent()).trim(), 'Hieraan geven');
      assert.equal(await knop.getAttribute('href'), '/apps/foundation/geven.html?project=' + encodeURIComponent(PROJECT),
        'de knop wijst niet naar het geverscherm met dit project');
      assert.match(await tekstVan(page, '#werklijst'), /Beverwijk/, 'de stad van het project staat er niet bij');

      assert.deepEqual(fouten, [], 'geen JS-fouten op het klimaatfonds: ' + fouten.join(' | '));
      await ctx.close();
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
