/* DE SALON: het vierde domein, en het eerste waar NIET elke actie de regel
   weghaalt.

   Archiveren haalt een post uit je tijdlijn, dus dat loopt via KLAAR.server:
   inklappen, server, en een weg terug. Bewaren doet dat niet -- een bewaarde
   post blijft gewoon staan -- dus daar drukt de veeg de knop in die op de regel
   zelf al staat (KLAAR.eigenKnop). Dat pad is nergens anders getoetst, en juist
   dat is hier de winst: er mag maar EEN waarheid zijn over wat bewaren doet, en
   die staat in salon.html.

   Wat deze proef daarom meet: dat de veeg de SERVER bereikt langs allebei de
   wegen, dat de post bij bewaren BLIJFT staan, en dat archiveren terug kan.

   Zelfde regel als de andere drie: geen vaste wachttijden, er wordt gepold.

   Draai: node --test test/gebaar-salon.e2e.js  (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, veegDoor, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const BROWSER = process.env.RTG_CHROMIUM || undefined;

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

/* DE FEED HERTEKENT ZICHZELF, en dat is geen randgeval: elke actie roept
   herlaad() aan. Een locator die je net gevonden hebt kan daardoor tussen het
   scrollen en het meten uit de DOM verdwijnen -- gemeten: ongeveer een op de
   vier ronden gaf "Element is not attached to the DOM". Deze helper wacht op een
   moment waarop de regel WEL stil ligt in plaats van de proef daarop te laten
   zakken. Wat hij niet doet is een fout wegpoetsen: blijft het schuiven, dan
   zegt hij dat. */
async function doosVan(locator, wat) {
  for (let poging = 0; poging < 12; poging++) {
    try {
      await locator.scrollIntoViewIfNeeded();
      const doos = await locator.boundingBox();
      if (doos) return doos;
    } catch (e) { /* de regel is net vervangen; zo dadelijk opnieuw */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.fail(wat + ' bleef onder de meting verschuiven; de feed hertekent te vaak om te meten');
}


test('een veeg archiveert een post en draait terug; bewaren drukt de knop in en laat hem staan',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gb-salon-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Salon ' + t, email: 's' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');
    const api = (pad, body) => fetch(base + '/api/salon/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then((r) => r.json());
    const teksten = ['Een stille ochtend in Kyoto.', 'Het licht op de gracht om zeven uur.'];
    for (const tekst of teksten) {
      const r = await api('plaats', { tekst });
      assert.ok(!r.error, 'de proef heeft twee posts nodig: ' + r.error);
    }
    /* De stand volgens de SERVER, niet volgens het scherm. `archief:true` haalt
       de gearchiveerde erbij; zonder die vlag staan ze er niet in. */
    const staatVan = async (tekst) => {
      for (const archief of [false, true]) {
        const d = await api('feed', { archief });
        const p = (d.posts || []).find((x) => x.text === tekst);
        if (p) return { archief: !!p.gearchiveerd, bewaard: !!p.bewaard };
      }
      return null;
    };

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/salon.html', { waitUntil: 'load' });
    await page.waitForSelector('#main article.post.gb-rij', { timeout: 20000 });
    /* De feed staat niet leeg voor een vers lid -- er staat demo-post in. Deze
       proef zoekt daarom zijn EIGEN posts op hun tekst en telt niet op een
       aantal dat van de seed afhangt. */
    const tekst = teksten[0];
    const rij = page.locator('#main article.post').filter({ hasText: tekst }).first();
    await rij.waitFor({ timeout: 8000 });
    /* De feed is langer dan het venster, en boundingBox() rekent in het VENSTER:
       zonder dit landt de muis buiten beeld en gebeurt er niets. */
    const doos1 = await doosVan(rij, 'de eerste post');
    await veegDoor(page, doos1, { vanBoven: 40 });
    await wachtTot(() => staatVan(tekst), (s) => s && s.archief,
      'doorvegen hoort de post bij de server te archiveren');
    assert.match(await page.locator('.gb-terug').textContent(), /^\s*Gearchiveerd/,
      'de melding hoort te beginnen met wat er gebeurd is');

    // 2. en de weg terug haalt hem er ook echt uit
    await page.locator('.gb-terug button').click();
    await wachtTot(() => staatVan(tekst), (s) => s && !s.archief,
      'Terugdraaien hoort de post terug in je tijdlijn te zetten');

    /* 3. BEWAREN DRUKT DE KNOP IN DIE ER AL STAAT, en laat de post staan. Dat is
       het verschil met alle andere veegacties tot nu toe: geen inklap, geen weg
       terug, want er gaat niets weg. Wat het WEL moet doen is de server bereiken
       -- anders is de veeg een knop die niets doet. */
    const tekst2 = teksten[1];
    const weer = page.locator('#main article.post').filter({ hasText: tekst2 }).first();
    await weer.waitFor({ timeout: 8000 });
    await page.waitForFunction((t) => {
      const a = [...document.querySelectorAll('#main article.post')].find((e) => e.textContent.includes(t));
      return a && a.classList.contains('gb-rij');
    }, tekst2, { timeout: 8000 });
    assert.equal((await staatVan(tekst2)).bewaard, false, 'de post hoort nog niet bewaard te zijn');
    const d2 = await doosVan(weer, 'de tweede post');
    const y2 = d2.y + Math.min(40, d2.height / 2);
    /* DEZELFDE GESCHAALDE AFSTAND als veegDoor hierboven. Een vaste stapgrootte
       leek genoeg tot deze proef: de drempel is max(lade + 52, 55% van de REGEL),
       en een Salon-post is zo breed als de kolom. 22 stapjes van 14 pixels kwam
       op 308 en de drempel lag op 462 -- er gebeurde dus niets, en de proef zei
       alleen dat de server niets had gezien. */
    const px2 = d2.width * 0.62 + 90;
    await page.mouse.move(d2.x + d2.width * 0.15, y2);
    await page.mouse.down();
    for (let i = 1; i <= 22; i++) await page.mouse.move(d2.x + d2.width * 0.15 + (px2 * i) / 22, y2);
    await page.mouse.up();
    await wachtTot(() => staatVan(tekst2), (s) => s && s.bewaard,
      'doorvegen naar rechts hoort de post bij de server te bewaren');
    await page.waitForFunction((t) => [...document.querySelectorAll('#main article.post')]
      .some((e) => e.textContent.includes(t)), tekst2, { timeout: 8000 });
    assert.equal(await page.locator('#main article.post').filter({ hasText: tekst2 }).count(), 1,
      'bewaren haalt niets weg, dus de post hoort er nog te staan');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het vegen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
