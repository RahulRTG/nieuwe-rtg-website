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

/* Deze toetsen meten bewust de alternatieve rasterstand. Wacht eerst tot het
   lid en de wereldmodule volledig zijn hersteld; een DOM-tegel kan al bestaan
   terwijl de sessie nog bezig is en de standaardring hem een tel later
   verbergt. Daarna schakelen we via dezelfde publieke bediening als de app. */
async function wachtRooster(page) {
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return !!(app && app.classList.contains('active') && window.RTGWereld &&
      document.querySelector('.view[data-view="home"].active') &&
      document.querySelectorAll('#osMappen .os-app').length === 3);
  }, null, { timeout: 60000 });
  /* RTG Command is na de intake de landing en blijft dat. Deze toetsen meten de
     SCHIL eronder -- het toestel met de mappen, de functies en de statusbalk --
     dus volgen ze dezelfde knop "Toestel" als een lid. (Die heette "Beginscherm"
     en had klasse cmd-klok; het beginscherm is de werktafel geworden, zie
     WERELD.md.) Rechtstreeks klikken via de DOM werkt ook wanneer de mobiele
     bank nog dicht is. */
  await page.evaluate(() => {
    const k = document.querySelector('#rtgCommand .cmd-schil');
    if (k) k.click();
  });
  await page.evaluate(() => RTGWereld.zet(false));
  await page.waitForFunction(() => !RTGWereld.aan() &&
    !!document.querySelector('.view[data-view="home"].active') &&
    [...document.querySelectorAll('#osMappen .os-app')]
      .every((t) => t.getBoundingClientRect().width >= 8 && t.getBoundingClientRect().height >= 8),
  null, { timeout: 10000 });
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

test('het beginscherm heeft géén hamburger: de statusbalk is leeg en de bovenrand is de ingang',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osAiBalk', { timeout: 10000 });
    /* Een vers geregistreerd lid staat nog in de intake, en die legt een blad
       over het hele scherm. Wat we hier meten ligt eronder: de statusbalk van
       het beginscherm. Het blad gaat dus opzij -- de intake heeft een eigen
       toets en hoort niet in deze. */
    await page.evaluate(() => {
      const g = document.getElementById('onbGate');
      /* hidden is het signaal waarop Command wacht; verwijderen vóór die
         MutationObserver heeft gelopen laat de werktafel in de toestand
         "ondertekening open" staan. */
      if (g) g.hidden = true;
    });
    /* RTG Command is de landing. Deze toets meet bewust de stille statusbalk
       van de schil eronder, dus volgt dezelfde zichtbare ingang als een lid: de
       knop "Toestel" in de bank. */
    await page.waitForFunction(() => {
      const g = document.getElementById('onbGate');
      if (g) g.hidden = true;
      const k = document.querySelector('#rtgCommand .cmd-schil');
      if (!k) return false;
      k.click();
      if (g) g.remove();
      return true;
    }, null, { timeout: 10000 });
    await page.waitForTimeout(400);

    /* HET BEGINSCHERM IS DE RUSTPLEK. Geen batterij, geen bel, geen paneelknop
       en ook geen hamburger: mappen, klok, functies, de balk van Rahul, en
       verder niets. De knoppen mogen wel BESTAAN -- het bedieningspaneel en de
       rest van de app klikken ze aan, en dat is de enige plek waar hun gedrag
       staat -- ze horen alleen niet in beeld. */
    const balk = await page.evaluate(() => {
      const zichtbaar = (id) => {
        const e = document.getElementById(id);
        if (!e) return null;                  // null = bestaat niet meer
        const b = e.getBoundingClientRect(), s = getComputedStyle(e);
        return !e.hidden && s.display !== 'none' && s.visibility !== 'hidden' &&
          Number(s.opacity || 1) > 0 && b.width > 0 && b.height > 0;
      };
      return {
        bel: zichtbaar('bell'), paneel: zichtbaar('osCcBtn'), accu: zichtbaar('osBat'),
        hamburger: !!document.getElementById('osMenuBtn'),
        groet: !!document.getElementById('homeGreeting'),
        zichtbaarRechts: [...document.querySelectorAll('.topbar .os-rechts button')]
          .filter((e) => { const b = e.getBoundingClientRect(), s = getComputedStyle(e);
            return !e.hidden && s.display !== 'none' && s.visibility !== 'hidden' &&
              Number(s.opacity || 1) > 0 && b.width > 0 && b.height > 0; })
          .map((b) => b.id || b.className)
      };
    });
    /* EEN DEUR, EN VERDER NIETS.

       Hier stond `paneel === false` en `zichtbaarRechts === []`: de statusbalk
       moest helemaal leeg zijn. Dat klopte tot de balk werd leeggemaakt --
       scannen, Zegel, backoffice en de bel verhuisden allemaal NAAR het
       bedieningspaneel -- en de knop van dat paneel per ongeluk meeging in de
       opruiming. Toen was het paneel waar ze allemaal in zitten alleen nog te
       openen via Rahuls "zoek ..."-opdracht, en dus praktisch onvindbaar.

       Die knop is daarom bewust teruggezet, met de reden erbij in app.html. De
       eis is niet veranderd -- de bovenrand is de ingang en de balk is geen
       gereedschapskist -- maar "leeg" is nu "precies EEN deur". Deze toets
       bewaakt dat scherper dan een lege lijst: hij noemt de enige knop die er
       mag staan, dus zowel een knop erbij als deze deur die verdwijnt, zakt. */
    assert.equal(balk.bel, false, 'de bel staat nog in de statusbalk');
    assert.equal(balk.accu, false, 'de batterij staat nog in de statusbalk');
    assert.equal(balk.hamburger, false, 'het beginscherm hoort geen hamburger te hebben');
    assert.equal(balk.groet, false, 'de begroeting hoort van het beginscherm af te zijn');
    assert.equal(balk.paneel, true,
      'de deur naar het bedieningspaneel is uit de statusbalk verdwenen; dan is alles wat ' +
      'daarin verhuisd is (scannen, Zegel, backoffice, meldingen) alleen nog via Rahul te openen');
    assert.deepEqual(balk.zichtbaarRechts, ['osCcBtn'],
      'in de statusbalk hoort alleen de deur naar het bedieningspaneel te staan, gevonden: ' +
      (balk.zichtbaarRechts.join(', ') || '(niets)'));

    /* ...EN DAN MOET DE WEG NAAR HET SYSTEEM ER WEL ZIJN. Dit is de helft die
       stil kapot kan: knoppen weghalen is zichtbaar, een ingang die niemand
       meer heeft niet. De bovenrand omlaag halen (shared/randen.js) opent het
       bedieningspaneel, en dat paneel draagt alles wat uit de balk is gehaald
       -- meldingen incluis, want zonder die tegel was er na het leegmaken geen
       enkele ingang meer naar wat er voor je klaarligt. */
    await page.mouse.move(196, 4);
    await page.mouse.down();
    for (const y of [20, 50, 90, 130]) { await page.mouse.move(196, y); await page.waitForTimeout(40); }
    await page.mouse.up();
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => {
      const s = document.getElementById('osCcScrim');
      return !!(s && s.classList.contains('open'));
    }), true, 'de bovenrand opent het bedieningspaneel niet');

    const tegels = await page.evaluate(() =>
      [...document.querySelectorAll('.os-cc-tegels button')].filter((b) => !b.hidden)
        .map((b) => b.textContent.trim()));
    for (const woord of ['Meldingen', 'Zoeken', 'Scannen', 'Zegel', 'backoffice']) {
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
    await page.close();
  });
});

test('de schil draagt één gecentreerde rij van drie werelden, en de balk van Rahul staat onderaan',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtRooster(page);
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(400);
    await wachtRooster(page);

    const r = await page.evaluate(() => {
      const vak = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { top: Math.round(b.top), bodem: Math.round(b.bottom) };
      };
      const nav = document.getElementById('osMappen');
      const navVak = nav.getBoundingClientRect();
      const tegels = [...nav.querySelectorAll('.os-app')];
      const rijen = new Set(tegels.map((t) => Math.round(t.getBoundingClientRect().top)));
      // de ene rij hoort als geheel gecentreerd te staan
      const laatsteTop = Math.max(...tegels.map((t) => Math.round(t.getBoundingClientRect().top)));
      const laatste = tegels.filter((t) => Math.round(t.getBoundingClientRect().top) === laatsteTop);
      const marge = {
        links: Math.round(laatste[0].getBoundingClientRect().left - navVak.left),
        rechts: Math.round(navVak.right - laatste[laatste.length - 1].getBoundingClientRect().right)
      };
      const onder = [...document.querySelectorAll('#osAiWet, #osDemoWet')]
        .filter((e) => getComputedStyle(e).display !== 'none').at(-1);
      const tips = document.querySelector('#osAiTips');
      const boven = tips && !tips.hidden ? vak('#osAiTips') : vak('#osAiDraad');
      return {
        mappen: tegels.length, rijen: rijen.size, marge: marge,
        breedtes: [...new Set(tegels.map((t) => Math.round(t.getBoundingClientRect().width)))],
        volgorde: ['#osMappen', '#osFuncties', '#osAiBalk'].map((s) => vak(s).top),
        klok: !!document.querySelector('#homeKlok'),
        gatNaarBalk: vak('#osAiBalk').top - boven.bodem,
        onderrand: Math.round(onder.getBoundingClientRect().bottom), hoogte: innerHeight
      };
    });
    assert.equal(r.mappen, 3, 'de voordeur hoort exact drie hoofdwerelden te dragen');
    assert.equal(r.rijen, 1, 'de drie hoofdwerelden staan niet in één rij (rijen: ' + r.rijen + ')');
    /* DE RIJ TELT ER DRIE EN HOORT GECENTREERD TE STAAN. Links en rechts even
       veel marge maakt er één bewuste voordeur van, in plaats van drie tegels
       die toevallig vanaf de linkerkant zijn neergelegd. De tegels houden
       bovendien dezelfde compacte maat; drie uitgerekte tegels zouden de rustige
       hiërarchie verdringen. */
    assert.ok(Math.abs(r.marge.links - r.marge.rechts) <= 2,
      'de laatste rij mappen staat niet gecentreerd (links ' + r.marge.links +
      ', rechts ' + r.marge.rechts + ')');
    assert.equal(r.breedtes.length, 1,
      'niet alle maptegels zijn even breed: ' + r.breedtes.join(', '));
    assert.deepEqual(r.volgorde.slice().sort((a, b) => a - b), r.volgorde,
      'de volgorde is mappen, functies, balk');

    /* DRIE EISEN DIE ELKAAR IN DE WEG ZITTEN, en daarom in één meting staan.

       DE KLOK STOND HIER TUSSEN, als tweede laag, en pakte met flex:1 alle
       overgebleven ruimte. Er heeft een bovengrens op dat vak gestaan om hem
       omhoog te halen; gevolg was dat alle overtollige ruimte naar het einde van
       de kolom zakte, de balk van Rahul loskwam van de onderrand en er een gat
       van 155 punten onder het scherm stond. De klok is nu helemaal weg (het
       beginscherm is de werktafel, zie WERELD.md) en die ruimte gaat naar
       margin-top:auto op de functierij -- dezelfde val, andere regel, dus de
       meting blijft.

       1. DE KLOK KOMT NIET TERUG. Wie hem hier weer neerzet, zet ook zijn vak
          met flex:1 terug, en dan is eis 2 weer een gok.
       2. DE BALK STAAT ONDERAAN. Daar zoekt je duim hem.
       3. HET GESPREK PLAKT NIET AAN DE BALK. Anders leest het als één blok in
          plaats van gesprek en invoer. */
    assert.equal(r.klok, false,
      'de klok hoort van dit scherm af te zijn -- het beginscherm is de werktafel');
    assert.ok(r.hoogte - r.onderrand < 60,
      'de balk van Rahul hangt los van de onderrand (' + (r.hoogte - r.onderrand) + 'px eronder)');
    assert.ok(r.gatNaarBalk > 22,
      'de berichten van Rahul plakken aan zijn balk (' + r.gatNaarBalk + 'px ertussen)');
    await page.close();
  });
});

test('elke hoofdwereld houdt een volwaardig beeldmerk op de instappas',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* PREMIUMRECHTEN VERANDEREN DE INHOUD, NIET DE KWALITEIT VAN DE VOORDEUR.
     Een RTG-pas ziet minder onderdelen dan Lifestyle of Business, maar krijgt
     dezelfde drie volledige huizen. Daarom toetst dit pad bewust met de
     instappas: geen hoofdwereld mag daar terugvallen op een kaal monogram of
     verdwijnen. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mappen-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const tok = await lidToken(base, 'mappen' + process.pid + '@x.nl');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
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
    const page = await ctx.newPage();
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtRooster(page);
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(400);
    await wachtRooster(page);

    /* DE METING IS TWEE KEER VERHUISD, en dat hoort hier te staan.

       Eerst telde deze toets tegels in een OPENGEKLIKTE map. Toen werelden
       apps werden, telde hij de minitegels op de wereldtegel -- en die telling
       ving meteen iets echts: de minitegels toonden alleen wat op JOUW pas
       zichtbaar is, dus op de instappas stond RTG Leven er met drie snippers
       en RTFoundation met een. De instap oogde budget, precies wat de
       merkregel verbiedt.

       De oplossing is niet een lagere lat maar een andere tegel: een wereld is
       een app en ziet eruit als een app, met EEN glyf die op elke pas even vol
       is. Wat deze toets dus nu bewaakt: elke wereldtegel draagt een echte
       getekende glyf (svg), geen monogram-terugval en geen leeg vlak. De
       monogram-terugval bestaat voor een glyf die ontbreekt, en op het
       beginscherm is "de glyf ontbreekt" geen smaakverschil maar een kale
       voordeur.

       De dubbelcheck ("een app staat in precies EEN wereld") is apart
       verhuisd, naar regel 44 in scripts/check.js -- die leest de bron.

       DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: geef een wereld in
       app-main-24a2.js een glyf-naam die niet bestaat ('map-rtg' ->
       glyf: 'bestaatniet'). De tegel valt dan terug op het monogram. */
    const mappen = await page.evaluate(() =>
      [...document.querySelectorAll('#osMappen .os-app')].map((map) => ({
        sleutel: map.dataset.sleutel || '',
        naam: (map.getAttribute('aria-label') || '').replace(/^Map /, '').trim(),
        glyf: !!map.querySelector('.os-tegel svg'),
        monogram: !!map.querySelector('.os-monogram')
      })));

    assert.deepEqual(mappen.map((m) => m.sleutel), ['map-rtg', 'map-werk', 'map-rtf'],
      'de voordeur hoort exact RTG, RTG Kantoor en RTFoundation te dragen');
    const kaal = mappen.filter((m) => !m.glyf);
    assert.deepEqual(kaal.map((m) => m.naam + (m.monogram ? ' (monogram)' : ' (leeg)')), [],
      'deze wereldtegels dragen geen getekende glyf:\n' +
      mappen.map((m) => '  ' + m.naam + ': ' + (m.glyf ? 'glyf' : (m.monogram ? 'monogram' : 'leeg'))).join('\n'));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de wereldtegels op het beginscherm staan naast elkaar, en openen hun app',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* DIT IS NIET AAN DE BRON TE ZIEN EN OOK NIET AAN EEN GROENE TELTOETS.

     De voorganger van deze toets mat de tegels in een GEOPENDE map. Sinds het
     beginscherm drie hoofdwerelden toont (PLATFORM.md par. 0) opent een tegel de
     app zelf en is er geen tussenscherm meer. De fout waar die toets voor
     bestond is niet verdwenen -- hij is verhuisd: tegels die over elkaar
     liggen, buiten hun vak vallen of de helft van de breedte onbenut laten,
     staan nu op het beginscherm zelf. Tellen is geen kijken, en dat gold toen
     en geldt nu.

     Wat er bij komt en er niet in kon staan: dat een wereld ook echt zijn app
     opent. Dat is het hele punt van de drie hoofdwerelden; een tegel die niets doet
     zou door elke telling heen komen.

     De mutatie die hem hoort te laten zakken: haal `wereld` van een van de
     mappen in app-main-24a2.js weg. De tegel opent dan weer een tegelveld en
     navigeert nergens heen. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werelden-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const tok = await lidToken(base, 'werelden' + process.pid + '@x.nl');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
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
    const page = await ctx.newPage();
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await wachtRooster(page);
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(400);
    await wachtRooster(page);

    const beeld = await page.evaluate(() => {
      const tegels = [...document.querySelectorAll('#osMappen .os-app')];
      const vak = document.getElementById('osMappen').getBoundingClientRect();
      const doosjes = tegels.map((t) => t.getBoundingClientRect());
      const overlap = [];
      for (let i = 0; i < doosjes.length; i++) {
        for (let j = i + 1; j < doosjes.length; j++) {
          const a = doosjes[i], b = doosjes[j];
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
              a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlap.push(i + '/' + j);
        }
      }
      return {
        aantal: tegels.length,
        sleutels: tegels.map((t) => t.dataset.sleutel || ''),
        namen: tegels.map((t) => (t.getAttribute('aria-label') || '').replace(/^Map /, '').trim()),
        overlap: overlap.length,
        buiten: doosjes.filter((r) => r.left < vak.left - 0.5 || r.right > vak.right + 0.5).length,
        nul: doosjes.filter((r) => r.width < 8 || r.height < 8).length
      };
    });

    assert.deepEqual(beeld.sleutels, ['map-rtg', 'map-werk', 'map-rtf'],
      'de voordeur hoort exact RTG, RTG Kantoor en RTFoundation te tekenen');
    assert.equal(beeld.overlap, 0,
      'wereldtegels liggen over elkaar heen (' + beeld.overlap + ' paren): ' + beeld.namen.join(', '));
    assert.equal(beeld.buiten, 0, 'deze wereldtegels vallen buiten hun eigen vak');
    assert.equal(beeld.nul, 0, 'een wereldtegel is nul groot; die is er wel en je ziet hem niet');

    /* EN NU OPENT HIJ OOK ECHT. Een voor een, want elke klik navigeert weg. */
    for (let i = 0; i < beeld.aantal; i++) {
      await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      await wachtRooster(page);
      await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
      await page.waitForTimeout(250);
      await wachtRooster(page);
      await page.evaluate((n) => document.querySelectorAll('#osMappen .os-app')[n].click(), i);
      await page.waitForTimeout(900);
      const pad = new URL(page.url()).pathname;
      assert.notEqual(pad, '/apps/app.html',
        'de wereld "' + beeld.namen[i] + '" opent geen app; hij bleef op het beginscherm staan');
      assert.match(pad, /^\/apps\//, 'een wereld hoort naar een app te wijzen, niet naar ' + pad);
    }
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
