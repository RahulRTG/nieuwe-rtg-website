/* DE SPRONG: een tik naar elke functie, vanaf elk scherm.

   Deze toets bewaakt de belofte die scripts/tikken.js meet. De meter zegt
   HOEVEEL tikken het huis diep is; deze toets zegt of het instrument dat die
   diepte kort houdt, er ook echt staat en werkt.

   Vier beweringen, en alle vier komen ze uit iets dat hier is misgegaan:

   1) DE GREEP STAAT ER, EN NIET VOOR IEDEREEN. Op een gewoon ledenscherm staat
      hij; zonder ledensessie staat hij er niet -- een deur die het hele huis
      opent hoort niet op een inlogscherm.
   2) DE GREEP IS EEN DUIM GROOT. TOEGANKELIJK.md eist minstens 24x24 op
      telefoonformaat; deze is met opzet ruimer.
   3) EEN TIK OPENT DE LIJST, EEN TWEEDE OPENT DE FUNCTIE. Dat is de hele
      belofte: twee tikken, waar u ook staat.
   4) DE RIJEN DRAGEN HUN ADRES. Zonder data-url ziet scripts/tikken.js de korte
      weg niet, en dan meet het huis zich dieper dan het is -- en erger: dan kan
      iemand de korte weg weghalen zonder dat een meting zakt.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function opzet() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sprong-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const u = Date.now().toString(36);
  const r = await fetch(srv.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sprong Proef', email: 'sprong' + u + '@voorbeeld.test',
      phone: '0600' + Date.now().toString().slice(-6),
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  });
  const d = await r.json();
  assert.ok(d.token, 'registratie hoort een token te geven, kreeg: ' + JSON.stringify(d).slice(0, 200));
  return { srv, token: d.token, dataDir };
}

/* Telefoonformaat, want een tik is een duim. Op een breed scherm zou deze toets
   iets anders meten dan de belofte belooft. */
const TELEFOON = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' };

test('de sprong: een tik naar elke functie, vanaf elk scherm', { skip: geenBrowser(pw) }, async (t) => {
  const { srv, token, dataDir } = await opzet();
  const browser = await pw.chromium.launch(browserOpties());
  const opruimen = () => { try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {} };
  try {
    await t.test('zonder ledensessie staat er geen greep', async () => {
      const ctx = await browser.newContext(TELEFOON);
      const page = await ctx.newPage();
      await page.goto(srv.base + '/apps/leven.html', { waitUntil: 'load' });
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('.rtgsprong-greep').count(), 0,
        'een uitgelogde bezoeker hoort geen deur naar het hele huis te krijgen');
      await ctx.close();
    });

    const ctx = await browser.newContext(TELEFOON);
    await ctx.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, token);
    const page = await ctx.newPage();
    /* Een gewoon ledenscherm dat app-main NIET laadt: juist daar bestond de
       korte weg niet, en juist daar moet hij nu staan. */
    await page.goto(srv.base + '/apps/leven.html', { waitUntil: 'load' });
    await page.waitForTimeout(1800);

    await t.test('de greep staat er en is een duim groot', async () => {
      const greep = page.locator('.rtgsprong-greep');
      assert.equal(await greep.count(), 1, 'de greep hoort op elk ledenscherm te staan');
      const doos = await greep.boundingBox();
      assert.ok(doos && doos.width >= 24 && doos.height >= 24,
        'een raakvlak is minstens 24x24 (TOEGANKELIJK.md), gemeten: ' + JSON.stringify(doos));
    });

    await t.test('een tik opent de lijst, en die lijst is niet leeg', async () => {
      await page.locator('.rtgsprong-greep').click();
      await page.waitForTimeout(400);
      const rijen = await page.locator('.rtgsprong-rij:visible').count();
      assert.ok(rijen > 20, 'de lijst hoort alles te tonen zonder dat er getypt wordt, kreeg ' + rijen + ' rijen');
    });

    await t.test('elke rij met een adres draagt dat adres ook echt', async () => {
      const zonder = await page.evaluate(() => [...document.querySelectorAll('.rtgsprong-rij')]
        .filter(b => !b.dataset.url).map(b => b.textContent.trim()));
      /* Tabs en os-apps wonen IN de leden-app en hebben geen eigen adres; die
         mogen er zonder staan. Een rij met een adres dat het verzwijgt, niet:
         dan ziet scripts/tikken.js de korte weg niet. */
      const index = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public/shared/sprongindex.json'), 'utf8'));
      const zonderAdres = index.items.filter(i => !i.url).length;
      assert.ok(zonder.length <= zonderAdres,
        'rijen zonder data-url: ' + zonder.length + ', terwijl er maar ' + zonderAdres +
        ' bestemmingen zonder adres zijn -- ' + JSON.stringify(zonder.slice(0, 5)));
    });

    await t.test('de tweede tik opent de functie', async () => {
      await page.fill('.rtgsprong-kop input', 'pay');
      await page.waitForTimeout(250);
      await page.locator('.rtgsprong-rij:visible').first().click();
      await page.waitForTimeout(1500);
      assert.equal(new URL(page.url()).pathname, '/apps/pay.html',
        'zoeken op de SLEUTEL (pay) hoort RTG Pay te openen, ook al heet de rij "Betalen"');
    });
    await ctx.close();
  } finally {
    await browser.close();
    stop(srv);
    opruimen();
  }
});
