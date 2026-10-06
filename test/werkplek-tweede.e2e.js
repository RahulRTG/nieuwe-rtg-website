/* DE TWEEDE STAP VAN DE WERKPLEKINLOG IN EEN ECHTE BROWSER (N19).

   test/werkplek-tweede.test.js bewijst de server: met de tweede factor aan geeft
   /api/supplier/mijn/login op het wachtwoord alleen een bewijs. Dat helpt een
   medewerker niets als zijn scherm dat bewijs niet kan omruilen: dan staat hij
   na een juist wachtwoord voor een dichte deur. Deze toets loopt de twee
   schermen die de route aanroepen, met Nora Prins uit de zaaiset en een echte
   authenticatorcode:

     - de personeels-app (personeel-03.js, personeel-03b.js): na het wachtwoord
       een codeveld, een verkeerde code zegt het, de juiste opent de werkplek;
     - de leverancier-app (leverancier-06a.js): het gesprek met Rahul, daarna
       het codeformulier, en de juiste code geeft de werksessie.

   Het codeveld is in beide gevallen het veld van de techniekpagina:
   inputmode numeric, autocomplete one-time-code en een aria-label.

   Draai los: node --test test/werkplek-tweede.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser,
  letOpFouten, wachtTot, wachtOpZichtbaar } = require('./helper');
const { totpCode } = require('../server/kern/totp');

const pw = laadPlaywright();
const NORA = 'nora@rtg.example', NORA_WW = 'werk';

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* Een TOTP-code werkt een keer (server/kern/totp.js), en het venster kent er
   drie; het aanzetten maakt er een op. Dit geeft telkens een ongebruikte. */
function codeBron(geheim, eerste) {
  const gebruikt = new Set([eerste]);
  return () => {
    for (const d of [30000, 0, -30000]) {
      const c = totpCode(geheim, Date.now() + d, 30);
      if (!gebruikt.has(c)) { gebruikt.add(c); return c; }
    }
    throw new Error('geen ongebruikte code meer in dit venster');
  };
}
function foutCode(geheim) {
  const geldig = new Set([-30000, 0, 30000].map(d => totpCode(geheim, Date.now() + d, 30)));
  let c = '000000';
  for (let i = 0; geldig.has(c); i++) c = String(100000 + i);
  return c;
}

async function codeveldKlopt(page, selector) {
  const v = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el && { inputmode: el.getAttribute('inputmode'), autocomplete: el.getAttribute('autocomplete'),
      aria: el.getAttribute('aria-label') };
  }, selector);
  assert.ok(v, selector + ' staat er');
  assert.equal(v.inputmode, 'numeric');
  assert.equal(v.autocomplete, 'one-time-code');
  assert.ok(v.aria && v.aria.length > 3, 'het veld draagt een aria-label');
}

test('de werkplekinlog vraagt in beide schermen de code, en de juiste opent de werkplek',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werk2-e2e-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_AI_UIT: '1' } });
  let browser;
  try {
    const lid = await post(srv.base, '/api/auth/login', { login: NORA, password: NORA_WW });
    assert.ok(lid.body.token, 'Nora logt in als lid: ' + JSON.stringify(lid.body).slice(0, 160));
    const begin = await post(srv.base, '/api/mijn/tweefactor/begin', { huidig: NORA_WW }, lid.body.token);
    const eerste = totpCode(begin.body.geheim, Date.now(), 30);
    const aan = await post(srv.base, '/api/mijn/tweefactor/bevestig', { code: eerste }, lid.body.token);
    assert.equal(aan.status, 200, 'tweede factor aan: ' + JSON.stringify(aan.body).slice(0, 160));
    const code = codeBron(begin.body.geheim, eerste);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    });
    const fouten = [];

    /* ---- de personeels-app ---- */
    const pda = await ctx.newPage();
    letOpFouten(pda, fouten);
    await pda.goto(srv.base + '/apps/personeel.html');
    await pda.locator('#liUser').fill(NORA);
    await pda.locator('#liPass').fill(NORA_WW);
    const stap1 = pda.waitForResponse(r => r.url().endsWith('/api/supplier/mijn/login'));
    await pda.locator('#loginForm button[type="submit"]').click();
    const een = await (await stap1).json();
    assert.equal(een.tweedeFactorNodig, true, 'de server vraagt de code');
    await wachtOpZichtbaar(pda, '#tcCode');
    await codeveldKlopt(pda, '#tcCode');
    assert.equal(await pda.evaluate(() => localStorage.getItem('rtg_pda_token')), null, 'nog geen werksessie');

    await pda.locator('#tcCode').fill(foutCode(begin.body.geheim));
    await pda.locator('#codeForm button[type="submit"]').click();
    await wachtTot(pda, () => /klopt niet/i.test(document.querySelector('#tcErr').textContent), null,
      { wat: 'de melding dat de code niet klopt' });
    await pda.locator('#tcCode').fill(code());
    await pda.locator('#codeForm button[type="submit"]').click();
    await wachtTot(pda, () => localStorage.getItem('rtg_pda_token'), null, { wat: 'de werksessie in de personeels-app' });
    await wachtOpZichtbaar(pda, '#gate', { weg: true });

    /* ---- de leverancier-app ---- */
    const lev = await ctx.newPage();
    letOpFouten(lev, fouten);
    await lev.goto(srv.base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
    await lev.fill('.rp-rij input', NORA);
    await lev.press('.rp-rij input', 'Enter');
    await lev.waitForFunction(() => document.querySelector('.rp-rij input').type === 'password');
    await lev.fill('.rp-rij input', NORA_WW);
    await lev.press('.rp-rij input', 'Enter');
    await wachtOpZichtbaar(lev, '#liCode');
    await codeveldKlopt(lev, '#liCode');
    assert.equal(await lev.evaluate(() => localStorage.getItem('rtg_sup_token')), null, 'nog geen werksessie');
    assert.equal(await lev.evaluate(() => getComputedStyle(document.getElementById('gateGesprek')).display), 'none',
      'het gesprek wacht zolang de code gevraagd wordt');
    // een verkeerde code zegt het en laat het formulier staan
    await lev.locator('#liCode').fill(foutCode(begin.body.geheim));
    await lev.locator('#codeForm button[type="submit"]').click();
    await wachtTot(lev, () => /klopt niet/i.test(document.querySelector('#codeFout').textContent), null,
      { wat: 'de melding dat de code niet klopt (leverancier)' });
    // terug brengt het gesprek terug, met de reden, en geen "onjuiste inloggegevens"
    await lev.locator('#codeTerug').click();
    await wachtOpZichtbaar(lev, '#gateGesprek');
    await wachtTot(lev, () => /afgebroken/i.test(document.querySelector('.rp-zin').textContent), null,
      { wat: 'Rahul zegt dat de inlog is afgebroken' });
    assert.equal(await lev.evaluate(() => document.getElementById('codeForm').hidden), true);
    // het gesprek staat weer bij het wachtwoord: opnieuw, en nu de juiste code
    await lev.fill('.rp-rij input', NORA_WW);
    await lev.press('.rp-rij input', 'Enter');
    await wachtOpZichtbaar(lev, '#liCode');
    await lev.locator('#liCode').fill(code());
    await lev.locator('#codeForm button[type="submit"]').click();
    await wachtTot(lev, () => localStorage.getItem('rtg_sup_token'), null, { wat: 'de werksessie in de leverancier-app' });

    assert.deepEqual(fouten, [], 'geen fouten in de pagina');
  } finally {
    if (browser) await browser.close();
    stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
