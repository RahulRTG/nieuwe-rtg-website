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

   EN DAARNA ZAKTE HIJ NOG STEEDS, EEN OP DE VIJF KEER, EN DAT WAS DEZE PROEF
   ZELF (11 oktober 2026). Hij mat de regel met boundingBox() terwijl het scherm
   nog aan het verhuizen was: het wereldkader (shared/rtg-world-desktop.js) zet
   de pagina in zijn schil, en pas als de adaptieve Edge er staat
   (`data-rtg-adaptive-ready`) verdwijnen de duimbalk en de oude kopbalk uit de
   flow -- twee sprongen van 44 en 95 px, seconden na `domcontentloaded`. Daarbij
   lag de regel ONDER de vouw (y 963 in een venster van 900), dus de muis van
   Chromium raakte nooit iets en elke veeg liep via de terugval van veegDoor,
   die zonder kiezer de regel kiest die het dichtst bij de OUDE coordinaten ligt.
   Na de sprong van 95 px was dat Contract-2026.txt: de veeg slaagde, de server
   zette een bestand in de prullenbak -- alleen het verkeerde, en de melding zei
   dat ook ("Contract-2026.txt ligt in de prullenbak"). Gemeten met een
   layoutlog per 30 ms en de doelregel van elke pointerdown.

   Drie dingen houden dat nu dicht: wachten op de TOESTAND van het kader (klaar
   en de Edge staat) voordat er iets gemeten wordt, de regel in beeld schuiven
   en VLAK voor de veeg meten (zelfde vorm als maat() in gebaar.e2e.js), en een
   kiezer op het bestands-id meegeven, zodat ook de terugval nooit een buurman
   kan pakken.

   Draai: node --test test/gebaar-bestanden.e2e.js  (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, veegDoor, laadPlaywright, browserOpties, geenBrowser, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const BROWSER = process.env.RTG_CHROMIUM || undefined;

/* De regel in beeld en dan pas meten: een muis buiten het venster raakt niets,
   en een maat van voor een verschuiving is een maat van een andere regel. Na het
   schuiven een frame afwachten: de laag sluit een open lade op `scroll`, en die
   gebeurtenis valt pas in de volgende renderstap -- niet midden in de veeg. */
async function maat(loc) {
  await loc.evaluate((el) => new Promise((klaar) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    requestAnimationFrame(() => requestAnimationFrame(klaar));
  }));
  return loc.boundingBox();
}
/* De kiezer die veegDoor in zijn terugval gebruikt om DEZE regel terug te
   vinden, op het id dat het scherm zelf aan de regel hangt. */
async function kiezerVan(loc) {
  return '#lijst .item[data-open="' + await loc.getAttribute('data-open') + '"]';
}

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


/* DE RIJ OP ZIJN NAAM EN NIET OP ZIJN PLEK. Wordt de eerste poging van veegDoor
   een langdruk (de race van 520 ms hierboven), dan veegt hij een tweede keer, en
   zonder kiezer kiest die tweede poging de rij die NU op de oude coordinaten
   staat. Was de lijst intussen opnieuw getekend, dan ging die veeg over het
   ANDERE bestand: de server zette Contract-2026.txt in de prullenbak terwijl deze
   proef op Paspoort-scan.txt wachtte, en zakte na 8000 ms op
   {"weg":false,"ster":false} -- ongeveer een op de zes rondes, ook op main.
   Gevonden met een spoor IN de pagina (fetch en pointer-gebeurtenissen), want
   een luisteraar aan de Node-kant verschoof de timing genoeg om hem te laten
   verdwijnen. Een rij draagt zijn bestand in data-open; dat is de identiteit, en
   precies dat geeft kiezerVan() hierboven aan veegDoor mee. */

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
    await page.goto(base + '/apps/bestanden.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lijst .item.gb-rij', { timeout: 20000 });
    /* Het scherm staat pas stil als het wereldkader klaar is EN de adaptieve
       Edge er staat: daarna gaan duimbalk en kopbalk uit de flow en schuift de
       lijst omhoog. Zie de kop van dit bestand. */
    await page.waitForFunction(() => {
      const st = document.body.dataset.rtgDesktopState;
      return (st === 'ready' || st === 'error') && document.body.dataset.rtgAdaptiveReady === 'true';
    }, null, { timeout: 20000 });
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
    const d0 = await maat(eerste);
    await veegDoor(page, d0, { afstand: -112, stappen: 16, kiezer: await kiezerVan(eerste) });
    /* Wachten tot de lade ER IS, niet tot het scherm stil is. wachtOpRust telt
       stilte, en vlak na een veeg is het nog stil omdat de lade nog moet
       opengaan -- dan meet de regel hieronder een lade die er niet staat. */
    await page.waitForFunction(() => !!document.querySelector('#lijst .gb-lade'), null, { timeout: 15000 });
    /* EN TOT HIJ UITGESCHOVEN IS, want ER ZIJN is niet BREED ZIJN. `.gb-lade`
       heeft `width: var(--gb-lade)` met een transition erop, dus vlak na het
       verschijnen is hij nog smaller dan zijn doel -- en dan puilen de knoppen
       er per definitie uit. Deze toets zakte daar op ongeveer een op de drie
       rondes op ("Prullenbak steekt 1.6px uit zijn lade"), en dat had niets met
       de navigatie te maken: hij deed het met `load` net zo vaak als met
       `domcontentloaded`. Gemeten door hem zes keer los te draaien.

       Vergelijken met de doelbreedte en niet met "twee keer hetzelfde": een
       transition die net begint staat twee frames lang op nul en zou zo als
       rust doorgaan. */
    await page.waitForFunction(() => {
      const l = document.querySelector('#lijst .gb-lade');
      if (!l) return false;
      const st = getComputedStyle(l);
      const doel = parseFloat(st.getPropertyValue('--gb-lade')) || 0;
      /* `width` uit de berekende stijl en niet de bounding box: de lade staat op
         content-box en draagt een rand van 1px, dus de box is altijd een pixel
         breder dan zijn doel. */
      return doel > 0 && Math.abs(parseFloat(st.width) - doel) < 0.5;
    }, null, { timeout: 15000 });
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
    await veegDoor(page, await maat(rij), { kiezer: await kiezerVan(rij) });
    await wachtTot(() => staatVan(naam), (s) => s && s.weg,
      'doorvegen hoort ' + naam + ' bij de server in de prullenbak te zetten');
    assert.match(await page.locator('.gb-terug').textContent(), new RegExp(naam.slice(0, 8), 'i'),
      'de melding hoort te zeggen WELK bestand er weg is, niet alleen dat er iets weg is');

    // 2. en de weg terug haalt hem er ook echt uit
    await page.locator('.gb-terug button').click();
    await wachtTot(() => staatVan(naam), (s) => s && !s.weg,
      'Terugdraaien hoort het bestand terug in de kluis te zetten');

    // 3. de andere kant draagt andere acties, en de ster is ook echt omkeerbaar
    const weer = page.locator('#lijst .item.gb-rij').filter({ hasText: naam }).first();
    await weer.waitFor({ state: 'visible', timeout: 15000 });
    const naam2 = (await weer.locator('b').textContent()).trim();
    const d2 = await maat(weer);
    assert.ok(d2, 'het teruggezette bestand hoort weer een meetbare regel te zijn');
    await veegDoor(page, d2, { startFractie: 0.15, afstand: 176, stappen: 16, kiezer: await kiezerVan(weer) });
    assert.deepEqual(await page.evaluate(() =>
      [...document.querySelectorAll('#lijst .gb-lade .gb-doe > span')].map((s) => s.textContent)),
      ['Ster', 'Overnemen'], 'naar rechts horen de ster en overnemen te liggen');
    await page.keyboard.press('Escape');

    // 4. wat de server weigert, komt TERUG op het scherm -- stil falen is hier het ergst
    await page.route('**/api/bestanden/actie', (r) => r.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'De kluis is even niet bereikbaar.' })
    }));
    const derde = page.locator('#lijst .item').first();
    const naam3 = (await derde.locator('b').textContent()).trim();
    await veegDoor(page, await maat(derde), { kiezer: await kiezerVan(derde) });
    await page.waitForFunction(() => {
      const t = document.querySelector('.gb-terug');
      return t && /niet bereikbaar/i.test(t.textContent);
    }, null, { timeout: 8000 });
    await page.waitForFunction((n) => [...document.querySelectorAll('#lijst .item b')]
      .some((b) => b.textContent.trim() === n), naam3, { timeout: 8000 });
    assert.equal((await staatVan(naam3)).weg, false,
      'een geweigerde veeg mag bij de server niets veranderd hebben');
    await page.unroute('**/api/bestanden/actie');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het vegen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
