/* Schermtoets voor de INSTELLINGEN van een postvak in RTG Mail: handtekening,
   afwezigheid, aliassen en regels.

   De server had deze vier al een golf lang (test/rtmail-schrijf.test.js en
   test/rtmail-alias.test.js bewijzen de laag); er was alleen geen knop. Deze toets
   bewijst dat een mens er nu bij kan EN dat wat hij op het scherm zet, echt
   doet wat er staat: de handtekening staat onder het verstuurde bericht, de
   alias vangt post op, de regel bergt binnenkomende post op, en een weigering
   van de server staat met zijn eigen zin op het scherm.

   Draait alleen waar een browser is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, edgeActies } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();
async function lid(base, naam, n) {
  const t = Date.now();
  const r = await api(base, '/api/auth/register', { name: naam, email: 'inst' + n + t + '@e.test',
    phone: '06' + String(t).slice(-7) + n, password: 'geheim123', geboortedatum: '1988-08-08', tier: 'rtg' });
  assert.ok(r.token, JSON.stringify(r));
  return r.token;
}
async function stuur(base, tok, naar, onderwerp) {
  const c = await api(base, '/api/member/rtmail/concept/bewaar', { naar, onderwerp, tekst: 'inhoud' }, tok);
  return (await api(base, '/api/member/rtmail/concept/verstuur', { id: c.concept.id }, tok)).bericht;
}

test('instellingen op het scherm: handtekening, afwezigheid, alias en regel doen wat er staat',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inst-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const aTok = await lid(base, 'Instel Een', 1);
    const bTok = await lid(base, 'Instel Twee', 2);
    const aAdres = (await api(base, '/api/member/rtmail/adres', {}, aTok)).adres;
    const bAdres = (await api(base, '/api/member/rtmail/adres', {}, bTok)).adres;

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => { localStorage.setItem('rtg_member_token', tok); }, aTok);
    await page.goto(base + '/apps/rtmail.html', { waitUntil: 'domcontentloaded' });
    await edgeActies(page);
    await page.locator('.rtg-adaptive-controls').getByRole('button', { name: /Alle post$/i }).click();
    await page.waitForSelector('#instKnp', { timeout: 15000 });
    await page.click('#instKnp');
    await page.waitForSelector('#rtmInstellingen', { timeout: 10000 });

    // 1. handtekening -- en hij staat onder het volgende bericht
    await page.fill('#iHand', 'Groet, Instel Een');
    await page.click('#iHandBewaar');
    await page.waitForSelector('text=Je handtekening is bewaard.', { timeout: 10000 });
    assert.equal(await page.inputValue('#iHand'), 'Groet, Instel Een', 'na herladen staat hij er nog');
    const m = await stuur(base, aTok, bAdres, 'Met handtekening');
    assert.match(m.tekst, /Groet, Instel Een/, 'de handtekening staat onder het verstuurde bericht');

    // 2. afwezigheid aan -- B krijgt een antwoord, en dan weer uit
    await page.fill('#iAfTekst', 'Ik ben er tot maandag niet.');
    await page.click('#iAfAan');
    await page.waitForSelector('text=Je afwezigheidsbericht staat aan.', { timeout: 10000 });
    assert.match(await page.textContent('#iAfStand'), /Staat aan/);
    await stuur(base, bTok, aAdres, 'Ben je er?');
    const bIn = (await api(base, '/api/member/rtmail/vak', {}, bTok)).berichten;
    assert.ok(bIn.some(x => x.tekst === 'Ik ben er tot maandag niet.'), 'B kreeg het afwezigheidsbericht');
    await page.click('#iAfUit');
    await page.waitForSelector('text=Je afwezigheidsbericht staat uit.', { timeout: 10000 });
    assert.match(await page.textContent('#iAfStand'), /Staat uit/);

    // 3. een weigering staat met de zin van de server op het scherm
    await page.fill('#iAlias', aAdres.split('@')[0]);
    await page.click('#iAliasMaak');
    await page.waitForSelector('#iAliasUit.fout', { timeout: 10000 });
    assert.match(await page.textContent('#iAliasUit'), /eigen adres/);

    // 4. alias aan -- post aan de alias komt bij A binnen
    await page.fill('#iAlias', 'reserveringen');
    await page.click('#iAliasMaak');
    await page.waitForSelector('text=De alias staat aan.', { timeout: 10000 });
    assert.equal(await page.locator('[data-alias-uit="reserveringen"]').count(), 1);
    await stuur(base, bTok, 'reserveringen@' + aAdres.split('@')[1], 'Via de alias');
    const aIn = (await api(base, '/api/member/rtmail/vak', {}, aTok)).berichten;
    assert.ok(aIn.some(x => x.onderwerp === 'Via de alias' && x.viaAlias), 'de alias vangt post op voor A');

    // 5. een regel: alles met "nieuwsbrief" in het onderwerp gaat naar het archief
    await page.selectOption('#iRVeld', 'onderwerp');
    await page.fill('#iRBevat', 'nieuwsbrief');
    await page.selectOption('#iRActie', 'opbergen');
    await page.click('#iRMaak');
    await page.waitForSelector('text=De regel staat aan.', { timeout: 10000 });
    await stuur(base, bTok, aAdres, 'Nieuwsbrief oktober');
    const archief = (await api(base, '/api/member/rtmail/vak', { map: 'archief' }, aTok)).berichten;
    assert.ok(archief.some(x => x.onderwerp === 'Nieuwsbrief oktober'), 'de regel borg het bericht op bij binnenkomst');
    // de teller op het scherm telt mee
    await page.click('#terug');
    await page.waitForSelector('#instKnp', { timeout: 10000 });
    await page.click('#instKnp');
    await page.waitForSelector('#rtmInstellingen', { timeout: 10000 });
    assert.match(await page.textContent('#rtmInstellingen'), /1 keer geraakt/);
    // en uitzetten
    await page.click('[data-regel-zet]');
    await page.waitForSelector('text=De regel staat uit.', { timeout: 10000 });
    assert.equal(await page.getAttribute('[data-regel-zet]', 'aria-pressed'), 'false');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
