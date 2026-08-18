/* Scherm-toets op DE REISWACHT in /apps/reizen.html (REIZEN.md fase 3).

   De serverkant staat in test/reiswacht.test.js. Wat alleen hier te bewijzen
   valt, is het gevaarlijkste scenario van dit hele scherm: RUST. Een leeg vak
   leest als "niets aan de hand", en dat mag alleen als er ook echt gemeten is
   -- en als de kijker in dezelfde oogopslag ziet met hoeveel ogen.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:
   1. bij een reis met een visumvraag staat het signaal er, met zijn bron;
   2. de bronnen staan ALTIJD onder het vak -- ook de ontbrekende (externe
      luchtvaart), en de momentopname-zin staat erbij;
   3. rust wordt gezegd ("er speelt niets") en niet gezwegen.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
function browserOpties() {
  const opties = { args: ['--no-sandbox'] };
  const kandidaten = [process.env.RTG_BROWSER_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const gevonden = kandidaten.find(p => fs.existsSync(p));
  if (gevonden) opties.executablePath = gevonden;
  return opties;
}
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

test('de reiswacht op het scherm: signalen met bron, de ontbrekende bronnen, en rust die gezegd wordt',
  { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wacht-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'we' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    assert.ok(lid);

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, lid);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- eerst de rust: een lid zonder reizen ---- */
    await page.goto(srv.base + '/apps/reizen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const el = document.querySelector('#wacht');
      return el && !/Laden/.test(el.textContent);
    }, null, { timeout: 20000 });

    await t.test('rust wordt gezegd, en de bronnen staan er toch', async () => {
      const tekst = await page.$eval('#wacht', el => el.innerText);
      assert.match(tekst, /speelt op dit moment niets/i, 'rust is een zin en geen leegte: ' + tekst.slice(0, 150));
      assert.match(tekst, /luchtvaart \(extern\)/i, 'de ontbrekende bron staat eronder');
      assert.match(tekst, /kijkt hier nu niet mee/i, 'met de eerlijke uitleg');
      assert.match(tekst, /waakt niet op de achtergrond/i, 'en de momentopname-zin');
    });

    /* ---- dan een reis met een visumvraag ---- */
    const lees = await post('/api/reis/invoer/lees', { tekst: 'Rondreis India, vertrek ' + dag(20) }, lid);
    const bev = await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
      velden: { titel: 'Rondreis India', soort: 'activiteit', bestemming: 'India', van_datum: dag(20) } }, lid);
    assert.equal(bev.status, 200);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const el = document.querySelector('#wacht');
      return el && !/Laden/.test(el.textContent) && /India/.test(el.innerText);
    }, null, { timeout: 20000 });

    await t.test('het signaal staat er met zijn bron en zijn grond', async () => {
      const tekst = await page.$eval('#wacht', el => el.innerText);
      assert.match(tekst, /India/);
      assert.match(tekst, /geen taak/i, 'de visumvraag staat er: ' + tekst.slice(0, 300));
      assert.match(tekst, /Al geregeld\?/i, 'als vraag, niet als bewering');
      assert.match(tekst, /Bron: landregels/i, 'met de bron erbij');
      assert.doesNotMatch(tekst, /speelt op dit moment niets/i, 'en de rustzin is weg');
    });

    assert.deepEqual(fouten, [], 'geen scriptfouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
