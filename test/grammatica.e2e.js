/* DE GRAMMATICA IN EEN ECHTE BROWSER. De regels staan in GRAMMATICA.md, de
   statische kant in test/grammatica.test.js.

   WAAROM DIT NAAST DIE TOETS BESTAAT. Dat `zwaar` in een tabel "vraagt: true"
   heet, is uit de bron te lezen. Of één tik hem dan ook echt niet afvuurt, of
   vasthouden hem wél afmaakt, of een verhinderde knop zijn reden geeft in plaats
   van stil niets te doen -- dat kan alleen een scherm zeggen.

   De handelingen hieronder worden hier ter plekke gedeclareerd en niet uit een
   bestaand scherm geplukt. Dat is met opzet: dit meet de TAAL en niet één
   afnemer, en `RTGAdaptief.declareer` is precies de weg die een afnemer ook
   gebruikt. De laatste toets kijkt wel naar een echt product, want "het voelt in
   het volgende product nog steeds bekend" is een belofte over echte schermen.

   Draait alleen waar Playwright met een passende browser staat; anders
   overgeslagen. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadScherm, letOpFouten, startServer, stop, wachtOpRust, wachtTot } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser die er ECHT is; zie laadScherm() in test/helper.js voor wat
   hier tweeendertig keer misging. */
const pw = laadScherm();

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body) });
  return r.json();
}

/* Eén lid, één telefoon. De intake wordt op de STATUS gemockt en niet met
   `onbGate.hidden = true`: dat laatste is een wedloop met een serveraanroep die
   de poort even later gewoon weer opent (uitgezocht in test/appmenu.e2e.js). */
let teller = 0;
async function metLid(fn) {
  const merk = ++teller;
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-grammatica-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Grammatica Lid',
      email: 'gram' + process.pid + merk + '@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
    letOpFouten(page, []);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rtgCommand .cmd-balk', { timeout: 20000 });
    await page.waitForFunction(() => window.RTGCommand && window.RTGCommand.actief && window.RTGCommand.actief(),
      null, { timeout: 20000 });
    await page.waitForFunction(() => !!(window.RTGGrammatica && window.RTGGewicht && window.RTGRail),
      null, { timeout: 20000 });
    await fn(page, base);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

/* De proefhandelingen, aangemeld zoals een afnemer dat doet. `zwaar` schrijft
   naar window.__gedaan, zodat de toets kan zien of hij is gedraaid EN met welke
   reden. */
async function zetProef(page, wat) {
  await page.evaluate((soort) => {
    window.__gedaan = null;
    window.__ongedaan = 0;
    const A = window.RTGAdaptief;
    const basis = { telefoon: ['balk', 'lade'], tablet: ['werkbalk'], bureau: ['werkbalk'] };
    if (soort === 'zwaar') {
      A.declareer(Object.assign({ id: 'proef.zwaar', naam: 'Salarissen exporteren', label: 'S',
        gewicht: 'zwaar', doe: (x) => { window.__gedaan = x; } }, basis));
      A.context({ bron: 'proef', titel: 'Proef', acties: ['proef.zwaar'],
        staat: { 'proef.zwaar': { bevestiging: { watGebeurt: '10.000 salarissen.', omvang: '10.000 regels' } } },
        rail: [{ sleutel: 'p', tekst: 'Opgeslagen', teken: '✓', staat: 'rustig',
          uitleg: ['Bewaard om 02:47.', 'Herstel beschikbaar.'] }] });
      return;
    }
    if (soort === 'terug') {
      A.declareer(Object.assign({ id: 'proef.terug', naam: 'Archiveren', label: 'A',
        gewicht: 'terug', doe: () => { window.__gedaan = 'weg'; } }, basis));
      A.context({ bron: 'proef', titel: 'Proef', acties: ['proef.terug'],
        staat: { 'proef.terug': { ongedaan: () => { window.__ongedaan++; } } }, rail: [] });
      return;
    }
    if (soort === 'dicht') {
      A.declareer(Object.assign({ id: 'proef.licht', naam: 'Vet', label: 'B', gewicht: 'licht',
        doe: () => { window.__gedaan = 'vet'; } }, basis));
      A.declareer(Object.assign({ id: 'proef.dicht', naam: 'Extern delen', label: 'E', gewicht: 'bewust',
        verhinderd: { reden: 'Extern delen is uitgeschakeld omdat dit stuk als Vertrouwelijk is geclassificeerd.',
          bron: 'classificatie' },
        doe: () => { window.__gedaan = 'extern'; } }, basis));
      A.context({ bron: 'proef', titel: 'Memo', acties: ['proef.licht', 'proef.dicht'], rail: [] });
    }
  }, wat);
  await page.waitForSelector('#rtgCommand .cmd-balk[data-zone="acties"]', { timeout: 10000 });
}

/* Omhoog trekken, met echte aanwijzerinvoer. Elke trap krijgt zijn eigen pagina:
   Playwright's virtuele muis doet na één sleep-met-vangst niet meer mee, en een
   toets die daardoor zakt zegt iets over de toetsdriver en niets over het
   product. */
async function trek(page, hoogte) {
  const b = await page.locator('#rtgCommand .cmd-balk').boundingBox();
  await page.mouse.move(b.x + b.width * 0.62, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.62, b.y - hoogte, { steps: 12 });
  await page.mouse.up();
  await wachtOpRust(page);
}

test('de grammatica', { skip: geenBrowser(pw), concurrency: false }, async (t) => {

  await t.test('de Trust Rail staat boven het dock en is een ingang, geen mededeling', async () => {
    /* DE MUTATIE: laat rail.js het onderdeel als <span> tekenen in plaats van als
       <button> wanneer er uitleg is. Dan staat de toestand er wel en is de
       verklaring erachter onbereikbaar -- precies de statusbalk die dit niet moest
       worden. */
    await metLid(async (page) => {
      await zetProef(page, 'zwaar');
      const rail = await page.locator('#rtgCommand .cmd-rail').boundingBox();
      const dock = await page.locator('#rtgCommand .cmd-balk').boundingBox();
      assert.ok(rail && dock, 'rail en dock horen allebei te staan');
      assert.ok(Math.round(rail.y + rail.height) <= Math.round(dock.y) + 1,
        'de rail hoort boven het dock te staan (' + Math.round(rail.y) + ' vs ' + Math.round(dock.y) + ')');
      assert.ok(Math.round(dock.y + dock.height) <= 845, 'en het dock onderaan het scherm');

      await page.locator('#rtgCommand .cmd-rail .rail-deel').first().click();
      await page.waitForSelector('.rtg-laag-lade.open', { timeout: 8000 });
      const uitleg = await page.locator('.rail-uitleg').allTextContents();
      assert.ok(uitleg.join(' ').includes('02:47'), 'de uitleg hoort de gemeten stand te tonen: ' + uitleg);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.rtg-laag'), null, { timeout: 8000 });
    });
  });

  await t.test('een zware handeling gaat niet met één tik, en vasthouden geeft de reden mee', async () => {
    /* DE HELE TRAP IN EEN TOETS: tikken opent een lade in plaats van te draaien,
       de knop blijft uit tot er een reden staat, vasthouden maakt hem af, en wat
       de handeling ontvangt is die reden.

       DE MUTATIE: zet `vraagt: false` op `zwaar` in grammatica.js -- dan draait
       hij op de eerste tik en zakt deze toets op __gedaan. */
    await metLid(async (page) => {
      await zetProef(page, 'zwaar');
      await page.locator('#rtgCommand .cmd-actie[data-cap="proef.zwaar"]').click();
      await page.waitForSelector('.rtg-laag-lade.open', { timeout: 8000 });
      assert.equal(await page.evaluate(() => window.__gedaan), null,
        'een tik hoort een zware handeling nog niet te draaien');

      assert.equal(await page.locator('.gw-reden').count(), 1, 'er hoort om een reden gevraagd te worden');
      assert.ok(await page.locator('.vh-knop').isDisabled(), 'zonder reden hoort de knop uit te staan');
      await page.locator('.gw-reden').fill('Jaarafsluiting, gevraagd door Finance.');
      assert.ok(!(await page.locator('.vh-knop').isDisabled()), 'met een reden hoort hij aan te gaan');

      /* Eerst een korte druk: die hoort NIET af te gaan, maar ook geen
         mislukking te zijn -- de knop biedt de tweede weg aan. */
      await page.locator('.vh-knop').hover();
      await page.mouse.down();
      await wachtOpRust(page);
      await page.mouse.up();
      await wachtOpRust(page);
      assert.equal(await page.evaluate(() => window.__gedaan), null, 'een korte druk mag niet afgaan');
      assert.ok(await page.locator('.vh-knop.tweede').count() > 0,
        'een korte druk hoort de tweede weg aan te bieden');

      /* HIER IS DE TIJD HET GEBAAR ZELF: vasthouden duurt nu eenmaal. Maar de
         toets hoeft niet te gokken HOE lang -- shared/adaptief/vasthoud.js zet
         de knop op `.af` zodra de druk vol is, en dat is het moment om los te
         laten. Zo blijft het een echte lange druk en toch een wacht op een
         toestand: gaat de drempel ooit omhoog, dan wacht deze toets gewoon
         langer in plaats van te zakken. */
      await page.locator('.vh-knop').hover();
      await page.mouse.down();
      await wachtTot(page, () => !!document.querySelector('.vh-knop.af'), null, { ms: 15000 });
      await page.mouse.up();
      /* Bevestigd, en dan gaat de lade dicht -- met een animatie. wachtOpRust
         telt stilte en die is er al voordat hij weg is; dan telt de bewering
         onderaan nog een lade. Wachten tot hij ECHT weg is. */
      await page.waitForFunction(() => !!(window.__gedaan && window.__gedaan.bevestigd)
        && document.querySelectorAll('.rtg-laag').length === 0, null, { timeout: 15000 });
      const gedaan = await page.evaluate(() => window.__gedaan);
      assert.ok(gedaan && gedaan.bevestigd === true, 'vasthouden hoort hem af te maken: ' + JSON.stringify(gedaan));
      assert.match(gedaan.reden, /Finance/, 'en de reden hoort mee te gaan');
      assert.equal(await page.locator('.rtg-laag').count(), 0, 'de lade hoort daarna dicht te zijn');
    });
  });

  await t.test('ongedaan maken staat in de rail en werkt', async () => {
    /* ONGEDAAN VOOR BEVESTIGEN. Een `terug`-handeling gebeurt meteen; de weg
       terug staat in de rail, op de plek waar je de toestand van je werk toch al
       leest.

       DE MUTATIE: laat naMelding() in gewicht.js niets doen. De handeling gebeurt
       dan nog steeds, maar er is geen weg terug -- en dat is precies het soort
       verlies dat je op een scherm niet ziet. */
    await metLid(async (page) => {
      await zetProef(page, 'terug');
      await page.locator('#rtgCommand .cmd-actie[data-cap="proef.terug"]').click();
      await wachtOpRust(page);
      assert.equal(await page.evaluate(() => window.__gedaan), 'weg', 'terug hoort meteen te gebeuren');
      await page.waitForSelector('#rtgCommand .rail-ongedaan', { timeout: 8000 });
      await page.locator('#rtgCommand .rail-ongedaan').click();
      await wachtOpRust(page);
      assert.equal(await page.evaluate(() => window.__ongedaan), 1, 'de weg terug hoort te werken');
      assert.equal(await page.locator('#rtgCommand .rail-ongedaan').count(), 0,
        'en daarna hoort de melding weg te zijn');
    });
  });

  await t.test('een verhinderde handeling geeft zijn reden en draait niet', async () => {
    /* DE SIGNATUUR VAN DIT HUIS: geen grijze knop zonder uitleg.

       DE MUTATIE: haal `if (!mag(id)) return false;` uit doe() in register.js, of
       laat balkknop.js een verhinderde handeling gewoon uitvoeren. */
    await metLid(async (page) => {
      await zetProef(page, 'dicht');
      const knop = page.locator('#rtgCommand .cmd-actie[data-cap="proef.dicht"]');
      assert.match(await knop.getAttribute('class'), /verhinderd/);
      assert.match(await knop.getAttribute('aria-label'), /niet beschikbaar/,
        'de stand hoort in de toegankelijke naam te staan');
      assert.equal(await knop.getAttribute('aria-disabled'), null,
        'hij hoort bedienbaar te blijven, anders is de uitleg onbereikbaar');

      await knop.click();
      await page.waitForSelector('.rtg-laag-lade.open', { timeout: 8000 });
      assert.match(await page.locator('.wm-reden').textContent(), /Vertrouwelijk/,
        'de reden hoort er in gewone taal te staan');
      assert.match(await page.locator('.wm-bron').textContent(), /Classificatie/,
        'en de bron erbij');
      assert.equal(await page.evaluate(() => window.__gedaan), null,
        'een verhinderde handeling hoort niet te draaien');
    });
  });

  await t.test('lang drukken legt uit, ook op een handeling die het wél doet', async () => {
    /* EEN GEBAAR, EEN BETEKENIS. Dit was tijdens het bouwen een keer stuk: lang
       drukken opende de uitgebreide lade, en dat is de betekenis van omhoog
       trekken.

       DE MUTATIE: zet in balkknop.js de lange druk terug op openLade(). */
    await metLid(async (page) => {
      await zetProef(page, 'dicht');
      const doos = await page.locator('#rtgCommand .cmd-actie[data-cap="proef.licht"]').boundingBox();
      await page.mouse.move(doos.x + doos.width / 2, doos.y + doos.height / 2);
      await page.mouse.down();
      await wachtOpRust(page);
      await page.mouse.up();
      await page.waitForSelector('.rtg-laag-lade.open', { timeout: 8000 });
      assert.equal((await page.locator('.lg-titel').textContent()).trim(), 'Vet');
      assert.match(await page.locator('.wm-belofte').textContent(), /meteen/,
        'de uitleg hoort te zeggen wat de handeling weegt');
      assert.equal(await page.evaluate(() => window.__gedaan), null,
        'lang drukken mag niets veranderen');
    });
  });

  await t.test('de orb stelt voor wat hier kan, inclusief wat hier niet kan', async () => {
    /* De orb mag voorstellen; wat er gebeurt loopt langs dezelfde weg. Een
       verhinderde handeling staat er juist WEL bij -- "kan ik dit hier?" met als
       antwoord stilte is de vraag die deze laag moest oplossen.

       DE MUTATIE: filter in orb.js de verhinderde handelingen weg. */
    await metLid(async (page) => {
      await zetProef(page, 'dicht');
      const orb = await page.locator('#rtgCommand .cmd-mondknop').boundingBox();
      await page.mouse.move(orb.x + orb.width / 2, orb.y + orb.height / 2);
      await page.mouse.down();
      await wachtOpRust(page);
      await page.mouse.up();
      await page.waitForSelector('.rtg-laag-lade.open', { timeout: 8000 });
      const kopjes = await page.locator('.lg-kopje').allTextContents();
      assert.deepEqual(kopjes, ['Dit kan hier', 'Dit kan hier niet']);
      const rijen = (await page.locator('.rtg-laag .lg-rij').allTextContents()).join(' ');
      assert.match(rijen, /Vet/);
      assert.match(rijen, /Extern delen/, 'wat niet kan hoort er ook te staan');
    });
  });

  await t.test('een kleine veeg omhoog geeft het uitgebreide gereedschap', async () => {
    /* DE MUTATIE: zet EERSTE in diepte.js op 400. De veeg haalt de drempel dan
       nooit en het gebaar bestaat niet meer. */
    await metLid(async (page) => {
      await zetProef(page, 'dicht');
      await trek(page, 60);
      assert.equal(await page.locator('.rtg-laag-lade.open').count(), 1,
        'een kleine veeg hoort de lade te openen');
    });
  });

  await t.test('verder omhoog geeft de volledige werkmodus', async () => {
    /* DE TWEEDE TRAP TOONT DEZELFDE HANDELINGEN, met hun groepen en ruimte. Zou
       hij iets anders tonen, dan is het geen diepte maar een tweede menu.

       DE MUTATIE: haal setPointerCapture uit diepte.js. De meting stopt dan op de
       rand van de balk en de tweede trap is niet te halen -- de fout die hier
       tijdens het bouwen zat. */
    await metLid(async (page) => {
      await zetProef(page, 'dicht');
      await trek(page, 220);
      assert.equal(await page.locator('.rtg-laag-taak.open').count(), 1,
        'verder omhoog hoort de werkmodus te openen');
      const rijen = (await page.locator('.rtg-laag .lg-rij').allTextContents()).join(' ');
      assert.match(rijen, /Vet/, 'met dezelfde handelingen erin');
    });
  });

  await t.test('tijdens het werk wijkt de chrome, maar het dock blijft staan', async () => {
    /* De eerste zin van deze grammatica is dat je duim zijn werk onderaan vindt.
       Een dock dat verdwijnt zodra je leest, breekt precies die zin.

       DE MUTATIE: zet in grammatica.css .cmd-balk[data-bezig="1"] op
       transform:translateY(100%). */
    await metLid(async (page) => {
      await zetProef(page, 'zwaar');
      const voor = await page.locator('#rtgCommand .cmd-balk').boundingBox();
      await page.evaluate(() => window.RTGDiepte.bezig());
      /* De rail zakt IN; dat is de toestand waar deze toets over gaat, en niet
         "het scherm is stil" -- dat is het al voordat de rail begint. */
      await page.waitForFunction(() => {
        const r = document.querySelector('#rtgCommand .cmd-rail');
        if (!r) return true;
        const b = r.getBoundingClientRect();
        return b.height < 6 || getComputedStyle(r).visibility === 'hidden' || b.width === 0;
      }, null, { timeout: 15000 });
      const na = await page.locator('#rtgCommand .cmd-balk').boundingBox();
      assert.equal(Math.round(voor.y), Math.round(na.y), 'het dock hoort te blijven staan');
      assert.ok(!(await page.locator('#rtgCommand .cmd-rail').isVisible()) ||
        (await page.locator('#rtgCommand .cmd-rail').boundingBox()).height < 6,
        'de rail hoort in te zakken');
    });
  });

  await t.test('een tweede product spreekt dezelfde taal', async () => {
    /* "Ik wissel van RTG-product en de bediening voelt nog steeds bekend" is de
       zevende zin, en die is pas iets waard als er een tweede product is. RTG
       Bestanden draagt dezelfde lagen als RTG Office, zonder dat die twee iets
       van elkaar weten.

       DE MUTATIE: haal de adaptief-scripts uit apps/bestanden.html. */
    await metLid(async (page, base) => {
      await page.evaluate(() => window.RTGCommand.open('/apps/bestanden.html', 'Bestanden'));
      await page.waitForSelector('#rtgCommand .cmd-pane.actief iframe', { timeout: 20000 });
      const frame = page.frameLocator('#rtgCommand .cmd-pane.actief iframe');
      await frame.locator('body').waitFor({ timeout: 20000 });
      const heeft = await page.evaluate(() => {
        const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
        const w = f && f.contentWindow;
        return w ? { leer: !!w.RTGAdaptiefLeer, gram: !!w.RTGGrammatica,
          register: !!w.RTGAdaptief, lagen: !!w.RTGLagen } : null;
      });
      assert.deepEqual(heeft, { leer: true, gram: true, register: true, lagen: true },
        'RTG Bestanden hoort dezelfde taal te dragen als RTG Office');
    });
  });
});
