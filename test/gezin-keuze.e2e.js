/* SCHERMTOETS: de stand Gezin stuurt een antwoord naar het GEKOZEN gezin.

   DE FOUT (domeinkaart LivingOS-A, 19 oktober 2026). Chat en antwoord in de
   stand Gezin (app-main-43.js laadGezinChat, app-main-44.js rtfReply) gebruikten
   altijd `rtf.gekoppeld[0]`. Een oppas die twee gezinnen volgt, schreef dus
   altijd naar het eerste, ook als hij het tweede bedoelde.

   DE TOETS. Een oppas is gekoppeld aan twee gezinnen. In de stand kiest hij het
   tweede en stuurt een antwoord. Het bericht staat bij het tweede gezin en niet
   bij het eerste, gelezen zoals de gezinsapp dat doet.

   Draait alleen waar een browser beschikbaar is. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Gezin: een oppas met twee gezinnen antwoordt het gezin dat hij koos', { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezin-keuze-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  let n = 0;
  const lid = async () => {
    const u = String(Date.now()).slice(-9) + (n++);
    return (await post('/api/auth/register', { name: 'Gezinslid', email: 'gk' + u + '@x.nl', phone: '06' + u.slice(-8),
      password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
  };
  /* Een ouder met een eigen gezin, en een uitnodiging voor de oppas. */
  const gezinMet = async (naam) => {
    const P = await lid();
    const g = await post('/api/rtf/eigen-gezin/maak', { gezinsnaam: naam, naam: 'Beheerder', bevoegdGezin: true, privacyAkkoord: true }, P);
    const prof = ((g.body && g.body.profielen) || [])[0];
    const s = (await post('/api/rtf/eigen-gezin/sessie', { profielId: prof && prof.id }, P)).body;
    const u = (await post('/api/foundation/gezin/uitnodiging/maak', { code: s.code, token: s.token, naam: 'Oppas Mila', rol: 'gast', relatie: 'oppas' })).body.uitnodiging;
    return { code: s.code, token: s.token, uitnodiging: u, naam };
  };
  const berichten = async (g) => {
    const r = await fetch(base + '/api/foundation/gezin/' + g.code + '/berichten', { headers: { Authorization: 'Bearer ' + g.token } });
    return ((await r.json().catch(() => ({}))).berichten) || [];
  };
  let browser;
  try {
    const een = await gezinMet('Gezin Een'), twee = await gezinMet('Gezin Twee');
    const O = await lid();
    for (const g of [een, twee]) {
      const a = await post('/api/rtf/uitnodiging/accepteer', { uitnodiging: base + '/apps/foundation/registreren.html#familie=' + encodeURIComponent(g.uitnodiging) }, O);
      assert.equal(a.status, 200, 'de oppas koppelt aan ' + g.naam + ': ' + JSON.stringify(a.body));
    }

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx.addInitScript((token) => {
      localStorage.setItem('rtg_member_token', token);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, O);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/app.html#tab=gezin', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rtfReplyIn', { state: 'attached', timeout: 20000 });
    await page.waitForSelector('#rtfGezinKeus', { state: 'attached', timeout: 5000 });
    /* De stand staat in de DOM maar is in dit venster niet per se zichtbaar
       (de schil bepaalt dat); de fout gaat over WELK gezin het antwoord krijgt,
       dus de toets bedient de elementen rechtstreeks, zoals een tik dat doet. */
    const gestuurd = page.waitForResponse((r) => r.url().endsWith('/api/rtf/bericht'), { timeout: 15000 });
    await page.evaluate((code) => {
      const k = document.querySelector('#rtfGezinKeus'); k.value = code; k.dispatchEvent(new Event('change'));
      document.querySelector('#rtfReplyIn').value = 'Voor gezin twee, niet voor een';
      document.querySelector('#rtfReplyBtn').click();
    }, twee.code);
    assert.equal((await gestuurd).status(), 200);

    const bijTwee = await berichten(twee), bijEen = await berichten(een);
    assert.ok(bijTwee.some((m) => m.tekst === 'Voor gezin twee, niet voor een'), 'het bericht staat bij het gekozen gezin');
    assert.ok(!bijEen.some((m) => m.tekst === 'Voor gezin twee, niet voor een'), 'en niet bij het eerste');
    assert.deepEqual(fouten, [], 'de pagina logde fouten: ' + JSON.stringify(fouten).slice(0, 400));
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
