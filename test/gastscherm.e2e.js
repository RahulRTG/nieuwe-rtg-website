/* ============================================================================
   AAN TAFEL: DE GAST SCANT, SCHUIFT AAN EN ZIET ZIJN REKENING.

   HET LAATSTE SCHERM ZONDER EIGEN TOETS. Na de ronde van 18 augustus stond
   /apps/gast.html als enige van 261 schermen op "nooit afgelegd": wel drie keer
   opgehaald (een service worker, een veegtoets), nooit door een toets bezocht.
   En dat terwijl dit het ENIGE scherm is dat een vreemde zonder enige sessie
   bedient -- de QR op tafel is er de toegangscontrole. Juist zo'n deur hoort
   een toets te hebben die hem echt opent.

   DE WEG DIE HIER WORDT AFGELEGD is de weg van de sticker:

     1. de zaak drukt een QR (POST /api/supplier/horeca/gast/qr)
     2. de gast opent het pad dat daar letterlijk uit komt (?t=<token>)
     3. het scherm noemt de zaak en de tafel -- dat kwam van de server
     4. de gast schuift aan met alleen een naam, en ziet de rekening
     5. zonder token zegt het scherm wat je moet doen, en toont het GEEN zaak

   Die vijfde is de privacyhelft: een gast-URL zonder geldig token mag niets
   over een zaak of een tafel prijsgeven.

   MUTATIEBEWIJS (LAT.md regel 2 en 9). Twee keer gebroken, twee keer gezakt:

     de zaaknaam ook zonder geldig token tonen  -> subtoets 3 zakt
     aanschuiven bewaart de sleutel niet        -> subtoets 2 zakt

   En de toets brak eerst op ZICHZELF, twee keer, en dat hoort hier te staan:
   waitForSelector wacht standaard op een ZICHTBAAR element, dus wachten op
   '#vAanschuif[hidden]' kan nooit slagen; en de kop draagt statisch al 'Aan
   tafel', dus "er staat een naam" was al waar voordat de server iets zei. Een
   toets die op zijn eigen wachtvoorwaarde zakt, meldt een fout die er niet is.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('de gast scant de QR, schuift aan en ziet zijn rekening; zonder token ziet hij niets',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gastscherm-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    /* De zaak drukt zijn sticker. Het antwoord draagt het PAD dat op de sticker
       komt; de toets gebruikt letterlijk dat pad en bouwt het niet zelf op --
       anders toetst hij zijn eigen aanname in plaats van de sticker. */
    const sup = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body;
    assert.ok(sup.token, 'de demo-leverancier kan inloggen');
    const qr = (await post('/api/supplier/horeca/gast/qr', { tafel: 'Tafel 7' }, sup.token)).body;
    assert.ok(qr.token && qr.pad, 'de QR-uitgifte geeft een token en een pad: ' + JSON.stringify(qr).slice(0, 120));
    assert.ok(qr.pad.includes(qr.token), 'het pad draagt het token');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await t.test('met de QR: de zaak en de tafel komen van de server', async () => {
      await page.goto(srv.base + qr.pad, { waitUntil: 'domcontentloaded' });
      /* NIET wachten op "er staat een naam": de kop draagt statisch al 'Aan
         tafel', dus die wacht slaagt voordat de server iets heeft gezegd. De
         wacht is dat de naam VERANDERT -- dat kan alleen de server doen. */
      await page.waitForFunction(() => {
        const el = document.querySelector('#zaakNaam');
        return el && el.textContent.trim() !== 'Aan tafel';
      }, null, { timeout: 20000 });
      const kop = await page.evaluate(() => ({
        zaak: document.querySelector('#zaakNaam').textContent,
        sub: document.querySelector('#zaakSub').textContent
      }));
      assert.ok(kop.zaak.trim(), 'de zaak heeft een naam');
      assert.match(kop.sub, /Tafel 7/, 'de tafel van de sticker staat op het scherm: ' + kop.sub);
    });

    await t.test('aanschuiven met alleen een naam, en de rekening verschijnt', async () => {
      await page.waitForSelector('#vAanschuif:not([hidden])', { timeout: 10000 });
      await page.fill('#naam', 'Proefgast');
      await page.click('#bAanschuif');
      /* Aangeschoven is: het aanschuifvenster is weg en er staat een rekening.
         De INHOUD van die rekening (leeg of niet) is hier niet de bewering;
         dat een vreemde met alleen een naam een sessie krijgt, is het. */
      /* GEEN waitForSelector: die wacht standaard op een ZICHTBAAR element, en
         een element met [hidden] is per definitie niet zichtbaar -- die wacht
         kan dus nooit slagen. Dat is hier gebeurd: de flow werkte, de toets
         zakte op zijn eigen wachtvoorwaarde. */
      await page.waitForFunction(() => document.querySelector('#vAanschuif').hidden === true,
        null, { timeout: 10000 });
      const sleutel = await page.evaluate((tok) => localStorage.getItem('rtg_gast_' + tok), qr.token);
      assert.ok(sleutel, 'de gast heeft een sessiesleutel gekregen');
    });

    await t.test('zonder token: uitleg, en geen woord over een zaak', async () => {
      const kaal = await ctx.newPage();
      const kaalFouten = [];
      letOpFouten(kaal, kaalFouten);
      await kaal.goto(srv.base + '/apps/gast.html', { waitUntil: 'domcontentloaded' });
      await kaal.waitForFunction(() => {
        const el = document.querySelector('#melding');
        return el && !el.hidden && el.textContent.trim().length > 0;
      }, null, { timeout: 10000 });
      const stand = await kaal.evaluate(() => ({
        melding: document.querySelector('#melding').textContent,
        zaak: document.querySelector('#zaakNaam').textContent
      }));
      assert.match(stand.melding, /Scan de QR/, 'het scherm zegt wat je moet doen');
      /* De kop blijft op zijn NEUTRALE tekst staan. 'Aan tafel' is de statische
         plaatshouder; elke andere tekst kan alleen van de server komen en zou
         dus een zaak prijsgeven aan wie geen token heeft. */
      assert.strictEqual(stand.zaak.trim(), 'Aan tafel',
        'zonder token geen zaaknaam -- een gast-URL mag niets prijsgeven, nu: "' + stand.zaak + '"');
      assert.deepEqual(kaalFouten, [], 'paginafouten: ' + kaalFouten.join(' | '));
      await kaal.close();
    });

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    srv.child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* EN DE PUBLIEKE INGANG APART (main, 23 augustus): wie ZONDER code binnenkomt
   krijgt de volgende stap uitgelegd -- geen leeg scherm, geen leden- of
   leveranciersdeur. De QR-stroom hierboven bewijst de route met code; deze
   bewijst de route zonder. */
test('de publieke gastingang legt zonder QR-code de volgende stap uit',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);

    await page.goto(base + '/apps/gast.html', { waitUntil: 'load' });
    await page.waitForSelector('#melding:not([hidden])', { timeout: 10000 });

    assert.match(await page.locator('#zaakNaam').textContent(), /Aan tafel/);
    assert.match(await page.locator('#melding').textContent(), /Scan de QR-code op je tafel of op je kamer/);
    assert.equal(await page.locator('#vAanschuif').isVisible(), false,
      'zonder geldige QR vraagt het scherm nog geen persoonsgegevens');
    assert.deepEqual(fouten, [], 'het gastscherm opent zonder browserfouten');
  } finally {
    if (browser) await browser.close();
    stop(child);
  }
});

