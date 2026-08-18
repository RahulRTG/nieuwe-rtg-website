/* Scherm-test voor Het Huis: het reisdossier op blad 02 van het magazine.
   test/huis.test.js bewijst de server-kant; deze bewijst dat het blad de reis
   toont, elke stand als woord draagt, en dat "wat er nog moet" gescheiden staat
   van "wat bij een partner ligt".
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Het Huis: het reisdossier staat op blad 02, met elke stand als woord',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-huis-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    /* EEN SESSIE MET EEN REIS EROP, EN DAT IS DE DEMO-SESSIE.

       Hier stond een verse registratie, en die had een volle reis naar Ibiza --
       maar alleen doordat elk nieuw account de demo-reis uit de seed erfde. Dat
       is rechtgezet (server/kern/lid.js): wie zich echt aanmeldt begint leeg.
       Dit blad toetst hoe het dossier een reis TOONT, dus draait het nu op de
       demo-sessie, die de demo-reis wel heeft. Dat een vers account juist een
       leeg dossier krijgt, staat in test/huis.test.js. */
    const reg = await api(base, '/api/login', { tier: 'rtg' });
    assert.ok(reg.token, 'de demo-sessie staat open');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });

    // het dossier vult zich met de eigen reis
    await page.waitForFunction(() => /Ibiza/.test(document.querySelector('#dossier').textContent),
      null, { timeout: 15000 });
    const tekst = await page.evaluate(() => document.querySelector('#dossier').textContent);

    // elke stand staat als WOORD op het scherm, niet alleen als kleur
    assert.match(tekst, /Bevestigd/, 'een bevestigd onderdeel zegt dat: ' + tekst.slice(0, 200));
    assert.match(tekst, /Wacht op betaling|In aanvraag/, 'en wat niet rond is, zegt dat ook');

    // wat aan jou ligt en wat je afwacht staan onder een eigen kopje
    assert.match(tekst, /Wat er nog moet/);
    assert.match(tekst, /bij een partner ligt/);

    // en de bron zegt eerlijk wat er niet in staat
    assert.match(tekst, /inreisvereisten/i);

    // het dossier is mee te nemen: de knop staat er en werkt zonder fout
    await page.waitForSelector('#dosMap', { timeout: 8000 });
    await page.click('#dosMap');

    // Rahul verwoordt, en vervangt zijn eigen knop door de zin
    await page.click('#dosRahul');
    await page.waitForFunction(() => {
      const p = document.querySelector('#dosRahulTekst');
      return p && !p.hidden && p.textContent.length > 10;
    }, null, { timeout: 10000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
