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
        /* DEZE TOETSEN METEN HET ROOSTER, dus zetten ze het rooster aan. Het
           beginscherm opent tegenwoordig standaard in de wereldstand (de kring
           om de klok, shared/wereld.js) en daar staan de tegels op
           display:none -- dan meet je nullen en zakt de toets om een stand en
           niet om een fout. De wereldstand heeft een eigen toets
           (test/wereld.e2e.js); die zet deze sleutel juist op 'aan'. */
        localStorage.setItem('rtg_os_wereld', 'uit');
      } catch (e) {}
    }, tok);
    await fn({ base, ctx });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('Rahul heeft één balk, op elk pad waarop de homescreen te bereiken is',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
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
        await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
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
  });
});

test('elke app-pagina draagt de hamburger van het app-menu',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const fouten = [];
    let gemeten = 0;

    for (const pad of appPaden()) {
      const page = await ctx.newPage();
      try {
        await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
        /* Wegnavigeerd (een inlogdeur) of bewust zonder OS-chrome? Niet meten.
           De uitleesactie zelf moet ook een navigatie overleven: een pagina die
           tijdens het lezen naar het inlogscherm springt breekt de context af,
           en dat is geen meetresultaat maar een pagina die er niet meer is. */
        await page.waitForTimeout(200);
        let meedoen;
        try {
          /* data-ios-uit: de pagina zegt zelf dat ze de OS-chrome niet wil.
             data-ios-home: het beginscherm, en dat krijgt met opzet geen
             hamburger -- daar is de bovenrand de ingang naar het systeem (zie
             de kop van shared/appmenu.js). */
          meedoen = await page.evaluate(() => !document.body.hasAttribute('data-ios-uit') &&
            !document.body.hasAttribute('data-ios-home'));
        } catch (e) { continue; }
        if (!meedoen) continue;
        if (new URL(page.url()).pathname !== pad) continue;
        try {
          await page.waitForSelector('#osMenuBtn', { timeout: 8000 });
          gemeten++;
        } catch (e) {
          if (new URL(page.url()).pathname === pad) fouten.push(pad);
        }
      } finally { await page.close(); }
    }

    assert.ok(gemeten > 100, 'te weinig pagina\'s gemeten (' + gemeten + '): dan bewijst een groene uitslag niets');
    assert.deepEqual(fouten, [], 'deze app-pagina\'s hebben geen app-menu:\n' + fouten.join('\n'));
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
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osAiBalk', { timeout: 10000 });
    /* Een vers geregistreerd lid staat nog in de intake, en die legt een blad
       over het hele scherm. Wat we hier meten ligt eronder: de statusbalk van
       het beginscherm. Het blad gaat dus opzij -- de intake heeft een eigen
       toets en hoort niet in deze. */
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(400);

    /* HET BEGINSCHERM IS DE RUSTPLEK. Geen batterij, geen bel, geen paneelknop
       en ook geen hamburger: mappen, klok, functies, de balk van Rahul, en
       verder niets. De knoppen mogen wel BESTAAN -- het bedieningspaneel en de
       rest van de app klikken ze aan, en dat is de enige plek waar hun gedrag
       staat -- ze horen alleen niet in beeld. */
    const balk = await page.evaluate(() => {
      const zichtbaar = (id) => {
        const e = document.getElementById(id);
        return e ? !!e.offsetParent : null;   // null = bestaat niet meer
      };
      return {
        bel: zichtbaar('bell'), paneel: zichtbaar('osCcBtn'), accu: zichtbaar('osBat'),
        hamburger: !!document.getElementById('osMenuBtn'),
        groet: !!document.getElementById('homeGreeting'),
        zichtbaarRechts: [...document.querySelectorAll('.topbar .os-rechts button')]
          .filter((b) => b.offsetParent).map((b) => b.id || b.className)
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

test('het beginscherm draagt twee rijen mappen, en de klok staat erboven',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osMappen .os-app', { timeout: 10000 });
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(400);

    const r = await page.evaluate(() => {
      const vak = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { top: Math.round(b.top), bodem: Math.round(b.bottom) };
      };
      const nav = document.getElementById('osMappen');
      const navVak = nav.getBoundingClientRect();
      const tegels = [...nav.querySelectorAll('.os-app')];
      const rijen = new Set(tegels.map((t) => Math.round(t.getBoundingClientRect().top)));
      // de laatste rij: telt hij minder tegels, dan hoort hij gecentreerd te staan
      const laatsteTop = Math.max(...tegels.map((t) => Math.round(t.getBoundingClientRect().top)));
      const laatste = tegels.filter((t) => Math.round(t.getBoundingClientRect().top) === laatsteTop);
      const marge = {
        links: Math.round(laatste[0].getBoundingClientRect().left - navVak.left),
        rechts: Math.round(navVak.right - laatste[laatste.length - 1].getBoundingClientRect().right)
      };
      const onder = document.querySelector('#osDemoWet') || document.querySelector('#osAiWet');
      const klokvak = vak('.os-klokvak'), klok = vak('#homeKlok');
      const tips = document.querySelector('#osAiTips');
      const boven = tips && !tips.hidden ? vak('#osAiTips') : vak('#osAiDraad');
      return {
        mappen: tegels.length, rijen: rijen.size, marge: marge,
        breedtes: [...new Set(tegels.map((t) => Math.round(t.getBoundingClientRect().width)))],
        volgorde: ['#osMappen', '.os-klokvak', '#osFuncties', '#osAiBalk']
          .map((s) => vak(s).top),
        luchtBovenKlok: klok.top - klokvak.top,
        luchtOnderKlok: klokvak.bodem - klok.bodem,
        gatNaarBalk: vak('#osAiBalk').top - boven.bodem,
        onderrand: Math.round(onder.getBoundingClientRect().bottom), hoogte: innerHeight
      };
    });
    assert.ok(r.mappen >= 7, 'er staan minder dan zeven mappen: ' + r.mappen);
    assert.equal(r.rijen, 2, 'de mappen staan niet in twee rijen (rijen: ' + r.rijen + ')');
    /* DE TWEEDE RIJ TELT ER DRIE EN HOORT GECENTREERD TE STAAN. In een raster
       van vier kolommen schuift zo'n restrij tegen de linkerkolom aan en blijft
       er rechts een kolom leeg -- dan lees je een halfvolle rij van vier in
       plaats van een rij van drie. Links en rechts even veel marge is dus geen
       opmaakdetail maar het verschil tussen "een vorm" en "er ontbreekt er
       een". En de tegels houden hun rasterbreedte: drie brede tegels zijn geen
       tweede rij meer maar een andere maat. */
    assert.ok(Math.abs(r.marge.links - r.marge.rechts) <= 2,
      'de laatste rij mappen staat niet gecentreerd (links ' + r.marge.links +
      ', rechts ' + r.marge.rechts + ')');
    assert.equal(r.breedtes.length, 1,
      'niet alle maptegels zijn even breed: ' + r.breedtes.join(', '));
    assert.deepEqual(r.volgorde.slice().sort((a, b) => a - b), r.volgorde,
      'de volgorde is mappen, klok, functies, balk');

    /* DRIE DINGEN DIE ELKAAR IN DE WEG ZITTEN, en daarom hier bij elkaar staan.

       Er heeft een bovengrens op het klokvak gestaan om de klok omhoog te
       halen. Gevolg: alle overtollige ruimte zakte naar het einde van de kolom,
       de balk van Rahul kwam los van de onderrand en er stond een gat van 155
       punten onder het scherm. Die grens is er weer af, en dat maakt deze drie
       eisen tegelijk waar -- verschuif er één en de andere twee bewegen mee, dus
       ze horen in één meting.

       1. DE BALK STAAT ONDERAAN. Daar zoekt je duim hem.
       2. DE KLOK HEEFT LUCHT OM ZICH HEEN, boven en onder ongeveer evenveel;
          een horloge zonder marge wordt een tegel.
       3. HET GESPREK PLAKT NIET AAN DE BALK. Anders leest het als één blok in
          plaats van gesprek en invoer. */
    assert.ok(r.hoogte - r.onderrand < 60,
      'de balk van Rahul hangt los van de onderrand (' + (r.hoogte - r.onderrand) + 'px eronder)');
    assert.ok(r.luchtBovenKlok > 25 && r.luchtOnderKlok > 25,
      'de klok heeft te weinig lucht om zich heen (boven ' + r.luchtBovenKlok +
      ', onder ' + r.luchtOnderKlok + ')');
    assert.ok(Math.abs(r.luchtBovenKlok - r.luchtOnderKlok) < 20,
      'de klok hangt niet in het midden van zijn vak (boven ' + r.luchtBovenKlok +
      ', onder ' + r.luchtOnderKlok + ')');
    assert.ok(r.gatNaarBalk > 22,
      'de berichten van Rahul plakken aan zijn balk (' + r.gatNaarBalk + 'px ertussen)');
    await page.close();
  });
});

test('geen enkele map loopt leeg op de instappas',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* DE TEGELS TELLEN NIET VOOR IEDEREEN HETZELFDE, en dat is precies waar de
     indeling van de mappen op stukging. Veertien apps zijn Lifestyle/Business
     (de PREMIUM-set in app-main.js) en vallen voor een RTG-pas vanzelf weg.
     Het Huis was gevuld met Maison, Table, Cellier, Garde-robe en De
     Rechterhand -- alle vijf premium -- dus een Business-lid zag daar acht
     tegels en een RTG-lid drie. Dezelfde map, half zo vol, precies op de
     instappas. De merkregel is daar niet vaag over: RTG Pass is de instap,
     maar mag nooit budget aanvoelen.

     Zoiets zie je niet in de bron -- daar staan gewoon acht sleutels in een
     lijst -- en ook niet op je eigen scherm, want wie dit bouwt kijkt met de
     pas die alles ziet. Je ziet het alleen door de mappen echt open te klikken
     mét de kleinste pas. Vandaar deze toets.

     De mutatie die hem hoort te laten zakken: zet de zorg-tabbladen (tab:zorg,
     tab:gezin) uit Het Huis terug in een eigen map.

     Hier stonden ook link:vitaal en link:thuisrust bij. Die twee zijn standen
     van RTG Veilig geworden (een app kan maar in een map staan, en die map is
     Veilig), dus Het Huis draagt zijn ondergrens nu op de twee tabbladen plus
     link:ontdek en os:rtf. Dat is krapper dan het was: gaat er nog iets uit
     Het Huis weg, dan zakt deze toets -- en dat is precies de bedoeling. */
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
        /* DEZE TOETSEN METEN HET ROOSTER, dus zetten ze het rooster aan. Het
           beginscherm opent tegenwoordig standaard in de wereldstand (de kring
           om de klok, shared/wereld.js) en daar staan de tegels op
           display:none -- dan meet je nullen en zakt de toets om een stand en
           niet om een fout. De wereldstand heeft een eigen toets
           (test/wereld.e2e.js); die zet deze sleutel juist op 'aan'. */
        localStorage.setItem('rtg_os_wereld', 'uit');
      } catch (e) {}
    }, tok);
    const page = await ctx.newPage();
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osMappen .os-app', { timeout: 15000 });
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(400);

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
       app-main-24a2.js een glyf-naam die niet bestaat ('map-geld' ->
       glyf: 'bestaatniet'). De tegel valt dan terug op het monogram. */
    const mappen = await page.evaluate(() =>
      [...document.querySelectorAll('#osMappen .os-app')].map((map) => ({
        naam: (map.getAttribute('aria-label') || '').replace(/^Map /, '').trim(),
        glyf: !!map.querySelector('.os-tegel svg'),
        monogram: !!map.querySelector('.os-monogram')
      })));

    assert.ok(mappen.length >= 7, 'er zijn minder dan zeven werelden gemeten: ' + mappen.length);
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
     beginscherm acht werelden toont (PLATFORM.md par. 0) opent een tegel de
     app zelf en is er geen tussenscherm meer. De fout waar die toets voor
     bestond is niet verdwenen -- hij is verhuisd: tegels die over elkaar
     liggen, buiten hun vak vallen of de helft van de breedte onbenut laten,
     staan nu op het beginscherm zelf. Tellen is geen kijken, en dat gold toen
     en geldt nu.

     Wat er bij komt en er niet in kon staan: dat een wereld ook echt zijn app
     opent. Dat is het hele punt van acht werelden; een tegel die niets doet
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
        /* DEZE TOETSEN METEN HET ROOSTER, dus zetten ze het rooster aan. Het
           beginscherm opent tegenwoordig standaard in de wereldstand (de kring
           om de klok, shared/wereld.js) en daar staan de tegels op
           display:none -- dan meet je nullen en zakt de toets om een stand en
           niet om een fout. De wereldstand heeft een eigen toets
           (test/wereld.e2e.js); die zet deze sleutel juist op 'aan'. */
        localStorage.setItem('rtg_os_wereld', 'uit');
      } catch (e) {}
    }, tok);
    const page = await ctx.newPage();
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osMappen .os-app', { timeout: 15000 });
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(400);

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
        namen: tegels.map((t) => (t.getAttribute('aria-label') || '').replace(/^Map /, '').trim()),
        overlap: overlap.length,
        buiten: doosjes.filter((r) => r.left < vak.left - 0.5 || r.right > vak.right + 0.5).length,
        nul: doosjes.filter((r) => r.width < 8 || r.height < 8).length
      };
    });

    assert.ok(beeld.aantal >= 7, 'er zijn minder dan zeven werelden getekend: ' + beeld.aantal);
    assert.equal(beeld.overlap, 0,
      'wereldtegels liggen over elkaar heen (' + beeld.overlap + ' paren): ' + beeld.namen.join(', '));
    assert.equal(beeld.buiten, 0, 'deze wereldtegels vallen buiten hun eigen vak');
    assert.equal(beeld.nul, 0, 'een wereldtegel is nul groot; die is er wel en je ziet hem niet');

    /* EN NU OPENT HIJ OOK ECHT. Een voor een, want elke klik navigeert weg. */
    for (let i = 0; i < beeld.aantal; i++) {
      await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#osMappen .os-app', { timeout: 15000 });
      await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
      await page.waitForTimeout(250);
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
