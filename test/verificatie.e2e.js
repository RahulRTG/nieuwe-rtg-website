/* HET VERIFICATIESCHERM (/apps/verificatie.html) IN EEN ECHTE BROWSER.

   WAAROM DIT SCHERM BESTAAT. De routes /api/verify/upload, /selfie en /status
   stonden er al, en de kantoorkant (backoffice.js -> /office/verifications en
   /office/verify) ook. Maar GEEN ENKELE regel in public/ riep ze aan: er was
   nergens een scherm waarmee een lid zijn identiteit kon laten zien. Alleen de
   testhelper keurLidGoed gebruikte die routes. Het gevolg was dat niemand ooit
   door de A3-poort kwam, en dus dat elke machtiging uit RTG Vertegenwoordiging
   403 gaf -- niet door een defect, maar omdat de weg erheen ontbrak.

   Dit is precies BETROUWBAARHEID.md: een functie bestaat pas als een echte
   gebruiker haar bedoeling kan voltooien. Vier routes en een kantoorscherm zijn
   geen functie zolang de mens er niet bij kan.

   WAT DEZE TOETS VASTLEGT:

   1. HET SCHERM ZEGT WAAR JE STAAT, en een vers lid is niet "stuk" maar "nog
      niet begonnen".
   2. DE UPLOAD KOMT ECHT AAN. Na het kiezen van een foto staat de stand op de
      SERVER op `pending` en staat het lid in de kantoorrij -- niet alleen een
      groen vinkje op het scherm.
   3. DE SELFIE OOK.
   4. DE LUS IS ROND. Na goedkeuring door het kantoor (met de geboortedatum van
      het document) toont het scherm `Geverifieerd`, EN gaat een machtiging die
      daarvoor 403 gaf er nu wel doorheen. Dat laatste is de eigenlijke
      bewering: verificatie is niet een scherm maar een sleutel.

   Wat NIET is beproefd: de afwijzingsweg (die wist het bewijs en mailt), en de
   bewaartermijn van een jaar. Beide hebben hun eigen plek.

   Draai los: node --test test/verificatie.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon } = require('./helper');

const pw = laadPlaywright();
/* Een 1x1 PNG: de server controleert de VORM van de data-URL en de omvang, niet
   of er een gezicht op staat. Een echte scan in de repo zetten zou een
   identiteitsbewijs in de git-historie zijn. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAoHf3ZQAAAAASUVORK5CYII=', 'base64');
const foto = (naam) => ({ name: naam, mimeType: 'image/png', buffer: PNG });

test('Een lid toont zijn identiteit, het kantoor keurt, en daarmee gaat de machtiging open',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verif-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    let browser;
    try {
      const client = (await post('/api/auth/register', { name: 'Talent Verif', email: 'verif1@x.nl',
        phone: '0612348001', password: 'geheim12345', geboortedatum: '1991-05-05', tier: 'rtg' })).body;
      const agent = (await post('/api/auth/register', { name: 'Waarnemer Verif', email: 'verif2@x.nl',
        phone: '0612348002', password: 'geheim12345', geboortedatum: '1983-06-06', tier: 'rtg' })).body;
      assert.ok(client.token && agent.token, 'beide leden zijn aangemeld');
      const clientCode = (await post('/api/state', {}, client.token)).body.state.user.codename;

      /* DE NULMETING: zonder verificatie gaat de machtiging niet door. Zonder
         deze stap bewijst punt 4 niets -- dan zou de machtiging ook geslaagd
         kunnen zijn omdat hij nooit dicht zat. */
      const agentCode = (await post('/api/state', {}, agent.token)).body.state.user.codename;
      const tot = new Date(Date.now() + 90 * 86400000).toISOString();
      const voor = await post('/api/vertegenwoordiging/voorstel', { client: clientCode,
        hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'], tot }, agent.token);
      assert.equal(voor.status, 403, 'vooraf hoort de machtiging dicht te zitten');
      assert.match(voor.body.error, /verificatie\.html/,
        'de weigering hoort te zeggen WAAR je dat oplost, niet alleen dat het moet');

      browser = await pw.chromium.launch(browserOpties());
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript((t) => { try { localStorage.setItem('rtg_member_token', t); } catch (e) {} }, client.token);
      const page = await ctx.newPage();
      letOpFouten(page);

      /* 1. Waar sta ik? */
      await page.goto(base + '/apps/verificatie.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stand .stand, #stand');
      await page.waitForFunction(() => !/ophalen/.test(document.querySelector('#stand').textContent));
      assert.match(await page.textContent('#stand'), /nog niet begonnen|nog geen/i,
        'een vers lid hoort te lezen dat hij nog niets heeft ingestuurd, niet dat er iets stuk is');

      /* 2. De upload komt echt aan. */
      await page.setInputFiles('#doc', foto('paspoort.png'));
      await page.waitForSelector('#docKlaar:not([hidden])');
      assert.equal((await post('/api/verify/status', {}, client.token)).body.status, 'pending',
        'na het kiezen van een foto hoort de SERVER op pending te staan');

      const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
      assert.ok(office, 'het kantoor logt in');
      const rij = (await post('/api/office/verifications', {}, office)).body.pending || [];
      const mij = rij.find(x => x.codename === clientCode);
      assert.ok(mij, 'het lid staat in de keuringsrij van het kantoor');

      /* 3. De selfie ook. */
      await page.setInputFiles('#selfie', foto('selfie.png'));
      await page.waitForSelector('#selfieKlaar:not([hidden])');

      /* 4. De lus is rond. */
      const besluit = await post('/api/office/verify', { userId: mij.id, decision: 'approve',
        faceMatch: true, geboortedatum: '1991-05-05' }, office);
      assert.equal(besluit.status, 200, 'de keuring gaat door: ' + JSON.stringify(besluit.body).slice(0, 160));

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stand .stand.verified');
      assert.match(await page.textContent('#stand'), /A3/,
        'het scherm hoort te zeggen welk niveau je nu haalt, niet alleen dat het gelukt is');

      const na = await post('/api/vertegenwoordiging/voorstel', { client: clientCode,
        hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'], tot }, agent.token);
      assert.equal(na.status, 200,
        'na de keuring hoort dezelfde machtiging er WEL doorheen te gaan: ' + JSON.stringify(na.body).slice(0, 200));
      assert.ok(agentCode, 'de vertegenwoordiger heeft een codenaam');
    } finally {
      if (browser) await browser.close().catch(() => {});
      stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });
