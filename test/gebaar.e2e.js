/* RTG Gebaren in een echte browser: de laden onder een regel, de drempel, de
   uitvoering en de weg terug.

   WAAROM DIT EEN E2E IS EN GEEN UNIT. Alles wat aan deze laag stuk kan gaan,
   gaat stuk in de BROWSER en niet in de code: de richtingsvergrendeling, de
   sleeplink die Chromium over een <a> begint, de aanwijzer die na een
   pointercancel niet meer terugkomt. Die drie zijn hier alle drie een keer
   gemeten en geen ervan is met lezen te vinden.

   Draai: node --test test/gebaar.e2e.js   (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, veegDoor, laadPlaywright, browserOpties, geenBrowser, wachtOpRust } = require('./helper');
const gram = require('../public/shared/adaptief/grammatica.js');

const pw = laadPlaywright();
/* Waar de browser NIET op de plek staat die het pakket verwacht (een
   ontwikkelbak met een eigen chromium), wijst deze omgevingsvariabele hem aan.
   Leeg is undefined en dus precies het gedrag van elke andere e2e hier. */
const BROWSER = process.env.RTG_CHROMIUM || undefined;

/* Een vers lid heeft geen documenten, dus staat het register leeg en is er
   niets te vegen. We zetten twee regels neer in exact de vorm die werkRegel()
   in kantoor.html maakt: dan wordt de ECHTE bedrading getest -- de waarnemer
   van RTGGebaar.lijst en de actiebouwer van dat scherm -- en niet een
   nagebouwd scherm dat toevallig ook veegt. */
const REGEL = (titel, ref) => '<a class="reis" href="/apps/office.html" data-sig="gezond">' +
  '<span class="stip"></span><span class="doos">' +
  '<span class="dag"><span class="wd">zondag</span><span class="nr rtg-datum">02</span><span class="mnd">aug</span></span>' +
  '<span class="kern"><h3>' + titel + '</h3>' +
  '<span class="onder"><button class="rtg-ref" type="button" data-ref="' + ref + '">' + ref + '</button>' +
  '<span class="bron">Office</span></span></span></span><span class="pijl">&rsaquo;</span></a>';

/* DE MAAT WORDT VLAK VOOR DE VEEG GENOMEN, en niet een keer aan het begin.
   boundingBox() rekent in het VENSTER: rolt de pagina tussendoor (een tik op een
   actie, een lade die opent), dan wijst een eerder gemeten doos naar een plek
   waar de regel niet meer staat, en landt de muis ernaast. Dat is de tweede helft
   van dezelfde fout als de scrollIntoView hieronder -- een proef die faalt om de
   verkeerde reden is net zo min een proef. */
/* Centreer de regel boven de vaste Edge Bar, zodat de veeg de regel raakt. */
async function maat(loc) {
  await loc.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  return loc.boundingBox();
}

/* DE VEEG ZELF GAAT DOOR veegDoor (test/helper.js). Hier stond een eigen reeks
   -- mouse.down() en daarna twintig losse moves -- en daarmee precies de race die
   veegDoor oplost: tussen down() en de eerste move() zat een aparte CDP-ronde, en
   op een pagina die nog opstart haalt die de timer van lang drukken. Wat hier
   blijft is de MAAT van deze proef: waar hij begint, hoe ver hij gaat, in
   twintig stapjes (een sprong van honderd pixels is voor de browser geen veeg),
   en of hij loslaat. */
async function veeg(page, doos, px, losLaten) {
  return veegDoor(page, doos, { startFractie: px < 0 ? 0.7 : 0.15, afstand: px, stappen: 20, loslaten: losLaten });
}

/* WACHTEN OP DE LADE, NIET OP STILTE. wachtOpRust telt hoe lang de tekst niet
   verandert -- en vlak na een veeg is het nog stil omdat de lade nog moet
   opengaan. Dan meet de bewering erna een scherm dat nog niets heeft gedaan.
   Deze twee wachten op de toestand die de toets daarna beweert. */
const ladeOpen = (page) => page.waitForFunction(
  () => !!document.querySelector('#werkdag .gb-lade'), null, { timeout: 15000 });
const ladeDicht = (page) => page.waitForFunction(
  () => !document.querySelector('#werkdag .gb-lade'), null, { timeout: 15000 });

const laden = (page) => page.evaluate(() => {
  const l = document.querySelector('#werkdag .gb-lade');
  return l ? {
    kant: l.dataset.kant, gereed: l.hasAttribute('data-gereed'),
    acties: [...l.querySelectorAll('.gb-doe > span')].map((s) => s.textContent)
  } : null;
});

test('de twee laden onder een regel: openen, uitvoeren en de weg terug',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebaar-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gebaar ' + t, email: 'g' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGGebaar, null, { timeout: 20000 });
    /* Een gebaar op een onzichtbaar vlak is geen gebaar: het wereldhuis toont
       zijn inhoud pas na zijn eigen startlaag, en een pointer die op verborgen
       inhoud landt bereikt niets. Wachten op de TOESTAND (zichtbaar), niet op
       een klok. */
    await page.waitForFunction(() => {
      const el = document.querySelector('#werkdag');
      return !!el && getComputedStyle(el).visibility !== 'hidden';
    }, null, { timeout: 20000 });
    await page.evaluate((h) => {
      document.querySelector('#werkdag').innerHTML = h;
      // het klembord is in een kale browser niet toegestaan; we luisteren mee
      navigator.clipboard.writeText = (x) => { window.__plak = x; return Promise.resolve(); };
    }, REGEL('Nieuwe presentatie', 'doc86af40638634') + REGEL('Nieuw document', 'docefe8bb102fbb'));

    // 1. de laag herkent de regels zelf, zonder dat het scherm ze aanmeldt
    await page.waitForSelector('#werkdag .reis.gb-rij', { timeout: 5000 });
    assert.equal(await page.locator('#werkdag .reis.gb-rij').count(), 2,
      'beide regels horen door de waarnemer van RTGGebaar.lijst gemerkt te zijn');
    assert.ok(await page.locator('#werkdag .reis').first().getAttribute('aria-describedby'),
      'een gebarenregel hoort te zeggen DAT hij acties draagt, ook aan wie het scherm niet ziet');

    const rij = page.locator('#werkdag .reis').first();
    /* EERST IN BEELD, DAN METEN -- dezelfde reparatie als bij de proefregel
       verderop in dit bestand, en om precies dezelfde reden. boundingBox()
       rekent in het VENSTER. #werkdag staat op kantoor.html onder de vouw: op
       900 hoog kwam het veegpunt op y 920 uit, dus buiten beeld, en dan landt de
       muis nergens en komt er geen lade. De toets zakte daarmee op zijn eigen
       schermhoogte in plaats van op het gebaar. Gemeten met
       elementFromPoint(618, 920): null. */
    await rij.scrollIntoViewIfNeeded();
    const doos = await rij.boundingBox();

    // 2. halve veeg naar links -> de rechterlade blijft open staan, niets gebeurt
    await veeg(page, await maat(rij), -140, true);
    await ladeOpen(page);
    assert.deepEqual(await laden(page), { kant: 'rechts', gereed: false, acties: ['Openen', 'Delen'] },
      'een halve veeg naar links hoort de rechterlade te openen zonder iets uit te voeren');

    // 3. een tik op een actie sluit de lade en opent de regel NIET
    await page.locator('#werkdag .gb-lade .gb-doe').nth(1).click();
    await ladeDicht(page);
    assert.match(page.url(), /kantoor\.html/,
      'een tik in de lade mag niet doorlekken naar de link waar de regel zelf op zit');
    assert.equal(await laden(page), null, 'na een tik hoort de lade opgeruimd te zijn');

    // 4. de andere kant draagt andere acties -- dat is de hele afspraak
    await veeg(page, await maat(rij), 140, true);
    await ladeOpen(page);
    assert.deepEqual((await laden(page)).acties, ['Kenmerk', 'Overnemen'],
      'een veeg naar rechts hoort de ANDERE lade te openen');
    await page.keyboard.press('Escape');
    await ladeDicht(page);

    // 5. doorvegen: eerst zichtbaar gereed, dan uitgevoerd, dan een melding
    const drempel = Math.max(168 + 52, doos.width * 0.55) + 70;
    await veeg(page, await maat(rij), drempel, false);
    assert.equal((await laden(page)).gereed, true,
      'voorbij de drempel hoort de lade te laten ZIEN dat loslaten iets doet');
    await page.mouse.up();
    // doorvegen VOERT UIT: wachten tot de uitkomst er is, en de lade weg
    await page.waitForFunction(() => window.__plak === 'doc86af40638634', null, { timeout: 15000 });
    await ladeDicht(page);
    assert.equal(await page.evaluate(() => window.__plak), 'doc86af40638634',
      'doorvegen naar rechts hoort het kenmerk van die regel over te nemen');
    assert.match(await page.locator('.gb-terug').textContent(), /doc86af40638634/,
      'wat doorvegen deed, hoort te worden gemeld -- en de melding draagt role=status');
    assert.equal(await laden(page), null, 'na het uitvoeren hoort de lade dicht te zijn');

    // 6. zonder hand: pijltoets opent dezelfde acties met ECHTE knoppen
    await page.evaluate(() => document.querySelector('#werkdag .reis').focus());
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => { const d = document.querySelector('dialog.gb-blad'); return !!(d && d.open); },
      null, { timeout: 15000 });
    const lade = await page.evaluate(() => {
      const dl = document.querySelector('dialog.gb-blad');
      return dl ? { open: dl.open, knoppen: [...dl.querySelectorAll('menu button')].map((b) => b.textContent.trim()) } : null;
    });
    assert.deepEqual(lade, { open: true, knoppen: ['Openen', 'Delen'] },
      'pijl links hoort dezelfde acties te openen als de veeg naar links, maar dan als knoppen');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => /gb-rij/.test(document.activeElement.className || ''),
      null, { timeout: 15000 });
    assert.match(await page.evaluate(() => document.activeElement.className), /gb-rij/,
      'na de actielade hoort de focus terug te vallen op de regel waar hij vandaan kwam');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het vegen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE TWEEDE HELFT VAN DE AFSPRAAK. Doorvegen VOERT UIT, en dat is alleen te
   verantwoorden met een weg terug; wat geen weg terug heeft, gaat niet op een
   veeg maar op vasthouden. Geen van de drie gekoppelde schermen heeft vandaag
   zo'n actie -- ze openen, delen en kopieren, en dat is allemaal onschuldig.
   Zonder deze toets zou die helft van de laag dus ONBEWEZEN meerijden tot de
   eerste die hem gebruikt, en dat is precies hoe dode code ontstaat. Hier wordt
   hij daarom op zijn eigen contract (RTGGebaar.zet) nagerekend. */
test('doorvegen kan terug, en wat niet terug kan gaat alleen op vasthouden',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebaar2-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGGebaar, null, { timeout: 20000 });
    /* Een gebaar op een onzichtbaar vlak is geen gebaar: het wereldhuis toont
       zijn inhoud pas na zijn eigen startlaag, en een pointer die op verborgen
       inhoud landt bereikt niets. Wachten op de TOESTAND (zichtbaar), niet op
       een klok. */
    await page.waitForFunction(() => {
      const el = document.querySelector('#werkdag');
      return !!el && getComputedStyle(el).visibility !== 'hidden';
    }, null, { timeout: 20000 });
    await page.evaluate(() => {
      document.querySelector('#werkdag').innerHTML =
        '<div class="proefrij" tabindex="0" style="height:70px"><span>Een regel om te proeven</span></div>';
      window.__log = [];
      window.RTGGebaar.zet(document.querySelector('.proefrij'), {
        titel: 'Een regel om te proeven',
        rechts: [
          { naam: 'Afronden', teken: 'gereed',
            doe: () => { window.__log.push('afgerond'); return () => window.__log.push('teruggedraaid'); } }
        ],
        links: [
          { naam: 'Verwijderen', teken: 'ingrijp', sig: 'incident', borg: true,
            doe: () => { window.__log.push('verwijderd'); } }
        ]
      });
    });
    const rij = page.locator('.proefrij');
    const doos = await maat(rij);

    // 1. doorvegen naar links voert af EN biedt de weg terug aan
    await veeg(page, doos, -(doos.width * 0.55 + 90), true);
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), ['afgerond'],
      'doorvegen hoort de eerste actie van die kant uit te voeren');
    await page.locator('.gb-terug button').click();
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), ['afgerond', 'teruggedraaid'],
      'wat een actie teruggeeft, hoort de knop Terugdraaien te zijn');

    // 2. dezelfde veeg de andere kant op raakt de borg-actie NIET
    await page.evaluate(() => { window.__log = []; });
    await veeg(page, doos, doos.width * 0.55 + 90, false);
    assert.equal(await page.evaluate(() => document.querySelector('.gb-lade').hasAttribute('data-gereed')), false,
      'een lade met een borg-actie vooraan hoort NOOIT gereed te worden gemeld');
    await page.mouse.up();
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), [],
      'doorvegen mag een onomkeerbare actie niet uitvoeren -- daar is borg voor');

    // 3. hij gebeurt wel, maar pas na twee drukken op de echte knop
    /* Scherp vervalt na DREMPELS.herbevestig, en zonder tabel gaat hij niet op
       scherp: dus eerst de tabel, die zacht meekomt met RTGGebaar.zet(). */
    await page.waitForFunction(() => !!window.RTGGrammatica, null, { timeout: 10000 });
    await page.evaluate(() => document.querySelector('.proefrij').focus());
    await page.keyboard.press('ArrowRight');
    await wachtOpRust(page);
    const knop = page.locator('.gb-blad menu button').first();
    assert.match(await knop.textContent(), /houd vast/,
      'een borg-actie hoort in de actielade te zeggen dat je hem vasthoudt');
    await knop.press('Enter');
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), [],
      'de eerste druk zet hem op scherp en voert nog niets uit');
    assert.ok(await knop.getAttribute('data-scherp') !== null, 'op scherp hoort zichtbaar te zijn');
    /* SCHERP VERVALT (ronde 2, stap 10), zoals de tweede weg van vasthoud.js:
       "vier seconden geldig". Een borg die daarna nog op scherp stond, voerde uit
       op een druk die er niets meer mee te maken had. Hier wordt gewacht op de
       TIJD, want die is het gedrag -- en de tijd komt uit de tabel. */
    await page.waitForTimeout(gram.DREMPELS.herbevestig + 500);
    assert.equal(await knop.getAttribute('data-scherp'), null,
      'na DREMPELS.herbevestig (' + gram.DREMPELS.herbevestig + ' ms) hoort scherp vervallen te zijn');
    await knop.press('Enter');
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), [],
      'een druk na het vervallen hoort NIET uit te voeren, alleen opnieuw scherp te zetten');
    assert.ok(await knop.getAttribute('data-scherp') !== null, 'en dan staat hij weer op scherp');
    await knop.press('Enter');
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), ['verwijderd'],
      'de tweede druk voert hem uit');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens de proef');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* VASTHOUDEN MET EEN HAND, EN NIET ALLEEN MET EEN TOETS.

   De proef hierboven drukt twee keer op Enter: dat bewijst de toetsenbordweg en
   niets over de aanwijzer. Gemeten in ronde 2 (EDGE.md par. 11): met BORGTIJD op
   1 ging een borg af op een TIK en bleef elke toets in dit huis groen, en lang
   drukken op 5000 ms zag ook niemand. Een borg die op een tik afgaat is erger dan
   geen borg, want hij belooft iets wat hij niet houdt.

   Deze proeven pinnen het GEDRAG vast en geen getal. Kort ligt ruim onder elke
   tijd in de grammatica en ruim boven een animatieframe (de vulling loopt op
   requestAnimationFrame, dus korter dan een frame zegt niets); lang ligt ruim
   boven de hoogste vasthoudtijd. Zo blijven ze geldig als lang drukken naar
   DREMPELS gaat en als de borg in ronde 3 naar het gewicht verhuist (besluit
   K-borg van 23 september 2026).

   De borg komt hier uit de LAAG en niet uit een vlag: een serveractie zonder weg
   terug wordt vanzelf een borg (gebaar-04c.js), en dat is precies het pad van
   Weggooien op het bord. */
const KORT = 150;
const LANG_BORG = 2 * Math.max(...Object.values(gram.VASTHOUD));
const LANG_DRUK = 2 * gram.DREMPELS.lang;

async function proefBorg(page) {
  await page.evaluate(() => {
    document.querySelector('#werkdag').innerHTML =
      '<div class="proefrij" tabindex="0" style="height:70px"><span>Een regel om vast te houden</span></div>';
    window.__log = [];
    window.RTGGebaar.zet(document.querySelector('.proefrij'), {
      titel: 'Een regel om vast te houden',
      rechts: [{ naam: 'Afronden', teken: 'gereed', doe: () => { window.__log.push('afgerond'); } }],
      links: [window.RTGGebaar.klaar.server({ naam: 'Weggooien', teken: 'ingrijp', sig: 'incident',
        doe: () => { window.__log.push('weggegooid'); return Promise.resolve(); } })]
    });
  });
  await page.waitForSelector('.proefrij.gb-rij', { timeout: 5000 });
  /* Lang drukken leest zijn tijd uit de grammatica, en die komt zacht mee met de
     eerste zet() (gebaar-01.js). Zonder tabel is lang drukken uit; dan meet de
     proef een laag die er zo niet hoort te staan. */
  await page.waitForFunction(() => !!window.RTGGrammatica, null, { timeout: 10000 });
}

/* De borgknop in de actielade. Geopend langs de deur van de laag en niet langs
   een gebaar: deze stap meet de KNOP, en een gebaar dat de lade opent is een
   eigen proef hieronder. */
async function borgKnop(page) {
  await page.evaluate(() => window.RTGGebaar.open(document.querySelector('.proefrij')));
  await page.waitForFunction(() => { const d = document.querySelector('dialog.gb-blad'); return !!(d && d.open); },
    null, { timeout: 15000 });
  const knop = page.locator('dialog.gb-blad button.gb-borg');
  assert.equal(await knop.count(), 1, 'een serveractie zonder weg terug hoort vanzelf een borg te zijn');
  assert.match(await knop.textContent(), /Weggooien.*houd vast/, 'en de knop hoort te zeggen dat je hem vasthoudt');
  return knop;
}
const midden = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

async function houdMuis(page, loc, ms) {
  const p = await midden(loc);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/* EEN VINGER LANGS HET PROTOCOL. Playwright kent voor aanraking alleen tap(), en
   een tik is precies wat hier NIET gebeurt: de vinger blijft liggen. Via CDP gaan
   touchStart en touchEnd met een echte tijd ertussen naar Chromium, die er zelf
   pointerdown en pointerup van maakt -- dezelfde weg als een telefoon. */
async function houdVinger(page, loc, ms) {
  const p = await midden(loc);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
}

async function openKantoor(page, base) {
  await page.goto(base + '/apps/kantoor.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.RTGGebaar, null, { timeout: 20000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('#werkdag');
    return !!el && getComputedStyle(el).visibility !== 'hidden';
  }, null, { timeout: 20000 });
}

test('met een aanwijzer: kort vasthouden op een borg doet niets, lang voert uit, en lang drukken opent de actielade',
  { skip: geenBrowser(pw) }, async () => {
  assert.ok(KORT * 2 <= Math.min(gram.DREMPELS.lang, ...Object.values(gram.VASTHOUD)),
    'kort hoort ruim onder elke tijd in de grammatica te liggen, anders meet deze proef de tabel en niet de borg');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebaar-borg-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await openKantoor(page, base);
    await proefBorg(page);

    // 1. lang drukken op de regel opent de acties als lijst, zonder iets uit te voeren
    const rij = page.locator('.proefrij');
    await rij.scrollIntoViewIfNeeded();
    assert.equal(await page.locator('dialog.gb-blad').count(), 0, 'voor het drukken hoort er geen actielade te staan');
    await houdMuis(page, rij, LANG_DRUK);
    await page.waitForFunction(() => { const d = document.querySelector('dialog.gb-blad'); return !!(d && d.open); },
      null, { timeout: 5000 }).catch(() => {});
    assert.deepEqual(await page.evaluate(() => {
      const d = document.querySelector('dialog.gb-blad');
      return d && d.open ? [...d.querySelectorAll('menu button > span')].map((s) => s.textContent) : null;
    }), ['Afronden', 'Weggooien · houd vast'], 'lang drukken op een regel hoort de actielade met alle acties te openen');
    assert.deepEqual(await page.evaluate(() => window.__log), [], 'lang drukken legt uit en voert niets uit');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.gb-blad'), null, { timeout: 5000 });

    // 2. kort vasthouden op de borg: de vulling begint en valt terug, er gebeurt niets
    const knop = await borgKnop(page);
    await houdMuis(page, knop, KORT);
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), [],
      'een borg mag NIET afgaan op ' + KORT + ' ms vasthouden; dan is het een knop met een vertraging');
    assert.equal(await page.evaluate(() => !!(document.querySelector('dialog.gb-blad') || {}).open), true,
      'na kort vasthouden hoort de borg er nog te staan, klaar voor een echte poging');

    // 3. lang vasthouden voert hem uit
    await houdMuis(page, knop, LANG_BORG);
    await page.waitForFunction(() => window.__log.length > 0, null, { timeout: 5000 }).catch(() => {});
    assert.deepEqual(await page.evaluate(() => window.__log), ['weggegooid'],
      'na ' + LANG_BORG + ' ms vasthouden hoort de borg uitgevoerd te zijn');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens de proef');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('met een vinger: kort vasthouden op een borg doet niets, lang voert uit',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebaar-vinger-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    /* hasTouch en geen isMobile: aanraking aan, maar dezelfde opmaak als de proef
       met de aanwijzer, zodat alleen de hand verschilt. */
    const context = await browser.newContext({ viewport: { width: 900, height: 900 }, hasTouch: true });
    const page = await context.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await openKantoor(page, base);
    await proefBorg(page);

    const knop = await borgKnop(page);
    await houdVinger(page, knop, KORT);
    await wachtOpRust(page);
    assert.deepEqual(await page.evaluate(() => window.__log), [],
      'een borg mag ook met een vinger NIET afgaan op ' + KORT + ' ms; dat is een tik');
    assert.equal(await page.evaluate(() => !!(document.querySelector('dialog.gb-blad') || {}).open), true,
      'na een korte aanraking hoort de borg er nog te staan');

    /* De tegenproef, en zonder hem zegt de eerste niets: komt de vinger niet bij
       de knop aan, dan doet kort ook "niets". */
    await houdVinger(page, knop, LANG_BORG);
    await page.waitForFunction(() => window.__log.length > 0, null, { timeout: 5000 }).catch(() => {});
    assert.deepEqual(await page.evaluate(() => window.__log), ['weggegooid'],
      'na ' + LANG_BORG + ' ms met een vinger vasthouden hoort de borg uitgevoerd te zijn');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens de proef');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE DERDE PROEF DRAAIT OP EEN TELEFOON, EN DAT IS GEEN LUXE.

   De twee proeven hierboven draaien in een context met een MUIS, en dat deed
   elke schermafdruk en elke meting van deze laag ook. Daardoor stond er
   maandenlang een fout in die niemand kon zien: `position:relative` op .gb-rij
   zat alleen in de mediaquery van het aanwijslicht -- `(hover:hover) and
   (pointer:fine)`. Op een telefoon is die onwaar, dus was de regel static en
   zocht de lade (position:absolute) de PAGINA als houvast.

   Gemeten voor de reparatie: regel 350x62 op y=80, lade 97x844 op y=0. Een balk
   van boven naar beneden over het hele scherm. De veeg heeft dus nooit gewerkt
   op het apparaat waar hij voor bedoeld is.

   Deze proef meet de enige vraag die dat had gevangen: ligt de lade IN de
   regel? Niet of hij mooi is, niet of hij opengaat -- of hij op zijn plek zit. */
test('op een aanraakscherm ligt de lade in de regel en niet over de pagina',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebaar-tel-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gebaar tel ' + t, email: 'gt' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');

    browser = await pw.chromium.launch(browserOpties(pw));
    /* isMobile + hasTouch zet in Chromium de apparaatemulatie aan, en daarmee
       ook `pointer:coarse` en `hover:none` -- precies de stand waarin de fout
       zat. Zonder deze twee vlaggen meet deze proef hetzelfde als de andere. */
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
    });
    const page = await context.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGGebaar, null, { timeout: 20000 });
    /* Een gebaar op een onzichtbaar vlak is geen gebaar: het wereldhuis toont
       zijn inhoud pas na zijn eigen startlaag, en een pointer die op verborgen
       inhoud landt bereikt niets. Wachten op de TOESTAND (zichtbaar), niet op
       een klok. */
    await page.waitForFunction(() => {
      const el = document.querySelector('#werkdag');
      return !!el && getComputedStyle(el).visibility !== 'hidden';
    }, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches), false,
      'deze proef hoort in de aanraakstand te draaien; anders meet hij hetzelfde als de twee hierboven');

    /* EEN KALE REGEL, EN DAT IS EEN KEUZE DIE UIT DEZE FOUT KOMT. De eerste
       versie van deze proef veegde over een .reis uit het wereldregister -- en
       zakte NIET onder de mutatie, want rtg-wereld.css zet daar zelf
       `position:relative` op. De fout raakte dus juist de schermen die dat niet
       doen: .item in de kluis, .rij in de post. Wat hier gemeten wordt is de
       BELOFTE VAN DE LAAG -- RTGGebaar.zet werkt op elke regel -- en niet het
       toeval van een scherm dat zichzelf al had geplaatst. */
    await page.evaluate(() => {
      const r = document.createElement('div');
      r.id = 'proefregel';
      r.textContent = 'Een regel die zichzelf niet plaatst';
      r.style.cssText = 'margin:120px 12px;padding:18px;background:#151312;border:1px solid #333';
      /* VOORAAN en niet achteraan: boundingBox() rekent in het VENSTER, en op
         een scherm van 390x844 staat het eind van de body ver onder de rand.
         De muisaanwijzer landde daardoor buiten beeld en er kwam geen lade --
         een proef die faalt om de verkeerde reden is net zo min een proef. */
      document.body.insertBefore(r, document.body.firstChild);
      window.RTGGebaar.zet(r, { rechts: [{ naam: 'Opbergen', doe: function () {} }] });
    });
    await page.waitForSelector('#proefregel.gb-rij', { timeout: 5000 });

    const rij = page.locator('#proefregel');
    await rij.scrollIntoViewIfNeeded();
    const doos = await rij.boundingBox();
    /* LOSLATEN en dan pas meten. Blijft de vinger staan, dan is de lade zo breed
       als er geveegd is en heeft de knop ruimte die hij bij een OPEN lade niet
       heeft -- precies de stand waarin de pixel van de snedelijn zichtbaar wordt.
       Na loslaten staat de lade op zijn eigen maat, en dat is de maat die een
       lid ziet. */
    await veeg(page, doos, -150, true);
    await wachtOpRust(page);
    /* WACHTEN OP DE LADE ZELF, om dezelfde reden als bij ladeOpen() bovenaan dit
       bestand: wachtOpRust telt stilte, en vlak na een veeg is het stil omdat de
       lade nog moet opengaan. Op een trage bak mat de meting hierna een regel
       waar nog niets aan hing, en dan zakt deze proef op de klok in plaats van
       op het gedrag. De uitkomst blijft een METING en geen uitzondering: komt de
       lade er niet, dan blijft `meting` null en spreekt de bewering eronder. */
    await page.waitForSelector('#proefregel .gb-lade', { timeout: 15000 }).catch(() => {});

    const meting = await page.evaluate(() => {
      const r = document.getElementById('proefregel');
      const l = r && r.querySelector('.gb-lade');
      if (!l) return null;
      const rb = r.getBoundingClientRect(), lb = l.getBoundingClientRect();
      /* De regel mag zijn plaatsanker alleen van de LAAG hebben; had hij er zelf
         een, dan meet deze proef niets. Vandaar dat we hier de eigen stijl
         teruglezen en niet de berekende. */
      return { eigenPositie: r.style.position || 'static',
        regelH: Math.round(rb.height), ladeH: Math.round(lb.height),
        binnenIn: lb.y >= rb.y - 1 && lb.y + lb.height <= rb.y + rb.height + 1
          && lb.x >= rb.x - 1 && lb.x + lb.width <= rb.x + rb.width + 1 };
    });
    assert.ok(meting, 'de veeg hoort ook op een aanraakscherm een lade te openen');
    assert.equal(meting.eigenPositie, 'static',
      'deze proef meet niets als de regel zichzelf al plaatst -- dan verbergt het scherm de fout van de laag');
    assert.ok(meting.binnenIn,
      'de lade valt buiten de regel: ' + meting.ladeH + 'px hoog tegen een regel van ' + meting.regelH + 'px');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens de proef');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
