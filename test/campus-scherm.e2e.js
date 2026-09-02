/* DE RTF CAMPUS IN EEN ECHTE BROWSER: de werkplek van een leerlingprofiel.

   test/rtfleerlingtoegang.test.js bewijst dat /api/rtf/toegang de Campus
   fail-closed houdt. Dat zegt niets over het SCHERM: of de reden van de
   server ook in het toegangsslot terechtkomt, of de catalogus van de eigen
   leeftijdsgroep werkelijk in het raster verschijnt, en of een tegel een
   ruimte opent zonder de Campus te verlaten. scripts/schermen.js eist daarom
   een toets die deze weg zelf aflegt; dit is die toets.

   DE SESSIE. Een gezinstoken (de beheerder) opent de Campus NIET -- dat is
   grens 1 hieronder. Het scherm hoort bij een KINDPROFIEL met een
   geboortedatum: gezin aanmaken, een kind met geboortedatum toevoegen, het
   profiel kiezen met zijn pincode, en dat profieltoken in `rtf_sessie` zetten
   (zelfde weg als scripts/a11y.js). De leeftijd (11) valt in de groep kind,
   dus wat er te zien is, is de kindcatalogus.

   WAT ER WORDT VASTGELEGD, EN WAAROM JUIST DAT

   1. DE DEUR. De beheerder heeft een geldige gezinssessie en komt er toch niet
      in: de server weigert met "De Campus is de persoonlijke werkplek van een
      leerlingprofiel." en het scherm toont die zin in het slot. De catalogus
      wordt dan niet geladen -- een dichte deur met een gevuld raster erachter
      is geen dichte deur.
   2. DE LEEFTIJDSPOORT. Het kind ziet in "De hele Foundation" de apps uit
      /api/rtf/bieb/catalogus voor zijn groep, en NIET de tienerapp Online wijs.
      Ook de vaste leerreis naar mediawijs is verborgen, want de server gaf die
      app niet vrij. De passen tonen 'Kind-pas · 5-11', afgeleid uit de
      geboortedatum en niet uit iets wat de browser opgaf.
   3. ZOEKEN. #ecoZoek versmalt het raster en de status telt mee; een woord dat
      nergens op past geeft de lege melding en geen leeg vlak.
   4. EEN RUIMTE OPENT BINNEN DE CAMPUS. Een tik op een tegel zet het kader op
      de app-url en toont de naam; de knop "← Campus" sluit het weer.

   WAT HIER GEVONDEN EN DAARNA GEREPAREERD IS. De knop "← Campus" wordt
   hieronder met een KLIK bediend, en eerst wordt gemeten wat er op het midden
   van de knop ligt. Op 2 september 2026 lag daar de kruimelbalk: de kop van
   de ruimte (.ruimtekop, in #ruimte met z-index 20) lag ONDER de bovenbalk
   van het randensysteem (.rtg-edge-top, z-index 8800, pointer-events auto),
   op 1200x900 en op 390x844, en Playwright meldde "subtree intercepts
   pointer events". Sindsdien begint de ruimte onder die balk
   (campus.html, body.rtg-edge-host .ruimte). De meting is de bewering: ligt
   er weer iets anders op de knop, dan zakt deze stap voordat de klik wordt
   gedaan.

   Verder NIET beproefd: de Schoolpas (die vraagt een echte klasinschrijving,
   zie rtfleerlingtoegang.test.js) en wat er in het kader zelf gebeurt -- die
   app heeft zijn eigen toets.

   Draai los: node --test test/campus-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpTekst } = require('./helper');

const pw = laadPlaywright();
const OVERSLAAN = geenBrowser(pw);
const SCHERM = '/apps/foundation/campus.html';

let child, base, browser, TMP;
let BEHEERDER, KIND;

const post = async (pad, body) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test.before(async () => {
  if (OVERSLAAN) return;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-campus-scherm-'));
  ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }));
  /* Het gezin bevestigt wat een echte gebruiker bevestigt (bevoegd, privacy);
     de poort wordt niet omzeild. */
  const gezin = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Campusgezin', naam: 'Papa',
    pin: '1234', bevoegdGezin: true, privacyAkkoord: true })).body;
  assert.ok(gezin.token, 'het gezin bestaat: ' + JSON.stringify(gezin).slice(0, 160));
  BEHEERDER = { code: gezin.code, token: gezin.token, profiel: { naam: 'Papa', beheerder: true } };
  /* Een kind van 11 met een eigen pincode; de geboortedatum is wat de
     leeftijdspas maakt, en zonder die datum blijft de Campus dicht. */
  const kind = (await post('/api/foundation/gezin/profiel/maak', { code: gezin.code, token: gezin.token,
    naam: 'Milan', rol: 'kind', geboortedatum: '2015-04-04', pin: '5678', kleur: '#3A7BD5' })).body;
  assert.ok(kind.profiel && kind.profiel.id, 'het kindprofiel bestaat: ' + JSON.stringify(kind).slice(0, 160));
  const kies = (await post('/api/foundation/gezin/profiel/kies',
    { code: gezin.code, profielId: kind.profiel.id, pin: '5678' })).body;
  assert.ok(kies.token, 'het kind kiest zijn profiel met zijn pincode: ' + JSON.stringify(kies).slice(0, 160));
  KIND = { code: gezin.code, token: kies.token, profiel: kies.profiel };
  browser = await pw.chromium.launch(browserOpties(pw));
});

test.after(async () => {
  if (browser) try { await browser.close(); } catch (e) { /* al dicht */ }
  if (child) await stop(child);
  if (TMP) try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
});

/* Een eigen browsercontext per sessie, met de sessie al in localStorage
   VOORDAT de pagina laadt -- sessie.js beslist bij het inlezen al over de deur. */
async function openAls(sessie) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('rtf_sessie', JSON.stringify(s));
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, sessie);
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  return { ctx, page, fouten };
}

test('1. de deur: een gezinsbeheerder ziet de reden van de server en geen catalogus',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page, fouten } = await openAls(BEHEERDER);
    try {
      const toegang = page.waitForResponse((r) => r.url().endsWith('/api/rtf/toegang'));
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      assert.equal((await toegang).status(), 403, 'de server weigert de Campus voor een beheerder');
      await wachtOpTekst(page, 'De Campus is de persoonlijke werkplek van een leerlingprofiel.',
        { in: '#rtf-toegang-slot', ms: 15000 });
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('rtf-toegang-dicht')),
        true, 'het scherm staat achter het slot');
      assert.equal(await page.evaluate(() => document.querySelector('#rtf-toegang-slot h1').textContent.trim()),
        'Deze ruimte blijft nog dicht');
      /* Achter een dichte deur wordt niets geladen: geen catalogus, geen passen. */
      assert.equal(await page.locator('#ecoGrid .eco-app').count(), 0, 'geen apps achter de dichte deur');
      assert.equal(await page.evaluate(() => document.querySelector('#ecoStatus').textContent.trim()),
        'Je persoonlijke Campus wordt geladen…');
      assert.deepEqual(fouten, [], 'geen JS-fouten achter de deur: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });

test('2. het kind: de catalogus van zijn groep, de tienerapp blijft weg, de pas komt uit de geboortedatum',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page, fouten } = await openAls(KIND);
    try {
      const catalogus = page.waitForResponse((r) => r.url().endsWith('/api/rtf/bieb/catalogus'));
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      assert.equal((await catalogus).status(), 200, 'de catalogus komt van de server');
      await wachtTot(page, () => document.querySelectorAll('#ecoGrid .eco-app').length > 0, null,
        { wat: 'apps in het raster' });
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('rtf-toegang-dicht')),
        false, 'het slot is weg');
      assert.equal(await page.evaluate(() => document.querySelector('#groet').textContent), 'Welkom, Milan');

      const passen = await page.evaluate(() => document.querySelector('#passen').textContent);
      assert.match(passen, /Foundation-pas actief/);
      assert.match(passen, /Kind-pas · 5-11/, 'de leeftijdspas volgt uit de geboortedatum: ' + passen);
      assert.match(passen, /Schoolpas nog niet gekoppeld/, 'zonder klas geen Schoolpas: ' + passen);

      const titels = await page.evaluate(() => [...document.querySelectorAll('#ecoGrid .eco-app')].map((b) => b.dataset.titel));
      assert.ok(titels.includes('Mijn leerpaspoort'), 'een kindapp staat in het raster: ' + titels.join(', '));
      assert.ok(!titels.includes('Online wijs'), 'de tienerapp staat NIET in het raster van een kind: ' + titels.join(', '));
      const status = await page.evaluate(() => document.querySelector('#ecoStatus').textContent);
      assert.match(status, new RegExp('^' + titels.length + ' van ' + titels.length + ' mogelijkheden zichtbaar'), status);

      /* De vaste leerreis naar mediawijs hangt aan dezelfde serverbeslissing. */
      assert.equal(await page.evaluate(() => document.querySelector('[data-app="rtf-mediawijs"]').hidden), true,
        'de tienerroute is verborgen voor een kind');
      assert.equal(await page.evaluate(() => document.querySelector('.wereld[data-app="rtf-school"]').hidden), false,
        'de schoolwereld staat open voor een kind');
      assert.deepEqual(fouten, [], 'geen JS-fouten op de Campus: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });

test('3. zoeken versmalt het raster, en niets gevonden is een melding en geen leeg vlak',
  { skip: OVERSLAAN }, async () => {
    const { ctx, page, fouten } = await openAls(KIND);
    try {
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.querySelectorAll('#ecoGrid .eco-app').length > 1, null,
        { wat: 'meer dan een app in het raster' });
      const alles = await page.locator('#ecoGrid .eco-app').count();

      await page.locator('#ecoZoek').fill('leerpaspoort');
      await wachtTot(page, (n) => document.querySelectorAll('#ecoGrid .eco-app').length < n, alles,
        { wat: 'een versmald raster' });
      const gevonden = await page.evaluate(() => [...document.querySelectorAll('#ecoGrid .eco-app')].map((b) => b.dataset.titel));
      assert.deepEqual(gevonden, ['Mijn leerpaspoort'], 'alleen wat op het zoekwoord past');
      assert.match(await page.evaluate(() => document.querySelector('#ecoStatus').textContent),
        new RegExp('^1 van ' + alles + ' mogelijkheden zichtbaar'));

      await page.locator('#ecoZoek').fill('xyzzyq');
      await wachtOpTekst(page, 'Niets gevonden', { in: '#ecoGrid' });
      assert.equal(await page.locator('#ecoGrid .eco-app').count(), 0);

      await page.locator('#ecoZoek').fill('');
      await wachtTot(page, (n) => document.querySelectorAll('#ecoGrid .eco-app').length === n, alles,
        { wat: 'het volledige raster terug' });
      assert.deepEqual(fouten, [], 'geen JS-fouten bij het zoeken: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });

test('4. een tegel opent een ruimte binnen de Campus, en Campus sluit hem weer',
  { skip: OVERSLAAN }, async (t) => {
    const { ctx, page, fouten } = await openAls(KIND);
    try {
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => document.querySelectorAll('#ecoGrid .eco-app').length > 0, null,
        { wat: 'apps in het raster' });
      assert.equal(await page.evaluate(() => document.querySelector('#ruimte').hidden), true, 'de ruimte is dicht bij het begin');

      await page.locator('#ecoGrid .eco-app[data-titel="Mijn leerpaspoort"]').click();
      await wachtTot(page, () => !document.querySelector('#ruimte').hidden, null, { wat: 'de ruimte open' });
      assert.equal(await page.evaluate(() => document.querySelector('#ruimteTitel').textContent), 'Mijn leerpaspoort');
      assert.equal(await page.evaluate(() => new URL(document.querySelector('#frame').src).pathname),
        '/apps/foundation/leerpaspoort.html', 'het kader wijst naar de app uit de catalogus');
      assert.equal(await page.evaluate(() => location.hash), '#ruimte');

      /* Eerst de app in het kader laten uitladen: een pagina die nog laadt kan
         de focus naar zich toe trekken, en dan gaat de Enter hieronder het
         kader in en niet naar de knop. */
      await wachtTot(page, () => {
        const f = document.querySelector('#frame');
        return !!(f && f.contentDocument && f.contentDocument.readyState === 'complete');
      }, null, { wat: 'de app in het kader geladen' });
      /* Wat ligt er op het midden van de knop? De knop zelf, of deze stap zakt
         (zie de kop: hier lag de kruimelbalk van het randensysteem). */
      const opDeKnop = await page.evaluate(() => {
        const k = document.querySelector('#terug');
        const b = k.getBoundingClientRect();
        const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return { raak: !!(el && (el === k || k.contains(el))),
          ligt: el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : '') : 'niets' };
      });
      assert.ok(opDeKnop.raak, 'op het midden van "← Campus" ligt iets anders dan de knop: ' + opDeKnop.ligt);
      await page.click('#terug');
      await wachtTot(page, () => document.querySelector('#ruimte').hidden, null, { wat: 'de ruimte dicht' });
      assert.equal(await page.evaluate(() => document.querySelector('#frame').getAttribute('src')), 'about:blank',
        'het kader is leeg na het sluiten');
      assert.deepEqual(fouten, [], 'geen JS-fouten bij het openen van een ruimte: ' + fouten.join(' | '));
    } finally { await ctx.close(); }
  });
