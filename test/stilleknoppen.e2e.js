/* KNOPPEN DIE NIETS DEDEN EN NIETS ZEIDEN.

   Een kruipronde over alle 310 schermen onder public/apps (elke zichtbare knop
   aangetikt als lid, op telefoonformaat) vond een terugkerend patroon: een knop
   die bij een leeg veld of een ontbrekende voorwaarde stil `return` deed. Voor
   de mens is dat niet te onderscheiden van een kapotte knop, en GRAMMATICA.md
   zegt het hard: een verhindering draagt altijd een reden.

   Deze toets houdt de reparaties vast die de meeste mensen raken:
   - de kantoor-inlog (shared/kantoorgesprek.js) staat voor dertien schermen;
   - de drie kaarten op de FoundationOS-home sprongen zonder open afdeling
     naar boven zonder te zeggen waarom;
   - Labfonds, Veilig en Vertaler weigerden een lege invoer zonder woord;
   - de knooppunten van Partner Network waren knoppen zonder handeling en
     zijn nu weergave;
   - de keuzes op foundation/registreren.html deden niets omdat de catalogus
     achter de kantoorpoort stond (openbaar gemaakt als besluit van de
     eigenaar; zet officeAuth terug op de route en deze bewering zakt).

   DE MUTATIE: zet in een van die plekken de oude stille `return` terug, en de
   bijbehorende bewering zakt -- er verschijnt dan geen tekst.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function lid(base) {
  const u = Date.now().toString(36);
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Stille Proef', email: 'stil' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then((x) => x.json());
  assert.ok(r.token, 'registratie hoort een token te geven');
  const status = await fetch(base + '/api/onboarding/status', { method: 'POST',
    headers: { Authorization: 'Bearer ' + r.token } }).then((x) => x.json());
  await fetch(base + '/api/onboarding/teken', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
    body: JSON.stringify({ naam: 'Stille Proef', akkoord: true, contractVersion: status.contract.versie }) });
  return r.token;
}

test('een knop die niet kan, zegt waarom', { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stil-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  const naar = async (pad) => {
    await page.goto(srv.base + pad, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  };
  const tekstVan = (sel) => page.waitForFunction((s) => {
    const e = document.querySelector(s); return e && !e.hidden && e.textContent.trim() ? e.textContent.trim() : null;
  }, sel, { timeout: 10000 }).then((h) => h.jsonValue());
  try {
    const token = await lid(srv.base);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);

    // Kantoor-inlog: Verder met een leeg veld.
    await naar('/apps/command.html');
    await page.locator('.kg-rij button').click();
    assert.match(await tekstVan('.kg-fout'), /antwoord/i, 'Verder met een leeg veld zegt niet wat er ontbreekt');

    // FoundationOS-home zonder open afdeling: de kaart blijft staan en zegt het.
    await naar('/apps/foundation/os-publiek.html');
    await page.locator('[data-heen="projecten"]').click();
    assert.match(await tekstVan('#doenReden'), /afdeling|stad/, 'de kaart zegt niet waarom hij nergens heen gaat');

    // Labfonds: Zamel in zonder bedrag.
    await naar('/apps/geld.html#labfonds');
    await page.locator('[data-doneer]').first().click();
    assert.match(await tekstVan('#geldMelding'), /bedrag/i);

    // Veilig: toevoegen zonder codenaam.
    await naar('/apps/veilig.html');
    await page.locator('#kringAdd').click();
    const veilig = await page.waitForFunction(() => document.body.innerText.includes('Vul eerst een codenaam in'),
      null, { timeout: 10000 }).then(() => true).catch(() => false);
    assert.ok(veilig, 'Toevoegen zonder codenaam zegt niets');

    // Vertaler: kopieren voordat er iets vertaald is.
    await naar('/apps/vertaler.html');
    await page.locator('#kopieer').click();
    const vert = await page.waitForFunction(() => document.body.innerText.includes('nog geen vertaling'),
      null, { timeout: 10000 }).then(() => true).catch(() => false);
    assert.ok(vert, 'Kopieer zonder vertaling zegt niets');

    // Foundation-registratie: de keuzes openen hun formulier (de catalogus is openbaar).
    await naar('/apps/foundation/registreren.html');
    await page.locator('.keuze[data-type="school"]').click();
    await page.waitForSelector('#formulierPaneel:not([hidden])', { timeout: 10000 });
    assert.equal(await page.locator('#type').inputValue(), 'school', 'de keuze School opent geen formulier');

    // Partner Network: wat niets doet, is geen knop.
    await naar('/apps/partner-network.html');
    assert.equal(await page.locator('button.pn-node').count(), 0, 'een knooppunt zonder handeling is weer een knop');
    assert.equal(await page.locator('.pn-top button', { hasText: /Grand Hotel|Kyoto Consortium/ }).count(), 0,
      'de partnerkop zonder handeling is weer een knop');

    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
