/* Scherm-toets op DE TERUGGAVEN van de reisbalie (kantoren.html, kamer Reisbureau).

   WAAROM DIT BESTAND ER IS. Een afgezegde betaalde reis laat een teruggaverecht
   achter, en tot 11 oktober 2026 was er geen scherm om het uit te voeren: de balie
   zei "het geld handelt u zelf af". De serverkant staat in test/reisteruggave.test.js;
   hier moet blijken dat het scherm erop aangesloten zit.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:

   1. Het blok toont het recht dat de API kent: hetzelfde id, dezelfde reis, het
      bevroren bedrag -- niet "er staat een regel".
   2. "Voer uit" ZONDER passkey op het account beweegt geen cent, en het scherm zegt
      waarom in plaats van de medewerker uit te loggen. (Met een passkey is de hele
      baan tot en met de tweede mens bewezen in test/reisteruggave.test.js toets 1;
      een browserceremonie hoort daar niet bij te worden nagemaakt.)
   3. Afwijzen zonder reden verandert niets; mét reden is over het recht besloten
      (een tweede besluit geeft 409) en het verdwijnt van de balie. Of het lid die
      reden leest, toetst dit bestand NIET: geen ledenroute toont hem vandaag.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon, keurLidGoed, browserOpties, geenBrowser, laadPlaywright } = require('./helper');

const pw = laadPlaywright();
const CODE = 'KANTOOR-TERUG-1';

test('de teruggaven op de reisbalie: zichtbaar, niet zonder passkey, en afwijzen met reden',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisterug-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const reg = await post('/api/auth/register', { name: 'Terug Reiziger', email: 'tr' + u + '@voorbeeld.test',
      phone: '06' + u, password: 'Geheim123!', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const lid = reg.body.token;
    assert.ok(lid, JSON.stringify(reg.body).slice(0, 200));
    await keurLidGoed(srv.base, lid, reg.body.state.user.codename, '1990-01-01');
    assert.equal((await post('/api/pay/oplaad', { centen: 300000, idem: 'tr-op-' + u }, lid)).status, 200);
    const saldo = async () => (await post('/api/pay/overzicht', {}, lid)).body.saldo;

    const kantoor = await kantoorAlsPersoon(srv.base, CODE);
    assert.ok(kantoor, 'de eigenaar staat als persoon in de backoffice');
    const ref = (await post('/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, lid)).body.aanvraag.ref;
    assert.equal((await post('/api/office/reisbureau/besluit', { ref, besluit: 'bevestigd', bericht: 'Bevestigd.' }, kantoor)).status, 200);
    assert.equal((await post('/api/reisbureau/betaal', { ref }, lid)).status, 200);
    const af = await post('/api/office/reisbureau/afzeggen', { ref, reden: 'Het lid kan niet meer reizen.' }, kantoor);
    assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
    const id = af.body.aanvraag.geld.recht;
    assert.ok(id, 'de afzegging zette een recht klaar');
    const voor = await saldo();

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((tok) => {
      try { localStorage.setItem('rtg_office_token', tok); } catch (e) {}
    }, kantoor);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/kantoren.html?kamer=reisbureau', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#kReisbureau:not([hidden])', { timeout: 20000 });
    await page.waitForFunction((r) => {
      const el = document.querySelector('#kReisTerug');
      return el && el.innerText.includes(r);
    }, id, { timeout: 20000 });

    await t.test('het blok toont het recht dat de API kent', async () => {
      const tekst = await page.$eval('#kReisTerug', el => el.innerText);
      assert.ok(tekst.includes(id), 'het id van het recht: ' + tekst.slice(0, 200));
      assert.ok(tekst.includes(ref), 'de reis');
      assert.ok(tekst.includes('2200,00'), 'het bevroren bedrag (2200 euro): ' + tekst.slice(0, 200));
      assert.ok(/tweede mens/.test(tekst), 'boven de vier-ogengrens staat erbij dat er een tweede mens tekent');
      assert.ok(!tekst.includes('Terug Reiziger'), 'de echte naam komt hier niet in beeld');
    });

    await t.test('Voer uit zonder passkey beweegt geen geld, en het scherm zegt waarom', async () => {
      await page.click('button[data-tuit="' + id + '"]');
      await page.waitForFunction(() => {
        const m = document.querySelector('#melding');
        return m && m.style.opacity === '1' && /passkey|bevestig/i.test(m.textContent);
      }, null, { timeout: 20000 });
      assert.equal(await saldo(), voor, 'er bewoog geld zonder passkey');
      assert.ok(page.url().includes('kantoren.html'), 'de medewerker is niet naar de inlog gestuurd');
      const open = (await post('/api/office/reisbureau/teruggaven', {}, kantoor)).body.open;
      assert.ok(open.some(r => r.id === id), 'het recht staat nog open');
    });

    await t.test('afwijzen zonder reden verandert niets; met reden staat het recht op afgewezen', async () => {
      await page.click('button[data-tweg="' + id + '"]');
      await page.waitForFunction(() => {
        const m = document.querySelector('#melding');
        return m && m.style.opacity === '1' && /reden/i.test(m.textContent);
      }, null, { timeout: 20000 });
      let open = (await post('/api/office/reisbureau/teruggaven', {}, kantoor)).body.open;
      assert.ok(open.some(r => r.id === id), 'een afwijzing zonder reden heeft het recht aangeraakt');

      const reden = 'Het lid heeft de reissom al buiten RTG terug.';
      await page.fill('input[data-treden="' + id + '"]', reden);
      await page.click('button[data-tweg="' + id + '"]');
      await page.waitForFunction((r) => {
        const el = document.querySelector('#kReisTerug');
        return el && !el.innerText.includes(r);
      }, id, { timeout: 20000 });
      open = (await post('/api/office/reisbureau/teruggaven', {}, kantoor)).body.open;
      assert.ok(!open.some(r => r.id === id), 'het afgewezen recht staat nog open');
      // er is besloten: een tweede besluit kan niet meer
      const nogEens = await post('/api/office/reisbureau/teruggave', { id, besluit: 'afgewezen', reden: 'nog een keer afwijzen' }, kantoor);
      assert.equal(nogEens.status, 409, JSON.stringify(nogEens.body).slice(0, 160));
      assert.equal(await saldo(), voor, 'afwijzen beweegt geen geld');
    });

    assert.deepEqual(fouten, [], 'geen scriptfouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
