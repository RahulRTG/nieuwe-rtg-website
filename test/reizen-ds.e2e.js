/* TravelOS (reizen) op het RTG Design System: het bewijs van stroom A uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.

   Wat deze toets eist, en waarom elk punt:
     1. er is geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de
        stijlbundel; de ds-poort van de basis klopt; de Edge staat, met Rahul
        in het midden, en er zweeft geen tweede greep;
     2. de Cover staat: de wereldnaam in Bodoni op de foto, een ingang op beeld
        en de rubrieken van de wereld, die echt van blad wisselen;
     3. de kernhandeling slaagt tegen de echte reiskern: een bevestiging
        voorlezen verandert NIETS, pas "Voeg toe" zet het bij de reizen, en het
        register toont het gegroepeerd onder zijn eigen kop;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
     5. het hoofdbeeld is van het lid (beeldplek travel/hoofd): een eigen foto
        met een uitsnede voor desktop en een voor mobiel, bewaard via de
        ds-editor, staat na herladen op de Cover op 1440 en op 390 px; herstel
        brengt het RTG-beeld terug, en een gast krijgt de inlogzin. De
        uitsnede staat in SVG-attributen, nooit in een style-attribuut.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { decodeer, PAD } = require('../server/middleware/stijlbundel-rij');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const BEELDEN = process.env.RTG_DS_BEELDEN || '';
const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let srv, browser, token;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', adres = '/apps/reizen.html', tok = token) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [tok, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + adres, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !/Laden/.test(document.querySelector('#wacht').textContent));
  return { ctx, page, fouten };
}
async function beeld(page, naam, opties) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot(Object.assign({ path: path.join(BEELDEN, 'reizen-' + naam + '.png') }, opties || {}));
}
async function bladen(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const uit = [];
  for (const h of hrefs) {
    const u = new URL(h);
    if (u.pathname === PAD) uit.push(...decodeer(u.searchParams.get('f')));
    else uit.push(u.pathname);
  }
  return uit;
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Reis Lid', email: 'reizen-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
  /* Echte gegevens, langs de gewone routes: een reis bij het reisbureau en een
     verblijf in dezelfde plaats; samen horen ze een reis te worden. */
  const cat = await post('/api/reisbureau', {});
  const ibiza = cat.reizen.find(r => /ibiza/i.test(r.bestemming));
  await post('/api/reisbureau/boek', { tripId: ibiza.id, personen: 2, vertrek: dag(30) });
  const huis = (await post('/api/hotels', {})).huizen.find(h => /ibiza/i.test(h.stad || ''));
  await post('/api/verblijf', { supplierCode: huis.code, roomId: huis.kamers[0].id, aankomst: dag(30), vertrek: dag(34), personen: 2 });
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const lijst = await bladen(page);
  assert.ok(lijst.length, 'er is minstens een blad actief');
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'), 'het Design System is geladen');
  assert.equal(await page.locator('.rtgsprong-greep').count(), 0, 'de sprong tekent geen eigen greep naast de Edge');
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) {
    assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt op een ds-scherm terwijl de ds-poort hem dicht noemt');
  }
  for (const oud of ['/shared/randen.js', '/shared/metgezel.js', '/shared/klok.js', '/shared/uurwerk.js', '/shared/rtg-world-desktop.js']) {
    assert.ok(!scripts.includes(oud), oud + ' hoort niet op een ds-scherm');
  }
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  assert.equal(await page.locator('.ds-edge').count(), 1, 'precies een Edge');
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await page.locator('[data-ds-edge="acties"]').click();
  assert.match(await page.locator('#dsEdgeBlad').textContent(), /Betreed TravelOS/, 'Acties toont de handelingen van dit scherm');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dsEdgeBlad').isHidden(), true, 'Escape sluit het blad');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de Cover: de wereld op de foto, een ingang, en rubrieken die echt van blad wisselen', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'cover');
  const titel = page.locator('.ds-cover .ds-cover__wereld');
  assert.equal(await titel.textContent(), 'TravelOS');
  assert.match(await titel.evaluate(e => getComputedStyle(e).fontFamily), /Bodoni/);
  assert.equal(await page.locator('.ds-cover__beeld').evaluate(i => i.complete && i.naturalWidth > 0 && /travel-heritage-v2/.test(i.src)), true, 'het eigen wereldbeeld staat');
  assert.match(await page.locator('.ds-cover__ondertitel').textContent(), /Experience the elite class/);
  assert.equal(await page.locator('.ds-cover [data-betreed]').getAttribute('href'), '#inhoud');
  await beeld(page, '390');
  await page.locator('.ds-cover__nav a', { hasText: 'Reizen' }).click();
  await page.waitForFunction(() => window.RTGReizen.staat.blad === 'reizen' && !document.querySelector('[data-blad="reizen"]').hidden);
  assert.equal(await page.locator('[data-tab="reizen"]').getAttribute('aria-selected'), 'true');
  assert.equal(new URL(page.url()).hash, '#reizen', 'het blad staat in het adres (Continuity)');
  await page.locator('[data-tab="taxi"]').click();
  assert.equal(await page.locator('[data-blad="taxi"]').isVisible(), true);
  assert.equal(await page.locator('[data-blad="reizen"]').isHidden(), true);
  /* Nadruk (ONTWERPSYSTEEM.md par. 7): de Cover is beleving, het overzicht
     balans, en zelf iets toevoegen is gereedschap: minder lucht en een kortere beweging. */
  const lucht = sel => page.locator(sel).evaluate(e => getComputedStyle(e).marginBlockStart);
  assert.equal(await lucht('section[aria-labelledby="wachtTitel"]'), '48px');
  assert.equal(await lucht('#worldTravelImport'), '32px');
  assert.equal(await page.locator('[data-blad="taxi"]').evaluate(e => { const c = getComputedStyle(e); return c.getPropertyValue('--ds-duur') === c.getPropertyValue('--ds-duur-kort'); }), true);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('het register groepeert per reis, en voorlezen verandert niets tot u bevestigt', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.waitForSelector('#reisVolgende:not([hidden])');
  await beeld(page, '390-vandaag', { fullPage: true });
  await page.locator('[data-tab="reizen"]').click();
  await page.waitForSelector('#komend [data-reiskop]');
  const koppen = await page.locator('#komend [data-reiskop]').allInnerTexts();
  assert.equal(koppen.length, 1, 'een reis, uit twee boekingen: ' + JSON.stringify(koppen));
  assert.match(koppen[0], /Ibiza/i); assert.match(koppen[0], /2 onderdelen/);
  assert.match(await page.locator('#stand').innerText(), /1 reis gepland/);
  await beeld(page, '390-reizen', { fullPage: true });

  const voor = (await post('/api/reis/reizen', {})).reizen.length;
  await page.fill('#invTekst', 'Rondreis India, vertrek ' + dag(60));
  await page.click('#invLees');
  await page.waitForSelector('#invVoegToe');
  assert.equal((await post('/api/reis/reizen', {})).reizen.length, voor, 'lezen zet nog niets bij de reizen');
  await page.fill('#bTitel', 'Rondreis India'); await page.fill('#bBestemming', 'India'); await page.fill('#bVan', dag(60));
  await page.click('#invVoegToe');
  await page.waitForFunction(() => [...document.querySelectorAll('#komend [data-reiskop]')].some(k => /India/.test(k.innerText)));
  assert.equal(await page.locator('[data-blad="reizen"]').isVisible(), true, 'na toevoegen staat het register in beeld');
  const na = (await post('/api/reis/reizen', {})).reizen;
  assert.equal(na.length, voor + 1, 'de server heeft de nieuwe reis');
  assert.ok(na.some(r => r.bestemming === 'India'));
  assert.match(await page.locator('#invMijn').innerText(), /Rondreis India/);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('Rahul en Samen: het gesprek en het gezelschap laden op de ds-vorm', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', '/apps/reizen.html#samen');
  await page.waitForFunction(() => document.querySelectorAll('#samenReizen .ds-chip').length > 0);
  assert.equal(await page.locator('#samenReizen .ds-chip[aria-pressed="true"]').count(), 1, 'een reis is gekozen');
  await page.waitForSelector('#samenLeden li');
  await page.locator('[data-tab="rahul"]').click();
  await page.fill('#rahulVraag', 'Wat staat er open?');
  await page.locator('#rahulForm button[type="submit"]').click();
  await page.waitForSelector('#rahulChat .ds-gesprek__bericht--eigen');
  assert.match(await page.locator('#rahulChat').innerText(), /Wat staat er open\?/);
  await beeld(page, '390-rahul');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['320', 320, 700, 'nl'], ['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    for (const blad of ['vandaag', 'reizen', 'taxi', 'samen', 'rahul']) {
      await page.evaluate((b) => window.RTGReizen.wisselBlad(b, false, { restore: true }), blad);
      const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
      assert.ok(maat.breed <= maat.venster, blad + ': scrollWidth ' + maat.breed + ' > ' + maat.venster);
    }
    await page.evaluate(() => window.RTGReizen.wisselBlad('vandaag', false, { restore: true }));
    await beeld(page, naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}

/* 5. Het eigen hoofdbeeld. Een eigen lid, zodat de andere toetsen het
   RTG-beeld blijven zien. */
async function coverStand(page) {
  return page.evaluate(() => {
    const c = document.querySelector('.ds-cover'), svg = c.querySelector('svg.ds-cover__beeld'), img = c.querySelector('img.ds-cover__beeld');
    const beeld = svg && svg.querySelector('image'), r = (svg || img).getBoundingClientRect();
    return { eigen: c.getAttribute('data-eigen-beeld'), imgZichtbaar: !img.hidden && img.checkVisibility(),
      href: beeld ? beeld.getAttribute('href').slice(0, 15) : '', breed: beeld ? Number(beeld.getAttribute('width')) : 0,
      x: beeld ? Number(beeld.getAttribute('x')) : 0, vlak: r.width, hoog: r.height,
      stijl: [...document.querySelectorAll('[style]')].map(e => e.tagName + '#' + e.id) };
  });
}
test('het eigen hoofdbeeld: bewaren met twee uitsneden, na herladen op 1440 en 390, herstel en de gast', { skip }, async () => {
  const now = Date.now();
  const lid = (await post('/api/auth/register', { name: 'Beeld Lid', email: 'reizen-beeld-' + now + '@e.test',
    phone: '06' + String(now + 7).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
  const foto = fs.readFileSync(path.join(__dirname, '..', 'public', 'images', 'daily', 'agenda.webp'));
  let { ctx, page, fouten } = await open(1440, 900, 'nl', '/apps/reizen.html', lid);
  assert.equal((await coverStand(page)).imgZichtbaar, true, 'zonder keuze staat het RTG-beeld');
  await page.locator('[data-ds-edge="acties"]').click();
  assert.match(await page.locator('#dsEdgeBlad').textContent(), /Foto wijzigen/, 'Foto wijzigen staat ook onder Acties');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Foto wijzigen', exact: true }).click();
  await page.waitForSelector('#beeldDialoog[open]');
  await page.locator('#beeldUpload').setInputFiles({ name: 'Mijn reisfoto.webp', mimeType: 'image/webp', buffer: foto });
  await page.waitForSelector('#beeldX:not(:disabled)');
  await page.getByLabel('Horizontaal', { exact: true }).fill('20'); await page.getByLabel('Vergroten', { exact: true }).fill('1.4');
  await page.getByRole('button', { name: 'Mobiel', exact: true }).click();
  assert.equal(await page.locator('#beeldSnede').getAttribute('data-ds-snede'), 'mobiel');
  await page.getByLabel('Horizontaal', { exact: true }).fill('80'); await page.getByLabel('Verticaal', { exact: true }).fill('30');
  await beeld(page, '1440-beeldeditor');
  await page.getByRole('button', { name: 'Opslaan', exact: true }).click();
  await page.waitForSelector('#beeldDialoog:not([open])', { state: 'attached' });
  const bewaard = (await post('/api/ik/beelden', {}, lid)).images['travel/hoofd'];
  assert.ok(bewaard && bewaard.file, 'de keuze staat op de server');
  assert.deepEqual([bewaard.desktop, bewaard.mobile], [{ x: 20, y: 50, zoom: 1.4 }, { x: 80, y: 30, zoom: 1 }]);
  /* Uw eigen bestanden: de upload staat in de galerij van de editor. */
  await page.getByRole('button', { name: 'Foto wijzigen', exact: true }).click();
  await page.getByRole('button', { name: 'Mijn foto’s', exact: true }).click();
  await page.locator('#beeldGalerij .ds-keuze', { hasText: 'Mijn reisfoto.webp' }).waitFor();
  await page.getByRole('button', { name: 'Annuleren', exact: true }).click();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-cover[data-eigen-beeld="desktop"]');
  let stand = await coverStand(page);
  assert.equal(stand.imgZichtbaar, false); assert.equal(stand.href, 'data:image/webp');
  verwacht(stand, { x: 20, zoom: 1.4 }, 'desktop');
  assert.deepEqual(stand.stijl, [], 'geen style-attribuut op de pagina');
  await beeld(page, '1440-eigen-beeld');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForSelector('.ds-cover[data-eigen-beeld="mobile"]');
  stand = await coverStand(page);
  verwacht(stand, { x: 80, zoom: 1 }, 'mobiel');
  await geenOverloopHier(page);
  await beeld(page, '390-eigen-beeld');
  await ctx.close();
  ({ ctx, page, fouten } = await open(390, 844, 'nl', '/apps/reizen.html', lid));
  await page.waitForSelector('.ds-cover[data-eigen-beeld="mobile"]');
  await page.getByRole('button', { name: 'Foto wijzigen', exact: true }).click();
  assert.equal(await page.locator('#beeldMobiel').getAttribute('aria-pressed'), 'true', 'op de telefoon opent de mobiele uitsnede');
  assert.equal(await page.locator('#beeldX').inputValue(), '80');
  await beeld(page, '390-beeldeditor');
  await page.getByRole('button', { name: 'Herstel RTG-beeld', exact: true }).click();
  await page.getByRole('button', { name: 'Opslaan', exact: true }).click();
  await page.waitForSelector('#beeldDialoog:not([open])', { state: 'attached' });
  assert.equal((await post('/api/ik/beelden', {}, lid)).images['travel/hoofd'], undefined, 'herstel haalt de keuze weg');
  stand = await coverStand(page);
  assert.equal(stand.imgZichtbaar, true); assert.equal(stand.eigen, null);
  assert.deepEqual(fouten, []);
  await ctx.close();

  ({ ctx, page, fouten } = await open(390, 844, 'nl', '/apps/reizen.html', ''));
  await page.getByRole('button', { name: 'Foto wijzigen', exact: true }).click();
  await page.waitForSelector('#beeldDialoog[open]');
  assert.equal(await page.locator('#beeldStatus').textContent(), 'Log in met uw RTG-account om persoonlijke beelden te bewaren.');
  assert.equal(await page.locator('#beeldBewaar').isDisabled(), true);
  assert.equal(await page.locator('#beeldUploadKnop').isDisabled(), true);
  await page.getByRole('button', { name: 'Mijn foto’s', exact: true }).click();
  assert.equal(await page.locator('#beeldStatus').textContent(), 'Log in met uw RTG-account om uw foto’s te gebruiken.');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#beeldDialoog[open]').count(), 0, 'Escape sluit de editor');
  assert.deepEqual(fouten, []);
  await ctx.close();
});
/* object-fit: cover met object-position x% en een vergroting rond dat punt,
   nagerekend uit de attributen van het SVG-beeld. */
function verwacht(stand, snede, naam) {
  const bw = stand.breed / snede.zoom, px = stand.vlak * snede.x / 100;
  const x = px + ((stand.vlak - bw) * snede.x / 100 - px) * snede.zoom;
  assert.ok(bw >= stand.vlak - 1, naam + ': het beeld dekt de breedte: ' + JSON.stringify(stand));
  assert.ok(Math.abs(stand.x - x) < 1, naam + ': x ' + stand.x + ' verwacht ' + x.toFixed(2));
}
async function geenOverloopHier(page) {
  const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
  assert.ok(maat.breed <= maat.venster, 'scrollWidth ' + maat.breed + ' > ' + maat.venster);
}

/* 6. De vier handelingen van een reisregel (Openen, Delen, Kenmerk,
   Overnemen): op de oude Reizen gaf RTGGebaar.wereldregister ze; op de ds-vorm
   geeft de gedeelde bouwer /ds/register.js ze, met dezelfde teksten. Het
   klembord wordt hier waargenomen; zonder navigator.share valt Delen terug op
   het klembord, net als in gebaar.js. */
test('de vier handelingen van een reisregel: openen, delen, kenmerk en overnemen', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => {
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t);
    window.__klembord = [];
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (x) => { window.__klembord.push(x); return Promise.resolve(); } }, configurable: true });
  }, token);
  const page = await ctx.newPage(), fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/reizen.html#reizen', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#komend .reis[href] + [data-ds-register]');
  const rij = page.locator('#komend .reis[href]').first(), acties = page.locator('#komend [data-ds-register]').first();
  const ref = await rij.locator('[data-ref]').getAttribute('data-ref');
  assert.ok(ref, 'de regel draagt een kenmerk');
  assert.deepEqual(await acties.locator('button').allInnerTexts(), ['Openen', 'Delen', 'Kenmerk', 'Overnemen']);
  assert.equal(await page.locator('#komend .reis[href]').count(), await page.locator('#komend [data-ds-register]').count(), 'elke regel krijgt zijn handelingen');
  const titel = await rij.locator('[data-reg-titel]').innerText(), href = await rij.getAttribute('href');
  await acties.getByRole('button', { name: 'Delen', exact: true }).click();
  await page.waitForFunction(() => /gekopieerd; klaar om te plakken/i.test(document.querySelector('#toast').textContent));
  await acties.getByRole('button', { name: 'Kenmerk', exact: true }).click();
  await page.waitForFunction((r) => document.querySelector('#toast').textContent === r + ' - gekopieerd', ref);
  await acties.getByRole('button', { name: 'Overnemen', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent === 'De regel staat op uw klembord.');
  const klembord = await page.evaluate(() => window.__klembord);
  assert.equal(klembord[0], titel + ' - ' + new URL(href, srv.base).href, 'delen zonder deelvenster: titel - adres');
  assert.equal(klembord[1], ref);
  assert.ok(klembord[2].startsWith(titel + ' · ') && klembord[2].includes(' · ' + ref), 'overnemen: titel · plaats · dag · kenmerk · bron: ' + klembord[2]);
  /* Na een nieuwe tekening van het register staan de handelingen er weer, een keer. */
  await page.evaluate(() => window.RTGReizen.register.laad());
  await page.waitForSelector('#komend .reis[href] + [data-ds-register]');
  assert.equal(await page.locator('#komend .reis[href]').count(), await page.locator('#komend [data-ds-register]').count());
  await beeld(page, '390-handelingen', { fullPage: true });
  await page.locator('#komend [data-ds-register]').first().getByRole('button', { name: 'Openen', exact: true }).click();
  await page.waitForURL((u) => u.href === new URL(href, srv.base).href);
  assert.deepEqual(fouten, []);
  await ctx.close();
});
