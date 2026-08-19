/* DE ADAPTIEVE LAAG IN EEN ECHTE BROWSER. De regels staan in ADAPTIEF.md,
   de statische kant in test/adaptief.test.js.

   WAAROM DIT NAAST DIE TOETS BESTAAT. Dat een declaratie een telefoonvorm noemt,
   is te lezen uit de bron. Of die vorm ook op het scherm belandt, of een tik erop
   in het werkblad AANKOMT, en of de balk binnen de schermbreedte blijft, is dat
   niet -- dat zijn drie dingen die alleen een echt scherm kan zeggen, en alle
   drie zijn ze hier tijdens het bouwen fout geweest:

   1. de balk werd 1099px breed op een scherm van 390 (de min-width-keten brak),
      waardoor Rahul buiten beeld stond en de overloop nooit aansprong;
   2. het anker en de ⋯-knop stonden zichtbaar terwijl de code ze verborg (een
      klasse met display wint van [hidden]);
   3. een tik op "vet" in het BOVENdocument deed niets, want het werkblad-frame
      had de focus verloren en had daarmee geen selectie meer.

   Draait alleen waar Playwright met een passende browser staat; anders
   overgeslagen. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body) });
  return r.json();
}

/* Eén lid, één server, en een venster op de maat die je meten wil. De intake
   wordt op de STATUS gemockt en niet met `onbGate.hidden = true`: dat laatste is
   een wedloop met een serveraanroep die de poort even later gewoon weer opent
   (zie test/appmenu.e2e.js, waar dat is uitgezocht). */
async function metLid(breedte, hoogte, fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-adaptief-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Adaptief Lid',
      email: 'adaptief' + process.pid + breedte + '@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte } });
    await ctx.route('**/api/onboarding/status', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_office_token', t);
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rtgCommand', { timeout: 20000 });
    await page.waitForFunction(() => window.RTGCommand && window.RTGCommand.actief && window.RTGCommand.actief(),
      null, { timeout: 20000 });
    await fn(page, base, fouten);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

/* Office openen als werkblad en er een tekstdocument in maken. Dit is de enige
   afnemer die vandaag aangesloten is (ADAPTIEF.md), en daarmee het bewijs dat de
   keten werkt: declaratie -> brug -> balk -> terug het frame in. */
async function metDocument(page, fn) {
  await page.evaluate(() => window.RTGCommand.open('/apps/office.html', 'Documenten'));
  await page.waitForSelector('#rtgCommand .cmd-pane.actief iframe', { timeout: 20000 });
  const fr = page.frameLocator('#rtgCommand .cmd-pane.actief iframe');
  await fr.locator('text=Zakelijke brief').first().waitFor({ timeout: 25000 });
  await fr.locator('text=Zakelijke brief').first().click();
  await page.waitForSelector('#rtgCommand .cmd-balk[data-zone="acties"]', { timeout: 20000 });
  await fn(fr);
}

/* De hele selectie van één blok, in het frame. Playwright's eigen selectiehulp
   werkt niet op contenteditable in een frame, dus wordt het bereik hier gezet --
   met de gebeurtenis erbij, want daar hangt de melding aan. */
async function selecteerAlles(fr) {
  await fr.locator('#tekst').click();
  await fr.locator('#tekst').evaluate((vel) => {
    const r = document.createRange();
    r.selectNodeContents(vel.querySelector('p,h1,h2,div') || vel);
    const s = document.getSelection();
    s.removeAllRanges(); s.addRange(r);
    document.dispatchEvent(new Event('selectionchange'));
  });
}

test('de contextuele schilbalk', { skip: pw ? false : 'playwright ontbreekt', concurrency: false }, async (t) => {

  await t.test('op het beginscherm staan de werelden IN de balk, niet twee tikken diep', async () => {
    /* WAT DIT MEET. De balk zei "Kies een wereld" -- een zin, geen bediening --
       en de enige weg naar een wereld liep via de lade: twee handelingen voor het
       enige wat dat scherm te doen heeft.

       DE MUTATIE: laat werelditems() in shared/adaptief/balk.js een lege lijst
       teruggeven. De zone valt dan terug op de bladenrij en deze toets zakt op
       nul handelingen. */
    await metLid(390, 844, async (page) => {
      await page.waitForSelector('#rtgCommand .cmd-balk[data-zone="acties"]', { timeout: 20000 });
      const acties = page.locator('#rtgCommand .cmd-actie');
      assert.ok(await acties.count() >= 1, 'de werelden horen als knop in de balk te staan');
      const namen = await acties.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
      assert.ok(namen.some((n) => /RTG/i.test(n || '')), 'de werelden dragen hun eigen naam: ' + namen.join(', '));

      // en een tik erop opent het werkblad meteen -- geen tussenstap
      await acties.first().click();
      await page.waitForSelector('#rtgCommand .cmd-pane', { timeout: 20000 });
    });
  });

  await t.test('elk raakvlak in de balk haalt de aanraakmaat', async () => {
    /* TOEGANKELIJK.md houdt 24x24 aan als harde poort; ADAPTIEF.md ontwerpt op
       44. Dit meet de echte doos op het scherm en niet de CSS-regel: een knop kan
       een min-height dragen en toch platgedrukt worden door zijn ouder.

       DE MUTATIE: zet .cmd-actie{min-width:24px;min-height:24px}. */
    await metLid(390, 844, async (page) => {
      await page.waitForSelector('#rtgCommand .cmd-balk[data-zone="acties"]', { timeout: 20000 });
      const dozen = await page.locator('#rtgCommand .cmd-actie, #rtgCommand .cmd-meer:visible')
        .evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
      assert.ok(dozen.length, 'er horen raakvlakken te staan');
      for (const [b, h] of dozen) {
        assert.ok(b >= 44 && h >= 44, 'een raakvlak van ' + Math.round(b) + 'x' + Math.round(h) + ' is te klein');
      }
    });
  });

  await t.test('de balk blijft binnen de schermbreedte, hoeveel handelingen er ook zijn', async () => {
    /* GEMETEN EN ECHT MISGEGAAN: met eenentwintig handelingen werd de balk 1099px
       breed op een scherm van 390. Geen foutmelding, geen schuifbalk (de body
       staat op overflow:hidden) -- alleen Rahul buiten beeld en een overloop die
       nooit aansprong, want in een balk van 1099px past alles.

       DE MUTATIE: haal `.cmd-balk{min-width:0}` uit adaptief.css. */
    await metLid(390, 844, async (page) => {
      await metDocument(page, async () => {
        const maat = await page.evaluate(() => {
          const b = document.querySelector('#rtgCommand .cmd-balk');
          const r = document.querySelector('#rtgCommand .cmd-actierij');
          return { balk: b.clientWidth, venster: window.innerWidth,
            rijClient: r.clientWidth, rijScroll: r.scrollWidth };
        });
        assert.ok(maat.balk <= maat.venster,
          'de balk is ' + maat.balk + 'px op een venster van ' + maat.venster);
        assert.ok(maat.rijScroll <= maat.rijClient + 1,
          'de actierij loopt over: ' + maat.rijScroll + ' in ' + maat.rijClient);
      });
    });
  });

  await t.test('een selectie verandert de balk, en de handeling komt aan in het werkblad', async () => {
    /* DE KETEN IN EEN TOETS: office declareert, de brug brengt het omhoog, de balk
       tekent het, een tik gaat terug omlaag, en het document verandert.

       Dat laatste was stuk: een tik in het bovendocument haalt de focus uit het
       frame, en dan heeft document.execCommand geen selectie meer om vet te
       maken. De knop reageerde zichtbaar niet.

       DE MUTATIE: haal herstel() weg uit de doe() in apps/office/adaptief.js. */
    await metLid(390, 844, async (page) => {
      await metDocument(page, async (fr) => {
        const inRust = await page.locator('#rtgCommand .cmd-actie')
          .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
        assert.ok(await page.locator('#rtgCommand .cmd-anker').isVisible(),
          'zonder selectie draagt de balk het anker: waar je bent');

        await selecteerAlles(fr);
        await page.waitForFunction(() => {
          const b = document.querySelector('#rtgCommand .cmd-actie');
          return b && /vet/i.test(b.getAttribute('aria-label') || '');
        }, null, { timeout: 10000 });

        const bijSelectie = await page.locator('#rtgCommand .cmd-actie')
          .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
        assert.notDeepEqual(bijSelectie, inRust, 'een selectie hoort de balk te veranderen');
        assert.ok(/vet/i.test(bijSelectie[0] || ''), 'vet hoort vooraan te staan: ' + bijSelectie.join(', '));

        const voor = await fr.locator('#tekst').innerHTML();
        await page.locator('#rtgCommand .cmd-actie').first().click();
        await page.waitForTimeout(400);
        const na = await fr.locator('#tekst').innerHTML();
        assert.notEqual(na, voor, 'een tik in de balk hoort het document te veranderen');
        assert.ok(/<b>|<strong>/i.test(na), 'er hoort vette tekst te staan');
      });
    });
  });

  await t.test('wat niet in de balk past staat volledig in de lade, en die gaat met Escape dicht', async () => {
    /* PROGRESSIVE DISCLOSURE, EN DE VOORWAARDE ERBIJ: de lade draagt de VOLLEDIGE
       lijst en niet alleen de rest. Moeten onthouden of iets nou in de balk stond
       of erachter, is precies wat dit niet mag kosten.

       DE MUTATIE: laat openLade() alleen de weggevallen handelingen tonen. */
    await metLid(390, 844, async (page) => {
      await metDocument(page, async (fr) => {
        await selecteerAlles(fr);
        await page.waitForSelector('#rtgCommand .cmd-meer:visible', { timeout: 10000 });
        const inBalk = await page.locator('#rtgCommand .cmd-actie').count();
        await page.locator('#rtgCommand .cmd-meer').click();
        await page.waitForSelector('.rtg-laag-lade.open', { timeout: 10000 });
        const inLade = await page.locator('.rtg-laag .lg-rij').count();
        assert.ok(inLade > inBalk, 'de lade hoort meer te dragen dan de balk (' + inLade + ' vs ' + inBalk + ')');

        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.rtg-laag'), null, { timeout: 10000 });
      });
    });
  });

  await t.test('er ligt nooit meer dan EEN dominante laag tegelijk', async () => {
    /* Twee laden over elkaar is de vorm waarin een mens niet meer weet waar
       "terug" heen gaat, en dan verlaat hij het scherm in plaats van de laag.

       DE MUTATIE: haal `sluit(true)` uit bouw() in shared/adaptief/lagen.js. */
    await metLid(390, 844, async (page) => {
      await page.evaluate(() => {
        window.RTGLagen.lade({ titel: 'Een' });
        window.RTGLagen.paneel({ titel: 'Twee' });
        window.RTGLagen.taak({ titel: 'Drie' });
      });
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.rtg-laag').count(), 1, 'er hoort er precies één te staan');
      assert.equal(await page.locator('.rtg-laag[data-soort="taak"]').count(), 1, 'en dat is de laatste');
    });
  });

  await t.test('op een breed scherm bestaat de contextzone niet', async () => {
    /* Dezelfde capability, een andere presentatie: op bureau doen de werkbalk en
       het contextvlak van het scherm zelf dit werk, en een tweede rij knoppen
       onderin zou een tweede bediening naast een bestaande zijn.

       DE MUTATIE: haal het @media (min-width:1000px)-blok onderaan adaptief.css
       weg. */
    await metLid(1440, 900, async (page) => {
      await page.waitForSelector('#rtgCommand .cmd-bank', { state: 'visible', timeout: 20000 });
      assert.equal(await page.locator('#rtgCommand .cmd-acties:visible').count(), 0,
        'de contextzone hoort op een breed scherm niet zichtbaar te zijn');
    });
  });
});
