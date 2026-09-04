/* HET HUIS VAN EEN WERELD TOONT ZIJN HELE WERELD.

   De fout die dit voorkomt is echt gebeurd en bleef lang stil: elk wereldhuis
   droeg een HANDGESCHREVEN rooster diensten, en dat liep uit de pas met MAPPEN.
   Passkeys en de wereldlaag stonden netjes in een wereld en waren vanaf het
   beginscherm tóch onbereikbaar -- ze stonden in de lijst en niet op het huis
   (TIKKEN.md). Een tweede lijst naast de bron is precies LAT.md regel 4.

   Deze toets vergelijkt wat er op het huis STAAT met wat er in
   shared/sprongindex.json hoort te staan -- de afgeleide van MAPPEN. Niet de
   aantallen: de ADRESSEN, want een gelijk aantal met een ander adres erin is
   precies de fout die je niet wilt missen.

   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, wachtTot } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const HUIZEN = [
  ['/apps/rtg.html', 'LivingOS'],
  ['/apps/kantoor.html', 'WorkOS'],
  ['/apps/reizen.html', 'TravelOS'],
  ['/apps/foundation/os-publiek.html', 'FoundationOS']
];

test('elk wereldhuis toont alles wat in die wereld hangt', { skip: geenBrowser(pw) }, async (t) => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public/shared/sprongindex.json'), 'utf8'));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rooster-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const u = Date.now().toString(36);
  const reg = await fetch(srv.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rooster Proef', email: 'rooster' + u + '@voorbeeld.test',
      phone: '0600' + Date.now().toString().slice(-6), password: 'geheim12345',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then(r => r.json());
  assert.ok(reg.token, 'registratie hoort een token te geven');

  const browser = await pw.chromium.launch(browserOpties());
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    for (const [pad, wereld] of HUIZEN) {
      await t.test(wereld + ' staat compleet op ' + pad, async () => {
        await page.goto(srv.base + pad, { waitUntil: 'domcontentloaded' });
        /* Op een toestand wachten en niet op een klok: het rooster staat sinds
           scripts/wereldrooster.js gewoon in de HTML, dus het is er zodra de
           pagina er is. We wachten op de eerste kaart en niet op een seconde. */
        await wachtTot(page, () => document.querySelectorAll('a[href]').length > 5,
          null, { wat: 'de links van dit wereldhuis' });
        const opHetHuis = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
          .map(a => new URL(a.getAttribute('href'), location.href).pathname));
        const hoort = index.items
          .filter(i => i.wereld === wereld && i.url && !i.huis)
          .map(i => new URL(i.url, 'http://x').pathname);
        const mist = hoort.filter(p => !opHetHuis.includes(p));
        assert.deepEqual(mist, [], 'deze onderdelen hangen in ' + wereld +
          ' maar staan niet op het huis: ' + mist.join(', '));
      });
    }
    await ctx.close();
  } finally {
    await browser.close();
    stop(srv);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
