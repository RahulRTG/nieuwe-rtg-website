/* HET DERDE DOMEIN MET EEN VEEG DIE DE SERVER RAAKT, en het eerste waar de twee
   soorten actie NAAST elkaar liggen.

   Archiveren is omkeerbaar: `bewaar {archief:true}` legt de notitie in de la en
   `{archief:false}` haalt hem eruit. Weggooien is dat niet -- de kern gooit hem
   echt uit het bord en neemt een gekoppelde agenda-afspraak mee. Die tweede
   krijgt daarom geen terugdraai-knop maar een borg: vasthouden. Dat is geen
   strengheid maar de enige eerlijke uitkomst, en het is precies wat hier
   gemeten wordt -- want een borg die stiekem toch op een enkele druk afgaat, is
   erger dan geen borg.

   Zelfde regel als bij de kluis en de post: geen vaste wachttijden, er wordt
   gepold tot de server het zegt.

   Draai: node --test test/gebaar-notities.e2e.js  (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, veegDoor, laadPlaywright, browserOpties, geenBrowser, wachtOpRust, wachtOpWaarde } = require('./helper');

const pw = laadPlaywright();
const BROWSER = process.env.RTG_CHROMIUM || undefined;

/* Wacht op een TOESTAND via wachtOpWaarde uit ./helper (scripts/klokwacht.js);
   `klopt` mag ook op null of false slaan, dus de waarde gaat verpakt terug. */
async function wachtTot(lees, klopt, wat, grens = 8000) {
  let laatst;
  try {
    const raak = await wachtOpWaarde(async () => {
      laatst = await lees();
      return klopt(laatst) ? { waarde: laatst } : false;
    }, { ms: grens, stap: 120, wat });
    return raak.waarde;
  } catch (e) {
    assert.fail(wat + ' -- na ' + grens + 'ms stond er: ' + JSON.stringify(laatst));
  }
}


test('een veeg archiveert een notitie en draait terug; weggooien gaat alleen op vasthouden',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gb-not-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bord ' + t, email: 'b' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');
    const api = (pad, body) => fetch(base + '/api/notities/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then((r) => r.json());
    for (const titel of ['Paklijst Kyoto', 'Voor vertrek']) {
      const r = await api('bewaar', { soort: 'notitie', titel, tekst: 'Adapter, paspoort, regenjas.' });
      assert.ok(!r.error, 'de proef heeft twee notities nodig: ' + r.error);
    }
    /* De stand volgens de SERVER: bestaat de notitie nog, en ligt hij in de la?
       Niet volgens het scherm -- dat is precies het verschil dat optimistisch
       bijwerken kan verbergen. */
    const staatVan = (titel) => api('mijn', {}).then((s) => {
      const n = (s.eigen || []).find((x) => x.titel === titel);
      return n ? { archief: !!n.archief, vast: !!n.vast } : null;
    });

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bord .nkaart.gb-rij', { timeout: 20000 });
    assert.equal(await page.locator('#bord .nkaart').count(), 2, 'beide notities horen op het bord te staan');

    // 1. doorvegen legt de notitie ECHT in de la
    const rij = page.locator('#bord .nkaart').first();
    const titel = (await rij.locator('h3').textContent()).trim();
    await veegDoor(page, await rij.boundingBox());
    await wachtTot(() => staatVan(titel), (s) => s && s.archief,
      'doorvegen hoort ' + titel + ' bij de server te archiveren');
    assert.match(await page.locator('.gb-terug').textContent(), /^\s*Gearchiveerd/,
      'de melding hoort te beginnen met wat er gebeurd is');

    // 2. en de weg terug haalt hem er ook echt uit
    await page.locator('.gb-terug button').click();
    await wachtTot(() => staatVan(titel), (s) => s && !s.archief,
      'Terugdraaien hoort de notitie terug op het bord te zetten');

    // 3. de andere kant pint vast, en dat is ook echt omkeerbaar
    /* EERST HET BORD LATEN UITHERTEKENEN, en dat is de oorzaak van twee losse
       flakkeringen die hieronder zaten. `wachtTot` hierboven pollt de SERVER:
       die is klaar zodra het terugdraaien is verwerkt, terwijl de pagina daarna
       nog moet hertekenen. En `waitForSelector('#bord .nkaart.gb-rij')` is dan
       meteen tevreden -- de OUDE kaarten voldoen er ook aan. Wie hier doorloopt,
       pakt de maten van een kaart die een tel later wordt vervangen; het gebaar
       begint dan op een knoop die uit het document wordt gehaald, en de lade die
       de laag eraan hangt is nergens meer te vinden. Dat verklaarde zowel de
       lege lade in deze stap als het weggooien in stap 4 dat niets deed: dat
       leunt op dezelfde regel. Deze wacht kijkt naar het BORD zelf en gaat pas
       door als daar niets meer verandert. */
    await page.waitForSelector('#bord .nkaart.gb-rij');
    await wachtOpRust(page, '#bord');
    const weer = page.locator('#bord .nkaart').first();
    const titel2 = (await weer.locator('h3').textContent()).trim();
    const d2 = await weer.boundingBox();
    /* NIET DOORVEGEN. Een kaart op het bord is smaller dan een regel in een
       lijst, dus de drempel ligt dichterbij: zestien stapjes van elf pixels
       kwamen erover en pinden de notitie ECHT vast. Daarna hertekent het bord,
       en de toetsaanslag hieronder landde op een kaart die net vervangen was --
       dan vindt de laag geen acties meer en gaat er geen actielade open. Deze
       proef wil de lade ZIEN, niet uitvoeren; dat gebeurt hieronder met de
       toets. */
    await veegDoor(page, d2, { startFractie: 0.15, afstand: 110, stappen: 10, loslaten: false });
    /* De EERSTE actie ligt vast -- dat is degene die een volle veeg uitvoert --
       en wat er verder in de lade past hangt van de breedte van de kaart af. Het
       bord is een raster, dus een kaart is smaller dan het venster en 'Overnemen'
       valt er hier uit. Daarom wordt hier niet op een vaste rij beweerd maar op
       de regel: de eerste klopt, alles wat er staat past HEEL, en wat er niet in
       past staat in de actielade. */
    /* WACHTEN TOT DE LADE ER ECHT IS, en niet tot de muis klaar is met bewegen.
       Dit zakte af en toe met `undefined` op de eerste actie, en de oorzaak is
       geen drempel maar een tik: de laag bouwt de lade tijdens het slepen op,
       en `page.mouse.move` keert terug zodra de gebeurtenis is afgeleverd -- niet
       zodra het scherm hem verwerkt heeft. De toets las de lade dus in dezelfde
       tik waarin hij werd gevuld. Het viel op doordat er tijdelijk een
       diagnoseregel tussen stond: die ene extra heen-en-weer naar de browser was
       al genoeg om hem te laten slagen, en dat is het bewijs van een race en niet
       van een te korte veeg. De muis blijft hier bewust ingedrukt. */
    await page.waitForSelector('#bord .gb-lade .gb-doe > span', { state: 'attached', timeout: 10000 });
    const lade = await page.evaluate(() =>
      [...document.querySelectorAll('#bord .gb-lade .gb-doe > span')].map((s) => s.textContent));
    assert.equal(lade[0], 'Vastpinnen', 'naar rechts hoort vastpinnen vooraan te liggen');
    assert.ok(await page.evaluate(() => {
      const l = document.querySelector('#bord .gb-lade');
      const r = l.getBoundingClientRect();
      return [...l.querySelectorAll('.gb-doe')].every((e) => e.getBoundingClientRect().right <= r.right + 0.6);
    }), 'geen enkele actie mag over de rand van de lade steken');
    await page.mouse.up();
    await page.keyboard.press('Escape');

    /* 4. WEGGOOIEN GAAT ALLEEN OP VASTHOUDEN. Er is geen route die het terugdraait,
       dus de laag hoort er vanzelf een borg van te maken. Een enkele druk zet hem
       op scherp en doet verder niets; pas de tweede voert uit. */
    await page.waitForSelector('#bord .nkaart.gb-rij');
    await page.locator('#bord .nkaart').first().focus();
    await page.keyboard.press('ContextMenu');
    await page.waitForSelector('.gb-blad', { timeout: 5000 });
    const inBlad = await page.evaluate(() =>
      [...document.querySelectorAll('.gb-blad menu button > span')].map((s) => s.textContent));
    assert.ok(inBlad.some((x) => /Overnemen/.test(x)),
      'wat niet in de lade past, hoort wel in de actielade te staan: ' + JSON.stringify(inBlad));
    const knop = page.locator('.gb-blad menu button', { hasText: 'Weggooien' }).first();
    assert.match(await knop.textContent(), /houd vast/,
      'weggooien kan niet terug, dus hoort hij te zeggen dat je hem vasthoudt');
    await knop.press('Enter');
    await wachtOpRust(page);
    assert.ok(await knop.getAttribute('data-scherp') !== null, 'de eerste druk zet hem op scherp');
    assert.ok(await staatVan(titel2), 'de eerste druk mag de notitie nog niet hebben weggegooid');
    assert.equal((await staatVan(titel2)).vast, false,
      'de halve veeg hierboven mag de notitie NIET hebben vastgepind; dan meet die stap de lade en niet de uitvoering');
    await knop.press('Enter');
    await wachtTot(() => staatVan(titel2), (s) => s === null,
      'de tweede druk hoort de notitie echt weg te gooien');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het vegen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ALS BLAD, EN DAAR ONTBRAK DE TABEL (EDGE.md par. 11, ronde 2, stap 10).

   Los krijgt het bord de grammatica van de adaptieve Edge mee; als blad in de
   werktafel niet, en daar kregen vijf van de negen gebaarschermen hem nooit
   (gemeten op 23 september 2026: kantoor, notities, post, Salon en sociaal).
   Sinds lang drukken zijn tijd uit DREMPELS leest, stond het daar dus uit. De
   gebaarlaag brengt de grammatica nu zelf mee bij de eerste zet() of lijst();
   deze proef zet het bord in een frame op dezelfde oorsprong, zoals de werktafel
   een blad opent, en drukt lang op een kaart. Eerst het gebaar en daarna de
   oorzaak: zakt hij, dan zegt de eerste bewering WAT er misgaat. */
const gram = require('../public/shared/adaptief/grammatica.js');

test('als blad in een frame: lang drukken op een notitie opent de actielade, met de grammatica die de laag zelf meebrengt',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gb-not-blad-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Blad ' + t, email: 'bl' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');
    const r = await fetch(base + '/api/notities/bewaar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify({ soort: 'notitie', titel: 'Paklijst Kyoto', tekst: 'Adapter, paspoort, regenjas.' })
    }).then((x) => x.json());
    assert.ok(!r.error, 'de proef heeft een notitie nodig: ' + r.error);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await page.clock.install(); // lang drukken is TIJD: de nepklok springt, er wordt niet gegokt
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    /* Een kale gastheer op dezelfde oorsprong, met het bord als blad erin. */
    await page.goto(base + '/site/404.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((u) => {
      document.body.innerHTML = '';
      const f = document.createElement('iframe');
      f.id = 'blad'; f.src = u; f.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:900px;border:0';
      document.body.appendChild(f);
    }, base + '/apps/notities.html');
    const blad = page.frameLocator('#blad');
    await blad.locator('#bord .nkaart.gb-rij').first().waitFor({ timeout: 20000 });
    const frame = page.frames().find((f) => /\/apps\/notities\.html/.test(f.url()));
    assert.ok(frame, 'het bord hoort als frame geladen te zijn');
    /* Wachten op de tabel mag niet zakken: zonder tabel hoort de bewering over
       het gebaar hieronder te zeggen wat er misgaat, niet deze wacht. */
    await frame.waitForFunction(() => !!window.RTGGrammatica, null, { timeout: 10000 }).catch(() => {});

    const kaart = blad.locator('#bord .nkaart').first();
    const b = await kaart.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.clock.runFor(2 * gram.DREMPELS.lang);
    await page.mouse.up();
    await frame.waitForFunction(() => { const d = document.querySelector('dialog.gb-blad'); return !!(d && d.open); },
      null, { timeout: 5000 }).catch(() => {});
    assert.equal(await frame.evaluate(() => !!(document.querySelector('dialog.gb-blad') || {}).open), true,
      'lang drukken op een kaart in een blad hoort de actielade te openen');
    assert.deepEqual(await frame.evaluate(() => ({
      tabel: !!(window.RTGGrammatica && window.RTGGrammatica.DREMPELS),
      tags: document.querySelectorAll('script[src*="shared/adaptief/grammatica.js"]').length
    })), { tabel: true, tags: 1 },
    'in het blad hoort de grammatica er te staan, EEN keer, meegebracht door de gebaarlaag');
    await page.keyboard.press('Escape');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten in de gastheer');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
