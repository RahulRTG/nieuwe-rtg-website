/* Het app-menu (public/shared/appmenu.js) en de belofte dat Rahul ÉÉN balk heeft.

   TWEE BELOFTES, EN ALLEBEI ZIJN ZE HIER AL EEN KEER GEBROKEN.

   1. ÉÉN BALK VAN RAHUL PER SCHERM. shared/metgezel.js hangt zijn chatbalk op
      elke app-pagina, behalve waar het scherm er zelf al een heeft -- en dat is
      de homescreen (#osAiBalk). Die uitzondering werd getoetst met
      `/\/apps\/app\.html$/.test(location.pathname)`, en dat is precies één
      regel te letterlijk: server/middleware/voordeur.js serveert de homescreen
      OOK op /, /apps/ en /apps/index.html, zonder omleiding. Op drie van de
      vier ingangen -- waaronder de kale domeinnaam, de meest bezochte van
      allemaal -- stonden er dus twee invoervelden voor hetzelfde gesprek, recht
      onder elkaar. Vandaar dat deze toets alle vier de paden afgaat en niet
      alleen het bestandspad.

      De mutatie die hem hoort te laten zakken: zet in shared/metgezel.js de
      padtoets terug als enige voorwaarde voor `eigenRahul`.

   2. ELKE APP HEEFT EEN MENU -- EN HET BEGINSCHERM JUIST NIET. De hamburger
      rechtsboven komt van shared/appmenu.js, en die wordt door shared/ios.js
      binnengehaald -- één plek voor elke app-pagina. Dat is de kracht en de
      zwakte tegelijk: valt die koppeling weg, of vergeet een nieuwe pagina
      shared/ios.js (dat was bij dispatch.html, zakelijk.html en de zeven
      foundation/os-*.html precies wat er aan de hand was), dan is er geen
      foutmelding en geen rood -- alleen een app zonder weg terug naar huis.
      Deze toets loopt daarom ALLE app-pagina's af.

      Het beginscherm is de rustplek en heeft er met opzet géén: daar is de
      bovenrand de ingang naar het systeem. Die kant kan stil kapot -- knoppen
      weghalen zie je, een ingang die niemand meer heeft niet -- dus de toets
      hieronder haalt de bovenrand echt omlaag en kijkt of het paneel opengaat
      en of meldingen erin staan.

      De mutatie: haal het blok dat appmenu.js bijlaadt uit shared/ios.js.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, volgVerzoeken, wachtOpRust, wachtTot } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

const pw = laadPlaywright({ eigenDriver: false });

function appPaden(dir = path.join(PUB, 'apps'), uit = []) {
  for (const naam of fs.readdirSync(dir)) {
    const p = path.join(dir, naam);
    if (fs.statSync(p).isDirectory()) appPaden(p, uit);
    else if (naam.endsWith('.html')) uit.push('/' + path.relative(PUB, p).split(path.sep).join('/'));
  }
  return uit.sort();
}

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}

/* Een echt lid, want zonder inlog bouwt metgezel.js niets en heeft de toets
   niets te meten. */
async function lidToken(base, email) {
  const reg = await api(base, '/api/auth/register', { name: 'Menu Lid', email, phone: '0612345799',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.token, 'lid-registratie geeft een token');
  return reg.token;
}

async function metLid(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-menu-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const tok = await lidToken(base, 'appmenu' + process.pid + '@x.nl');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    /* DE INTAKE STAAT HIER BUITEN, EN DAT MOET VIA DE STATUS.

       Een vers geregistreerd lid is niet `klaar`, dus opent app-main het
       onboardinggesprek en gaat #onbGate open. Daar mag niets overheen
       (shared/command.js), dus is er dan geen werktafel om te meten.

       Deze toetsen deden dat met `onbGate.hidden = true` vlak na
       domcontentloaded. Dat is een wedloop die je verliest: /onboarding/status
       is een serveraanroep, en het antwoord zet de poort even later gewoon
       weer open. De werktafel week zoals hij hoort, kwam niet terug, en de
       toets wachtte zich dood op werelden in een bank die niet bestond.

       Mocken op de status is wat de rest van deze suite ook doet
       (apps-ui, handenvrij, verzorging-scherm): dan is er niets te tekenen,
       zet app-main de poort zelf dicht, en is er geen moment waarop het
       andersom kan uitpakken. */
    await ctx.route('**/api/onboarding/status', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        /* HIER STOND rtg_os_wereld = 'uit'.

           Het beginscherm had twee standen -- de kring om de klok en het rooster
           met tegels -- en deze toetsen meten het rooster, dus zetten ze die
           stand aan; in de wereldstand stonden de tegels op display:none en mat
           je nullen. De wereldstand bestaat niet meer (de klok is met het
           beginscherm meegegaan, zie WERELD.md), het rooster is de enige vorm
           die er nog is, en een sleutel zetten die niemand meer leest maakt een
           toets alleen maar moeilijker te geloven. */
      } catch (e) {}
    }, tok);
    await fn({ base, ctx });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

/* WACHT TOT DE WERELDEN IN DE BANK STAAN.

   Deze helper heette wachtRooster en deed twee dingen die geen van beide nog
   bestaan: hij schakelde met RTGWereld.zet(false) naar de rasterstand van het
   beginscherm, en hij klikte daarna de knop in de bank die de werktafel opvouwde
   naar het springboard. De wereldstand is weg met de klok, en het springboard is
   als scherm weg (WERELD.md) -- de werelden staan nu bovenaan de bank van de
   werktafel, en dat is wat deze toetsen meten.

   Twee wachtmomenten en niet een: #osMappen is nog steeds de registry waar de
   bank uit gevuld wordt (app-main reikt hem aan, zie app-main-29c.js), dus de
   bank kan pas kloppen als die registry klaar is. Wachten op alleen de bank
   levert een toets op die soms een tel te vroeg meet.

   HIER STOND `=== 3` EN DAT WAS EEN PROXY DIE VERLIEP. Het was een telling van
   tegels, bedoeld als "de registry is klaar", en toen WERELDEN.md er een vierde
   wereld en Instellingen bij zette liep hij vast op een tijdslimiet -- vier
   toetsen vielen om zonder dat er iets aan die toetsen mankeerde. Een
   wachtvoorwaarde hoort te noemen WAAROP hij wacht: de vier wereldtegels, bij
   hun sleutel. Komt er een wereld bij, dan hoort die hier ook te staan. */
const WERELDTEGELS = ['map-rtg', 'map-werk', 'map-reizen', 'map-rtf'];
async function wachtWerelden(page) {
  await page.waitForFunction((sleutels) => {
    const app = document.getElementById('app');
    if (!app || !app.classList.contains('active')) return false;
    return sleutels.every((s) => document.querySelector('#osMappen .os-app[data-sleutel="' + s + '"]'));
  }, WERELDTEGELS, { timeout: 60000 });
  /* De werktafel hoort er dan ook te zijn: de intake staat buiten deze toetsen
     (zie metLid), dus is #onbGate dicht en is er geen grendel meer. */
  await page.waitForSelector('#rtgCommand .cmd-nav', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => {
    const nav = document.querySelector('#rtgCommand .cmd-nav');
    if (!nav) return false;
    return [...nav.querySelectorAll('button[data-url]')]
      .some((b) => /\/apps\/rtg\.html$/.test(b.dataset.url));
  }, null, { timeout: 20000 });
}

/* De werelden zoals ze in de bank staan, in volgorde.

   HIER STOND EEN GRENS, en die is niet meer nodig. De bank had twee secties --
   Werelden en daaronder Software -- en deze functie las tot het TWEEDE kopje om
   de software buiten beeld te houden. Dat tweede kopje bestaat niet meer
   (WERELDEN.md): de twaalf apps die eronder hingen staan nu in de wereld waar ze
   horen, en de nav draagt alleen nog werelden. De voet (Rahul, Instellingen,
   Pagina-instellingen) staat in .cmd-bankvoet en niet hierin. */
async function werelden(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('#rtgCommand .cmd-nav');
    const koppen = [...nav.querySelectorAll('.cmd-kop')].map((k) => k.textContent.trim());
    const uit = [];
    for (const el of [...nav.children]) {
      if (el.tagName !== 'BUTTON') continue;
      const r = el.getBoundingClientRect();
      uit.push({
        url: el.dataset.url || '', naam: el.textContent.trim(),
        glyf: !!el.querySelector('.cmd-glyf svg'),
        breed: Math.round(r.width), hoog: Math.round(r.height),
        top: Math.round(r.top)
      });
    }
    return { koppen, werelden: uit };
  });
}

/* De lade openen ALS hij dicht is. Nog een keer klikken sluit hem, en zolang hij
   openstaat ligt hij over de greep heen -- dan wacht een klik zich dood op een
   knop die eronder zit. Dat is precies wat er in de lus hieronder gebeurde. */
async function openLade(page) {
  if (await page.evaluate(() => !!document.querySelector('#rtgCommand.bank-open'))) return;
  const lade = page.locator('#rtgCommand .cmd-lade');
  if (!(await lade.isVisible())) return;      // breed scherm: de bank staat vast
  await lade.click();
  await page.waitForSelector('#rtgCommand.bank-open', { timeout: 5000 });
}

test('Rahul heeft één balk en elk app-scherm houdt een veilige systeemdeur',
  { skip: geenBrowser(pw) }, async (t) => {
  await metLid(async ({ base, ctx }) => {
    /* Alle vier de ingangen van de homescreen (zie voordeur.js) plus een paar
       gewone app-pagina's, want daar hoort de balk van metgezel.js juist WEL te
       staan -- eentje. */
    const thuisPaden = ['/', '/apps/', '/apps/index.html', '/apps/bureau.html', '/apps/app.html'];
    const appPagina = ['/apps/muziek.html', '/apps/wallet.html', '/apps/berichten.html'];
    const fouten = [];

    for (const pad of thuisPaden.concat(appPagina)) {
      const page = await ctx.newPage();
      await volgVerzoeken(page);
      try {
        await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await wachtOpRust(page);
        /* EEN LATE OMLEIDING, en die hoort hier gewoon te mogen. Twee van de
           vier ingangen van de homescreen sturen door zodra hun eigen script
           klaar is, en dat kan NA de rust vallen -- dan sterft de meting op een
           vernielde context. Dat is geen defect maar precies wat een ingang
           doet. Kwam de pagina ergens anders uit, dan is dit pad niet meer wat
           we meten: de bestemming staat zelf ook in deze lijst en wordt daar
           geteld. Zonder deze vangst zakte de toets op "Execution context was
           destroyed" en las dat als een breuk in de balk. */
        const meet = () => page.evaluate(() => ({
          eigen: document.querySelectorAll('.os-aibalk').length,
          metgezel: document.querySelectorAll('.mgz-balk').length
        }));
        let r;
        try { r = await meet(); }
        catch (e) {
          if (!/Execution context was destroyed|Target closed|Target page/.test(String(e && e.message))) throw e;
          await wachtOpRust(page);
          if (new URL(page.url()).pathname !== pad) continue;
          r = await meet();
        }
        const totaal = r.eigen + r.metgezel;
        if (totaal > 1) {
          fouten.push(pad + ': ' + totaal + ' balken (eigen ' + r.eigen + ', metgezel ' + r.metgezel + ')');
        }
        // en op de homescreen hoort de EIGEN balk het te zijn, niet die van de laag
        if (thuisPaden.includes(pad) && r.metgezel > 0) {
          fouten.push(pad + ': de homescreen kreeg de balk van metgezel.js erbij');
        }
      } finally { await page.close(); }
    }
    assert.deepEqual(fouten, [], 'dubbele balk van Rahul:\n' + fouten.join('\n'));

    /* De census stond eerst in een tweede top-level test. Op GitHub sloot de
       eerste Chromium netjes na 25 seconden, maar de volgende chromium.launch
       kwam 89 minuten lang niet terug. Hergebruik daarom deze al bewezen
       browser en context. De bewering blijft hetzelfde: ieder app-scherm wordt
       echt geopend en draagt een menu of, bij de modale Foundation-poort, een
       veilige uitweg. Eén pagina tegelijk houdt samen met de tweede fileworker
       de totale browserparalleliteit op twee. */
    await t.test('elke app-pagina draagt het app-menu of een beveiligde uitweg',
      { skip: geenBrowser(pw) }, async () => {
      const menuFouten = [];
      let gemeten = 0;
      for (const pad of appPaden()) {
        const page = await ctx.newPage();
        await volgVerzoeken(page);
        try {
          await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await wachtOpRust(page);
          let meedoen;
          try {
            meedoen = await page.evaluate(() => !document.body.hasAttribute('data-ios-uit') &&
              !document.body.hasAttribute('data-ios-home'));
          } catch (e) { continue; }
          if (!meedoen || new URL(page.url()).pathname !== pad) continue;
          try {
            await page.waitForSelector('#osMenuBtn, #rtf-toegang-slot [data-rtf-uitweg]',
              { timeout: 8000 });
            gemeten++;
          } catch (e) {
            if (new URL(page.url()).pathname === pad) menuFouten.push(pad);
          }
        } finally {
          /* Een defecte renderer mag ook het opruimen niet onbeperkt vasthouden;
             de context wordt aan het eind sowieso door browser.close gesloten. */
          await Promise.race([
            page.close().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 5000))
          ]);
        }
      }
      assert.ok(gemeten > 100, 'te weinig pagina\'s gemeten (' + gemeten + '): dan bewijst groen niets');
      assert.deepEqual(menuFouten, [],
        'deze app-pagina\'s hebben geen app-menu of veilige uitweg:\n' + menuFouten.join('\n'));
      });
  });
});

test('het menu opent en brengt je terug naar het beginscherm',
  { skip: geenBrowser(pw) }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.goto(base + '/apps/wallet.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osMenuBtn', { timeout: 10000 });
    await page.click('#osMenuBtn');
    await page.waitForSelector('.amn-scrim.amn-open', { timeout: 5000 });

    const inhoud = await page.evaluate(() => ({
      tegels: [...document.querySelectorAll('.amn-tegel')].map((b) => b.textContent.trim()),
      rijen: [...document.querySelectorAll('.amn-rij')].map((b) => b.textContent.trim())
    }));
    /* "Deze app": gelezen uit het scherm zelf, niet met de hand opgeschreven.
       De wallet draagt zijn eigen schakelrij (Passen, Tickets, Sleutels...), en
       die hoort dus in het menu te staan. Staat er niets, dan is de hele
       vondstlaag stilgevallen -- precies het soort storing dat je niet ziet. */
    assert.ok(inhoud.tegels.length > 0, 'het menu vond geen enkele functie van de app zelf');
    assert.ok(inhoud.rijen.some((t) => /Beginscherm/i.test(t)), 'geen weg naar het beginscherm');
    assert.ok(inhoud.rijen.some((t) => /Instellingen/i.test(t)), 'geen ingang naar de instellingen');

    // Escape sluit, en dan brengt de rij "Beginscherm" je ook echt thuis
    await page.keyboard.press('Escape');
    await page.waitForSelector('.amn-scrim.amn-open', { state: 'detached', timeout: 3000 }).catch(() => {});
    assert.equal(await page.evaluate(() => !!document.querySelector('.amn-scrim.amn-open')), false,
      'Escape sluit het menu niet');

    await page.click('#osMenuBtn');
    await page.waitForSelector('.amn-scrim.amn-open', { timeout: 5000 });
    await page.evaluate(() => {
      const rij = [...document.querySelectorAll('.amn-rij')].find((b) => /Beginscherm/i.test(b.textContent));
      rij.click();
    });
    await page.waitForURL(/\/apps\/app\.html/, { timeout: 8000 });
    assert.match(new URL(page.url()).pathname, /\/apps\/app\.html$/, 'het menu brengt je niet thuis');
    await page.close();
  });
});

test('het beginscherm draagt geen gereedschapskist: het systeem komt van de bank en van de bovenrand',
  { skip: geenBrowser(pw) }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    /* Een vers geregistreerd lid staat nog in de intake, en die legt een blad
       over het hele scherm. hidden is het signaal waarop Command wacht;
       verwijderen vóór die MutationObserver heeft gelopen laat de werktafel in
       de toestand "ondertekening open" staan. */
    await wachtWerelden(page);

    /* HET BEGINSCHERM IS DE RUSTPLEK, en dat is nu de werktafel.

       Deze toets mat de statusbalk van het springboard: geen batterij, geen
       bel, geen hamburger, en precies EEN deur (die naar het bedieningspaneel).
       Het springboard is geen scherm meer (WERELD.md), dus is die hele balk uit
       beeld -- en daarmee zou de eis verdampen tot "je ziet niets", wat elke
       kapotte versie ook haalt.

       Wat de eis WAS blijft daarom staan, alleen op de plek waar hij nu geldt:
       de knoppen mogen bestaan (het paneel en de rest van de app klikken ze
       aan, en dat is de enige plek waar hun gedrag staat), ze horen alleen niet
       in beeld. En de weg naar het systeem moet er wel zijn -- dat is de helft
       die stil kapot kan. Knoppen weghalen is zichtbaar; een ingang die niemand
       meer heeft niet. */
    const beeld = await page.evaluate(() => {
      const zichtbaar = (id) => {
        const e = document.getElementById(id);
        if (!e) return null;                  // null = bestaat niet meer
        const b = e.getBoundingClientRect(), s = getComputedStyle(e);
        return !e.hidden && s.display !== 'none' && s.visibility !== 'hidden' &&
          Number(s.opacity || 1) > 0 && b.width > 0 && b.height > 0;
      };
      return {
        bel: zichtbaar('bell'), paneelknop: zichtbaar('osCcBtn'), accu: zichtbaar('osBat'),
        hamburger: !!document.getElementById('osMenuBtn'),
        groet: !!document.getElementById('homeGreeting'),
        paneelBestaat: !!document.getElementById('osCcBtn'),
        zichtbaarRechts: [...document.querySelectorAll('.topbar .os-rechts button')]
          .filter((e) => { const b = e.getBoundingClientRect(), s = getComputedStyle(e);
            return !e.hidden && s.display !== 'none' && s.visibility !== 'hidden' &&
              Number(s.opacity || 1) > 0 && b.width > 0 && b.height > 0; })
          .map((b) => b.id || b.className)
      };
    });
    assert.equal(beeld.bel, false, 'de bel staat in beeld op het beginscherm');
    assert.equal(beeld.accu, false, 'de batterij staat in beeld op het beginscherm');
    assert.equal(beeld.hamburger, false, 'het beginscherm hoort geen hamburger te hebben');
    assert.equal(beeld.groet, false, 'de begroeting hoort van het beginscherm af te zijn');
    assert.equal(beeld.paneelknop, false, 'de statusbalk van het springboard staat weer in beeld');
    assert.deepEqual(beeld.zichtbaarRechts, [],
      'er staat nog een knop van de oude statusbalk in beeld: ' + beeld.zichtbaarRechts.join(', '));
    /* De knop moet wel BLIJVEN bestaan: de deur in de bank klikt hem aan, en
       daar staat het gedrag. Verdwijnt hij, dan valt die deur stil. */
    assert.equal(beeld.paneelBestaat, true,
      'de knop van het bedieningspaneel is uit de DOM verdwenen; dan klikt de deur in de bank niets meer aan');

    /* DEUR EEN: de voet van de bank. Dit is de vervanger van de knop in de
       statusbalk, en de enige zichtbare weg naar uitloggen. */
    await openLade(page);
    const deuren = await page.evaluate(() =>
      [...document.querySelectorAll('#rtgCommand .cmd-bankvoet button')].map((b) => b.textContent.trim()));
    assert.ok(deuren.some((t) => /^Instellingen$/i.test(t)),
      'de voet van de bank heeft geen deur naar het bedieningspaneel, gevonden: ' + deuren.join(', '));
    /* Op NAAM en niet op positie: er staan twee systeemdeuren in de voet
       (Rahul boven het bedieningspaneel), dus `[data-systeem]` pakte de
       eerste en opende het vraagveld van Rahul. */
    await page.locator('#rtgCommand .cmd-bankvoet button', { hasText: 'Instellingen' }).first().click();
    await page.waitForSelector('#osCcScrim.open', { timeout: 8000 });
    assert.equal(await page.evaluate(() => {
      const s = document.getElementById('osCcScrim').getBoundingClientRect();
      return s.width > 0 && s.height > 0;
    }), true, 'het bedieningspaneel gaat wel open maar staat niet in beeld boven de werktafel');

    const tegels = await page.evaluate(() =>
      [...document.querySelectorAll('.os-cc-tegels button')].filter((b) => !b.hidden)
        .map((b) => b.textContent.trim()));
    for (const woord of ['Meldingen', 'Zoeken', 'Scannen', 'Zegel', 'backoffice', 'Uitloggen']) {
      assert.ok(tegels.some((t) => new RegExp(woord, 'i').test(t)),
        woord + ' ontbreekt in het bedieningspaneel');
    }
    // en de tegel doet het echt: hij klikt de verborgen bel aan
    await page.click('#osCcBel');
    await wachtTot(page, () => {
      const p = document.getElementById('notifPanel');
      return !!(p && p.classList.contains('open'));
    }, null, { wat: 'het geopende meldingenpaneel' });
    assert.equal(await page.evaluate(() => {
      const p = document.getElementById('notifPanel');
      return !!(p && p.classList.contains('open'));
    }), true, 'de tegel Meldingen opent het meldingenpaneel niet');

    /* DEUR TWEE: de bovenrand omlaag halen (shared/randen.js). Die luistert op
       document mee, dus hij werkt boven de werktafel net zo goed als hij boven
       het springboard werkte -- maar dat is precies het soort ding dat stil
       stukgaat als er een laag bij komt. */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    await page.mouse.move(196, 4);
    await page.mouse.down();
    /* Een veeg is een REEKS bewegingen, geen sprong -- daar had die 40 ms mee te
       maken. Playwright doet dat zelf met `steps`, en dan is het geen wachttijd
       meer maar een beweging met tussenstappen. */
    for (const y of [20, 50, 90, 130]) await page.mouse.move(196, y, { steps: 4 });
    await page.mouse.up();
    await wachtTot(page, () => {
      const s = document.getElementById('osCcScrim');
      return !!(s && s.classList.contains('open'));
    }, null, { wat: 'het bedieningspaneel dat de bovenrand opent' });
    assert.equal(await page.evaluate(() => {
      const s = document.getElementById('osCcScrim');
      return !!(s && s.classList.contains('open'));
    }), true, 'de bovenrand opent het bedieningspaneel niet boven de werktafel');
    await page.close();
  });
});

test('de bank zet de vier werelden bovenaan, en het springboard is weg',
  { skip: geenBrowser(pw) }, async () => {
  /* DEZE TOETS IS MEEVERHUISD MET WAT HIJ MEET.

     Hij mat de voordeur: drie wereldtegels (er zijn er nu vier) als één
     gecentreerde rij op het
     springboard, met de klok eronder en de balk van Rahul aan de onderrand.
     Dat springboard is geen scherm meer -- het beginscherm is de werktafel van
     RTG Command (WERELD.md) -- en de werelden staan nu bovenaan de bank.

     Wat hetzelfde bleef is de VRAAG: staan de werelden er, staan ze
     bovenaan, en zijn ze echt te zien? Een rij die op nul pixels staat of onder
     de software wegzakt komt door elke telling heen. Wat er bij komt is de
     andere helft van dezelfde afspraak: het springboard mag NIET meer in beeld
     komen. Zonder die meting is "de pagina is weg" een bewering.

     DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: haal in shared/command/bank.js
     het kopje "Werelden" en de wereld-lus uit vul() -- dan houdt de bank alleen
     software. Of haal de springboard-regel uit command.css: dan staat het
     scherm er weer onder. */
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    // op een telefoon is de bank een lade; open hem zoals een lid dat doet
    await openLade(page);

    const b = await werelden(page);
    /* EEN KOPJE EN NIET TWEE. Er stond ook "Software" met twaalf apps eronder
       die in geen wereld hingen; dat is weg (WERELDEN.md) en die twaalf staan
       nu in hun eigen wereld. De bank draagt navigatie en geen tweede
       voorraadkast. */
    assert.deepEqual(b.koppen, ['Werelden'],
      'de bank hoort alleen werelden te dragen, gevonden: ' + b.koppen.join(', '));
    assert.deepEqual(b.werelden.map((w) => w.url),
      ['/apps/rtg.html', '/apps/kantoor.html', '/apps/reizen.html', '/apps/foundation/os-publiek.html'],
      'de bank hoort exact LivingOS, WorkOS, TravelOS en FoundationOS bovenaan te dragen');
    const onzichtbaar = b.werelden.filter((w) => w.breed < 8 || w.hoog < 8);
    assert.deepEqual(onzichtbaar.map((w) => w.naam), [],
      'deze werelden staan wel in de bank maar zijn nul groot');
    const volgorde = b.werelden.map((w) => w.top);
    assert.deepEqual(volgorde.slice().sort((x, y) => x - y), volgorde,
      'de werelden staan niet op volgorde onder elkaar');

    /* EN HET SPRINGBOARD KOMT NIET TERUG. Het bestaat nog als registry -- de
       bank en Spotlight worden eruit gevuld -- maar het is geen scherm meer. */
    const schil = await page.evaluate(() => {
      const zichtbaar = (s) => {
        const e = document.querySelector(s);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      return { springboard: zichtbaar('.os-thuisscherm'), balk: zichtbaar('#osAiBalk'),
        topbar: zichtbaar('.topbar'), klok: !!document.getElementById('homeKlok') };
    });
    assert.equal(schil.springboard, false, 'het springboard staat weer in beeld');
    assert.equal(schil.balk, false, 'de balk van Rahul van het springboard staat weer in beeld');
    assert.equal(schil.topbar, false, 'de statusbalk van het springboard staat weer in beeld');
    assert.equal(schil.klok, false, 'de klok is terug op het beginscherm');
    await page.close();
  });
});

test('elke hoofdwereld houdt een volwaardig beeldmerk op de instappas',
  { skip: geenBrowser(pw) }, async () => {
  /* PREMIUMRECHTEN VERANDEREN DE INHOUD, NIET DE KWALITEIT VAN DE VOORDEUR.
     Een RTG-pas ziet minder onderdelen dan Lifestyle of Business, maar krijgt
     dezelfde vier volledige huizen (WERELDEN.md). Daarom toetst dit pad bewust
     met de instappas: geen hoofdwereld mag daar terugvallen op een kaal
     monogram of verdwijnen. TravelOS is de kleinste van de vier en juist
     daarom de scherpste meting: elf onderdelen zijn genoeg voor een wereld,
     maar niet als hij zijn beeldmerk kwijtraakt.

     DE METING IS DRIE KEER VERHUISD, en dat hoort hier te staan.

     Eerst telde deze toets tegels in een OPENGEKLIKTE map. Toen werelden apps
     werden, telde hij de minitegels op de wereldtegel -- en die telling ving
     meteen iets echts: de minitegels toonden alleen wat op JOUW pas zichtbaar
     is, dus op de instappas stond RTG Leven er met drie snippers en
     RTFoundation met een. De instap oogde budget, precies wat de merkregel
     verbiedt. De oplossing was niet een lagere lat maar EEN glyf die op elke
     pas even vol is.

     Nu is de tegel zelf verhuisd: het springboard is geen scherm meer en de
     werelden staan in de bank van de werktafel (WERELD.md). De glyf ging mee --
     dezelfde uit RTGGlyf, dezelfde als op hun huis -- en de eis dus ook.

     DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: geef een wereld in
     app-main-24a2.js een glyf-naam die niet bestaat ('map-rtg' ->
     glyf: 'bestaatniet'). De deur in de bank valt dan terug op het standaard
     icoon van Command in plaats van het eigen merkteken. */
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    await openLade(page);

    const b = await werelden(page);
    assert.deepEqual(b.werelden.map((w) => w.url),
      ['/apps/rtg.html', '/apps/kantoor.html', '/apps/reizen.html', '/apps/foundation/os-publiek.html'],
      'de bank hoort exact LivingOS, WorkOS, TravelOS en FoundationOS te dragen');
    const kaal = b.werelden.filter((w) => !w.glyf);
    assert.deepEqual(kaal.map((w) => w.naam), [],
      'deze werelden dragen geen eigen glyf maar het standaard icoon:\n' +
      b.werelden.map((w) => '  ' + w.naam + ': ' + (w.glyf ? 'glyf' : 'terugval')).join('\n'));
    await page.close();
  });
});

test('elke wereld in de bank opent ook echt zijn huis, als werkblad',
  { skip: geenBrowser(pw) }, async () => {
  /* DIT IS NIET AAN DE BRON TE ZIEN EN OOK NIET AAN EEN GROENE TELTOETS.

     Een deur die er goed uitziet en niets doet komt door elke telling heen. Dat
     gold toen de werelden tegels op het springboard waren -- die navigeerden
     naar hun huis -- en het geldt nu ze deuren in de bank zijn. Alleen de
     uitkomst is anders: een wereld opent nu als WERKBLAD in de werktafel en
     verlaat de pagina niet. Dat verschil is het hele punt van de werktafel, dus
     wordt het hier gemeten en niet aangenomen.

     DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: haal `wereld` van een van de
     mappen in app-main-24a2.js weg. Die wereld valt dan uit de aanreiking
     (app-main-29c.js filtert erop) en staat niet meer in de bank. */
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);

    const b = await werelden(page);
    for (const w of b.werelden) {
      await openLade(page);
      await page.click('#rtgCommand .cmd-nav button[data-url="' + w.url + '"]');
      await page.waitForFunction((url) => {
        const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe') ||
                  document.querySelector('#rtgCommand .cmd-pane iframe');
        return !!(f && f.getAttribute('src') === url);
      }, w.url, { timeout: 10000 });
      // en we zijn de werktafel niet kwijtgeraakt: een blad is geen navigatie
      assert.match(new URL(page.url()).pathname, /\/apps\/app\.html$/,
        'de wereld "' + w.naam + '" verliet de werktafel in plaats van een werkblad te openen');
      const titels = await page.evaluate(() =>
        [...document.querySelectorAll('#rtgCommand .cmd-balkblad')].map((t) => t.textContent.trim()));
      assert.ok(titels.length > 0, 'de wereld "' + w.naam + '" opende geen werkblad');
    }
    await page.close();
  });
});

test('TravelOS gebruikt mobiel één veilige onderbalk met alle vier reisbladen',
  { skip: geenBrowser(pw) }, async () => {
  /* Dit is het scherm uit de praktijk: 393×852, TravelOS geopend vanuit de
     wereldbank. De fout bestond niet op /apps/reizen.html alleen, maar in de
     combinatie van zijn vaste .hoofdtabs met de vaste .cmd-balk eromheen. */
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    await openLade(page);
    await page.click('#rtgCommand .cmd-nav button[data-url="/apps/reizen.html"]');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const h = f && f.contentDocument && f.contentDocument.documentElement;
      return !!(h && h.classList.contains('rtg-command-mobiel') &&
        f.contentDocument.querySelector('.prestatiekop'));
    }, null, { timeout: 20000 });
    await page.waitForSelector('#rtgCommand .cmd-balk[data-zone="acties"]', { timeout: 20000 });

    /* Chromium heeft geen iPhone-notch. De bronregel gebruikt daarom een
       overschrijfbare variabele met env() als echte terugval; zo meet deze toets
       dezelfde 47px die de bovenste uitsparing op het toestel opeist. */
    await page.evaluate(async () => {
      document.getElementById('rtgCommand').style.setProperty('--rtg-command-safe-top', '47px');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    const maat = await page.evaluate(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const doc = f.contentDocument;
      const balk = document.querySelector('#rtgCommand .cmd-balk');
      const eigen = doc.querySelector('.hoofdtabs');
      const werelden = doc.querySelector('.os-switcher');
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' &&
        el.getBoundingClientRect().height > 0);
      return {
        frameTop: Math.round(f.getBoundingClientRect().top),
        schilbalk: zichtbaar(balk),
        eigenBalk: zichtbaar(eigen),
        wereldbalk: zichtbaar(werelden),
        onderbalken: [balk, eigen].filter(zichtbaar).length,
        navRuimte: getComputedStyle(doc.documentElement).getPropertyValue('--nav').trim(),
        acties: [...document.querySelectorAll('#rtgCommand .cmd-actie')].map(b => b.dataset.cap),
        heeftMeer: zichtbaar(document.querySelector('#rtgCommand .cmd-meer'))
      };
    });
    assert.ok(maat.frameTop >= 47,
      'TravelOS begint onder de iPhone-statusbalk, gemeten top: ' + maat.frameTop);
    assert.equal(maat.wereldbalk, false, 'de wereldwisselaar wordt in het mobiele werkblad dubbel getoond');
    assert.equal(maat.eigenBalk, false, 'de lokale TravelOS-balk wordt naast de schilbalk getoond');
    assert.equal(maat.schilbalk, true, 'de ene schilbalk met menu en sluiten hoort bereikbaar te blijven');
    assert.equal(maat.onderbalken, 1, 'onderaan hoort exact één vaste navigatiebalk te staan');
    assert.equal(maat.navRuimte, '0px', 'de verborgen lokale balk laat nog lege ruimte achter');
    assert.ok(maat.acties.length || maat.heeftMeer, 'de TravelOS-tabhandelingen bereikten de ene balk niet');

    async function kies(id, label, blad) {
      const direct = page.locator('#rtgCommand .cmd-actie[data-cap="' + id + '"]');
      if (await direct.count() && await direct.first().isVisible()) {
        await direct.first().click();
      } else {
        const meer = page.locator('#rtgCommand .cmd-meer');
        assert.equal(await meer.isVisible(), true, label + ' is niet zichtbaar en ook niet bereikbaar via Meer');
        await meer.click();
        await page.locator('.rtg-laag .lg-rij', { hasText: label }).click();
      }
      await page.waitForFunction((naam) => {
        const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
        const b = f && f.contentDocument && f.contentDocument.querySelector('[data-blad="' + naam + '"]');
        return !!(b && !b.hidden);
      }, blad, { timeout: 10000 });
    }
    await kies('reizen.reizen', 'Reizen', 'reizen');
    await page.waitForFunction(() => {
      const s = window.RTGAdaptief && window.RTGAdaptief.context().staat;
      return !!(s && s['reizen.reizen'] && s['reizen.reizen'].aan &&
        !document.querySelector('.rtg-laag'));
    }, null, { timeout: 10000 });
    const toetsenbord = page.locator('#rtgCommand .cmd-actie[data-cap="reizen.vandaag"]');
    assert.equal(await toetsenbord.isVisible(), true, 'Vandaag hoort direct met het toetsenbord bereikbaar te zijn');
    await toetsenbord.focus();
    assert.deepEqual(await page.evaluate(() => ({ tag: document.activeElement && document.activeElement.tagName,
      klasse: document.activeElement && document.activeElement.className,
      cap: document.activeElement && document.activeElement.dataset.cap })),
    { tag: 'BUTTON', klasse: 'cmd-actie', cap: 'reizen.vandaag' },
    'de TravelOS-handeling moet focus kunnen ontvangen');
    await toetsenbord.press('Enter');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const b = f && f.contentDocument && f.contentDocument.querySelector('[data-blad="vandaag"]');
      const s = window.RTGAdaptief && window.RTGAdaptief.context().staat;
      return !!(b && !b.hidden && s && s['reizen.vandaag'] && s['reizen.vandaag'].aan);
    }, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.cap),
      'reizen.vandaag', 'de hertekende actierij hoort toetsenbordfocus op dezelfde handeling te houden');
    await kies('reizen.taxi', 'Taxi', 'taxi');
    assert.match(await page.evaluate(() => localStorage.getItem('rtg_cmd_bladen') || ''), /reizen\.html#taxi/,
      'Continuity bewaart niet het lokaal gekozen TravelOS-blad');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const b = f && f.contentDocument && f.contentDocument.querySelector('[data-blad="taxi"]');
      return !!(f && f.contentWindow.location.hash === '#taxi' && b && !b.hidden);
    }, null, { timeout: 20000 });
    await kies('reizen.rahul', 'Rahul', 'rahul');
    await kies('reizen.vandaag', 'Vandaag', 'vandaag');

    /* Een inactief frame mag de balk niet overnemen, maar moet zijn context
       opnieuw aanbieden zodra het weer actief wordt. Zonder deze heen-en-
       terugweg verdween de enige mobiele bediening na een werkbladwissel. */
    await openLade(page);
    await page.click('#rtgCommand .cmd-nav button[data-url="/apps/kantoor.html"]');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      return !!(f && f.getAttribute('src') === '/apps/kantoor.html');
    }, null, { timeout: 10000 });
    await openLade(page);
    await page.click('#rtgCommand .cmd-nav button[data-url="/apps/reizen.html"]');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      if (!f || f.getAttribute('src') !== '/apps/reizen.html') return false;
      const c = window.RTGAdaptief && window.RTGAdaptief.context();
      return !!(c && c.bron === 'reizen.tabs' && c.acties.includes('reizen.taxi'));
    }, null, { timeout: 10000 });
    await kies('reizen.taxi', 'Taxi', 'taxi');

    /* Dezelfde pagina mag op bureau niet kaal worden: daar bestaat de mobiele
       schilbalk niet en blijft de eigen TravelOS-navigatie dus eigenaar. */
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      return !!(f && f.contentDocument &&
        !f.contentDocument.documentElement.classList.contains('rtg-command-mobiel'));
    }, null, { timeout: 10000 });
    const bureau = await page.evaluate(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const tabs = f.contentDocument.querySelector('.hoofdtabs');
      const schil = document.querySelector('#rtgCommand .cmd-balk');
      return { tabs: getComputedStyle(tabs).display !== 'none' && tabs.getBoundingClientRect().height > 0,
        schil: getComputedStyle(schil).display !== 'none' && schil.getBoundingClientRect().height > 0 };
    });
    assert.equal(bureau.tabs, true, 'op bureau hoort TravelOS zijn eigen navigatie te behouden');
    assert.equal(bureau.schil, false, 'de mobiele schilbalk hoort niet naar bureau te lekken');
    await page.close();
  });
});

test('Reizen & Veilig opent vervoer als direct RTG-werkblad met één onderbalk',
  { skip: geenBrowser(pw) }, async () => {
  /* Dit is de tweede echte-toestelroute: LivingOS navigeert zijn bestaande
     Command-frame naar Reizen & Veilig. Gaan wordt vervolgens een direct
     tweede Command-blad; de vroegere derde framelaag kon een derde balk tekenen. */
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    await openLade(page);
    await page.click('#rtgCommand .cmd-nav button[data-url="/apps/rtg.html"]');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      return !!(f && f.contentDocument && /\/apps\/rtg\.html$/.test(f.contentWindow.location.pathname));
    }, null, { timeout: 20000 });

    const living = page.frameLocator('#rtgCommand .cmd-pane.actief iframe');
    await living.locator('a[href="/apps/reizen-veilig.html"]:visible').first().click();
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const c = window.RTGAdaptief && window.RTGAdaptief.context();
      return !!(f && f.contentDocument && f.contentDocument.documentElement &&
        f.contentWindow.location.pathname === '/apps/reizen-veilig.html' &&
        f.contentDocument.documentElement.classList.contains('rtg-command-mobiel') &&
        c && c.bron === 'reizen-veilig.bank');
    }, null, { timeout: 20000 });

    const begin = await page.evaluate(() => {
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' &&
        el.getBoundingClientRect().height > 0);
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const doc = f.contentDocument;
      return {
        acties: window.RTGAdaptief.context().acties,
        schil: zichtbaar(document.querySelector('#rtgCommand .cmd-balk')),
        bank: zichtbaar(doc.querySelector('#rvApp > .rv-bank')),
        rahul: zichtbaar(doc.querySelector('#rvApp > .rv-rahul')),
        rasterrijen: getComputedStyle(doc.querySelector('#rvApp')).gridTemplateRows.trim().split(/\s+/).length
      };
    });
    assert.deepEqual(begin.acties, [
      'reisveilig.overzicht', 'reisveilig.vervoer', 'reisveilig.reisblad',
      'reisveilig.veilig', 'reisveilig.navigatie', 'reisveilig.instellingen'
    ], 'alle zes handelingen van Reizen & Veilig horen de ene buitenbalk te bereiken');
    assert.equal(begin.schil, true, 'de Command-balk met menu en sluiten hoort te blijven');
    assert.equal(begin.bank, false, 'de lokale Reizen & Veilig-bank staat dubbel in beeld');
    assert.equal(begin.rahul, false, 'de lokale Rahul-balk staat naast de Rahul van Command');
    assert.equal(begin.rasterrijen, 1, 'de verborgen bank laat nog een lege rasterrij achter');

    /* Ook een gewone specialist-link blijft hetzelfde directe werkblad. Zo'n
       route heeft geen embed-query, dus bewaakt de hostmarker zelf dat de
       TravelOS-balk en haar gereserveerde ruimte niet terugkomen. */
    const rvFrame = page.frameLocator('#rtgCommand .cmd-pane.actief iframe');
    await rvFrame.locator('.rv-specialisten summary').click();
    await rvFrame.locator('.rv-specialisten a[href="/apps/vluchten.html"]').click();
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe'), doc = f && f.contentDocument;
      return !!(f && doc && doc.documentElement && f.contentWindow.location.pathname === '/apps/vluchten.html' &&
        doc.documentElement.classList.contains('rtg-command-mobiel') && doc.body.classList.contains('travel-os'));
    }, null, { timeout: 20000 });
    assert.deepEqual(await page.evaluate(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe'), doc = f.contentDocument;
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
      return { eigenaren: [document.querySelector('#rtgCommand .cmd-balk'), doc.querySelector('.tos-nav')].filter(zichtbaar).length,
        travel: zichtbaar(doc.querySelector('.tos-nav')),
        onderruimte: getComputedStyle(doc.documentElement).getPropertyValue('--tos-bottom').trim() };
    }), { eigenaren: 1, travel: false, onderruimte: '0px' },
    'een gewone specialist-link brengt de tweede TravelOS-balk terug');
    await page.evaluate(() => document.querySelector('#rtgCommand .cmd-pane.actief iframe').contentWindow.history.back());
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const c = window.RTGAdaptief && window.RTGAdaptief.context();
      return !!(f && f.contentWindow.location.pathname === '/apps/reizen-veilig.html' && c && c.bron === 'reizen-veilig.bank');
    }, null, { timeout: 20000 });

    async function kies(id, label) {
      /* DRIE POGINGEN OP DE DIRECTE KNOP, en dat is geen dobbelsteen wegpoetsen
         maar een race benoemen. De actiebalk van RTG Command wordt opnieuw
         getekend zodra het blad van context wisselt; klikt de toets precies
         daartussen, dan verdwijnt de knop onder zijn handen ("element was
         detached from the DOM"). Dat is gedrag dat er hoort te zijn -- de balk
         volgt het blad -- en het is geen fout die een gebruiker treft: die
         drukt op wat hij ziet, en ziet de nieuwe balk.

         Gemeten op 30 augustus 2026: deze toets zakte zo ongeveer twee van de
         vijf keer, met en zonder de wijzigingen van die dag. Opnieuw pakken is
         hier dus de juiste reparatie; een langere wachttijd zou de race alleen
         onzichtbaar maken. */
      const directeKnop = () => page.locator('#rtgCommand .cmd-actie[data-cap="' + id + '"]');
      for (let poging = 0; poging < 3; poging++) {
        const direct = directeKnop();
        if (!(await direct.count()) || !(await direct.first().isVisible())) break;
        try { await direct.first().click({ timeout: 7000 }); return; }
        catch (e) {
          if (poging === 2) throw e;
          /* Op de knop wachten en niet op een klok (test/klokwacht.test.js):
             de balk is opnieuw aan het tekenen, dus we wachten tot er weer een
             knop met dit vermogen IN de balk staat. */
          await page.waitForSelector('#rtgCommand .cmd-actie[data-cap="' + id + '"]',
            { state: 'attached', timeout: 7000 }).catch(() => {});
        }
      }
      {
        const meer = page.locator('#rtgCommand .cmd-meer');
        assert.equal(await meer.isVisible(), true, label + ' is ook niet via Meer bereikbaar');
        await meer.click();
        await page.locator('.rtg-laag .lg-rij', { hasText: label }).click();
      }
    }

    await kies('reisveilig.vervoer', 'Gaan');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      return !!(f && f.contentDocument && f.contentDocument.body &&
        f.contentWindow.location.pathname === '/apps/ov.html' &&
        f.contentDocument.body.classList.contains('travel-os') &&
        f.contentDocument.documentElement.classList.contains('tos-ingebed') &&
        document.querySelectorAll('#rtgCommand > .cmd-werk > .cmd-panes > .cmd-pane').length === 2);
    }, null, { timeout: 20000 });
    const vervoer = await page.evaluate(() => {
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' &&
        el.getBoundingClientRect().height > 0);
      const buiten = document.querySelector('#rtgCommand .cmd-balk');
      const frames = [...document.querySelectorAll('#rtgCommand > .cmd-werk > .cmd-panes > .cmd-pane > iframe')];
      const rv = frames.find(f => f.contentWindow.location.pathname === '/apps/reizen-veilig.html');
      const leaf = frames.find(f => f.contentWindow.location.pathname === '/apps/ov.html');
      const bank = rv.contentDocument.querySelector('#rvApp > .rv-bank');
      const lokaal = leaf.contentDocument.querySelector('.tos-nav');
      const stijl = getComputedStyle(leaf.contentDocument.documentElement);
      return {
        eigenaren: [buiten, bank, lokaal].filter(zichtbaar).length,
        schil: zichtbaar(buiten), bank: zichtbaar(bank), travel: zichtbaar(lokaal),
        marker: leaf.contentDocument.documentElement.classList.contains('tos-ingebed'),
        embed: leaf.contentWindow.location.search,
        rail: stijl.getPropertyValue('--tos-rail').trim(),
        onderruimte: stijl.getPropertyValue('--tos-bottom').trim(),
        diepte: frames.reduce((n, f) => n + f.contentDocument.querySelectorAll('iframe').length, 0),
        paden: frames.map(f => f.contentWindow.location.pathname)
      };
    });
    assert.equal(vervoer.eigenaren, 1, 'Command, Reizen & Veilig en OV tekenen samen meer dan één onderbalk');
    assert.deepEqual({ schil: vervoer.schil, bank: vervoer.bank, travel: vervoer.travel },
      { schil: true, bank: false, travel: false }, 'de verkeerde laag is eigenaar van de onderbalk');
    assert.equal(vervoer.marker, true, 'OV herkent niet dat Command zijn navigatie al draagt (' +
      vervoer.embed + ')');
    assert.match(vervoer.embed, /(?:^|[?&])embed=1(?:&|$)/, 'het child-werkblad mist zijn expliciete embed-signaal');
    assert.equal(vervoer.rail, '0px', 'de verborgen TravelOS-rail laat links lege ruimte achter');
    assert.equal(vervoer.onderruimte, '0px', 'de verborgen TravelOS-balk laat onderaan lege ruimte achter');
    assert.equal(vervoer.diepte, 0, 'een direct Command-blad hoort zelf geen nieuw app-frame te maken: ' + vervoer.paden);

    /* Keer naar het bronblad terug. Zijn zes handelingen moeten opnieuw aan de
       buitenbalk worden gemeld; daarna vervangt Navigatie alleen het rechterblad. */
    await page.evaluate(() => {
      const frames = [...document.querySelectorAll('#rtgCommand > .cmd-werk > .cmd-panes > .cmd-pane > iframe')];
      const i = frames.findIndex(f => f.contentWindow.location.pathname === '/apps/reizen-veilig.html');
      document.querySelectorAll('#rtgCommand .cmd-balkblad')[i].click();
    });
    await page.waitForFunction(() => {
      const c = window.RTGAdaptief && window.RTGAdaptief.context();
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      return !!(f && f.contentWindow.location.pathname === '/apps/reizen-veilig.html' &&
        c && c.bron === 'reizen-veilig.bank');
    }, null, { timeout: 10000 });
    await kies('reisveilig.reisblad', 'Reizen');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const p = f && f.contentDocument && f.contentDocument.querySelector('.rv-pane.actief');
      return !!(p && p.dataset.id === 'reisblad' && !p.querySelector('iframe'));
    }, null, { timeout: 10000 });
    await kies('reisveilig.navigatie', 'Navigatie');
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      const doc = f && f.contentDocument;
      return !!(f && doc && doc.documentElement &&
        f.contentWindow.location.pathname === '/apps/navigatie.html' &&
        doc.documentElement.classList.contains('tos-ingebed') &&
        !doc.querySelector('.tos-nav') &&
        document.querySelectorAll('#rtgCommand > .cmd-werk > .cmd-panes > .cmd-pane').length === 2);
    }, null, { timeout: 20000 });

    /* De terugdeur van een ingebed moduleblad blijft binnen TravelOS en houdt
       embed=1 vast. Een kale app-shell-link mag hier niet meer bestaan. */
    const terugAdres = await page.frameLocator('#rtgCommand .cmd-pane.actief iframe')
      .locator('.tos-mark').getAttribute('href');
    assert.equal(terugAdres, '/apps/reizen.html?embed=1#reizen',
      'de ingebedde terugdeur verliest zijn eigenaar- en embedcontract');
    assert.equal(await page.frameLocator('#rtgCommand .cmd-pane.actief iframe')
      .locator('a[href="/apps/app.html"]:visible').count(), 0,
    'een moduleblad biedt opnieuw een geneste app-shell aan');

    /* Ook een programmatische oude Homealias wordt door de host teruggenomen;
       de actieve taak blijft staan en er initialiseert geen child-Command. */
    await page.evaluate(() => {
      document.querySelector('#rtgCommand .cmd-pane.actief iframe').contentWindow.location.href = '/apps/index.html';
    });
    await page.waitForFunction(() => {
      const r = document.getElementById('rtgCommand'), f = r.querySelector('.cmd-pane.actief iframe');
      return r.dataset.rtgSecondScreen === 'panel' && f.contentWindow.location.pathname === '/apps/navigatie.html' &&
        !f.contentDocument.querySelector('#rtgCommand');
    }, null, { timeout: 20000 });
    await page.click('#rtgCommand [data-ss-action="close"]');

    /* Op bureau staan twee directe werkbladen naast elkaar. Reizen & Veilig
       herstelt zijn lokale rail; het ingebedde moduleblad bouwt er geen bij. */
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => {
      const frames = [...document.querySelectorAll('#rtgCommand > .cmd-werk > .cmd-panes > .cmd-pane > iframe')];
      const rv = frames.find(f => f.contentWindow.location.pathname === '/apps/reizen-veilig.html');
      return !!(rv && !rv.contentDocument.documentElement.classList.contains('rtg-command-mobiel'));
    }, null, { timeout: 10000 });
    const bureau = await page.evaluate(() => {
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' &&
        el.getBoundingClientRect().height > 0);
      const frames = [...document.querySelectorAll('#rtgCommand > .cmd-werk > .cmd-panes > .cmd-pane > iframe')];
      const rv = frames.find(f => f.contentWindow.location.pathname === '/apps/reizen-veilig.html');
      const leaf = frames.find(f => f.contentWindow.location.pathname === '/apps/navigatie.html');
      return { bank: zichtbaar(rv.contentDocument.querySelector('#rvApp > .rv-bank')),
        schil: zichtbaar(document.querySelector('#rtgCommand .cmd-balk')),
        kindnav: zichtbaar(leaf && leaf.contentDocument.querySelector('.tos-nav')),
        directeBladen: frames.length };
    });
    assert.deepEqual(bureau, { bank: true, schil: false, kindnav: false, directeBladen: 2 },
      'bureau herstelt niet precies de eigen Reizen & Veilig-rail');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForFunction(() => {
      const f = document.querySelector('#rtgCommand .cmd-pane.actief iframe');
      return !!(f && f.contentDocument && f.contentDocument.documentElement.classList.contains('rtg-command-mobiel'));
    }, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => {
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
      const frames = [...document.querySelectorAll('#rtgCommand > .cmd-werk > .cmd-panes > .cmd-pane > iframe')];
      const rv = frames.find(f => f.contentWindow.location.pathname === '/apps/reizen-veilig.html');
      const leaf = frames.find(f => f.contentWindow.location.pathname === '/apps/navigatie.html');
      return [document.querySelector('#rtgCommand .cmd-balk'), rv.contentDocument.querySelector('#rvApp > .rv-bank'),
        leaf.contentDocument.querySelector('.tos-nav')].filter(zichtbaar).length;
    }), 1, 'na terugdraaien naar telefoon verschijnen de drie balken opnieuw');

    /* Standalone Reizen & Veilig blijft zelf eigenaar. Zowel de merklink als
       een lokale teruglink houden het child in embedmodus; geen app-shell en
       geen tweede TravelOS-balk mogen ontstaan. */
    const los = await ctx.newPage();
    await los.setViewportSize({ width: 393, height: 852 });
    await los.goto(base + '/apps/reizen-veilig.html', { waitUntil: 'domcontentloaded' });
    await los.click('#rvApp [data-open="vervoer"]');
    await los.waitForSelector('#rvPanes .rv-pane.actief iframe[src*="/apps/ov.html"][src*="embed=1"]', { timeout: 20000 });
    const losKind = los.frameLocator('#rvPanes .rv-pane.actief iframe');
    const lokaleTerug = losKind.locator('a[href="/apps/reizen.html?embed=1#reizen"]:not(.tos-mark)').first();
    assert.equal(await lokaleTerug.evaluate(el => getComputedStyle(el).clipPath), 'inset(50%)',
      'het child toont naast de Reizen & Veilig-bank een tweede terugbediening');
    await lokaleTerug.evaluate(el => el.click());
    await los.waitForFunction(() => {
      const f = document.querySelector('#rvPanes .rv-pane.actief iframe');
      const tabs = f && f.contentDocument && f.contentDocument.querySelector('.hoofdtabs');
      return !!(f && f.contentWindow.location.pathname === '/apps/reizen.html' &&
        f.contentWindow.location.search.includes('embed=1') && tabs && getComputedStyle(tabs).display === 'none');
    }, null, { timeout: 20000 });
    await los.evaluate(() => document.querySelector('#rvPanes .rv-pane.actief iframe').contentWindow.history.back());
    await los.waitForFunction(() => document.querySelector('#rvPanes .rv-pane.actief iframe').contentWindow.location.pathname === '/apps/ov.html');
    const ingebedMerk = losKind.locator('.tos-mark');
    assert.equal(await ingebedMerk.evaluate(el => getComputedStyle(el.closest('.tos-topbar')).display), 'none',
      'een childmodule tekent naast Reizen & Veilig opnieuw globale topchrome');
    await ingebedMerk.evaluate(el => el.click());
    await los.waitForFunction(() => {
      const f = document.querySelector('#rvPanes .rv-pane.actief iframe');
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
      return f.contentWindow.location.pathname === '/apps/reizen.html' && !f.contentDocument.querySelector('#rtgCommand') &&
        [document.querySelector('#rvApp > .rv-bank'), f.contentDocument.querySelector('.hoofdtabs')].filter(zichtbaar).length === 1;
    }, null, { timeout: 20000 });
    await los.close();

    const deep = await page.evaluate(() => ({
      bel: RTGCommand.thuisAdres('/apps/app.html?bel=123').diep,
      herstel: RTGCommand.thuisAdres('/apps/app.html?pinherstel=1').diep,
      ai: RTGCommand.thuisAdres('/apps/app.html#ai').diep,
      pas: RTGCommand.thuisAdres('/apps/app.html?pas=business').diep,
      index: RTGCommand.thuisAdres('/apps/index.html').diep
    }));
    assert.deepEqual(deep, { bel: true, herstel: true, ai: true, pas: true, index: false },
      'de host verwart een Home-deeplink met kale Home');
    await page.evaluate(() => {
      document.querySelector('#rtgCommand .cmd-pane.actief iframe').contentWindow.location.href = '/apps/app.html#ai';
    });
    await page.waitForURL(/\/apps\/app\.html#ai$/, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('#rtgCommand').length === 1 &&
      !document.querySelector('#rtgCommand iframe[src*="/apps/app.html"]'), null, { timeout: 20000 });
    await page.close();
  });
});

test('RTG Second Screen groeit van Peek naar Focus zonder tweede navigatie',
  { skip: geenBrowser(pw) }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    await page.route('**/api/comm/inbox', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true,
        gesprekken: [{ titel: 'Rahul', laatste: 'Uw actieve context blijft beschikbaar.',
          at: '2026-08-29T08:00:00.000Z', ongelezen: 1, link: '/apps/app.html' }],
        laden: [], ongelezen: 1 }) }));
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    await page.waitForFunction(() => {
      const r = document.getElementById('rtgCommand');
      return !!(r && r.__rtgSecondScreen && r.dataset.rtgSecondScreen === 'peek');
    }, null, { timeout: 10000 });

    await page.evaluate(() => {
      const r = document.getElementById('rtgCommand');
      r.style.setProperty('--rtg-ss-safe-top', '47px');
      r.style.setProperty('--rtg-ss-safe-bottom', '34px');
      r.style.setProperty('--rtg-command-safe-top', '47px');
      window.RTGUitvoer.bron(() => ({ kolommen: ['veld', 'waarde'], rijen: [['status', 'actief']] }));
    });
    await openLade(page);
    await page.waitForFunction(() => {
      const p = document.querySelector('#rtgCommand .rtg-ss-profile-copy strong');
      const m = document.querySelector('#rtgCommand [data-ss-module="messages"] .rtg-ss-messages');
      return !!(p && p.textContent.includes('Menu Lid') && m && !/laden/i.test(m.textContent));
    }, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => {
      const r = document.getElementById('rtgCommand'), bank = r.querySelector('.cmd-bank'), grip = r.querySelector('.cmd-lade');
      return bank.contains(document.activeElement) && grip.getAttribute('aria-controls') === bank.id;
    }), true, 'Panel neemt toetsenbordfocus niet over van zijn greep');

    const panel = await page.evaluate(() => {
      const r = document.getElementById('rtgCommand'), b = r.querySelector('.cmd-bank');
      const rect = b.getBoundingClientRect();
      const zichtbaar = (el) => !!(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
      return { state: r.dataset.rtgSecondScreen, top: Math.round(rect.top), bottom: Math.round(innerHeight - rect.bottom),
        width: Math.round(rect.width), modules: r.querySelectorAll('[data-ss-module]').length,
        balken: [r.querySelector('.cmd-balk')].filter(zichtbaar).length,
        overloop: b.scrollWidth > b.clientWidth,
        tekst: b.textContent };
    });
    assert.equal(panel.state, 'panel', 'de greep hoort Peek naar Panel te laten groeien');
    assert.ok(panel.top >= 59, 'het Second Screen staat onder de nagebootste iPhone-uitsparing: ' + panel.top);
    assert.ok(panel.bottom >= 94, 'het Second Screen houdt de ene onderdock en thuiszone vrij: ' + panel.bottom);
    assert.ok(panel.width <= 369, 'het paneel loopt buiten de telefoon: ' + panel.width);
    assert.ok(panel.modules >= 5, 'profiel, context, berichten, werelden en deuren horen levende modules te zijn');
    assert.equal(panel.balken, 1, 'het Second Screen mag geen tweede globale navigatie tekenen');
    assert.equal(panel.overloop, false, 'het Second Screen mag horizontaal niet overlopen');
    assert.doesNotMatch(panel.tekst, /Sophie|Yassin|Laura/, 'de referentienamen mogen geen demodata worden');

    /* Een echte Rahul-inboxbron verwijst naar app.html. De centrale hostregel
       houdt dat Home-adres in het Second Screen; er mag geen app-shell als
       werkblad (en dus geen tweede Command) ontstaan. */
    await page.click('#rtgCommand [data-ss-module="messages"] [data-ss-url="/apps/app.html"]');
    assert.equal(await page.evaluate(() => {
      const r = document.getElementById('rtgCommand');
      return r.dataset.rtgSecondScreen === 'panel' &&
        !r.querySelector('.cmd-pane iframe[src*="/apps/app.html"]');
    }), true, 'een inboxlink naar Home bouwt de app-shell in een werkblad');

    await page.click('#rtgCommand [data-ss-action="workspace"]');
    await page.waitForFunction(() => document.getElementById('rtgCommand').dataset.rtgSecondScreen === 'workspace');
    const focusKnop = page.locator('#rtgCommand [data-ss-action="focus"]');
    await focusKnop.click();
    await page.waitForFunction(() => {
      const r = document.getElementById('rtgCommand'), b = r.querySelector('.cmd-bank'), werk = r.querySelector('.cmd-werk');
      return r.dataset.rtgSecondScreen === 'focus' && b.getAttribute('role') === 'dialog' &&
        b.contains(document.activeElement) && werk.hasAttribute('inert') && werk.getAttribute('aria-hidden') === 'true';
    });
    await page.click('#rtgCommand .rtg-ss-header .rtguitvoer-knop');
    await page.waitForFunction(() => {
      const r = document.getElementById('rtgCommand'), laag = r.querySelector('.rtguitvoer-laag');
      return !!(laag && !laag.hidden && r.querySelector('.cmd-bank').contains(laag));
    });
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => {
      const r = document.getElementById('rtgCommand');
      return r.dataset.rtgSecondScreen === 'focus' && r.querySelector('.rtguitvoer-laag').hidden;
    }), true, 'Escape sluit tegelijk de uitvoerdialoog en het Focus-scherm');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('rtgCommand').dataset.rtgSecondScreen === 'workspace');
    assert.equal(await page.evaluate(() => {
      const r = document.getElementById('rtgCommand');
      return document.activeElement === r.querySelector('[data-ss-action="focus"]') &&
        !r.querySelector('.cmd-werk').hasAttribute('inert');
    }), true, 'Focus herstelt de aanroeper of werkruimte niet');
    await page.click('#rtgCommand [data-ss-action="close"]');
    await page.waitForFunction(() => {
      const r = document.getElementById('rtgCommand');
      return r.dataset.rtgSecondScreen === 'peek' && document.activeElement === r.querySelector('.cmd-lade');
    });

    /* Een Living Module gebruikt dezelfde Command-ingang. Hij sluit het paneel
       op telefoon, opent één direct blad en meldt daarna zijn context terug. */
    await openLade(page);
    await page.click('#rtgCommand [data-ss-url="/apps/reizen.html#reizen"]');
    await page.waitForFunction(() => {
      const r = document.getElementById('rtgCommand');
      const f = r.querySelector('.cmd-pane.actief iframe');
      return !!(f && f.contentWindow.location.pathname === '/apps/reizen.html' &&
        r.dataset.rtgSecondScreen === 'peek');
    }, null, { timeout: 20000 });
    await openLade(page);
    await page.waitForFunction(() => {
      const x = document.querySelector('#rtgCommand [data-ss-module="context"]');
      return !!(x && /TravelOS|Reizen/.test(x.textContent));
    }, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => {
      const r = document.getElementById('rtgCommand');
      return [...r.querySelectorAll('.cmd-balk')].filter(x => getComputedStyle(x).display !== 'none').length;
    }), 1, 'na een moduleactie hoort nog steeds één onderdock zichtbaar te zijn');
    await page.click('#rtgCommand [data-ss-action="close"]');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => document.getElementById('rtgCommand').dataset.rtgSecondScreen === 'workspace');
    assert.equal(await page.locator('#rtgCommand .cmd-bank').isVisible(), true,
      'op bureau hoort de vaste Workspace beschikbaar te blijven');
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForFunction(() => document.getElementById('rtgCommand').dataset.rtgSecondScreen === 'peek');
    await page.evaluate(() => document.getElementById('rtgCommand').__rtgSecondScreen.destroy());
    await page.waitForFunction(() => {
      const r = document.getElementById('rtgCommand'), out = document.querySelector('.rtguitvoer-knop');
      return !r.__rtgSecondScreen && !r.querySelector('.rtg-ss-shell') &&
        r.querySelector('.cmd-nav').parentElement === r.querySelector('.cmd-bank') && !r.querySelector('.cmd-werk').inert &&
        !!(out && out.isConnected);
    }, null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => {
      const r = document.getElementById('rtgCommand'), out = document.querySelector('.rtguitvoer-knop');
      return !r.__rtgSecondScreen && !r.querySelector('.rtg-ss-shell') &&
        r.querySelector('.cmd-nav').parentElement === r.querySelector('.cmd-bank') && !r.querySelector('.cmd-werk').inert &&
        !!(out && out.isConnected);
    }), true, 'Second Screen laat na afbreken DOM, focus of uitvoerbediening achter');
    await page.close();
  });
});
