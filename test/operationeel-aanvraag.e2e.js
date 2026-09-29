'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const pw = require('playwright');
const { startServer, stopHard, browserOpties, geenBrowser, letOpFouten, edgeActies } = require('./helper');
const bewijs = require('./operationeel-journaal');

test('lid en zaak sluiten de aanvraaglus via echte schermknoppen en één Edge', async () => {
  assert.equal(geenBrowser(pw), false, 'browserbewijs vereist een geïnstalleerde browser');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanvraag-ui-')); let srv, browser, pg, pgNaam;
  const bron = process.env.DATABASE_URL || process.env.PG_URL;
  const opslag = { RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '' };
  try {
    if (bron) {
      pg = new (require('../server/pgwire').Pool)({ connectionString: bron });
      pgNaam = 'rtg_scherm_' + require('node:crypto').randomUUID().replace(/-/g, '');
      await pg.query('CREATE DATABASE ' + pgNaam);
      const url = new URL(bron); url.pathname = '/' + pgNaam;
      Object.assign(opslag, { RTG_STORE: 'postgres', DATABASE_URL: url.toString() });
    }
    srv = await startServer({ env: { ...opslag, RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_OWNER_EMAIL: 'beleid-eigenaar@example.test', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_PUSH_UIT: '1' } });
    const api = async (pad, body, token) => {
      const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body || {}) });
      const d = await r.json(); assert.ok(r.ok, pad + ': ' + JSON.stringify(d)); return d;
    };
    const lid = await api('/api/auth/register', { name: 'Schermproef', email: 'scherm@example.test', password: 'geheim123',
      phone: '0612345678', geboortedatum: '1990-01-01', tier: 'rtg' });
    const roster = await api('/api/supplier/roster', { code: 'SERENA' });
    const zaak = await api('/api/supplier/login', { code: 'SERENA', staffId: roster.staff.find(x => x.role === 'manager').id, pin: '1234' });
    const eigenaar = await api('/api/techniek/inloggen', { login: 'beleid-eigenaar@example.test', wachtwoord: 'Imran' });
    assert.ok(eigenaar.token);
    browser = await pw.chromium.launch(browserOpties(pw, { headless: true }));
    const klant = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const werk = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const fouten = []; letOpFouten(klant, fouten); letOpFouten(werk, fouten);
    const leesfouten = [];
    for (const p of [klant, werk]) p.on('response', r => {
      if (r.status() === 500 && r.url().startsWith(srv.base + '/api/')) leesfouten.push(r.url());
    });
    await klant.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); }, lid.token);
    await werk.addInitScript(t => { localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_lang', 'nl'); }, zaak.token);
    async function open(p, url) {
      await p.goto(srv.base + url); await p.waitForSelector('body[data-rtg-adaptive-ready="true"]');
      if (await p.locator('#rtg-cookie button').isVisible()) await p.locator('#rtg-cookie button').click();
    }
    await open(klant, '/apps/mijnmall.html#aanvragen');
    assert.equal(await klant.locator('.shop-nav').isVisible(), false, 'de winkelnavigatie wordt door Edge overgenomen');
    await klant.locator('#aWat').fill('Een behandeling op zaterdag');
    await klant.locator('#aVerdieping').selectOption('beauty'); await klant.locator('#aPlek').fill('Ibiza');
    await klant.locator('#aPlaats').click();
    await klant.locator('[data-aanvraag]').waitFor();
    const id = await klant.locator('[data-aanvraag]').first().getAttribute('data-aanvraag');
    await open(werk, '/apps/leverancier-aanvragen.html');
    const kaart = werk.locator('[data-aanvraag="' + id + '"]');
    await kaart.locator('.tekst').fill('Zaterdag om 14 uur is mogelijk.'); await kaart.locator('.prijs').fill('90');
    await kaart.getByRole('button', { name: 'Reageren', exact: true }).click();
    await kaart.getByRole('button', { name: 'Bijwerken', exact: true }).waitFor();
    await klant.reload(); const eigen = klant.locator('[data-aanvraag="' + id + '"]');
    await eigen.getByRole('button', { name: 'Kiezen', exact: true }).click();
    await eigen.getByText('Wacht op behandeling', { exact: false }).waitFor();
    await werk.reload(); await kaart.getByRole('heading').click();
    await edgeActies(werk);
    werk.setDefaultTimeout(10000);
    await werk.locator('.rtg-adaptive-controls').getByRole('button', { name: 'In behandeling nemen', exact: true }).click();
    await kaart.getByRole('button', { name: 'Antwoord afronden', exact: true }).waitFor();
    await kaart.getByRole('button', { name: 'Antwoord afronden', exact: true }).click();
    await kaart.getByRole('textbox', { name: 'Toelichting voor het lid' }).fill('Uw aanvraag is behandeld. Bel ons om de afspraak vast te leggen.');
    await kaart.getByRole('button', { name: 'Opslaan', exact: true }).click();
    await kaart.getByText('Uw antwoord:', { exact: false }).waitFor();
    assert.equal(await kaart.getByRole('button', { name: 'In behandeling nemen', exact: true }).count(), 0);
    assert.equal((await api('/api/mall/aanvragen/mijn', {}, lid.token)).aanvragen[0].resultaat.tekst,
      'Uw aanvraag is behandeld. Bel ons om de afspraak vast te leggen.');
    await api('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['voortgang'], vorm: 'mijn' } }, lid.token);
    await open(klant, '/apps/wereld.html');
    const resultaat = klant.locator('[data-saloon-id="voortgang:' + id + '"]');
    await resultaat.waitFor({ state: 'attached' });
    await resultaat.getByText('Uw aanvraag is behandeld. Bel ons om de afspraak vast te leggen.', { exact: true }).waitFor();
    for (const breedte of [390, 1440]) {
      await klant.setViewportSize({ width: breedte, height: 900 });
      assert.equal(await klant.locator('.rtg-adaptive-bar:visible').count(), 1);
      assert.equal(await klant.locator('.rtg-edge-chrome').count(), 1);
      assert.ok(await klant.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await resultaat.scrollIntoViewIfNeeded();
      if (process.env.SALOON_DESIGN_OUTPUT) await klant.screenshot({ path: path.join(process.env.SALOON_DESIGN_OUTPUT, 'saloon-aanvraag-' + breedte + '.png') });
    }
    async function schakel(aan) {
      const v = await api('/api/techniek/functie', { id: 'dom-mall', aan }, eigenaar.token);
      assert.ok(v.verzoekId);
      await api('/api/techniek/functie/besluit', { verzoekId: v.verzoekId, akkoord: true }, eigenaar.token);
    }
    const bronVoor = (await api('/api/mall/aanvragen/mijn', {}, lid.token)).aanvragen[0];
    const saloonVoor = await api('/api/wereld/feed', { ervaring: 'saloon', bronnen: ['voortgang'], vorm: 'mijn', lens: 'all' }, lid.token);
    assert.deepEqual(saloonVoor.items[0].bronActies, bronVoor.acties);
    assert.ok(bronVoor.acties.some(x => x.id === 'heropen'));
    await schakel(false);
    const dicht = await fetch(srv.base + '/api/mall/aanvraag/heropen', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid.token },
      body: JSON.stringify({ id, versie: bronVoor.versie }) });
    assert.equal(dicht.status, 503, 'oude schermactie wordt aan de bron geweigerd');
    const saloonDicht = await api('/api/wereld/feed', { ervaring: 'saloon', bronnen: ['voortgang'], vorm: 'mijn', lens: 'all' }, lid.token);
    assert.deepEqual(saloonDicht.items[0].bronActies, []);
    assert.equal(saloonDicht.items[0].bronversie, bronVoor.versie);
    await klant.reload(); await resultaat.waitFor(); await resultaat.focus(); await edgeActies(klant);
    assert.equal(await klant.getByRole('button', { name: 'Opnieuw openen in Mijn Mall', exact: true }).count(), 0);
    await schakel(true);
    await klant.reload(); await resultaat.waitFor();
    bewijs('mall-policy', ['AUTHORITY'], { grens: 'Eén actuele policy bij uitvoering, Saloon-projectie en Edge: echte schakelaar uit/aan, oude actie geweigerd, resultaat blijft bestaan.' });
    await klant.setViewportSize({ width: 390, height: 844 });
    await resultaat.getByRole('button', { name: 'Open aanvraag', exact: true }).click();
    await klant.waitForURL('**/apps/mijnmall.html#aanvragen');
    await open(klant, '/apps/wereld.html');
    await resultaat.focus(); await edgeActies(klant);
    await klant.locator('.rtg-adaptive-controls').getByRole('button', { name: 'Opnieuw openen in Mijn Mall', exact: true }).click();
    await klant.waitForURL('**/apps/mijnmall.html#aanvragen');
    await eigen.getByRole('button', { name: 'Opnieuw openen', exact: true }).click();
    await eigen.getByRole('button', { name: 'Aanvraag intrekken', exact: true }).click();
    await eigen.getByText('Ingetrokken', { exact: false }).waitFor();
    assert.equal(await eigen.getByRole('button', { name: 'Kiezen', exact: true }).count(), 0);
    assert.deepEqual(fouten, []);
    assert.deepEqual(leesfouten, [], 'de schermlus heeft geen verborgen API-fouten');
    bewijs('mall-ui', ['ENTRY'], { grens: 'Twee echte schermen, bronknoppen, Edge en terugkeer in Saloon op 390 en 1440 pixels.' });
    if (bron) bewijs('mall-ui-postgres', ['ENTRY'], { grens: 'De volledige schermlus op een eigen lege PostgreSQL-database, inclusief Edge en Saloon.' });
  } finally {
    if (browser) await browser.close(); await stopHard(srv?.child);
    if (pg) { if (pgNaam) await pg.query('DROP DATABASE IF EXISTS ' + pgNaam + ' WITH (FORCE)'); await pg.end(); }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
