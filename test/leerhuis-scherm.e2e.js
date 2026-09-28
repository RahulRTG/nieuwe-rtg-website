/* MIJN LEERHUIS IN EEN ECHTE BROWSER (ACADEMY.md, fase B-UI).

   test/leerhuis-routes.test.js bewijst de deur, niet het scherm. Deze toets
   opent /apps/leerhuis.html als lid en kijkt naar wat er staat -- in de drie
   standen waarin een lid hem werkelijk tegenkomt:

   1. DE FUNCTIE STAAT UIT (zo staat hij standaard). Het scherm zegt dat in
      woorden en blijft niet leeg of half geladen hangen.
   2. EEN ORGANISATIE ZONDER RELATIE. Het scherm zegt dat u daar geen relatie
      hebt; het toont niets van die organisatie.
   3. EEN ORGANISATIE MET RELATIE. De vier vakken zeggen wat er (nog) niet is,
      en het scherm onthoudt de gekozen code voor de volgende keer.

   4. DE COCKPITS. Wie geen trainer is en geen team heeft, ziet die vakken
      niet. De manager ziet zijn teamlid op CODENAAM, nooit op de sleutel
      `lid:<id>` en nooit op de echte naam.

   En er staat nergens een procent of een score: dat is een grens van de laag
   (geen cijfer op een mens), dus hij hoort ook op het scherm te houden.

   Draai los: node --test test/leerhuis-scherm.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser, kantoorAlsPersoon } = require('./helper');

const pw = laadPlaywright();

test('Mijn leerhuis: uit, zonder relatie en met relatie, telkens met woorden en zonder cijfer op een mens',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerhuis-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const lid = async (n, mail, tel) => (await post('/api/auth/register', { name: n, email: mail, phone: tel,
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;

    let browser;
    try {
      const E = await lid('Leerhuis Eigenaar', 'lhs-e@x.nl', '0612349701');
      const N = await lid('Leerhuis Collega', 'lhs-n@x.nl', '0612349702');
      const nId = (await post('/api/state', {}, N)).body.state.user.id;
      const eId = (await post('/api/state', {}, E)).body.state.user.id;

      browser = await pw.chromium.launch(browserOpties());
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript((token) => { try { localStorage.setItem('rtg_member_token', token); } catch (e) {} }, N);
      const page = await ctx.newPage();
      letOpFouten(page);
      const klaar = () => page.waitForFunction(() => !/wordt geladen/.test(document.getElementById('melding').textContent));

      /* 1. De functie staat uit. */
      await page.goto(base + '/apps/leerhuis.html?org=RTG-OPS', { waitUntil: 'domcontentloaded' });
      await klaar();
      const uit = await page.textContent('#melding');
      assert.ok(uit.trim().length > 10 && !/Leerhuis RTG-OPS\.$/.test(uit.trim()), 'uit hoort te zeggen waarom: ' + uit);
      assert.match(await page.textContent('#vandaag'), /Niet te tonen/);

      const login = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body;
      const vz = (await post('/api/techniek/functie', { id: 'leerhuis', aan: true }, login.token)).body;
      if (vz.status === 'wacht') await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, login.token);
      const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
      assert.equal((await post('/api/office/leerhuis/open', { id: 'RTG-OPS', soort: 'RTG', naam: 'Operations', eigenaar: 'user-' + eId }, office)).status, 200);

      /* 2. Zonder relatie. */
      await page.reload({ waitUntil: 'domcontentloaded' });
      await klaar();
      assert.match(await page.textContent('#melding'), /geen lopende relatie/);

      /* 3. Met relatie, en de code wordt onthouden. */
      assert.equal((await post('/api/leerhuis/doe', { org: 'RTG-OPS', actie: 'relatieZet',
        invoer: { persoon: 'lid:' + nId, soort: 'EMPLOYEE' }, sleutel: 'scherm-rel' }, E)).status, 200);
      await page.goto(base + '/apps/leerhuis.html', { waitUntil: 'domcontentloaded' });
      await klaar();
      assert.equal(await page.inputValue('#org'), 'RTG-OPS', 'de gekozen code wordt onthouden');
      assert.match(await page.textContent('#melding'), /Leerhuis RTG-OPS\./);
      assert.match(await page.textContent('#pad'), /nog geen curriculum/);
      assert.match(await page.textContent('#kan'), /nog niets op uw naam/);
      assert.doesNotMatch(await page.textContent('main'), /\d+\s*%|score/i, 'geen cijfer op een mens');
      assert.equal(await page.isVisible('#trainerBlok'), false, 'geen trainer, geen trainervak');
      assert.equal(await page.isVisible('#teamBlok'), false, 'geen team, geen teamvak');

      /* 4. De eigenaar is manager van N: hij ziet N op codenaam. */
      assert.equal((await post('/api/leerhuis/doe', { org: 'RTG-OPS', actie: 'relatieZet',
        invoer: { persoon: 'lid:' + nId, soort: 'EMPLOYEE', manager: 'lid:' + eId }, sleutel: 'scherm-rel-m' }, E)).status, 200);
      const codeN = (await post('/api/state', {}, N)).body.state.user.codename;
      const eigenaar = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await eigenaar.addInitScript((token) => { try { localStorage.setItem('rtg_member_token', token); } catch (e) {} }, E);
      const pe = await eigenaar.newPage();
      letOpFouten(pe);
      await pe.goto(base + '/apps/leerhuis.html?org=RTG-OPS', { waitUntil: 'domcontentloaded' });
      await pe.waitForSelector('#teamBlok:not([hidden])');
      const team = await pe.textContent('#team');
      assert.ok(team.includes(codeN), 'de codenaam van het teamlid staat er: ' + team);
      assert.doesNotMatch(team, /lid:\d+|Leerhuis Collega/, 'geen sleutel en geen echte naam');
      assert.equal(await pe.isVisible('#trainerBlok'), false);
    } finally {
      if (browser) await browser.close().catch(() => {});
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });
