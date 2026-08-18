/* ============================================================================
   TEAMS IN EEN ECHTE BROWSER.

   De serverkant is los nagemeten (test/spelteams.test.js). Hier gaat het om de
   twee dingen die alleen op het scherm bestaan: dat een team te maken is zonder
   dat je eerst iets anders moet weten, en dat het daarna ook echt iets DOET --
   een tik op de teamnaam vult de kieslijst van een nieuw potje.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-teams-e2e-'));
let teller = 0;

test('een lid maakt een team, vraagt een vriend erbij en speelt er in een tik mee',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const raw = (pad, body, token) => fetch(base + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
  const json = async (p, b, t) => (await raw(p, b, t)).json();
  let browser;
  try {
    async function lid() {
      const u = Date.now().toString().slice(-8) + (teller++) + Math.floor(Math.random() * 90 + 10);
      const r = await json('/auth/register', { name: 'Teamlid', email: 'te' + u + '@x.nl', phone: '06' + u.slice(0, 8),
        password: 'geheim12345', geboortedatum: '1986-06-06', tier: 'rtg' });
      assert.ok(r.token, 'aangemeld: ' + JSON.stringify(r).slice(0, 160));
      return { tok: r.token, cn: r.state.user.codename };
    }
    const a = await lid(), b = await lid();
    await raw('/member/connections', {}, a.tok); await raw('/member/connections', {}, b.tok);
    const zoek = await json('/member/find', { q: b.cn }, a.tok);
    const bKey = (zoek.results.find(r => r.codename === b.cn) || {}).key;
    await raw('/member/connect', { key: bKey }, a.tok);
    const vz = await json('/member/connections', {}, b.tok);
    await raw('/member/connect/respond', { key: (vz.requests || [])[0].key, action: 'accept' }, b.tok);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, a.tok);
    await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });

    // de vriendenchips van het teamblok staan er zodra de lobby geladen is
    await page.waitForFunction(() => document.querySelectorAll('#teamVrienden .chip').length > 0, null, { timeout: 15000 });
    await page.click('#teamVrienden .chip');          // de vriend erbij vragen
    await page.fill('#teamNaam', 'De Donderdagclub');
    await page.click('#teamMaak');
    await page.waitForFunction(() => /Donderdagclub/.test(document.querySelector('#teams').textContent), null, { timeout: 15000 });

    // de vriend zegt ja langs de gewone weg
    const bijB = await json('/member/spel/team-mijn', {}, b.tok);
    assert.equal(bijB.uitnodigingen.length, 1, 'de uitnodiging is echt verstuurd');
    await raw('/member/spel/team-antwoord', { id: bijB.uitnodigingen[0].id, akkoord: true }, b.tok);

    /* En nu waar een team voor is: een potje starten zonder opnieuw iedereen
       aan te klikken. Even herladen zodat de lobby de nieuwe stand ophaalt. */
    await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#teams .rij').length > 0, null, { timeout: 15000 });
    await page.click('[data-spel="schaak"]');
    await page.waitForFunction(() => !document.querySelector('#nTeams').hidden, null, { timeout: 15000 });
    await page.click('#nTeams .chip');
    await page.waitForFunction(() => /\(1\)/.test(document.querySelector('#nStart').textContent), null, { timeout: 15000 });
    const knop = await page.evaluate(() => document.querySelector('#nStart').textContent);
    assert.match(knop, /\(1\)/, 'een tik op het team vult de kieslijst: ' + knop);

    await page.click('#nStart');
    await page.waitForFunction(() => /Donderdagclub/.test(document.querySelector('#teams').textContent), null, { timeout: 15000 });
    const potjes = await json('/member/spel/mijn', {}, b.tok);
    assert.equal((potjes.uitnodigingen || []).length, 1, 'de teamgenoot is uitgenodigd voor het potje');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
