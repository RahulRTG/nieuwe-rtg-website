/* Scherm-toets op DE REISBALIE: de kamer Reisbureau in kantoren.html.

   WAAROM DIT BESTAND ER IS. Hier wordt een aanvraag een TOEZEGGING aan een lid.
   De serverkant staat in test/reisbureau.test.js (toets 7 t/m 9); wat hier moet
   blijken is dat het scherm daar echt op aangesloten zit -- want dit is precies
   het soort knop dat er goed uitziet en niets doet, en dan wacht er iemand op
   een reis die niemand heeft bevestigd.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:

   1. De balie toont de aanvraag die de API kent, met dezelfde ref en dezelfde
      codenaam -- niet "er staat een regel".
   2. Op Bevestig drukken verandert de STAND BIJ HET LID, na te meten via de
      leden-API. Een scherm dat alleen zijn eigen lijstje bijwerkt is een scherm
      dat doet alsof.
   3. Afwijzen zonder reden verandert niets, en het scherm zegt waarom. De
      server weigert het al; de vraag is of de gebruiker dat merkt of dat de
      regel stil van de lijst verdwijnt.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
/* Dezelfde browserkeuze als test/office-suite.e2e.js: een meegeleverde Chromium
   staat niet overal op de plek die playwright zelf verwacht, en dan is een
   overgeslagen schermtoets het stilste dat er is (LAT-regel 3). */
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

test('de reisbalie bevestigt echt: wat het kantoor hier besluit, ziet het lid',
  { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisbalie-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-BALIE-1' } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const reg = await post('/api/auth/register', { name: 'Reiziger', email: 'b' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    const lid = reg.body.token;
    assert.ok(lid, 'het lid staat ingeschreven');
    const kantoor = await kantoorAlsPersoon(srv.base);
    assert.ok(kantoor, 'de eigenaar staat als persoon in de backoffice');

    /* Twee echte aanvragen, want het scherm moet ook de JUISTE regel raken. Een
       balie met een enkele regel bewijst niet dat de knop bij zijn eigen
       aanvraag hoort -- dan werkt een verkeerde koppeling net zo goed. */
    const cat = await post('/api/reisbureau', {}, lid);
    assert.ok(cat.body.reizen.length >= 2, 'er staan minstens twee reizen klaar');
    const eerste = (await post('/api/reisbureau/boek', { tripId: cat.body.reizen[0].id, personen: 2 }, lid)).body.aanvraag;
    const tweede = (await post('/api/reisbureau/boek', { tripId: cat.body.reizen[1].id, personen: 4 }, lid)).body.aanvraag;
    assert.ok(eerste.ref && tweede.ref && eerste.ref !== tweede.ref, 'twee aanvragen, twee refs');

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok.lid); localStorage.setItem('rtg_office_token', tok.kantoor); } catch (e) {}
    }, { lid, kantoor });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/kantoren.html?kamer=reisbureau', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#kReisbureau:not([hidden])', { timeout: 20000 });
    const wacht = async (ref) => page.waitForFunction((r) => {
      const el = document.querySelector('#kReisOpen');
      return el && el.innerText.includes(r);
    }, ref, { timeout: 20000 });
    await wacht(eerste.ref);

    await t.test('de balie toont de aanvragen die de API kent, op codenaam', async () => {
      const tekst = await page.$eval('#kReisOpen', el => el.innerText);
      assert.ok(tekst.includes(eerste.ref), 'de eerste aanvraag staat er: ' + tekst.slice(0, 200));
      assert.ok(tekst.includes(tweede.ref), 'en de tweede ook');
      assert.ok(tekst.includes(eerste.codename), 'met de codenaam van het lid, niet met zijn echte naam');
      assert.ok(!tekst.includes('Reiziger'), 'de echte naam komt hier niet in beeld');
      assert.ok(tekst.includes('4 pers'), 'het aantal reizigers staat erbij');
    });

    await t.test('Bevestig verandert de stand bij het lid, en raakt alleen die aanvraag', async () => {
      await page.click('button[data-besluit="bevestigd"][data-ref="' + eerste.ref + '"]');
      // wachten tot de bevestigde aanvraag van de wachtrij af is
      await page.waitForFunction((r) => {
        const el = document.querySelector('#kReisOpen');
        return el && !el.innerText.includes(r);
      }, eerste.ref, { timeout: 20000 });

      const mijn = await post('/api/reisbureau/mijn', {}, lid);
      const bij = mijn.body.aanvragen.find(a => a.ref === eerste.ref);
      assert.equal(bij.status, 'bevestigd', 'het lid ziet zijn reis bevestigd staan');
      const andere = mijn.body.aanvragen.find(a => a.ref === tweede.ref);
      assert.equal(andere.status, 'aangevraagd', 'de andere aanvraag is niet meegesleept');
      const nog = await page.$eval('#kReisOpen', el => el.innerText);
      assert.ok(nog.includes(tweede.ref), 'en staat dus nog op de balie');
    });

    await t.test('afwijzen zonder reden verandert niets, en de regel blijft staan', async () => {
      await page.click('button[data-besluit="afgewezen"][data-ref="' + tweede.ref + '"]');
      await page.waitForFunction(() => {
        const m = document.querySelector('#melding');
        return m && m.style.opacity === '1' && /reden/i.test(m.textContent);
      }, null, { timeout: 20000 });
      const na = await post('/api/reisbureau/mijn', {}, lid);
      assert.equal(na.body.aanvragen.find(a => a.ref === tweede.ref).status, 'aangevraagd',
        'de geweigerde afwijzing heeft de aanvraag niet aangeraakt');
      assert.ok((await page.$eval('#kReisOpen', el => el.innerText)).includes(tweede.ref),
        'en de aanvraag staat nog op de balie in plaats van stil te verdwijnen');

      // mét reden gaat hij wel weg, en het lid leest die reden
      await page.fill('input[data-bericht="' + tweede.ref + '"]', 'Deze datum zit vol; een week later kan wel.');
      await page.click('button[data-besluit="afgewezen"][data-ref="' + tweede.ref + '"]');
      await page.waitForFunction((r) => {
        const el = document.querySelector('#kReisOpen');
        return el && !el.innerText.includes(r);
      }, tweede.ref, { timeout: 20000 });
      const eind = await post('/api/reisbureau/mijn', {}, lid);
      const af = eind.body.aanvragen.find(a => a.ref === tweede.ref);
      assert.equal(af.status, 'afgewezen');
      assert.equal(af.besluit.bericht, 'Deze datum zit vol; een week later kan wel.');
    });

    assert.deepEqual(fouten, [], 'geen scriptfouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
