#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE NAVIGATIEPROEF -- de belofte, niet het bestand.

   BETROUWBAARHEID.md par. 1 gebruikt precies deze functie als voorbeeld:
   `Navigatie` is niet `/apps/navigatie.html`, de belofte is *breng mij vanaf
   waar ik nu ben naar mijn bestemming*, en daaronder vallen de locatiepoort,
   het zoeken, de kaartdata, de routering, het gedrag bij time-out en de status
   die het scherm toont. Pas als die keten sluit mag Navigeren groen.

   WAAROM DIT DOOR EEN BROWSER MOET. Er staat een uitgebreide motorproef
   (test/navigatie.test.js, 256 regels) en die stond helemaal groen, terwijl vijf
   defecten in het SCHERM zaten en een lid ze alle vijf tegenkwam:

     1. de badge zei "Motor actief" boven Nederland zonder ingeladen wegennet,
        precies het defect dat kern/navigatie/dekking.js opgelost heet te hebben
        -- het scherm haalde de status alleen op NA een geslaagde kaart, dus in
        het faalgeval bleef de tekst uit de HTML staan;
     2. wie zocht voor de eerste GPS-fix binnen was, kreeg per toetsaanslag een
        `Cannot read properties of null (reading 'lat')`: geen resultaten, geen
        melding, zoeken stuk tot er een plek kwam;
     3. nul treffers sloot de lijst zonder een woord, en een 503 van de motor
        werd helemaal weggegooid;
     4. wie zijn locatie weigerde keek 12,2 seconden naar een zwart scherm --
        het antwoord was er na een halve seconde, maar shared/plek.js kon het
        niet doorgeven;
     5. knijpen deed niets: `pinchD` stond er als losse variabele en het doek
        draagt `touch-action:none`, dus op een telefoon was de kaart niet te
        zoomen.

   Geen van die vijf is met een routetoets te vinden, want geen van de vijf zit
   in een route. Vandaar een proef die het scherm ECHT opent.

   DE VORM IS DIE VAN scripts/tafelproef.js EN scripts/ritproef.js -- schakels
   met een van/naar, storingen met een belofte -- en er is met opzet GEEN
   gedeelde module: dat zou het gedeelde type verklaren voordat gemeten is dat
   er een is (KETENVORM.json). Wat de ketens werkelijk delen, telt
   scripts/ketenvorm.js achteraf uit de registers.

   WAT DEZE KETEN ANDERS DOET dan de tafel en de rit, en daarom als derde meting
   iets toevoegt: er is maar EEN actor (een lid en zijn toestel), de keten kan
   niet doorlopen zonder een gegeven dat RTG niet bezit (de locatie), en de
   uitkomst is geen levering maar KENNIS -- een route die klopt met waar je
   staat. Een keten die op een weigering van de gebruiker hoort door te lopen in
   plaats van te stoppen, komt in de andere twee niet voor.

   Draaien:  npm run navigatieproef            (print, zakt op een open schakel)
             npm run navigatieproef:vast       (schrijft NAVIGATIEPROEF.json)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { startChromium, herkomst } = require('./lib/scherm');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'NAVIGATIEPROEF.json');
const SCHERM = '/apps/navigatie.html';
/* Het eigen demonstratienet ligt rond Ibiza-stad (kern/navigatie.js REF); daar
   IS het eigen net alles wat er is en heet het ook zo. Amsterdam is het andere
   geval: binnen Nederland zonder NWB-import valt er niets te rekenen. */
const IBIZA = { latitude: 38.91, longitude: 1.43 };
const AMSTERDAM = { latitude: 52.37, longitude: 4.89 };

async function post(basis, pad, lijf) {
  const r = await fetch(basis + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lijf || {}) }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

/* Een ECHT lid langs de echte registratieroute; een nagebouwd token meet je
   eigen aanname en niet de deur (scripts/lib/proefsessies.js). */
async function lidToken(basis) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post(basis, '/api/auth/register', { name: 'Proeflid', email: 'nav' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  return r.data && r.data.token;
}

/* Een blad met een lid erin, en een teller van alles wat de pagina stukmaakt.
   Een scriptfout is hier geen bijzaak: defect 2 hierboven was er een, en hij
   maakte een halve app stil. */
async function blad(browser, basis, token, opties) {
  const o = opties || {};
  /* Drie standen en niet twee: een toestel dat WEIGERT is iets anders dan een
     toestel dat toestemming heeft en nog niets weet -- en juist dat tweede geval
     is de trage weg waar storing 6 over gaat. */
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, locale: 'nl-NL' },
    o.plek ? { permissions: ['geolocation'], geolocation: o.plek }
      : (o.toestemming ? { permissions: ['geolocation'] } : { permissions: [] })));
  const page = await ctx.newPage();
  const stuk = [];
  page.on('pageerror', e => stuk.push(String(e && e.message || e)));
  await page.addInitScript(([t, gps]) => {
    try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_os_gps', gps); } catch (e) {}
  }, [token, o.gpsUit ? '0' : '1']);
  await page.goto(basis + SCHERM, { waitUntil: 'domcontentloaded' });
  return { ctx, page, stuk };
}
const tekst = async (page, kies) => ((await page.locator(kies).textContent().catch(() => '')) || '').trim();
const wacht = (page, ms) => page.waitForTimeout(ms);

/* ---------------------------------------------------------------- de keten */
async function keten(browser, basis, token, uit) {
  let nr = 0;
  const noteer = (van, naar, wat, ziet, goed, antwoord) => {
    uit.schakels.push({ nr: ++nr, van, naar, wat, ziet, stand: goed ? 'gesloten' : 'open', antwoord });
  };
  const { page, stuk } = await blad(browser, basis, token, { plek: IBIZA });
  try {
    /* 1. DE DEUR. Een lid opent de app en de kaart bouwt zich rond de plek waar
       hij werkelijk staat -- niet rond een verzonnen startpunt. */
    await page.waitForSelector('#kaart', { timeout: 15000 });
    await wacht(page, 3500);
    const poortDicht = !(await page.locator('#poort.zien').count());
    const ref = await page.evaluate(() => (window.performance && null) || null).catch(() => null);
    void ref;
    const badge = await tekst(page, '#liveBadge');
    noteer('lid', 'kaart', 'opent RTG Navigatie met een vrijgegeven locatie',
      'de kaart bouwt en de poort blijft dicht; de badge noemt het net dat hier ligt',
      poortDicht && /demonstratienet/i.test(badge), 'badge: "' + badge + '", poort dicht: ' + poortDicht);

    /* 2. ZOEKEN. Een woord levert bestemmingen mét de afstand vanaf hier. */
    await page.fill('#zoek', 'laad');
    await wacht(page, 900);
    const treffers = await page.locator('#res button').count();
    const eersteAf = await tekst(page, '#res button:first-child .af');
    noteer('lid', 'motor', 'typt een woord in het zoekveld',
      'de eigen bronnen komen terug, met de afstand vanaf waar hij staat',
      treffers > 0 && /\d/.test(eersteAf), treffers + ' treffers, eerste afstand: "' + eersteAf + '"');

    /* 3. KIEZEN. Een tik maakt er een route van: ETA, afstand en bocht-voor-bocht. */
    await page.locator('#res button').first().click();
    await wacht(page, 1200);
    const eta = await tekst(page, '#etaGroot');
    const stappen = await page.locator('#stappen li').count();
    const paneelOpen = await page.locator('#paneel.zien').count();
    noteer('lid', 'route', 'kiest een bestemming uit de lijst',
      'het routepaneel opent met een ETA, een afstand en bocht-voor-bocht',
      !!paneelOpen && /\d+\s*min/.test(eta) && stappen > 0, 'ETA "' + eta + '", ' + stappen + ' stappen');

    /* 4. HET TOETSENBORD. Bewijs 2 van BETROUWBAARHEID.md gaat over bedienbaar,
       en dat is niet hetzelfde als aantikbaar: de lijst droeg `role="listbox"`
       met gewone knoppen erin en Enter deed niets. Wie geen muis of vinger
       gebruikt kwam nooit bij zijn bestemming. */
    await page.locator('#sluitPaneel').click();
    await wacht(page, 400);
    await page.fill('#zoek', '');
    await page.locator('#zoek').fill('laad');
    await wacht(page, 900);
    const rol = await page.locator('#res button').first().getAttribute('role');
    await page.locator('#zoek').press('ArrowDown');
    await page.locator('#zoek').press('ArrowDown');
    const gemerkt = await page.locator('#res button[aria-selected="true"]').count();
    await page.locator('#zoek').press('Enter');
    await wacht(page, 1200);
    const etaToets = await tekst(page, '#etaGroot');
    noteer('toetsenbord', 'route', 'kiest dezelfde bestemming met pijltjes en Enter',
      'de lijst draagt opties, de keuze is te zien, en Enter berekent de route',
      rol === 'option' && gemerkt === 1 && /\d+\s*min/.test(etaToets),
      'rol "' + rol + '", gemarkeerd: ' + gemerkt + ', ETA "' + etaToets + '"');

    /* 5. VERVOERWIJZE. Lopen is niet hetzelfde als rijden; de motor rekent het
       opnieuw en het scherm laat het verschil zien. */
    const etaAuto = await tekst(page, '#etaGroot');
    await page.locator('#modusrij button', { hasText: 'Lopen' }).click();
    await wacht(page, 1200);
    const etaLopen = await tekst(page, '#etaGroot');
    noteer('lid', 'route', 'wisselt van auto naar lopen',
      'dezelfde route wordt opnieuw gerekend en de ETA verandert mee',
      etaAuto !== etaLopen && /\d+\s*min/.test(etaLopen), 'auto "' + etaAuto + '" -> lopen "' + etaLopen + '"');

    /* 6. MELDEN. Wat een lid onderweg ziet, gaat terug het Flits-netwerk in --
       en zonder window.prompt, want dat venster blokkeert de pagina en komt in
       een geinstalleerde PWA soms helemaal niet. */
    const promptGebruikt = await page.evaluate(() => document.documentElement.innerHTML.includes('window.prompt'));
    await page.locator('#meldknop').click();
    await wacht(page, 300);
    const keuzeOpen = await page.locator('#meldkeuze button').count();
    await page.locator('#meldkeuze button[data-soort="file"]').click();
    await wacht(page, 1200);
    const toast = await tekst(page, '#toast');
    noteer('lid', 'netwerk', 'meldt een file op deze plek',
      'de keuze staat in het scherm zelf en de melding wordt bevestigd',
      !promptGebruikt && keuzeOpen >= 4 && /gemeld|bevestigd/i.test(toast),
      keuzeOpen + ' keuzeknoppen, antwoord: "' + toast + '"');

    /* 7. ZOOMEN MET TWEE VINGERS. Op een telefoon was dit de enige zoomweg, en
       hij bestond niet: `pinchD` stond er als losse variabele en het doek draagt
       `touch-action:none`, dus de browser zoomde ook niet zelf.

       GEMETEN AAN HET BEELD EN NIET AAN EEN HAAK. Er wordt met opzet geen
       `window.__cam` in de productiecode gezet om dit te kunnen aflezen -- een
       proef die zijn eigen meetpunt inbouwt, meet dat meetpunt. In plaats
       daarvan: eerst vaststellen dat het beeld STIL staat (twee opnamen zonder
       invoer die gelijk zijn -- met een route erop draait de kaart niet meer
       vanzelf), dan knijpen, dan kijken of er iets veranderde. Staat het beeld
       niet stil, dan is er niets te meten en zegt de schakel dat in plaats van
       groen te melden. */
    /* EEN RUSTIG STUK DOEK, en met opzet niet het hele element. Het doek ligt
       over het volle scherm en `locator('#kaart').screenshot()` fotografeert
       alles wat daar bovenop staat -- de zoekbalk, de melding van schakel 6 die
       over drie seconden vervaagt, het routepaneel dat inschuift. Dan beweegt er
       altijd iets en valt er niets te meten. Dit venster ligt onder de zoekbalk
       en boven het paneel en toont alleen kaart. De ruwe pixels uitlezen via een
       2D-kopie kan hier NIET: het doek draait op WebGL zonder
       preserveDrawingBuffer, en zo'n kopie komt leeg terug -- dat leest als
       "niets veranderd" terwijl er niets gemeten is. */
    const VENSTER = { x: 8, y: 210, width: 240, height: 140 };
    const foto = () => page.screenshot({ clip: VENSTER });
    const vak = await page.locator('#kaart').boundingBox();
    const mid = [vak.x + vak.width / 2, vak.y + vak.height / 2];
    const raak = (stappen) => page.evaluate(([x, y, rij]) => {
      const c = document.getElementById('kaart');
      c.setPointerCapture = () => {};
      for (const [soort, id, dx] of rij) c.dispatchEvent(new PointerEvent(soort, { pointerId: id,
        clientX: x + dx, clientY: y, bubbles: true, isPrimary: id === 1, pointerType: 'touch' }));
    }, [mid[0], mid[1], stappen]);

    /* EERST EEN AANRAKING DIE NIETS MAG DOEN, en die staat hier omdat deze
       schakel zonder hem GROEN BLEEF met de knijpzoom eruit gesloopt. De reden:
       `pointerdown` zet `draaien = 0`, en tot er een route lag draaide de kaart
       langzaam rond -- dus de eerste aanraking laat het beeld altijd verspringen,
       knijpzoom of niet. Deze neerzet-en-optil zonder beweging vangt die sprong
       op; pas daarna is een verandering werkelijk van het knijpen.

       Gevonden door de reparatie terug te draaien en te kijken of de proef hem
       mist. Dat deed hij (LAT.md regel 11). */
    await raak([['pointerdown', 9, 0], ['pointerup', 9, 0]]);
    await wacht(page, 400);

    let voor2 = await foto(), stil = false;
    for (let i = 0; i < 12 && !stil; i++) {
      await wacht(page, 400);
      const nu = await foto();
      stil = nu.equals(voor2); voor2 = nu;
    }
    const knijp = [['pointerdown', 1, -30], ['pointerdown', 2, 30]];
    for (let i = 1; i <= 6; i++) knijp.push(['pointermove', 1, -30 - i * 18], ['pointermove', 2, 30 + i * 18]);
    knijp.push(['pointerup', 1, -138], ['pointerup', 2, 138]);
    await raak(knijp);
    await wacht(page, 700);
    const na = await foto();
    noteer('vinger', 'kaart', 'knijpt met twee vingers uit elkaar',
      'het beeld verandert; zonder deze weg is de kaart op een telefoon niet te zoomen',
      stil && !na.equals(voor2),
      stil ? 'beeld stond stil en veranderde door het knijpen: ' + !na.equals(voor2)
        : 'NIET TE METEN: het beeld stond niet stil zonder invoer');

    uit.scriptfouten = uit.scriptfouten.concat(stuk);
  } finally { await page.context().close(); }
}

/* ------------------------------------------------------------- de storingen */
async function storingen(browser, basis, token, uit) {
  const noteer = (naam, belofte, goed, wat) =>
    uit.storingen.push({ naam, belofte, stand: goed ? 'gehouden' : 'gebroken', wat });

  /* 1. GEEN LOCATIE. De belofte is dubbel: RTG verzint nooit waar je bent, EN
     hij laat je daar niet op wachten. Dat tweede was de duurste helft. */
  {
    const t0 = Date.now();
    const { page, stuk } = await blad(browser, basis, token, { plek: null });
    let poortNa = null;
    for (let i = 0; i < 60 && poortNa === null; i++) {
      if (await page.locator('#poort.zien').count()) poortNa = Date.now() - t0;
      else await wacht(page, 250);
    }
    const reden = await tekst(page, '#poortReden');
    const badge = await tekst(page, '#liveBadge');
    const uitweg = !(await page.locator('#manualStart').evaluate(e => e.hidden).catch(() => true));
    noteer('het toestel geeft geen locatie af',
      'binnen drie seconden een poort met de reden, een uitweg, en een badge die niet doet alsof de motor draait',
      poortNa !== null && poortNa < 3000 && /locatie|toestel/i.test(reden) && uitweg && !/motor actief/i.test(badge),
      'poort na ' + poortNa + ' ms, reden "' + reden.slice(0, 70) + '", badge "' + badge + '", uitweg: ' + uitweg);
    uit.scriptfouten = uit.scriptfouten.concat(stuk);
    await page.context().close();
  }

  /* 2. ZELF EEN VERTREKPUNT KIEZEN. De uitweg uit storing 1 moet ook echt een
     uitweg zijn: de kaart bouwt alsnog en er komt een route uit. */
  {
    const { page, stuk } = await blad(browser, basis, token, { plek: null });
    await page.waitForSelector('#poort.zien', { timeout: 20000 });
    await page.locator('#manualStart').click();
    await wacht(page, 900);
    const opties = await page.locator('#startResultaten button').count();
    if (opties) await page.locator('#startResultaten button').first().click();
    await wacht(page, 2500);
    const kaartEr = !(await page.locator('#poort.zien').count());
    await page.fill('#zoek', 'laad');
    await wacht(page, 900);
    let eta = '';
    if (await page.locator('#res button').count()) {
      await page.locator('#res button').first().click();
      await wacht(page, 1500);
      eta = await tekst(page, '#etaGroot');
    }
    noteer('een lid dat zelf zijn vertrekpunt kiest',
      'de kaart bouwt alsnog en er komt een echte route uit -- de uitweg is geen doodlopende knop',
      opties > 0 && kaartEr && /\d+\s*min/.test(eta), opties + ' vertrekpunten, kaart open: ' + kaartEr + ', ETA "' + eta + '"');
    uit.scriptfouten = uit.scriptfouten.concat(stuk);
    await page.context().close();
  }

  /* 3. NEDERLAND ZONDER WEGENNET. Het defect uit BETROUWBAARHEID.md par. 6 nr.
     1, en de enige plek waar dit huis het kan meten: een wegwerpserver heeft
     nooit een NWB-import gedraaid. Is hij er toch, dan meet deze storing iets
     anders en zegt hij dat in plaats van groen te melden. */
  {
    const status = await post(basis, '/api/nav/status', {});
    void status;
    const { page, stuk } = await blad(browser, basis, token, { plek: AMSTERDAM });
    await page.waitForSelector('#poort.zien', { timeout: 20000 });
    const reden = await tekst(page, '#poortReden');
    const badge = await tekst(page, '#liveBadge');
    const kern = await tekst(page, '#sourceCore');
    /* Zoeken hoort dezelfde weigering te tonen; hij ging hier stil dicht. */
    await page.fill('#zoek', 'kalverstraat');
    await wacht(page, 1000);
    const inLijst = await tekst(page, '#res .leeg');
    const netGeladen = /nwb/i.test(badge);
    noteer('een lid in Nederland zonder ingeladen wegennet',
      'poort, badge en zoeklijst zeggen alle drie hetzelfde: hier ligt geen kaartdata -- nergens "Motor actief"',
      netGeladen ? false : (/wegennet/i.test(reden) && /geen kaartdata/i.test(badge) && kern === 'Geen' && /wegennet/i.test(inLijst)),
      netGeladen ? 'NIET BEPROEFD: deze server heeft het NWB wel ingeladen, dan meet deze storing iets anders'
        : 'poort "' + reden.slice(0, 50) + '", badge "' + badge + '", kern "' + kern + '", zoeken: "' + inLijst.slice(0, 60) + '"');
    uit.scriptfouten = uit.scriptfouten.concat(stuk);
    await page.context().close();
  }

  /* 4. ZOEKEN VOORDAT DE PLEK BINNEN IS. Met de schakelaar uit staat de vraag
     van shared/plek.js open en is er nog geen positie -- precies het venster
     waarin elke toetsaanslag een TypeError gaf. */
  {
    const { page, stuk } = await blad(browser, basis, token, { plek: IBIZA, gpsUit: true });
    await wacht(page, 700);
    const vraagOpen = await page.locator('.rtgplek').count();
    await page.fill('#zoek', 'laad');
    await wacht(page, 1000);
    const treffers = await page.locator('#res button').count();
    noteer('zoeken terwijl de locatievraag nog openstaat',
      'zoeken werkt zonder plek (alleen zonder afstanden) en gooit geen scriptfout',
      vraagOpen === 1 && treffers > 0 && stuk.length === 0,
      'vraag open: ' + vraagOpen + ', ' + treffers + ' treffers, scriptfouten: ' + (stuk.join(' | ') || 'geen'));
    uit.scriptfouten = uit.scriptfouten.concat(stuk);
    await page.context().close();
  }

  /* 6. EEN PLEK DIE PAS NA DE POORT BINNENKOMT. Sneller opgeven kost een
     functie als je het daarbij laat: het toestel dat er twaalf seconden over
     doet, zette wel `hier` maar bouwde nooit een kaart -- dan staat de poort
     over een app die precies weet waar je bent. De trage weg is hier met opzet
     de gemeten weg: permissie verleend, positie pas na de poort. */
  {
    const { ctx, page, stuk } = await blad(browser, basis, token, { plek: null, toestemming: true });
    await page.waitForSelector('#poort.zien', { timeout: 25000 });
    const voor = await tekst(page, '#poortReden');
    await ctx.setGeolocation(IBIZA);
    let dicht = false;
    for (let i = 0; i < 30 && !dicht; i++) { await wacht(page, 400); dicht = !(await page.locator('#poort.zien').count()); }
    const badge = await tekst(page, '#liveBadge');
    noteer('een toestel dat zijn plek pas na de poort vrijgeeft',
      'de poort gaat alsnog open en de kaart bouwt; een late fix is geen verloren fix',
      /niet beschikbaar|locatie/i.test(voor) && dicht && /demonstratienet/i.test(badge),
      'poort ging dicht: ' + dicht + ', badge daarna "' + badge + '"');
    uit.scriptfouten = uit.scriptfouten.concat(stuk);
    await page.context().close();
  }

  /* 5. NIETS GEVONDEN. Een lege lijst die stil dichtgaat, is niet te
     onderscheiden van een kapot zoekveld. */
  {
    const { page, stuk } = await blad(browser, basis, token, { plek: IBIZA });
    await wacht(page, 3000);
    await page.fill('#zoek', 'qqzzxx-bestaat-niet');
    await wacht(page, 1000);
    const melding = await tekst(page, '#res .leeg');
    noteer('een zoekterm die niets oplevert',
      'de lijst zegt dat er niets is gevonden in plaats van stil dicht te gaan',
      /niets gevonden/i.test(melding), 'lijst zegt: "' + melding + '"');
    uit.scriptfouten = uit.scriptfouten.concat(stuk);
    await page.context().close();
  }
}

/* ------------------------------------------------------------------- meten */
async function meet() {
  const uit = {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'De belofte van RTG Navigatie -- breng mij vanaf waar ik nu ben naar mijn bestemming -- gemeten in een echte browser, per SCHAKEL (doet het lid iets, en ziet hij het gevolg?) en per STORING (houdt de belofte als het misgaat?). Derde keten naast tafelproef en ritproef; zie BETROUWBAARHEID.md par. 1.',
    grens: 'Alleen de app op telefoonformaat, alleen de rol lid. De motor zelf staat in test/navigatie.test.js; deze proef meet het scherm erboven. Er wordt niet werkelijk gereden: dat de bocht-voor-bocht op straat klopt, is hier niet gemeten en kan dat ook niet.',
    browser: null, schakels: [], storingen: [], scriptfouten: []
  };
  const srv = await start({ naam: 'navigatieproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  let gestart = null;
  try {
    const token = await lidToken(srv.basis);
    if (!token) throw new Error('geen lidsessie: de proef kan de deur niet door');
    gestart = await startChromium();
    if (!gestart) {
      /* Overslaan is nooit stil: een proef die zich afmeldt terwijl niemand het
         leest, laat een stuk huis er gezond uitzien (scripts/lib/scherm.js). */
      uit.browser = 'geen (' + herkomst() + ')';
      uit.overgeslagen = 'er is geen Chromium te starten; deze proef meet niets zonder browser';
      return uit;
    }
    uit.browser = gestart.waarmee;
    await keten(gestart.browser, srv.basis, token, uit);
    await storingen(gestart.browser, srv.basis, token, uit);
  } finally {
    if (gestart) await gestart.browser.close().catch(() => {});
    srv.klaar();
  }

  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0, scriptfouten: uit.scriptfouten.length };
  for (const s of uit.schakels) t[s.stand]++;
  for (const s of uit.storingen) t[s.stand]++;
  uit.telling = t;
  /* Een scriptfout telt mee. Defect 2 hierboven WAS een scriptfout, en het
     scherm zag er gewoon uit -- met lege koppen. Een proef die alleen naar zijn
     eigen beweringen kijkt, mist precies die klasse. */
  uit.sluit = t.open === 0 && t.gebroken === 0 && t.scriptfouten === 0 && t.schakels >= 7 && t.storingen >= 6;
  return uit;
}

function druk(u) {
  if (u.overgeslagen) { console.log('navigatieproef OVERGESLAGEN: ' + u.overgeslagen); return; }
  console.log('navigatieproef (' + u.browser + '): ' + u.telling.schakels + ' schakels (' +
    u.telling.gesloten + ' gesloten, ' + u.telling.open + ' open), ' + u.telling.storingen + ' storingen (' +
    u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken), ' + u.telling.scriptfouten + ' scriptfouten.');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(20) + s.stand.padEnd(10) + s.wat +
      '\n      ziet: ' + s.ziet + (s.antwoord ? '\n      gemeten: ' + s.antwoord : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  for (const f of u.scriptfouten) console.log('  !! SCRIPTFOUT: ' + f);
  console.log(u.sluit ? '\nDe keten sluit.' : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, SCHERM };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluit ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: NAVIGATIEPROEF.json');
    }
    /* Een overgeslagen ronde is geen geslaagde ronde, maar ook geen gezakte
       bouw: zonder browser is er niets gemeten. Dat staat in de uitslag. */
    process.exit(u.overgeslagen ? 0 : (u.sluit ? 0 : 1));
  }).catch(e => { console.error('de navigatieproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}
