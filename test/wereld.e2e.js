/* DE LEVENDE WERELD: het beginscherm als kring om de klok (shared/wereld.js).

   WAAROM DEZE TOETS BESTAAT. De wereldstand is de STANDAARD van het
   beginscherm -- het eerste wat een lid ziet. Alles eraan kan stil kapot: een
   ring die zijn merken op een hoop legt is nog steeds een ring met acht
   knoppen, een achtergrond die nul pixels tekent is nog steeds een canvas, en
   een gouden ring van Rahul naast een open gesprek is nog steeds een gouden
   ring. Geen van die drie geeft een foutmelding. Ze zijn hier alle drie een
   keer echt gebeurd; vandaar dat er per meting bij staat welke mutatie hem
   hoort te laten zakken.

   De rasterstand wordt elders gemeten (appmenu.e2e.js, apps-ui.e2e.js). Die
   toetsen zetten rtg_os_wereld op 'uit'; deze zet hem op 'aan' of laat hem
   bewust weg, want dat de standaard de wereld IS, is zelf een belofte.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
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
const overslaan = pw ? false : 'playwright niet beschikbaar in deze omgeving';

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}

/* Een echt lid: zonder inlog bouwt het beginscherm geen mappen, en dan heeft de
   ring niets om te tonen en meet deze toets niets. `stand` bepaalt wat er in
   localStorage staat -- null betekent bewust NIETS, om de standaard te meten. */
async function metLid(stand, fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereld-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Wereld Lid',
      email: 'wereld' + process.pid + Date.now() + '@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await ctx.addInitScript(([t, s]) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        if (s) localStorage.setItem('rtg_os_wereld', s);
      } catch (e) {}
    }, [reg.token, stand]);
    const page = await ctx.newPage();
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.RTGWereld && RTGWereld.stand().merken > 0, null, { timeout: 20000 });
    /* DE INTAKEPOORT GAAT WEG, EN NIET ALLEEN OP HIDDEN.

       Een vers lid krijgt Rahuls intake (#onbGate) over het scherm, en
       checkOnboarding() zet hem telkens terug zolang de intake niet klaar is.
       Voor een meting die alleen POSITIES leest maakt dat niets uit -- die staan
       er ook onder een deklaag gewoon -- en zo hebben de andere e2e-toetsen er
       jaren mee geleefd met een enkele `hidden = true`.

       Voor een ECHT muisgebaar is het het verschil tussen meten en niets meten:
       de tikken landden allemaal op .onb-card, de ring kreeg nul gebeurtenissen,
       en de toets leek van alles te bewijzen zonder de ring te hebben
       aangeraakt. Het element eruit halen is wel definitief: onbStartGesprek()
       vindt hem niet meer en keert meteen terug. De intake zelf wordt elders
       getoetst; deze toets gaat over de ring. */
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.remove(); });
    await page.waitForTimeout(500);
    await fn({ base, page });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('zonder voorkeur opent het beginscherm in de wereldstand, met de tegels weg',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: draai de standaard in wereld-06.js om (zet(stand0 === 'aan')
     zonder de `stand0 ?`-tak, zodat een lid zonder voorkeur het rooster krijgt).
     Deze toets zakt dan meteen -- en dat hoort, want welke stand een lid ZONDER
     voorkeur ziet, is het besluit waar dit hele scherm over gaat. */
  await metLid(null, async ({ page }) => {
    const r = await page.evaluate(() => {
      const scherm = document.querySelector('.os-thuisscherm');
      const mappen = document.getElementById('osMappen');
      return {
        stand: RTGWereld.stand(),
        attr: scherm.getAttribute('data-os-wereld'),
        mappenZichtbaar: getComputedStyle(mappen).display !== 'none',
        // de tegels zijn er nog: het is een andere weergave, geen ander scherm
        tegelsInDom: mappen.querySelectorAll('.os-app').length,
        klokken: document.querySelectorAll('#homeKlok').length,
        klokInKring: !!document.querySelector('.os-wereldkring > #homeKlok')
      };
    });
    assert.equal(r.stand.aan, true, 'de wereldstand hoort de standaard te zijn');
    assert.equal(r.attr, 'aan', 'het beginscherm draagt data-os-wereld="aan"');
    assert.equal(r.mappenZichtbaar, false, 'in de wereldstand horen de maprijen weg te zijn');
    assert.ok(r.tegelsInDom >= 7, 'de tegels horen te BLIJVEN bestaan (dezelfde lijst), er staan er ' + r.tegelsInDom);
    /* EEN KLOK. Twee klokken zou betekenen dat de wereldstand er zelf een is
       gaan tekenen, en dan lopen ze op een dag uit elkaar. */
    assert.equal(r.klokken, 1, 'er hoort precies EEN klok te zijn, geen tweede voor de wereldstand');
    assert.equal(r.klokInKring, true, 'de klok hoort in de kring te hangen');
  });
});

test('de merken liggen op een cirkel, en niet op een hoop',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: haal in wereld-02.js de regel weg die m.style.left/top zet
     (of laat plaats() nooit aanroepen). De acht knoppen bestaan dan nog steeds,
     hebben nog steeds hun aria-label en zijn nog steeds aanklikbaar -- ze
     liggen alleen allemaal linksboven op elkaar. Niets in de console zegt er
     iets over; dit is precies het soort stille breuk waar een e2e-toets voor
     is. */
  await metLid('aan', async ({ page }) => {
    const r = await page.evaluate(() => {
      const kring = document.querySelector('.os-wereldkring').getBoundingClientRect();
      const mx = kring.left + kring.width / 2, my = kring.top + kring.height / 2;
      const merken = [...document.querySelectorAll('.os-wm')].map((m) => {
        const b = m.getBoundingClientRect();
        const x = b.left + b.width / 2 - mx, y = b.top + b.height / 2 - my;
        return { straal: Math.hypot(x, y), hoek: Math.round(Math.atan2(y, x) * 180 / Math.PI) };
      });
      return { merken, kring: Math.round(kring.width), knoppen: document.querySelectorAll('.os-wm').length };
    });
    assert.ok(r.merken.length >= 7, 'er horen minstens zeven merken te staan, er zijn er ' + r.merken.length);
    const stralen = r.merken.map((m) => m.straal);
    const min = Math.min(...stralen), max = Math.max(...stralen);
    assert.ok(min > r.kring * 0.25,
      'de merken liggen te dicht op het midden (kleinste straal ' + Math.round(min) + ' bij een kring van ' + r.kring + ')');
    assert.ok(max - min <= 2,
      'de merken liggen niet op EEN cirkel: stralen lopen van ' + Math.round(min) + ' tot ' + Math.round(max));
    // en ze staan elk op een eigen hoek; dubbele hoeken = twee merken op elkaar
    assert.equal(new Set(r.merken.map((m) => m.hoek)).size, r.merken.length,
      'twee merken staan op dezelfde hoek');
  });
});

test('draaien verplaatst de wereld op twaalf uur, en de naam eronder volgt',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: laat plaats() st.actief niet meer uit de hoek afleiden maar
     op 0 staan. De ring draait dan nog steeds zichtbaar rond -- alleen wijst
     het merkteken op twaalf uur naar iets anders dan wat eronder staat. */
  await metLid('aan', async ({ page }) => {
    const eerste = await page.evaluate(() => RTGWereld.stand().naam);
    const viaMuis = await page.evaluate(async () => {
      /* WACHTEN TOT HIJ STILSTAAT, en niet een vaste tijd gokken. De ring eased
         naar zijn stand in een rAF-lus; wordt die uitgehongerd doordat de
         machine druk is -- op de bouwstraat draaien alle e2e-bestanden tegelijk
         -- dan is hij na 900 ms nog onderweg en meet de toets een tussenstand.
         Dat is geen fout in het scherm maar in de meting. */
      const stil = async () => {
        let vorige = null, zelfde = 0;
        for (let i = 0; i < 150 && zelfde < 4; i++) {
          await new Promise((k) => setTimeout(k, 60));
          const nu = RTGWereld.stand().actief;
          if (nu === vorige) zelfde++; else { vorige = nu; zelfde = 0; }
        }
      };
      RTGWereld.naar(3);
      await stil();
      const wm = [...document.querySelectorAll('.os-wm')].find((m) => m.dataset.actief === 'ja');
      return {
        stand: RTGWereld.stand(),
        naamOpScherm: document.getElementById('osWereldNaam').textContent.trim(),
        actiefLabel: wm && wm.getAttribute('aria-label'),
        // het actieve merk hoort BOVEN het midden te staan (twaalf uur)
        bovenMidden: (() => {
          const k = document.querySelector('.os-wereldkring').getBoundingClientRect();
          const b = wm.getBoundingClientRect();
          return (b.top + b.height / 2) < (k.top + k.height * 0.25);
        })()
      };
    });
    assert.equal(viaMuis.stand.actief, 3, 'na naar(3) hoort stand drie actief te zijn');
    assert.notEqual(viaMuis.stand.naam, eerste, 'er hoort een ANDERE wereld actief te zijn geworden');
    assert.equal(viaMuis.naamOpScherm, viaMuis.stand.naam, 'de naam onder de klok hoort de actieve wereld te zijn');
    assert.equal(viaMuis.actiefLabel, viaMuis.stand.naam, 'het gemarkeerde merk hoort dezelfde wereld te zijn');
    assert.equal(viaMuis.bovenMidden, true, 'het actieve merk hoort op twaalf uur te staan');

    // en met de pijltjestoetsen ook: dit scherm mag nooit alleen met een vinger
    // te bedienen zijn
    const naPijl = await page.evaluate(async () => {
      document.body.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      let vorige = null, zelfde = 0;
      for (let i = 0; i < 150 && zelfde < 4; i++) {
        await new Promise((k) => setTimeout(k, 60));
        const nu = RTGWereld.stand().actief;
        if (nu === vorige) zelfde++; else { vorige = nu; zelfde = 0; }
      }
      return RTGWereld.stand().actief;
    });
    assert.equal(naPijl, 4, 'pijl-rechts hoort een wereld verder te reizen (kreeg stand ' + naPijl + ')');
  });
});

test('inzoomen toont de onderdelen van DIE wereld, en uitzoomen komt er weer uit',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: laat zoom() st.wereldIdx niet zetten en ringItems() weer
     st.werelden[st.actief] lezen. Inzoomen werkt dan nog steeds -- en uitzoomen
     zet je op een WILLEKEURIGE andere wereld, namelijk de wereld met het nummer
     van het onderdeel waar je toevallig op stond. Precies die fout zat in de
     eerste versie, en je ziet hem alleen als je erop let. */
  await metLid('aan', async ({ page }) => {
    /* Twee keer inzoomen, op TWEE verschillende werelden. Dat is de kern van
       deze meting: onder de mutatie hierboven werkt inzoomen nog steeds en
       klopt de naam eronder ook nog -- alleen krijg je overal de onderdelen van
       dezelfde wereld te zien. Dat zie je pas als je twee werelden vergelijkt,
       en niet als je er een bekijkt. */
    const bezoek = (i) => page.evaluate(async (n) => {
      RTGWereld.naar(n);
      await new Promise((k) => setTimeout(k, 800));
      const voor = RTGWereld.stand();
      // wat de wereld ZELF zegt te dragen, in de regel onder zijn naam
      const belofte = Number((document.getElementById('osWereldSub').textContent.match(/\d+/) || [0])[0]);
      RTGWereld.zoom(true);
      await new Promise((k) => setTimeout(k, 500));
      const binnen = RTGWereld.stand();
      const labels = [...document.querySelectorAll('.os-wm')].map((m) => m.getAttribute('aria-label'));
      const diepAttr = document.querySelector('.os-wereldkring').getAttribute('data-diep');
      RTGWereld.zoom(false);
      await new Promise((k) => setTimeout(k, 500));
      return { voor, binnen, labels, belofte, diepAttr, terug: RTGWereld.stand() };
    }, i);

    const a = await bezoek(2);
    assert.equal(a.binnen.diep, true, 'na inzoomen hoor je binnen te staan');
    assert.equal(a.diepAttr, 'ja', 'de kring hoort te tonen dat je een niveau dieper staat');
    assert.equal(a.binnen.wereld, a.voor.naam, 'je hoort in de wereld te staan die op twaalf uur stond');
    assert.ok(!a.labels.includes(a.voor.naam),
      'binnen een wereld horen de ONDERDELEN op de ring te staan, niet de werelden zelf');
    /* De ring hoort er precies zoveel te dragen als de wereld zelf beloofde.
       Toon je de onderdelen van een ANDERE wereld, dan klopt dit aantal bijna
       nooit -- en op de zeldzame keer dat het klopt, vangt de vergelijking
       hieronder het alsnog. */
    assert.equal(a.labels.length, a.belofte,
      'de ring hoort de ' + a.belofte + ' onderdelen te tonen die deze wereld beloofde, kreeg er ' + a.labels.length);
    assert.equal(a.terug.diep, false, 'uitzoomen hoort je weer buiten te zetten');
    assert.equal(a.terug.naam, a.voor.naam,
      'uitzoomen hoort terug te komen op DEZELFDE wereld (was ' + a.voor.naam + ', werd ' + a.terug.naam + ')');

    const b = await bezoek(5);
    assert.notEqual(b.voor.naam, a.voor.naam, 'de tweede reis hoort naar een andere wereld te gaan');
    assert.equal(b.labels.length, b.belofte,
      'ook hier hoort de ring te tonen wat de wereld beloofde (' + b.belofte + '), kreeg er ' + b.labels.length);
    assert.notDeepEqual(b.labels, a.labels,
      'twee verschillende werelden horen verschillende onderdelen te tonen; nu toont ' +
      b.voor.naam + ' hetzelfde als ' + a.voor.naam);
  });
});

test('aan de ring draaien opent geen app, ook niet als je op een merk loslaat',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: haal de `if (st.gesleept) return;` uit de clickhandler van een
     merk in wereld-02.js. Draaien werkt dan nog steeds precies zoals het hoort
     -- en zodra je je vinger toevallig boven een merk loslaat, stuurt de
     browser daar een click achteraan en sta je in een andere app. Je hebt niets
     aangetikt; je hebt losgelaten.

     Deze meting gebruikt met opzet ECHTE muisgebeurtenissen en niet
     RTGWereld.naar(): het gaat juist om wat de browser er zelf achteraan
     stuurt, en dat gebeurt alleen bij een echt gebaar. */
  await metLid('aan', async ({ page }) => {
    const vak = await page.evaluate(() => {
      const b = document.querySelector('.os-wereldkring').getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 };
    });
    const voor = await page.evaluate(() => RTGWereld.stand().naam);
    const pad = page.url();

    // beetpakken op drie uur en een kwartslag naar beneden draaien
    const straal = vak.r * 0.82;
    const raakt = await page.evaluate(([x, y]) => {
      const e = document.elementFromPoint(x, y);
      return !!(e && e.closest && e.closest('.os-wereldkring'));
    }, [vak.x + straal, vak.y]);
    assert.equal(raakt, true,
      'de greep op de ring wordt door iets anders opgevangen; dan meet dit gebaar niets');

    await page.mouse.move(vak.x + straal, vak.y);
    await page.mouse.down();
    for (let g = 5; g <= 90; g += 5) {
      const rad = g * Math.PI / 180;
      await page.mouse.move(vak.x + straal * Math.cos(rad), vak.y + straal * Math.sin(rad));
    }

    /* NOG VOOR HET LOSLATEN AFLEZEN WAAR DE RING STAAT.

       Dit is de plek waar deze toets wisselvallig was, en de reden is de moeite
       waard. Hij draaide een achtste slag en las de stand pas NA het loslaten,
       na een vaste wachttijd van 900 ms. Twee dingen kunnen daar misgaan zodra
       de machine druk is -- en op de bouwstraat draaien alle 120 e2e-bestanden
       tegelijk op vier kernen:

       1. Muisbewegingen worden samengevoegd of vallen weg. Blijft de laatste
          die de pagina echt ziet onder de helft van een stand, dan klikt de
          bezel bij het loslaten gewoon terug naar waar hij vandaan kwam, en
          lijkt het alsof er niet gedraaid is.
       2. 900 ms is een gok. De ring eased naar zijn stand in een rAF-lus; wordt
          die uitgehongerd, dan is hij nog onderweg als de toets kijkt.

       Nu draait hij een kwartslag (twee standen, dus ruim over de drempel) en
       leest hij de stand terwijl de knop nog ingedrukt is -- daar volgt de
       actieve wereld al uit de hoek, zonder animatie ertussen. Geen wachttijd,
       geen drempel op het randje. */
    const tijdensSleep = await page.evaluate(() => RTGWereld.stand().naam);
    assert.notEqual(tijdensSleep, voor,
      'het gebaar hoort de ring echt te verdraaien (bleef staan op ' + voor + ')');

    await page.mouse.up();
    // wachten tot hij is uitgedraaid, en niet een vaste tijd gokken
    await page.waitForFunction(() => {
      const s = RTGWereld.stand();
      if (window.__vorigeStand === s.actief) return (window.__stil = (window.__stil || 0) + 1) > 3;
      window.__vorigeStand = s.actief; window.__stil = 0;
      return false;
    }, null, { timeout: 15000, polling: 120 });

    const na = await page.evaluate(() => ({ naam: RTGWereld.stand().naam, url: location.href }));
    assert.equal(na.url, pad, 'draaien hoort je op het beginscherm te laten; je belandde op ' + na.url);
    assert.notEqual(na.naam, voor,
      'na het loslaten hoort de ring op een andere wereld vast te klikken (bleef staan op ' + voor + ')');
  });
});

test('de levende grond tekent werkelijk iets', { skip: overslaan }, async () => {
  /* TWEE MUTATIES, en het verschil ertussen is precies waarom deze meting op de
     MAAT let en niet op "staat er iets":

     1. Zet grondMaat() terug op `clientWidth || 1`. Elke meting valt vóór de
        indeling, het canvas wordt 1 bij 1 pixel en er is niets te zien. Dat is
        geen verzonnen mutatie maar de fout die er zat.
     2. Haal alleen de ResizeObserver weg en houd de bewaking. Dan schrijft
        niemand meer een verkeerde maat -- maar niemand schrijft ook nog een
        goede, en het canvas houdt zijn EIGEN standaardmaat van 300 bij 150.
        Daar tekent een motief keurig op, netjes gevuld en volledig verkeerd
        geschaald. Een toets die alleen "meer dan honderd pixels breed" eist,
        loopt daar zo langs -- de eerste versie van deze meting deed dat, en
        keurde die mutatie goed.

     De eis is daarom de echte: de tekenmaat van het canvas hoort zijn maat op
     het scherm te zijn, maal de pixeldichtheid. */
  await metLid('aan', async ({ page }) => {
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const cv = document.querySelector('.os-wereld-grond');
      if (!cv) return { canvas: false };
      const dt = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < dt.length; i += 4) if (dt[i] > 0) n++;
      return { canvas: true, w: cv.width, h: cv.height, pixels: n,
        breed: cv.clientWidth, hoog: cv.clientHeight,
        dpr: Math.min(2, devicePixelRatio || 1) };
    });
    assert.equal(r.canvas, true, 'de levende grond hoort er te zijn');
    assert.ok(r.breed > 100 && r.hoog > 100,
      'de grond hoort het scherm te vullen (' + r.breed + 'x' + r.hoog + ' op het scherm)');
    assert.ok(Math.abs(r.w - r.breed * r.dpr) <= 2 && Math.abs(r.h - r.hoog * r.dpr) <= 2,
      'de tekenmaat hoort de schermmaat maal de pixeldichtheid te zijn: verwacht ' +
      Math.round(r.breed * r.dpr) + 'x' + Math.round(r.hoog * r.dpr) + ', kreeg ' + r.w + 'x' + r.h);
    assert.ok(r.pixels > 500, 'er hoort werkelijk iets getekend te zijn, geteld: ' + r.pixels + ' pixels');
  });
});

test('de sterrenhemel van de poort staat op ware grootte op het beginscherm',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: hang de sterrenhemel meteen op in plaats van te wachten tot het
     scherm een maat heeft (haal probeerHemel/de waarnemer uit wereld-05.js weg
     en roep RTGSterren.hang direct aan).

     Dat is geen verzonnen mutatie maar precies wat er misging, en het is
     verraderlijk: shared/sterren.js meet met Math.max(1, breedte), dus op een
     scherm dat nog geen maat heeft wordt het doek 1 bij 1 pixel. Het blad rekt
     die ene pixel uit over het hele scherm, en wat je krijgt is geen
     sterrenhemel maar een egale crèmekleurige lap over je hele beginscherm --
     met de klok en de tekst er onleesbaar doorheen. Geen enkele foutmelding.

     Vandaar dat deze meting naar de MAAT van het doek kijkt en niet naar "staat
     er een canvas": dat canvas stond er, en dat was juist het probleem. */
  await metLid('aan', async ({ page }) => {
    await page.waitForFunction(
      () => !!document.querySelector('.os-thuisscherm > canvas.rtg-sterren'),
      null, { timeout: 15000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const cv = document.querySelector('.os-thuisscherm > canvas.rtg-sterren');
      const dpr = Math.min(2, devicePixelRatio || 1);
      return { w: cv.width, h: cv.height, breed: cv.clientWidth, hoog: cv.clientHeight, dpr };
    });
    assert.ok(r.breed > 100 && r.hoog > 100,
      'de hemel hoort het beginscherm te vullen (' + r.breed + 'x' + r.hoog + ')');
    assert.ok(Math.abs(r.w - r.breed * r.dpr) <= 2 && Math.abs(r.h - r.hoog * r.dpr) <= 2,
      'de tekenmaat van de hemel hoort de schermmaat maal de pixeldichtheid te zijn: verwacht ' +
      Math.round(r.breed * r.dpr) + 'x' + Math.round(r.hoog * r.dpr) + ', kreeg ' + r.w + 'x' + r.h);
  });
});

test('de hele sterrenhemel beweegt, niet alleen de heldere sterren',
  { skip: overslaan }, async () => {
  /* WAT HIER MIS WAS, EN WAAROM JE HET OP EEN AFDRUK NOOIT ZIET.

     De hemel bestond uit twee lagen: een STOFVELD van duizenden minuscule
     puntjes, en daarboven zo'n dertienhonderd heldere sterren die langzaam
     ronddraaiden. Het stofveld werd EEN keer in een apart doek gebakken en
     daarna elk beeld ongewijzigd overgezet. Het overgrote deel van wat je zag
     stond dus muurvast, en juist die paar felle punten bewogen -- precies
     andersom dan het lijkt. Op een stilstaande afdruk is dat onzichtbaar; op
     een scherm waar je een minuut naar kijkt leest het als behang met een paar
     bewegende stipjes erover.

     Deze meting kijkt daarom naar de hemel op TWEE momenten en telt hoeveel
     opgelichte pixels er op precies dezelfde plek nog steeds oplichten. Staat
     het veld stil, dan is dat bijna alles; beweegt het echt, dan blijft er
     alleen toevallige overlap over (gemeten: 9,5%, zowel na zes als na twintig
     seconden -- het veld is dan volledig gedecorreleerd).

     DE MUTATIE: laat verfStof() met een vaste tijd tekenen (verfStof(0) in
     plaats van verfStof(t)) in sterren-03.js. Het stof staat dan weer stil, de
     heldere sterren draaien nog gewoon door, en het scherm ziet er op een
     afdruk identiek uit. Deze toets zakt dan meteen. */
  await metLid('aan', async ({ page }) => {
    /* Eerst wachten tot de hemel STIL HANGT: bij het opbouwen kan hij nog een
       keer opnieuw worden opgehangen (het scherm krijgt zijn maat, de intake
       gaat eraf). Meten terwijl dat nog kan, meet de opbouw en niet de hemel. */
    await page.waitForFunction(() => {
      const cv = document.querySelector('.os-thuisscherm > canvas.rtg-sterren');
      if (!cv) return false;
      if (window.__hemelVorig === cv) return (window.__hemelZelfde = (window.__hemelZelfde || 0) + 1) > 6;
      window.__hemelVorig = cv; window.__hemelZelfde = 0;
      return false;
    }, null, { timeout: 20000, polling: 250 });

    const r = await page.evaluate(async () => {
      /* HET DOEK ELKE KEER OPNIEUW OPZOEKEN, en niet een verwijzing vasthouden.
         De hemel wordt opnieuw opgehangen als het scherm van maat verandert
         (zie hangHemel in wereld-05.js), en dan wordt het oude doek uit de
         pagina gehaald. Een vastgehouden verwijzing wijst daarna naar een doek
         waar niemand meer op tekent -- dat staat per definitie stil, en dan
         zakt deze toets om zijn eigen fout in plaats van om de hemel. Precies
         dat gebeurde toen hij naast een andere toetsenreeks draaide. */
      const doek = () => document.querySelector('.os-thuisscherm > canvas.rtg-sterren');
      const lees = () => {
        const cv = doek();
        if (!cv) return null;
        const k = document.createElement('canvas');
        k.width = cv.width; k.height = cv.height;
        const c = k.getContext('2d');
        c.drawImage(cv, 0, 0);
        return { data: c.getImageData(0, 0, k.width, k.height).data, cv: cv };
      };
      const a = lees();
      await new Promise((k) => setTimeout(k, 6000));
      const b = lees();
      if (!a || !b) return { fout: 'geen sterrendoek' };
      // is het doek onderweg vervangen, dan valt er niets te vergelijken
      if (a.cv !== b.cv) return { fout: 'de hemel is tussentijds opnieuw opgehangen' };
      let aanA = 0, gelijk = 0;
      for (let i = 3; i < a.data.length; i += 4) {
        const x = a.data[i] > 8, y = b.data[i] > 8;
        if (x) aanA++;
        if (x && y) gelijk++;
      }
      return { aanA, gelijk };
    });
    assert.ok(!r.fout, 'de meting kon niet worden gedaan: ' + r.fout);

    assert.ok(r.aanA > 400,
      'er hoort een hemel te staan om te meten (opgelichte punten: ' + r.aanA + ')');
    const bleef = r.gelijk / r.aanA;
    assert.ok(bleef < 0.35,
      'de hemel staat grotendeels stil: na zes seconden licht ' + Math.round(bleef * 100) +
      '% van de punten nog op precies dezelfde plek op. Het stofveld hoort mee te bewegen, ' +
      'niet als gebakken plaatje onder de draaiende sterren te liggen.');
  });
});

test('Rahul zegt het EEN keer: in de ring, niet ook nog in de draad eronder',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: haal de regel in wereld.css weg die de draad en de tips in de
     wereldstand dichthoudt. Rahul staat er dan twee keer met dezelfde zin --
     een keer in de gouden ring, een keer in de bel eronder. Dat is precies wat
     er stond, en het las als ruis in plaats van als nadruk. */
  await metLid('aan', async ({ page }) => {
    // wachten tot Rahul uit zichzelf iets zegt (uit /fluister/profiel,
    // /voorspel of /spar/lijst -- app-main-29b.js)
    await page.waitForFunction(() => {
      const dr = document.getElementById('osAiDraad');
      return dr && dr.children.length > 0;
    }, null, { timeout: 20000 });

    const r = await page.evaluate(() => {
      const dr = document.getElementById('osAiDraad');
      const ring = document.getElementById('osWereldRahul');
      return {
        draadZichtbaar: getComputedStyle(dr).display !== 'none',
        ringZichtbaar: !!ring && getComputedStyle(ring).display !== 'none',
        ringTekst: ring ? ring.querySelector('span').textContent.trim() : '',
        draadTekst: dr.lastElementChild.textContent.trim()
      };
    });
    assert.equal(r.ringZichtbaar, true, 'de gouden ring van Rahul hoort op te komen als hij iets heeft');
    assert.equal(r.draadZichtbaar, false, 'de draad hoort dicht te blijven zolang je hem niet opent');
    assert.equal(r.ringTekst, r.draadTekst,
      'de ring hoort DEZELFDE zin te tonen die Rahul zei, niet een eigen verzinsel');

    // en een tik op de ring opent het hele gesprek alsnog
    const na = await page.evaluate(async () => {
      document.getElementById('osWereldRahul').click();
      await new Promise((k) => setTimeout(k, 300));
      return {
        draadZichtbaar: getComputedStyle(document.getElementById('osAiDraad')).display !== 'none',
        ringZichtbaar: getComputedStyle(document.getElementById('osWereldRahul')).display !== 'none'
      };
    });
    assert.equal(na.draadZichtbaar, true, 'na een tik op de ring hoort het gesprek open te staan');
    assert.equal(na.ringZichtbaar, false, 'en dan hoort de ring te wijken -- anders staat het er alsnog twee keer');
  });
});

test('de schakelaar zet het rooster terug, met dezelfde klok',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: laat zet(false) de klok in de kring staan. Het rooster komt dan
     keurig terug, met een leeg gat waar de klok hoorde te staan -- en de klok
     zelf hangt onzichtbaar in een verborgen kring. Dat is de reden dat deze
     toets niet alleen naar de tegels kijkt maar ook naar WAAR de klok hangt. */
  await metLid('aan', async ({ page }) => {
    const r = await page.evaluate(async () => {
      RTGWereld.zet(false);
      await new Promise((k) => setTimeout(k, 500));
      const kring = document.querySelector('.os-wereldkring');
      return {
        aan: RTGWereld.aan(),
        attr: document.querySelector('.os-thuisscherm').getAttribute('data-os-wereld'),
        mappenZichtbaar: getComputedStyle(document.getElementById('osMappen')).display !== 'none',
        klokInVak: !!document.querySelector('.os-klokvak > #homeKlok'),
        klokken: document.querySelectorAll('#homeKlok').length,
        kringZichtbaar: !!kring && getComputedStyle(kring).display !== 'none',
        bewaard: localStorage.getItem('rtg_os_wereld')
      };
    });
    assert.equal(r.aan, false, 'de schakelaar hoort de wereldstand uit te zetten');
    assert.equal(r.attr, 'uit', 'het beginscherm hoort data-os-wereld="uit" te dragen');
    assert.equal(r.mappenZichtbaar, true, 'het rooster met tegels hoort terug te zijn');
    assert.equal(r.kringZichtbaar, false, 'de kring hoort weg te zijn');
    assert.equal(r.klokken, 1, 'er hoort nog steeds precies EEN klok te zijn');
    assert.equal(r.klokInVak, true, 'de klok hoort terug in .os-klokvak te hangen');
    assert.equal(r.bewaard, 'uit', 'de keuze hoort bewaard te worden, anders staat hij bij de volgende start terug');
  });
});

test('het Command Wheel geeft werkwoorden door aan de balk van Rahul',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: laat de knop in wereld-04.js alleen het wiel sluiten en niets
     doorgeven. Het wiel gaat dan nog steeds mooi open en dicht -- en doet
     niets. Een bediening die alleen beweegt is een animatie. */
  await metLid('aan', async ({ page }) => {
    const r = await page.evaluate(async () => {
      RTGWereld.wiel(true);
      await new Promise((k) => setTimeout(k, 300));
      const knoppen = [...document.querySelectorAll('.os-wiel-knop')].map((b) => b.textContent.trim());
      const wereld = RTGWereld.stand().naam;
      document.querySelectorAll('.os-wiel-knop')[0].click();
      await new Promise((k) => setTimeout(k, 300));
      return { knoppen, wereld, open: RTGWereld.stand().wiel,
        invoer: document.getElementById('osAiIn').value };
    });
    assert.deepEqual(r.knoppen, ['Regel', 'Zoek', 'Analyseer', 'Maak', 'Automatiseer'],
      'het wiel hoort de vijf werkwoorden te dragen, niet een menu met apps');
    assert.equal(r.open, false, 'na een keuze hoort het wiel dicht te zijn');
    assert.match(r.invoer, /^Regel /, 'het werkwoord hoort in de balk van Rahul te staan, kreeg: ' + JSON.stringify(r.invoer));
    assert.ok(r.invoer.includes(r.wereld.replace(/^RTG /, '')),
      'de wereld waar je stond hoort mee te gaan als context, kreeg: ' + JSON.stringify(r.invoer));
  });
});
