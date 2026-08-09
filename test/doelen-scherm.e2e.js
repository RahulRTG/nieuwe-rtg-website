/* Schermtoets voor apps/doelen.html. De servertoets bewijst de rekenkern; deze
   bewijst dat een lid er ook echt bij kan: een doel neerzetten, een meting
   erin, en de datum verzetten als het anders liep.

   De harde bewering aan het eind is dezelfde als die van de motor, maar dan
   zoals een lid hem ziet: na het verzetten van de datum staat de eerstvolgende
   stap nog steeds VOOR hem en niet achter hem, en zijn beginpunt is niet
   teruggezet.
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
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/* shared/deelmenu.js knipt een lange pagina op in stukken met een balk erboven;
   wat niet open staat is display:none. Een lid tikt dus eerst het stuk aan, en
   deze toets doet dat ook. Staat er geen balk (korte pagina), dan is alles al
   zichtbaar en hoeft er niets te gebeuren. */
async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('Doelen: een doel neerzetten, meten, en de datum verzetten',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doelscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Doel Lid', email: 'doelscherm@x.nl', phone: '0612345844',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/doelen.html', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const e = document.getElementById('lijst');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, null, { timeout: 15000 });
    assert.match(await page.textContent('#lijst'), /nog geen doel/i, 'een vers lid begint leeg');

    const tik = async (sel) => { const k = page.locator(sel).first(); await k.scrollIntoViewIfNeeded(); await k.click(); };

    // 1. een doel neerzetten
    await openDeel(page, 'Een doel erbij');
    await page.fill('#dTitel', '10 kilometer hardlopen');
    await page.fill('#dReden', 'omdat ik het wil kunnen');
    await page.fill('#dEenheid', 'km');
    await page.fill('#dNul', '2');
    await page.fill('#dStreef', '10');
    await page.fill('#dOp', overDagen(60));
    await tik('#dMaak');
    await page.waitForFunction(() => /hardlopen/i.test(document.getElementById('lijst').textContent),
      null, { timeout: 10000 });
    assert.match(await page.textContent('#lijst'), /nog niets gemeten/i,
      'zonder meting staat er "nog niets gemeten" en geen nul');

    // 2. een meting erin, in het stuk waar de doelen staan
    await openDeel(page, 'Mijn doelen');
    const meetveld = page.locator('[data-meetveld]').first();
    await meetveld.scrollIntoViewIfNeeded();
    await meetveld.fill('4');
    await tik('[data-meet]');
    await page.waitForFunction(() => /volgende stap/i.test(document.getElementById('lijst').textContent),
      null, { timeout: 10000 });
    const naMeting = await page.textContent('#lijst');
    assert.match(naMeting, /25%/, 'van 2 naar 10 met een meting van 4 is een kwart');
    assert.match(naMeting, /zelf/, 'de herkomst van de meting staat op het scherm');

    const eersteStap = () => page.evaluate(() => {
      const li = document.querySelector('.paden li');
      return li ? parseFloat(li.lastElementChild.textContent) : null;
    });
    const stapVoor = await eersteStap();
    assert.ok(stapVoor > 4, 'de eerstvolgende stap ligt voor je uit');

    // 3. het liep anders: de datum verzetten
    const datumveld = page.locator('[data-datumveld]').first();
    await datumveld.scrollIntoViewIfNeeded();
    await datumveld.fill(overDagen(240));
    await tik('[data-verzet]');
    await page.waitForFunction((v) => {
      const li = document.querySelector('.paden li');
      return li && parseFloat(li.lastElementChild.textContent) < v;
    }, stapVoor, { timeout: 10000 });

    const stapNa = await eersteStap();
    assert.ok(stapNa > 4, 'ook na het verzetten ligt de stap voor je, niet achter je');
    assert.ok(stapNa < stapVoor, 'met meer tijd is de eerstvolgende stap kleiner geworden');
    const eind = await page.textContent('#lijst');
    assert.match(eind, /25%/, 'het beginpunt is niet teruggezet: nog steeds een kwart van 2 naar 10');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
