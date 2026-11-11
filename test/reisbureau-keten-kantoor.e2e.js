/* De bestaande kantoorwerktafel in echt Chromium, zonder DOM-/netwerkmocks.
   De lokale bedrijven en leveranciersverklaringen zijn proefdata; deze toets
   is geen onafhankelijk securityonderzoek of externe leverancieracceptatie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, letOpFouten } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');

test('kantoor biedt vanuit de bestaande werktafel uitsluitend de juiste eigen reisofferte aan', async t => {
  const pw = laadPlaywright({ eigenDriver: false });
  assert.ok(pw && pw.chromium, 'een echte Playwright Chromium-installatie is verplicht; geen skip of vervangende driver');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisketen-kantoor-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const x = await maakReisketenFixture(srv.base);
    const MP = '/api/reisbureau/keten';
    async function begin(titel, idem, supplierCode) {
      return goed(await x.api(MP + '/start', { titel, bestemming: 'Ibiza', idem,
        ...(supplierCode ? { supplierCode } : {}) }, x.reiziger.token), 'aanvraag').reis;
    }
    const eerste = await begin('Werktafel eerste RTG reis', 'kantoor-e2e-eerste');
    const tweede = await begin('Werktafel tweede RTG reis', 'kantoor-e2e-tweede');
    const partner = await begin('Vertrouwelijke partnerreis', 'kantoor-e2e-partner', x.bureau.code);
    browser = await pw.chromium.launch(browserOpties(pw));
    t.diagnostic('Chromium ' + browser.version());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 },
      reducedMotion: 'reduce', serviceWorkers: 'block' });
    await ctx.addInitScript(({ lid, kantoor }) => {
      localStorage.setItem('rtg_member_token', lid);
      localStorage.setItem('rtg_office_token', kantoor);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_lang', 'nl');
    }, { lid: x.reiziger.token, kantoor: x.office });
    const page = await ctx.newPage(), fouten = letOpFouten(page, []);
    await page.goto(srv.base + '/apps/kantoren.html?kamer=reisbureau', { waitUntil: 'domcontentloaded' });
    const werktafel = page.locator('#kReisContracten');
    await werktafel.getByRole('heading', { name: eerste.titel, exact: true }).waitFor();
    await werktafel.getByRole('heading', { name: tweede.titel, exact: true }).waitFor();
    assert.equal(await werktafel.getByRole('heading', { name: partner.titel, exact: true }).count(), 0);
    assert.equal((await werktafel.innerText()).includes(partner.ref), false);
    const vak = werktafel.locator('section').filter({ has: page.getByRole('heading', { name: eerste.titel, exact: true }) });
    await vak.getByRole('button', { name: 'Offerte opstellen', exact: true }).click();
    const form = vak.locator('form');
    await form.locator('[name="hoedanigheid"]').selectOption('touroperator');
    await form.locator('[name="contractpartij"]').fill('RTG Travel lokale browserproef');
    await form.locator('[name="factureert"]').fill('RTG Travel lokale browserproef');
    await form.locator('[name="aansprakelijk"]').fill('Expliciete proefverklaring, geen juridische kwalificatie.');
    await form.locator('[name="voorwaarden"]').fill('Lokale fictieve reis: hotel, transfer en fietsdag. Geen externe reservering.');
    await form.locator('[name="geldigTot"]').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    const aanbod = x.offerte(eerste).onderdelen;
    for (let i = 0; i < aanbod.length; i++) {
      if (i) await form.getByRole('button', { name: 'Reisonderdeel toevoegen', exact: true }).click();
      const rij = form.locator('fieldset').nth(i), p = aanbod[i];
      for (const naam of ['wat', 'supplierCode', 'productRef', 'centen', 'verschuldigdCenten'])
        await rij.locator('[name="' + naam + '"]').fill(String(p[naam]));
      await rij.locator('[name="soort"]').selectOption(p.soort);
    }
    const antwoord = page.waitForResponse(r => r.url().endsWith('/api/office/reisbureau/keten/offerte') && r.request().method() === 'POST');
    await form.getByRole('button', { name: 'Offerte ter beoordeling aanbieden', exact: true }).click();
    const reactie = await antwoord, inhoud = await reactie.json();
    assert.equal(reactie.status(), 200, JSON.stringify(inhoud));
    assert.equal(inhoud.reis.ref, eerste.ref);
    assert.equal(inhoud.reis.offerte.totaalCenten, 80000);
    assert.match(inhoud.reis.offerte.hash, /^[a-f0-9]{64}$/);
    await vak.getByRole('button', { name: 'Nieuwe offerteversie opstellen', exact: true }).waitFor();
    const mijn = goed(await x.api(MP, {}, x.reiziger.token), 'lid leest echt resultaat').reizen;
    const bij = mijn.find(r => r.ref === eerste.ref);
    assert.equal(bij.status, 'aangeboden');
    assert.equal(bij.offerte.hash, inhoud.reis.offerte.hash);
    assert.equal(bij.offerte.totaalCenten, 80000);
    assert.equal(bij.offerte.onderdelen.length, 3);
    assert.ok(bij.offerte.onderdelen.every(r => !Object.hasOwn(r, 'verschuldigdCenten')));
    for (const onaangeraakt of [tweede, partner]) {
      const rij = mijn.find(r => r.ref === onaangeraakt.ref);
      assert.equal(rij.status, 'aangevraagd');
      assert.equal(rij.versie, onaangeraakt.versie);
      assert.equal(rij.offerte, null);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
      'de kantoorwerktafel past binnen het venster');
    assert.deepEqual(fouten, [], 'geen pagina- of consolefouten');
    if (process.env.RTG_DS_BEELDEN) {
      fs.mkdirSync(process.env.RTG_DS_BEELDEN, { recursive: true });
      await werktafel.screenshot({ path: path.join(process.env.RTG_DS_BEELDEN, 'reisketen-kantoor.png') });
    }
    const eigenaar = goed(await x.api('/api/auth/login', { login: 'roellie.i@gmail.com',
      password: 'Imran', pasApp: 'business' }), 'eigenaar beheert eigen sessies').token;
    const sessies = goed(await x.api('/api/mijn/sessies', {}, eigenaar), 'eigen sessies').sessies
      .filter(s => s.contextSoort === 'kantoor');
    assert.ok(sessies.length, 'de persoonlijke kantoorsessie is geregistreerd');
    for (const sessie of sessies) goed(await x.api('/api/mijn/sessies/sluit', { sid: sessie.sid }, eigenaar),
      'eigen kantoorsessie daadwerkelijk intrekken');
    const geweigerd = page.waitForResponse(r => r.url().endsWith('/api/office/reisbureau/keten') && r.request().method() === 'POST');
    await werktafel.getByRole('button', { name: 'Reiscontracten vernieuwen', exact: true }).click();
    assert.ok([401, 403].includes((await geweigerd).status()), 'de ingetrokken sessie krijgt geen dossier meer');
    await page.waitForFunction(() => !document.querySelector('#kReisContracten'));
    assert.equal((await page.locator('body').innerText()).includes(eerste.titel), false, 'oude gevoelige werktafel wordt door de bestaande inlogdeur vervangen');
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_office_token')), null);
    assert.deepEqual(fouten, [], 'ook echte sessie-intrekking geeft geen paginafouten');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await stop(srv);
    fs.rmSync(map, { recursive: true, force: true });
  }
});
