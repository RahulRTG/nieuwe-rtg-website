/* Schermtoets voor apps/training.html.

   Twee dingen worden hier op het scherm zelf nagekeken. Ten eerste dat er GEEN
   advies staat: RTG stelt niets voor en zegt niet of je te hard traint, en een
   motor die zich inhoudt naast een scherm dat er alsnog iets bij verzint, is
   voor een lezer hetzelfde probleem. Ten tweede dat aftekenen echt in het
   beweegcijfer landt dat ook op RTG Life staat -- niet in een tweede totaal dat
   alleen hier bestaat.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadPlaywright();

async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('Training: je eigen schema, en het beweegcijfer dat er echt van komt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-trscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Train Lid', email: 'trainscherm@x.nl', phone: '0612345888',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');
    const api = (pad, body) => fetch(base + '/api/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {}) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/training.html', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const e = document.getElementById('vandaag');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, { timeout: 15000 });

    /* 1. de grens staat er op een leeg scherm, met een echte weg ernaartoe. */
    const grens = await page.textContent('#grens');
    assert.match(grens, /schrijft geen training voor/i);
    assert.match(grens, /fysiotherapeut|coach/i);

    /* 2. een training erbij, met de dagen en de duur van het lid zelf. */
    await openDeel(page, 'Een training erbij');
    await page.locator('#tNaam').fill('Rustige duurloop');
    await page.locator('#tWat').fill('40 minuten praattempo');
    await page.locator('#tDagen').fill('1,2,3,4,5,6,7');
    await page.locator('#tDuur').fill('40');
    await page.locator('#tVanWie').fill('Coach Ali');
    const maak = page.locator('#tMaak');
    await maak.scrollIntoViewIfNeeded();
    await maak.click();
    await page.waitForFunction(() => /Rustige duurloop/.test(document.getElementById('schema').textContent),
      { timeout: 10000 });
    assert.match(await page.textContent('#schema'), /van Coach Ali/,
      'van wie het schema is staat erbij, want dat is meestal niet RTG');

    /* 3. aftekenen op het scherm, en het beweegcijfer komt terug in de melding. */
    await openDeel(page, 'Vandaag op schema');
    const gedaan = page.locator('[data-deed]').first();
    await gedaan.scrollIntoViewIfNeeded();
    await gedaan.click();
    await page.waitForFunction(() => /afgetekend/.test(document.getElementById('vandaag').textContent),
      { timeout: 10000 });

    /* En dat cijfer staat echt in de metingenlaag, dus ook op RTG Life. */
    const m = await api('metingen', {});
    assert.equal(m.beeld.beweging.vandaag, 40, 'de dagmeting beweging staat op 40');
    assert.deepEqual(m.beeld.beweging.herkomsten, ['zelf']);

    /* 4. nergens een oordeel op het scherm. */
    const alles = await page.textContent('#inhoud');
    assert.ok(!/goed bezig|ga zo door|te weinig getraind|je loopt achter|streak|reeks van/i.test(alles),
      'geen aansporing en geen oordeel op het scherm');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
