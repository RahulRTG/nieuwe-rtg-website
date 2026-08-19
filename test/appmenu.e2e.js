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
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();

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
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
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
   levert een toets op die soms een tel te vroeg meet. */
async function wachtWerelden(page) {
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return !!(app && app.classList.contains('active') &&
      document.querySelectorAll('#osMappen .os-app').length === 3);
  }, null, { timeout: 60000 });
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

/* De drie werelden zoals ze in de bank staan, in volgorde. De software eronder
   blijft buiten beeld: die komt uit de catalogus van Command en niet uit MAPPEN,
   en deze toetsen gaan over de werelden. */
async function werelden(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('#rtgCommand .cmd-nav');
    const koppen = [...nav.querySelectorAll('.cmd-kop')].map((k) => k.textContent.trim());
    const grens = nav.querySelector('.cmd-kop:nth-of-type(2)');
    const uit = [];
    for (const el of [...nav.children]) {
      if (el === grens) break;
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
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async (t) => {
  await metLid(async ({ base, ctx }) => {
    /* Alle vier de ingangen van de homescreen (zie voordeur.js) plus een paar
       gewone app-pagina's, want daar hoort de balk van metgezel.js juist WEL te
       staan -- eentje. */
    const thuisPaden = ['/', '/apps/', '/apps/index.html', '/apps/bureau.html', '/apps/app.html'];
    const appPagina = ['/apps/muziek.html', '/apps/wallet.html', '/apps/berichten.html'];
    const fouten = [];

    for (const pad of thuisPaden.concat(appPagina)) {
      const page = await ctx.newPage();
      try {
        await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);
        const r = await page.evaluate(() => ({
          eigen: document.querySelectorAll('.os-aibalk').length,
          metgezel: document.querySelectorAll('.mgz-balk').length
        }));
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
      { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
      const menuFouten = [];
      let gemeten = 0;
      for (const pad of appPaden()) {
        const page = await ctx.newPage();
        try {
          await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(200);
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
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
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
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
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
    assert.ok(deuren.some((t) => /Bedieningspaneel/i.test(t)),
      'de voet van de bank heeft geen deur naar het bedieningspaneel, gevonden: ' + deuren.join(', '));
    /* Op NAAM en niet op positie: er staan twee systeemdeuren in de voet
       (Rahul boven het bedieningspaneel), dus `[data-systeem]` pakte de
       eerste en opende het vraagveld van Rahul. */
    await page.locator('#rtgCommand .cmd-bankvoet button', { hasText: 'Bedieningspaneel' }).first().click();
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
    await page.waitForTimeout(500);
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
    for (const y of [20, 50, 90, 130]) { await page.mouse.move(196, y); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => {
      const s = document.getElementById('osCcScrim');
      return !!(s && s.classList.contains('open'));
    }), true, 'de bovenrand opent het bedieningspaneel niet boven de werktafel');
    await page.close();
  });
});

test('de bank zet de drie werelden boven de software, en het springboard is weg',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* DEZE TOETS IS MEEVERHUISD MET WAT HIJ MEET.

     Hij mat de voordeur: drie wereldtegels als één gecentreerde rij op het
     springboard, met de klok eronder en de balk van Rahul aan de onderrand.
     Dat springboard is geen scherm meer -- het beginscherm is de werktafel van
     RTG Command (WERELD.md) -- en de werelden staan nu bovenaan de bank.

     Wat hetzelfde bleef is de VRAAG: staan de drie werelden er, staan ze
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
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    // op een telefoon is de bank een lade; open hem zoals een lid dat doet
    await openLade(page);

    const b = await werelden(page);
    assert.deepEqual(b.koppen, ['Werelden', 'Software'],
      'de bank hoort de werelden van de software te scheiden, gevonden: ' + b.koppen.join(', '));
    assert.deepEqual(b.werelden.map((w) => w.url),
      ['/apps/rtg.html', '/apps/kantoor.html', '/apps/reizen.html', '/apps/foundation/index.html'],
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
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
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
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtWerelden(page);
    await openLade(page);

    const b = await werelden(page);
    assert.deepEqual(b.werelden.map((w) => w.url),
      ['/apps/rtg.html', '/apps/kantoor.html', '/apps/reizen.html', '/apps/foundation/index.html'],
      'de bank hoort exact LivingOS, WorkOS, TravelOS en FoundationOS te dragen');
    const kaal = b.werelden.filter((w) => !w.glyf);
    assert.deepEqual(kaal.map((w) => w.naam), [],
      'deze werelden dragen geen eigen glyf maar het standaard icoon:\n' +
      b.werelden.map((w) => '  ' + w.naam + ': ' + (w.glyf ? 'glyf' : 'terugval')).join('\n'));
    await page.close();
  });
});

test('elke wereld in de bank opent ook echt zijn huis, als werkblad',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
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
