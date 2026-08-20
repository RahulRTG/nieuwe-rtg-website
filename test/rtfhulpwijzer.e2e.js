/* Scherm-test voor de consistentieronde van golf 6 (deel 3): de hulpwijzer
   draait op de gedeelde coach-laag (soort 'hulp', wachttekst van Meike), de
   privacyregel staat onder elke chat, en veilig.html wijst warm door zonder
   zelf een chat te forceren. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Hulpwijzer: Meike praat via de gedeelde coach-laag en de privacyregel staat er',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfhulpw-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  let browser;
  try {
    const g = await fetch(base + '/api/foundation/gezin/maak', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gezinsnaam: 'Fam Wijzer', naam: 'Mam', pin: '1234' }) }).then(r => r.json());

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/hulpwijzer.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(sess => {
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtf_sessie', JSON.stringify(sess));
    }, { code: g.code, token: g.token, profiel: { naam: 'Mam', beheerder: true } });
    /* Het bezoek hierboven was uitgelogd -- alleen om localStorage te kunnen
       zetten -- en de pagina stopt daar bewust met 'geen sessie'. De meting
       begint bij het ingelogde bezoek hieronder. */
    fouten.length = 0;
    await page.goto(base + '/apps/foundation/hulpwijzer.html', { waitUntil: 'domcontentloaded' });

    /* de privacyregel staat onder de chat */
    assert.ok(await page.evaluate(() => /Wat je hier typt wordt niet bewaard\./.test(document.body.textContent)),
      'de hulpwijzer belooft net als de andere chats dat er niets bewaard wordt');

    /* een vraag stellen loopt via de gedeelde coach-laag, met Meike als wachttekst */
    await page.evaluate(() => { document.querySelector('#vraag').value = 'Ik heb hulp nodig met eten.'; });
    await page.evaluate(() => { document.querySelector('#stuur').click(); });
    await page.waitForFunction(() => {
      const b = document.querySelectorAll('#chat .b.ai');
      return b.length >= 2 && /Voedselbank/.test(b[b.length - 1].textContent);
    }, null, { timeout: 10000 });

    /* veilig.html: praktisch, met een warme doorverwijzing in plaats van een chat */
    await page.goto(base + '/apps/foundation/veilig.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Hulpwijzer/.test(document.body.textContent), null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => !!document.querySelector('a[href="steun.html"]') && !!document.querySelector('a[href="hulpwijzer.html"]')),
      'veilig wijst door naar Steun en de Hulpwijzer');
    assert.ok(await page.evaluate(() => !document.querySelector('#chat')),
      'veilig blijft een praktische pagina zonder chat');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina\'s');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
