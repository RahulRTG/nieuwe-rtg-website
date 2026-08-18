/* ============================================================================
   PRATEN IN HET POTJE, IN EEN ECHTE BROWSER.

   De serverkant is los nagemeten (test/spelpraat.test.js). Wat daarmee nog
   niet vaststaat is of de pagina het venster ook echt toont, vult en verstuurt
   -- en, minstens zo belangrijk, of hij het WEGLAAT als de server nee zegt.
   Dat laatste is de zichtbare kant van de regel "een potje geeft geen nieuw
   recht om iemand te bereiken": bij een potje met een vreemde hoort er geen
   invoerveld te staan dat toch nog iets probeert.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-praat-e2e-'));
let teller = 0;

function maakApi(base) {
  const raw = (pad, body, token) => fetch(base + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
  const json = async (p, b, t) => (await raw(p, b, t)).json();
  return { raw, json };
}

test('twee vrienden praten in hun potje; met een vreemde staat er geen invoerveld',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const { raw, json } = maakApi(base);
  let browser;
  try {
    async function lid() {
      const u = Date.now().toString().slice(-8) + (teller++) + Math.floor(Math.random() * 90 + 10);
      const r = await json('/auth/register', { name: 'Prater', email: 'pe' + u + '@x.nl', phone: '06' + u.slice(0, 8),
        password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
      assert.ok(r.token, 'aangemeld: ' + JSON.stringify(r).slice(0, 160));
      return { tok: r.token, cn: r.state.user.codename };
    }
    const a = await lid(), b = await lid(), c = await lid();
    // A en B worden vrienden; C blijft een vreemde
    await raw('/member/connections', {}, a.tok); await raw('/member/connections', {}, b.tok);
    const zoek = await json('/member/find', { q: b.cn }, a.tok);
    const bKey = (zoek.results.find(r => r.codename === b.cn) || {}).key;
    await raw('/member/connect', { key: bKey }, a.tok);
    const vz = await json('/member/connections', {}, b.tok);
    await raw('/member/connect/respond', { key: (vz.requests || [])[0].key, action: 'accept' }, b.tok);

    const potje = await json('/member/spel/nieuw', { soort: 'schaak', vrienden: [bKey] }, a.tok);
    await raw('/member/spel/antwoord', { id: potje.id, akkoord: true }, b.tok);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const open = async (token, id) => {
      await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, token);
      await page.goto(base + '/apps/spelen.html?potje=' + encodeURIComponent(id), { waitUntil: 'domcontentloaded' });
    };

    /* ---- A opent het potje en zegt iets ---- */
    await open(a.tok, potje.id);
    await page.waitForFunction(() => !document.querySelector('#sPraat').hidden, null, { timeout: 15000 });
    await page.fill('#prtVeld', 'Zet jij eerst?');
    await page.click('#prtKnop');
    await page.waitForFunction(() => /Zet jij eerst/.test(document.querySelector('#prtLijst').textContent), null, { timeout: 15000 });
    const eigen = await page.evaluate(() => document.querySelector('#prtLijst').textContent);
    assert.match(eigen, /jij/, 'je eigen bericht staat op naam "jij": ' + eigen);

    // B leest het langs de gewone weg mee (server, niet de pagina)
    const bijB = await json('/member/spel/praat', { id: potje.id }, b.tok);
    assert.equal(bijB.berichten.length, 1);
    // ... en antwoordt, waarna A het venster ziet bijwerken zonder herladen
    await raw('/member/spel/praat-stuur', { id: potje.id, tekst: 'Ik begin.' }, b.tok);
    await page.waitForFunction(() => /Ik begin/.test(document.querySelector('#prtLijst').textContent), null, { timeout: 20000 });

    /* ---- C zit in een potje met een vreemde: geen venster ---- */
    const random1 = await json('/member/spel/random', { soort: 'schaak' }, c.tok);
    assert.ok(random1.wachten, 'C staat in de wachtrij');
    const d = await lid();
    const random2 = await json('/member/spel/random', { soort: 'schaak' }, d.tok);
    assert.ok(random2.gestart, 'twee vreemden zijn gekoppeld: ' + JSON.stringify(random2).slice(0, 160));

    await open(c.tok, random2.id);
    await page.waitForFunction(() => !document.querySelector('#vSpel').hidden, null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    const praatWeg = await page.evaluate(() => document.querySelector('#sPraat').hidden);
    assert.equal(praatWeg, true, 'bij een potje met een vreemde hoort er geen praatvenster te staan');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
