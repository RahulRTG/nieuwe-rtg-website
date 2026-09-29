/* DEMOCRATIEOS V1 IN EEN ECHTE BROWSER: /apps/foundation/kwesties.html (de
   burger) en /apps/foundation/kwestiekantoor.html (het kantoor op naam).

   test/democratie.test.js en test/democratie-aanval.test.js bewijzen de lus op
   de routes. Dat zegt niets over de schermen: of een burger zijn kwestie kan
   inbrengen zonder de API te kennen, of de uitkomst MET de reden op zijn scherm
   komt, of "gelezen" pas vertrekt als hij hem openklapt, en of het kantoor met
   de gedeelde code een uitleg krijgt in plaats van een lege lijst. De hele lus
   loopt hier dus door twee browsers, en elke stap die een ander ziet, wordt bij
   die ander nagekeken.

     1  DE DEUREN. Zonder ledensessie een inlogkaart en geen verzoek; met de
        gedeelde kantoorcode de weigering van de server, op het scherm.
     2  INBRENGEN. Te kort wordt geweigerd voordat er iets vertrekt; daarna staat
        de kwestie in de lijst als "Ontvangen", zonder de naam van de burger.
     3  HET KANTOOR ziet de kwestie zonder wie hem inbracht, legt een eindstand
        met reden vast, en de meter staat op nul onverklaard.
     4  DE UITKOMST komt bij de burger als "Nieuw", met de reden en de codenaam
        van wie besliste. GELEZEN vertrekt pas bij openklappen.

   Draai los: node --test test/kwesties-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, wachtTot, wachtOpTekst, tekstVan } = require('./helper');

const pw = laadPlaywright();
const BURGER = '/apps/foundation/kwesties.html';
const KANTOOR = '/apps/foundation/kwestiekantoor.html';
const OFFICE_CODE = 'KWESTIES-SCHERM';
const REDEN = 'Er komt een zebrapad met een lamp, besloten in de buurtraad van dinsdag.';

test('Wat speelt er: inbrengen, het kantoor beslist op naam, de burger leest de uitkomst met de reden',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kwesties-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
    const reg = await post('/api/auth/register', { name: 'Kees Kwestie', email: 'k' + u + '@x.nl',
      phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'de burger is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
    const A = { token: reg.body.token, naam: 'Kees Kwestie', email: 'k' + u + '@x.nl' };
    let browser;
    try {
      const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
      assert.ok(kantoor, 'geen kantoormens op naam');
      const gedeeld = (await post('/api/office/login', { code: OFFICE_CODE })).body.token;
      assert.ok(gedeeld, 'de gedeelde kantoorcode logt in');

      browser = await pw.chromium.launch(browserOpties(pw));
      const context = async (zet) => {
        const c = await browser.newContext({ viewport: { width: 900, height: 900 } });
        await c.addInitScript((z) => {
          localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl');
          for (const k of Object.keys(z)) localStorage.setItem(k, z[k]);
        }, zet || {});
        return c;
      };
      /* Draait IN de browser: de selector gaat als argument mee, niet als closure. */
      const zichtbaar = (sel) => { const p = document.querySelector(sel); return p && !p.classList.contains('verborgen'); };

      /* 1a. De burgerdeur zonder sessie. */
      const gast = await context();
      const deur = await gast.newPage();
      const deurVerzoeken = [];
      deur.on('request', (r) => { try { deurVerzoeken.push(new URL(r.url()).pathname); } catch (e) { /* geen url */ } });
      await deur.goto(base + BURGER, { waitUntil: 'domcontentloaded' });
      await wachtTot(deur, zichtbaar, '#poort', { wat: 'de inlogkaart zonder sessie' });
      assert.ok(!deurVerzoeken.some((p) => p.startsWith('/api/member/democratie/')), 'zonder sessie ging er een kwestieverzoek uit');
      await gast.close();

      /* 1b. De kantoordeur met de gedeelde code: de reden van de server staat er. */
      const gc = await context({ rtg_office_token: gedeeld });
      const gp = await gc.newPage();
      await gp.goto(base + KANTOOR, { waitUntil: 'domcontentloaded' });
      await wachtTot(gp, zichtbaar, '#poort', { wat: 'de weigering voor de gedeelde code' });
      await wachtOpTekst(gp, /op naam/i, { in: '#poortTekst' });
      assert.ok(await gp.locator('#app').evaluate((el) => el.classList.contains('verborgen')), 'de gedeelde code zag toch de kwesties');
      await gc.close();

      /* 2. Inbrengen als burger. */
      const bc = await context({ rtg_member_token: A.token });
      const bp = await bc.newPage();
      const fouten = [];
      letOpFouten(bp, fouten);
      const verzoeken = [];
      bp.on('request', (r) => { try { verzoeken.push(new URL(r.url()).pathname); } catch (e) { /* geen url */ } });
      await bp.goto(base + BURGER, { waitUntil: 'domcontentloaded' });
      await wachtOpTekst(bp, /nog geen kwestie ingebracht/, { in: '#lijst' });
      assert.equal(await bp.locator('[data-hoofdactie]').count(), 1, 'het scherm heeft precies een hoofdactie');

      await bp.locator('#kOnderwerp').fill('te kort');
      await bp.locator('#inbreng').click();
      await wachtOpTekst(bp, /Schrijf er iets meer over/, { in: '#melding' });
      assert.ok(!verzoeken.includes('/api/member/democratie/kwestie/inbreng'), 'een te korte kwestie ging toch naar de server');

      await bp.locator('#kOnderwerp').fill('De oversteek bij de basisschool is onveilig voor kinderen');
      await bp.locator('#kGebied').fill('Kerkbuurt');
      const ingebracht = bp.waitForResponse((r) => r.url().endsWith('/api/member/democratie/kwestie/inbreng'), { timeout: 15000 });
      await bp.locator('#inbreng').click();
      const antwoord = await (await ingebracht).json();
      const id = antwoord.kwestie && antwoord.kwestie.id;
      assert.match(String(id), /^KW-[0-9A-F]{6}$/, 'inbrengen via het scherm gaf geen kwestie');
      await wachtOpTekst(bp, new RegExp('Ontvangen als ' + id), { in: '#melding' });
      await wachtOpTekst(bp, /De oversteek bij de basisschool/, { in: '#lijst' });
      assert.match(await tekstVan(bp, '#lijst'), /Ontvangen/i, 'de stand staat er niet in gewone taal');
      assert.ok(await bp.locator('[data-intrek="' + id + '"]').count() === 1, 'zolang er niets besloten is, kan de burger intrekken');

      /* 3. Het kantoor op naam. */
      const kc = await context({ rtg_office_token: kantoor });
      const kp = await kc.newPage();
      letOpFouten(kp, fouten);
      await kp.goto(base + KANTOOR, { waitUntil: 'domcontentloaded' });
      await wachtOpTekst(kp, /De oversteek bij de basisschool/, { in: '#lijst' });
      const kantoorTekst = await tekstVan(kp, 'body');
      assert.ok(!kantoorTekst.includes(A.naam) && !kantoorTekst.includes(A.email), 'het kantoor ziet wie de kwestie inbracht');
      assert.ok(!/ib-[0-9a-f]{6,}/.test(kantoorTekst), 'het inbrengersnummer staat op het kantoorscherm');
      await kp.locator('[data-eind="' + id + '"]').selectOption('samen-opgelost');
      await kp.locator('[data-toelichting="' + id + '"]').fill(REDEN);
      const gesloten = kp.waitForResponse((r) => r.url().endsWith('/api/office/democratie/kwestie/eindstand'), { timeout: 15000 });
      await kp.locator('[data-sluit="' + id + '"]').click();
      assert.equal((await gesloten).status(), 200, 'de eindstand vastleggen via het scherm lukt');
      await wachtOpTekst(kp, /Eindstand vastgelegd/, { in: '#melding' });
      await wachtTot(kp, () => { const t = document.querySelector('#tellers'); return t && /onverklaard/.test(t.textContent); },
        null, { wat: 'de meter' });
      const nul = await kp.locator('.teller.breuk').count();
      assert.equal(nul, 0, 'de meter meldt een onverklaarde kwestie');
      await kc.close();

      /* 4. De uitkomst bij de burger; gelezen pas bij openklappen. */
      await bp.reload({ waitUntil: 'domcontentloaded' });
      await wachtOpTekst(bp, /Nieuw: Samen opgelost/i, { in: '#lijst' });
      const voor = verzoeken.filter((p) => p === '/api/member/democratie/kwestie/gezien').length;
      assert.equal(voor, 0, 'de lijst laden gaf al een gezien-melding');
      const gezien = bp.waitForResponse((r) => r.url().endsWith('/api/member/democratie/kwestie/gezien'), { timeout: 15000 });
      await bp.locator('details[data-id="' + id + '"] summary').click();
      assert.equal((await gezien).status(), 200, 'openklappen meldde niet dat de uitkomst gelezen is');
      const uitkomst = await tekstVan(bp, 'details[data-id="' + id + '"]');
      assert.ok(uitkomst.includes(REDEN), 'de reden staat niet bij de uitkomst: ' + uitkomst.slice(0, 300));
      assert.match(uitkomst, /Besloten door /, 'er staat niet bij wie besliste');
      const mijn = await post('/api/member/democratie/kwestie/mijn', {}, A.token);
      assert.equal(mijn.body.kwesties[0].rondes[0].terugkoppeling.stand, 'gezien', 'de server weet niet dat de burger het las');
      assert.deepEqual(fouten, [], 'fouten in de browser: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      stop(child);
    }
  });
