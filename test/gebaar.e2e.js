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
const { startServer, stop, letOpFouten } = require('./helper');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
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

async function veeg(page, doos, px, losLaten) {
  const y = doos.y + doos.height / 2;
  const x0 = px < 0 ? doos.x + doos.width * 0.7 : doos.x + doos.width * 0.15;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  // in stapjes, want een sprong van honderd pixels is voor de browser geen veeg
  for (let i = 1; i <= 20; i++) await page.mouse.move(x0 + (px * i) / 20, y);
  if (losLaten) await page.mouse.up();
}

const laden = (page) => page.evaluate(() => {
  const l = document.querySelector('#werkdag .gb-lade');
  return l ? {
    kant: l.dataset.kant, gereed: l.hasAttribute('data-gereed'),
    acties: [...l.querySelectorAll('.gb-doe > span')].map((s) => s.textContent)
  } : null;
});

test('de twee laden onder een regel: openen, uitvoeren en de weg terug',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
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

    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: BROWSER });
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.RTGGebaar, null, { timeout: 20000 });
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
    const doos = await rij.boundingBox();

    // 2. halve veeg naar links -> de rechterlade blijft open staan, niets gebeurt
    await veeg(page, doos, -140, true);
    await page.waitForTimeout(350);
    assert.deepEqual(await laden(page), { kant: 'rechts', gereed: false, acties: ['Openen', 'Delen'] },
      'een halve veeg naar links hoort de rechterlade te openen zonder iets uit te voeren');

    // 3. een tik op een actie sluit de lade en opent de regel NIET
    await page.locator('#werkdag .gb-lade .gb-doe').nth(1).click();
    await page.waitForTimeout(400);
    assert.match(page.url(), /kantoor\.html/,
      'een tik in de lade mag niet doorlekken naar de link waar de regel zelf op zit');
    assert.equal(await laden(page), null, 'na een tik hoort de lade opgeruimd te zijn');

    // 4. de andere kant draagt andere acties -- dat is de hele afspraak
    await veeg(page, doos, 140, true);
    await page.waitForTimeout(350);
    assert.deepEqual((await laden(page)).acties, ['Kenmerk', 'Overnemen'],
      'een veeg naar rechts hoort de ANDERE lade te openen');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 5. doorvegen: eerst zichtbaar gereed, dan uitgevoerd, dan een melding
    const drempel = Math.max(168 + 52, doos.width * 0.55) + 70;
    await veeg(page, doos, drempel, false);
    assert.equal((await laden(page)).gereed, true,
      'voorbij de drempel hoort de lade te laten ZIEN dat loslaten iets doet');
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__plak), 'doc86af40638634',
      'doorvegen naar rechts hoort het kenmerk van die regel over te nemen');
    assert.match(await page.locator('.gb-terug').textContent(), /doc86af40638634/,
      'wat doorvegen deed, hoort te worden gemeld -- en de melding draagt role=status');
    assert.equal(await laden(page), null, 'na het uitvoeren hoort de lade dicht te zijn');

    // 6. zonder hand: pijltoets opent dezelfde acties met ECHTE knoppen
    await page.evaluate(() => document.querySelector('#werkdag .reis').focus());
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const lade = await page.evaluate(() => {
      const dl = document.querySelector('dialog.gb-blad');
      return dl ? { open: dl.open, knoppen: [...dl.querySelectorAll('menu button')].map((b) => b.textContent.trim()) } : null;
    });
    assert.deepEqual(lade, { open: true, knoppen: ['Openen', 'Delen'] },
      'pijl links hoort dezelfde acties te openen als de veeg naar links, maar dan als knoppen');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
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
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebaar2-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: BROWSER });
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.RTGGebaar, null, { timeout: 20000 });
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
    const doos = await rij.boundingBox();

    // 1. doorvegen naar links voert af EN biedt de weg terug aan
    await veeg(page, doos, -(doos.width * 0.55 + 90), true);
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(() => window.__log), ['afgerond'],
      'doorvegen hoort de eerste actie van die kant uit te voeren');
    await page.locator('.gb-terug button').click();
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => window.__log), ['afgerond', 'teruggedraaid'],
      'wat een actie teruggeeft, hoort de knop Terugdraaien te zijn');

    // 2. dezelfde veeg de andere kant op raakt de borg-actie NIET
    await page.evaluate(() => { window.__log = []; });
    await veeg(page, doos, doos.width * 0.55 + 90, false);
    assert.equal(await page.evaluate(() => document.querySelector('.gb-lade').hasAttribute('data-gereed')), false,
      'een lade met een borg-actie vooraan hoort NOOIT gereed te worden gemeld');
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(() => window.__log), [],
      'doorvegen mag een onomkeerbare actie niet uitvoeren -- daar is borg voor');

    // 3. hij gebeurt wel, maar pas na twee drukken op de echte knop
    await page.evaluate(() => document.querySelector('.proefrij').focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const knop = page.locator('.gb-blad menu button').first();
    assert.match(await knop.textContent(), /houd vast/,
      'een borg-actie hoort in de actielade te zeggen dat je hem vasthoudt');
    await knop.press('Enter');
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.__log), [],
      'de eerste druk zet hem op scherp en voert nog niets uit');
    assert.ok(await knop.getAttribute('data-scherp') !== null, 'op scherp hoort zichtbaar te zijn');
    await knop.press('Enter');
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.__log), ['verwijderd'],
      'de tweede druk voert hem uit');

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
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
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

    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: BROWSER });
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
    await page.goto(base + '/apps/kantoor.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.RTGGebaar, null, { timeout: 20000 });
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
    await veeg(page, doos, -150, false);
    await page.waitForTimeout(320);

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
    await page.mouse.up();
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
