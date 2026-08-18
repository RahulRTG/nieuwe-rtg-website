/* Scherm-test voor RTG Boeken: de plank (huisbibliotheek + een .txt uit de
   kluis), lezen in de eigen lezer, en de leesplek die na scrollen bewaard
   is en bij heropenen terugkomt. Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('Boeken: de plank groeit met je kluis en de leesplek reist mee',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-boeken-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Leeslid', email: 'be' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1986-06-06', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    // een eigen tekstboek in de kluis
    const tekst = Array(200).fill('Dit is een eigen boek uit de kluis, regel voor regel.').join('\n');
    const upload = await fetch(base + '/api/bestanden/upload', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify({ naam: 'mijn-verhaal.txt',
        dataUrl: 'data:text/plain;base64,' + Buffer.from(tekst).toString('base64') }) }).then(r => r.json());
    assert.ok(upload.id, 'het kluisboek is opgeslagen');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/boeken.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/boeken.html', { waitUntil: 'domcontentloaded' });

    /* de plank: huisbibliotheek + het kluisboek */
    await page.waitForFunction(() => document.querySelectorAll('#plank .boek').length >= 5, null, { timeout: 8000 });
    await page.waitForFunction(() => /mijn-verhaal/.test(document.querySelector('#eigen').textContent), null, { timeout: 8000 });

    /* het kluisboek lezen en scrollen -> de plek wordt bewaard */
    await page.evaluate(() => { document.querySelector('#eigen .boek').click(); });
    await page.waitForFunction(() => !document.querySelector('#leesBlok').hidden &&
      /eigen boek uit de kluis/.test(document.querySelector('#tekst').textContent), null, { timeout: 8000 });
    /* Wacht op de echte opslagbevestiging. De vaste 900 ms die hier stond kon
       onder CI-belasting al voorbij zijn terwijl de aanvraag nog liep. */
    await page.evaluate(() => {
      const el = document.querySelector('#tekst');
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
      el.dispatchEvent(new Event('scroll'));
    });
    /* Meteen terug: dit bewijst dat de lezer de debounce veilig doorspoelt en
       niet verwacht dat een gebruiker na het scrollen 600 ms blijft wachten. */
    await page.evaluate(() => { document.querySelector('#terug').click(); });
    let plek = 0;
    for (let poging = 0; poging < 120 && plek <= 0.4; poging++) {
      await new Promise(res => setTimeout(res, 100));
      const opgeslagen = await fetch(base + '/api/boeken/voortgang', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
        body: '{}' }).then(r => r.json());
      plek = (((opgeslagen.voortgang || {})['kluis:' + upload.id]) || {}).plek || 0;
    }
    assert.ok(plek > 0.4, 'de server heeft de leesplek bevestigd');

    /* op de plank staat de voortgang erbij, en heropenen springt terug */
    await page.waitForFunction(() => /% gelezen/.test(document.querySelector('#eigen').textContent), null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#eigen .boek').click(); });
    await page.waitForFunction(() => !document.querySelector('#leesBlok').hidden &&
      document.querySelector('#tekst').scrollTop > 50, null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
