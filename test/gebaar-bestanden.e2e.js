/* DE EERSTE VEEG DIE DE SERVER RAAKT: een bestand naar de prullenbak.

   Waarom dit een eigen scenario is en niet een regel in gebaar.e2e.js: daar
   wordt de LAAG getoetst (de laden, de drempel, de toetsen). Hier gaat het om
   de belofte die de laag doet zodra er een server achter zit -- optimistisch,
   met een weg terug, en met de regel die TERUGKOMT als het misgaat. Die drie
   zijn alleen samen iets waard, en alleen tegen een echte server te meten.

   GEEN VASTE WACHTTIJDEN. De eerste versie hiervan sliep duizend milliseconden
   en zakte soms wel en soms niet -- en hij SLAAGDE toen ik er logregels bij zette,
   want die kostten net genoeg tijd. Dat is geen toets maar een dobbelsteen. Er
   wordt nu gepold tot de server het zegt, met een grens eromheen; wat de laag
   belooft is dat het GEBEURT, niet dat het binnen een seconde gebeurt.

   EN HIJ ZAKTE SOMS, EN OP 20 AUGUSTUS 2026 IS UITGEZOCHT WAAROM. Tegen een
   KOUD gestarte server (zoals hier) zakte hij ongeveer een op de vijf keer,
   altijd op dezelfde plek: de regel droeg zijn klasse, beide globals stonden er,
   en er kwam geen lade en geen data-gb -- het gebaar begon niet eens.

   Hier stond dat ik niet wist waarom, met drie dingen die het NIET was. De
   oorzaak bleek een RACE MET EEN TIMER DIE ER HOORT TE ZIJN: gebaar-03b.js opent
   na 520 ms de actielade (lang drukken) en zet het lopende gebaar daarbij op nul.
   Tussen mouse.down() en de eerste mouse.move() zit een aparte CDP-ronde, en op
   een pagina die nog aan het opstarten is haalt die de 520 ms. Dan heeft deze
   toets in de ogen van de laag een halve seconde stilgestaan -- en dat IS
   vasthouden. Bewezen door het te forceren: 600 ms wachten na down() geeft
   precies dezelfde eindstand, plus de open dialog.gb-blad die ik toen niet had
   gecontroleerd. De vierde gedachte hierboven (een hertekening van de lijst) was
   dus een gelijkende oorzaak en niet de echte.

   De reparatie staat in test/helper.js, bij veegDoor -- op EEN plek, want deze
   functie stond hier vier keer.

   Draai: node --test test/gebaar-bestanden.e2e.js  (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, veegDoor, laadPlaywright, browserOpties, geenBrowser, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const BROWSER = process.env.RTG_CHROMIUM || undefined;

/* Pollen tot het waar is, of tot de grens. Geeft de laatste waarde terug zodat
   de bewering zelf kan zeggen wat er dan wel stond. */
async function wachtTot(lees, klopt, wat, grens = 8000) {
  const eind = Date.now() + grens;
  let laatst;
  while (Date.now() < eind) {
    laatst = await lees();
    if (klopt(laatst)) return laatst;
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.fail(wat + ' -- na ' + grens + 'ms stond er: ' + JSON.stringify(laatst));
}


test('een veeg zet een bestand in de prullenbak, en de weg terug haalt het eruit',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gb-best-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kluis ' + t, email: 'k' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');
    const api = (pad, body) => fetch(base + '/api/bestanden/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then((r) => r.json());
    const dataUrl = 'data:text/plain;base64,' + Buffer.from('een klein bestand').toString('base64');
    for (const naam of ['Contract-2026.txt', 'Paspoort-scan.txt']) {
      const r = await api('upload', { naam, dataUrl });
      assert.ok(!r.error, 'de proef heeft twee bestanden nodig: ' + r.error);
    }
    const staatVan = (n) => api('mijn', {}).then((s) => {
      const it = (s.items || []).find((x) => x.naam === n);
      return it ? { weg: !!it.weg, ster: !!it.ster } : null;
    });

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/bestanden.html', { waitUntil: 'load' });
    await page.waitForSelector('#lijst .item.gb-rij', { timeout: 20000 });
    assert.equal(await page.locator('#lijst .item').count(), 2, 'beide bestanden horen op het bord te staan');

    /* 0. EERST: PAST DE KNOP IN ZIJN EIGEN LADE? Gemeten op de OPEN lade en niet
       tijdens het vegen -- zolang de vinger staat is de lade zo breed als er
       geveegd is en heeft de knop ruimte die hij daarna niet heeft. En aan DEZE
       kant, want hier ligt EEN actie: dan is de lade exact zo breed als zijn
       knop, en dat is de enige stand waarin een pixel verschil zichtbaar wordt.
       De snedelijn is een border van 1px, en op een pagina die
       `*{box-sizing:border-box}` zet -- zoals deze -- gaat die pixel van de
       INHOUD af. Dan puilt de knoppenrij er precies zoveel uit en ziet de
       laatste letter er geschaafd uit. Daarom staat .gb-lade op content-box. */
    const eerste = page.locator('#lijst .item').first();
    const d0 = await eerste.boundingBox();
    await page.mouse.move(d0.x + d0.width * 0.8, d0.y + d0.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) await page.mouse.move(d0.x + d0.width * 0.8 - i * 7, d0.y + d0.height / 2);
    await page.mouse.up();
    /* Wachten tot de lade ER IS, niet tot het scherm stil is. wachtOpRust telt
       stilte, en vlak na een veeg is het nog stil omdat de lade nog moet
       opengaan -- dan meet de regel hieronder een lade die er niet staat. */
    await page.waitForFunction(() => !!document.querySelector('#lijst .gb-lade'), null, { timeout: 15000 });
    const uit = await page.evaluate(() => {
      const l = document.querySelector('#lijst .gb-lade');
      if (!l) return ['er staat geen open lade om te meten'];
      const lb = l.getBoundingClientRect();
      return [...l.querySelectorAll('.gb-doe')]
        .filter((e) => e.getBoundingClientRect().right > lb.right + 0.6)
        .map((e) => e.textContent.trim() + ' steekt ' +
          Math.round((e.getBoundingClientRect().right - lb.right) * 10) / 10 + 'px uit zijn lade');
    });
    assert.deepEqual(uit, [], 'geen enkele knop mag over de rand van zijn lade steken');
    await page.keyboard.press('Escape');
    // en tot hij WEG is; anders begint de volgende veeg op een lade die nog dichtgaat
    await page.waitForFunction(() => !document.querySelector('#lijst .gb-lade'), null, { timeout: 15000 });

    // 1. doorvegen zet het bestand er ECHT in -- gemeten aan de server, niet aan het scherm
    const rij = page.locator('#lijst .item').first();
    const naam = (await rij.locator('b').textContent()).trim();
    await veegDoor(page, await rij.boundingBox());
    await wachtTot(() => staatVan(naam), (s) => s && s.weg,
      'doorvegen hoort ' + naam + ' bij de server in de prullenbak te zetten');
    assert.match(await page.locator('.gb-terug').textContent(), new RegExp(naam.slice(0, 8), 'i'),
      'de melding hoort te zeggen WELK bestand er weg is, niet alleen dat er iets weg is');

    // 2. en de weg terug haalt hem er ook echt uit
    await page.locator('.gb-terug button').click();
    await wachtTot(() => staatVan(naam), (s) => s && !s.weg,
      'Terugdraaien hoort het bestand terug in de kluis te zetten');

    // 3. de andere kant draagt andere acties, en de ster is ook echt omkeerbaar
    await page.waitForSelector('#lijst .item.gb-rij');
    const weer = page.locator('#lijst .item').first();
    const naam2 = (await weer.locator('b').textContent()).trim();
    const d2 = await weer.boundingBox();
    await page.mouse.move(d2.x + d2.width * 0.15, d2.y + d2.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) await page.mouse.move(d2.x + d2.width * 0.15 + i * 11, d2.y + d2.height / 2);
    assert.deepEqual(await page.evaluate(() =>
      [...document.querySelectorAll('#lijst .gb-lade .gb-doe > span')].map((s) => s.textContent)),
      ['Ster', 'Overnemen'], 'naar rechts horen de ster en overnemen te liggen');
    await page.mouse.up();
    await page.keyboard.press('Escape');

    // 4. wat de server weigert, komt TERUG op het scherm -- stil falen is hier het ergst
    await page.route('**/api/bestanden/weg', (r) => r.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'De kluis is even niet bereikbaar.' })
    }));
    const derde = page.locator('#lijst .item').first();
    const naam3 = (await derde.locator('b').textContent()).trim();
    await veegDoor(page, await derde.boundingBox());
    await page.waitForFunction(() => {
      const t = document.querySelector('.gb-terug');
      return t && /niet bereikbaar/i.test(t.textContent);
    }, null, { timeout: 8000 });
    await page.waitForFunction((n) => [...document.querySelectorAll('#lijst .item b')]
      .some((b) => b.textContent.trim() === n), naam3, { timeout: 8000 });
    assert.equal((await staatVan(naam3)).weg, false,
      'een geweigerde veeg mag bij de server niets veranderd hebben');
    await page.unroute('**/api/bestanden/weg');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het vegen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
