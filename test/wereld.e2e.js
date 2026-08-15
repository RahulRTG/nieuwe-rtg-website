/* DE LEVENDE WERELD: het beginscherm als kring om de klok (shared/wereld.js).

   WAAROM DEZE TOETS BESTAAT. De wereldstand is de STANDAARD van het
   beginscherm -- het eerste wat een lid ziet. Alles eraan kan stil kapot: een
   ring die zijn merken op een hoop legt is nog steeds een ring met drie
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
/* BEWEGINGSARM METEN, en waarom dat geen uitweg is maar de juiste meting.

   De ring eased naar zijn stand in een rAF-lus. Op de bouwstraat draaien alle
   e2e-bestanden tegelijk op vier kernen, en dan staat zo'n lus soms seconden
   stil -- niet omdat het scherm kapot is maar omdat de machine druk is. Een
   toets die op die lus wacht, meet dus de drukte. Het budget verhogen maakt het
   erger: dan wacht hij ook echt zo lang, en loopt de hele ronde uit haar tijd.

   Wat deze toetsen willen weten is de STAND, niet de animatie: welke wereld op
   twaalf uur staat, wat de naam eronder zegt, of een sleep geen app opent. Die
   dingen zijn in bewegingsarme stand precies hetzelfde -- daar springt de ring
   er meteen heen (zie naar() in wereld-02.js). En bewegingsarm is geen kunstje:
   het is een echte voorkeur van echte leden, en die verdient dekking.

   De twee metingen die JUIST over beweging gaan (de levende grond en de
   sterrenhemel) draaien daarom bewust zonder deze stand. */
async function metLid(stand, fn, ritmeOpzet, rustig) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereld-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Wereld Lid',
      email: 'wereld' + process.pid + Date.now() + '@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 },
      reducedMotion: rustig === false ? 'no-preference' : 'reduce' });
    await ctx.addInitScript(([t, s, r]) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        if (s) localStorage.setItem('rtg_os_wereld', s);
        /* Een ritme voorwenden gebeurt HIER, in localStorage, en nergens anders.
           Dat is zelf het bewijs van de belangrijkste belofte: de server weet
           hier niets van. Zou het ritme van de server komen, dan kon deze toets
           het niet zo zetten. */
        if (r) localStorage.setItem('rtg_os_ritme_rtg', JSON.stringify(r));
      } catch (e) {}
    }, [reg.token, stand, ritmeOpzet]);
    const page = await ctx.newPage();
    /* De pas staat expliciet in het adres. Zonder deze query begint de ene
       poort correct met een doorverwijzing naar de pas van het lid; een toets
       die precies tijdens die navigatie meet, meet timing in plaats van de
       wereldring. */
    await page.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
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
    await page.evaluate(() => {
      const g = document.getElementById('onbGate');
      /* hidden is het signaal waarop Command wacht. Eerst die toestand laten
         waarnemen; pas na het opvouwen mag de testpoort definitief weg. */
      if (g) g.hidden = true;
    });
    /* RTG Command is na de intake de landing. De wereldtoetsen meten de ring
       en kloklaag eronder; open die via dezelfde knop als een lid, zodat de
       meting niet tegen een volledig correcte deklaag botst. */
    /* Wachten en klikken zijn bewust één browserstap. checkOnboarding kan de
       poort tussendoor opnieuw openen; een losse wait + click zag dan een knop
       die op de volgende event-lus alweer was afgebroken. */
    await page.waitForFunction(() => {
      /* checkOnboarding mag de testpoort intussen terugzetten. Herhaal het
         test-signaal in dezelfde poll waarmee we op Command wachten; zo kan
         zijn observer de toestand niet missen, ook niet onder CI-belasting. */
      const g = document.getElementById('onbGate');
      if (g) g.hidden = true;
      const k = document.querySelector('#rtgCommand .cmd-klok');
      if (!k) return false;
      k.click();
      if (g) g.remove();
      return true;
    }, null, { timeout: 30000 });
    await page.waitForFunction(() => {
      const s = document.querySelector('.os-thuisscherm');
      return !!(s && s.getBoundingClientRect().width > 100 && s.getBoundingClientRect().height > 100);
    }, null, { timeout: 10000 });
    await page.waitForTimeout(300);
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
    assert.equal(r.tegelsInDom, 3, 'de drie wereldtegels horen in de DOM te BLIJVEN bestaan');
    /* EEN KLOK. Twee klokken zou betekenen dat de wereldstand er zelf een is
       gaan tekenen, en dan lopen ze op een dag uit elkaar. */
    assert.equal(r.klokken, 1, 'er hoort precies EEN klok te zijn, geen tweede voor de wereldstand');
    assert.equal(r.klokInKring, true, 'de klok hoort in de kring te hangen');
  });
});

test('de merken liggen op een cirkel, en niet op een hoop',
  { skip: overslaan }, async () => {
  /* DE MUTATIE: haal in wereld-02.js de regel weg die m.style.left/top zet
     (of laat plaats() nooit aanroepen). De drie knoppen bestaan dan nog steeds,
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
    assert.equal(r.merken.length, 3, 'er horen exact drie hoofdwereldmerken te staan');
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
      RTGWereld.naar(2);
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
    assert.equal(viaMuis.stand.actief, 2, 'na naar(2) hoort de derde hoofdwereld actief te zijn');
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
    assert.equal(naPijl, 0, 'pijl-rechts hoort na de derde wereld door te reizen naar de eerste (kreeg stand ' + naPijl + ')');
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

    const a = await bezoek(1);
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

    const b = await bezoek(2);
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

test('de momenten van vandaag staan op de wijzerplaat, en de klok wordt dat moment',
  { skip: overslaan }, async () => {
  /* De klok droeg werelden; nu draagt hij ook TIJD. Drie dingen die daarbij echt
     moeten kloppen, en die je geen van drieen aan een afdruk ziet:

     1. Een tijdstip staat op de plek waar het HOORT. 14:00 op een
        twaalfuursverdeling is twee uur, dus rechtsboven -- niet ergens op de
        ring omdat het de tweede in de lijst was.
     2. De momenten DRAAIEN NIET MEE als je aan de werelden draait. Een tijdstip
        dat meedraait is geen tijdstip meer maar een versiering, en dat is precies
        het soort fout dat er goed uitziet.
     3. Tikken maakt de klok DAT moment: de wijzerplaat zakt weg en wat er dan is
        staat in dezelfde cirkel -- geen popup ernaast.

     DE MUTATIE: laat de momentenlaag meedraaien (zet de plaatsing in
     tekenMomenten op st.hoek, of hang hem in .os-bezel). Meting 2 zakt dan. */
  await metLid('aan', async ({ page }) => {
    await page.evaluate(() => RTGWereld.momenten([
      { tijd: '09:30', uur: 9, min: 30, titel: 'Ontbijt met Anne', sub: 'Bevestigd' },
      { tijd: '14:00', uur: 14, min: 0, titel: 'Project Europa', sub: '3 punten open' }
    ]));
    await page.waitForSelector('.os-moment', { timeout: 10000, state: 'attached' });

    const plek = await page.evaluate(() => {
      const k = document.querySelector('.os-wereldkring').getBoundingClientRect();
      const mx = k.left + k.width / 2, my = k.top + k.height / 2;
      return [...document.querySelectorAll('.os-moment')].map((m) => {
        const b = m.getBoundingClientRect();
        const x = b.left + b.width / 2 - mx, y = b.top + b.height / 2 - my;
        // hoek met de klok mee vanaf twaalf uur, zoals een wijzerplaat leest
        let h = Math.atan2(x, -y) * 180 / Math.PI; if (h < 0) h += 360;
        return { label: m.getAttribute('aria-label'), hoek: h, straal: Math.hypot(x, y) };
      });
    });
    assert.equal(plek.length, 2, 'er horen twee momenten te staan');
    // 09:30 -> 285 graden, 14:00 -> 60 graden
    const bij = (t) => plek.find((p) => p.label.indexOf(t) === 0);
    assert.ok(Math.abs(bij('14:00').hoek - 60) < 3,
      '14:00 hoort op twee uur te staan (60 graden), gemeten ' + Math.round(bij('14:00').hoek));
    assert.ok(Math.abs(bij('09:30').hoek - 285) < 3,
      '09:30 hoort op half tien te staan (285 graden), gemeten ' + Math.round(bij('09:30').hoek));

    /* En ze liggen tussen de wijzerplaat en de merken in. Raakt deze band de
       merken, dan loopt een tijdstip door een wereldglyf heen. */
    const merkStraal = await page.evaluate(() => {
      const k = document.querySelector('.os-wereldkring').getBoundingClientRect();
      const m = document.querySelector('.os-wm').getBoundingClientRect();
      return { straal: Math.hypot(m.left + m.width / 2 - (k.left + k.width / 2),
        m.top + m.height / 2 - (k.top + k.height / 2)), halveMerk: m.width / 2 };
    });
    assert.ok(Math.max(...plek.map((p) => p.straal)) < merkStraal.straal - merkStraal.halveMerk,
      'de momenten liggen tegen de wereldmerken aan; dan loopt een tijdstip door een glyf');

    // 2. draaien verplaatst de werelden, niet de tijd
    const naDraai = await page.evaluate(async () => {
      const hoek = () => {
        const k = document.querySelector('.os-wereldkring').getBoundingClientRect();
        const b = document.querySelector('.os-moment').getBoundingClientRect();
        const x = b.left + b.width / 2 - (k.left + k.width / 2);
        const y = b.top + b.height / 2 - (k.top + k.height / 2);
        let h = Math.atan2(x, -y) * 180 / Math.PI; if (h < 0) h += 360;
        return h;
      };
      const voor = hoek();
      RTGWereld.naar(2);
      let vorige = null, zelfde = 0;
      for (let i = 0; i < 150 && zelfde < 4; i++) {
        await new Promise((k) => setTimeout(k, 60));
        const nu = RTGWereld.stand().actief;
        if (nu === vorige) zelfde++; else { vorige = nu; zelfde = 0; }
      }
      return { voor, na: hoek(), wereld: RTGWereld.stand().actief };
    });
    assert.equal(naDraai.wereld, 2, 'de ring hoort wel naar de derde hoofdwereld gedraaid te zijn');
    assert.ok(Math.abs(naDraai.na - naDraai.voor) < 1,
      'de momenten draaiden mee met de bezel (van ' + Math.round(naDraai.voor) + ' naar ' +
      Math.round(naDraai.na) + ' graden); een tijdstip hoort stil te staan');

    // 3. tikken maakt de klok dat moment
    const open = await page.evaluate(async () => {
      [...document.querySelectorAll('.os-moment')].find((m) => m.getAttribute('aria-label').indexOf('14:00') === 0).click();
      await new Promise((k) => setTimeout(k, 400));
      const kaart = document.getElementById('osMomentKaart');
      return {
        moment: RTGWereld.stand().moment,
        zichtbaar: !kaart.hidden,
        tekst: kaart.textContent,
        klokVervaagd: Number(getComputedStyle(document.getElementById('homeKlok')).opacity) < 0.5,
        popups: document.querySelectorAll('.os-moment-kaart').length
      };
    });
    assert.equal(open.moment, true, 'na een tik hoort het moment open te staan');
    assert.equal(open.zichtbaar, true, 'de kaart van het moment hoort in beeld te komen');
    assert.match(open.tekst, /Project Europa/, 'het moment hoort te tonen wat er dan is');
    assert.equal(open.klokVervaagd, true,
      'de wijzerplaat hoort weg te zakken -- de klok WORDT het moment, hij krijgt er niets naast');

    // en Escape brengt je terug naar de klok
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => RTGWereld.stand().moment), false,
      'Escape hoort je terug te brengen naar de klok');
  });
});

test('Rahul kent je ritme, en houdt het op het toestel',
  { skip: overslaan }, async () => {
  /* "Normaal open je om deze tijd RTG Kantoor." De mooiste zin uit het ontwerp
     en de gevaarlijkste, want er zit gedrag van een mens onder. Deze toets meet
     de grenzen en niet alleen of de zin verschijnt:

     - Het ritme komt van het TOESTEL. Deze toets zet het in localStorage en
       nergens anders; verschijnt de zin dan toch, dan is dat het bewijs dat er
       geen serverkant aan zit. Zou iemand dit ooit naar de server verhuizen,
       dan zakt deze toets -- en dat is precies de bedoeling.
     - Tikken ZET KLAAR en opent niet. Het verschil is de hele afspraak: hij
       draait de bezel naar die wereld, jij besluit. Meteen openen zou van een
       aanbod een handeling maken die je niet gedaan hebt.
     - Weggetikt is weg. Geen tweede kans dezelfde dag, want dat is zeuren.

     DE MUTATIE: laat ritmeVolg() de wereld openen in plaats van ernaartoe te
     draaien (api.openUrl in plaats van naar()). De meting op de URL zakt dan. */
  const uur = new Date().getHours();
  const opzet = {};
  opzet['map-werk|' + uur] = { n: 5, t: Date.now() };
  opzet['map-media|' + uur] = { n: 1, t: Date.now() };

  await metLid('aan', async ({ page }) => {
    const pad = page.url();
    await page.waitForFunction(() => {
      const r = document.getElementById('osWereldRahul');
      return r && r.getAttribute('data-soort') === 'ritme' && r.getAttribute('data-toon') === 'ja';
    }, null, { timeout: 20000 });

    const ring = await page.evaluate(() => ({
      tekst: document.querySelector('#osWereldRahul span').textContent,
      // en het staat echt alleen op dit toestel
      lokaal: !!localStorage.getItem('rtg_os_ritme_rtg')
    }));
    assert.match(ring.tekst, /Normaal open je nu RTG Kantoor/,
      'de ring hoort te zeggen wat je normaal op dit uur opent, kreeg: ' + ring.tekst);
    assert.equal(ring.lokaal, true, 'het ritme hoort op het toestel te staan');
    /* GEEN AANDACHTTREKKERIJ. Geen teller, geen badge, geen uitroepteken -- dat
       is de grens uit CLAUDE.md, en die is aan de zin zelf af te lezen. */
    assert.ok(!/\d+ (keer|dagen|x)|streak|al \d/.test(ring.tekst),
      'de ring telt je gedrag terug naar je toe: ' + ring.tekst);

    // tikken ZET KLAAR: de bezel draait erheen, en we blijven op het beginscherm
    const na = await page.evaluate(async () => {
      document.getElementById('osWereldRahul').click();
      let vorige = null, zelfde = 0;
      for (let i = 0; i < 150 && zelfde < 4; i++) {
        await new Promise((k) => setTimeout(k, 60));
        const nu = RTGWereld.stand().actief;
        if (nu === vorige) zelfde++; else { vorige = nu; zelfde = 0; }
      }
      return { naam: RTGWereld.stand().naam, url: location.href,
        toon: document.getElementById('osWereldRahul').getAttribute('data-toon') };
    });
    assert.equal(na.url, pad, 'het ritme hoort klaar te ZETTEN, niet te openen; je belandde op ' + na.url);
    assert.equal(na.naam, 'RTG Kantoor', 'de bezel hoort naar die wereld te draaien, staat op ' + na.naam);
    assert.equal(na.toon, 'nee', 'na de tik hoort de ring te wijken');
  }, opzet);
});

test('zonder patroon zegt Rahul niets over je ritme',
  { skip: overslaan }, async () => {
  /* Liever stil dan een gok die als inzicht klinkt. Een keer iets openen is geen
     gewoonte, en een koploper die nauwelijks voorloopt is een muntworp.

     DE MUTATIE: haal de drempel weg in app-main-25b.js (RITME_DREMPEL op 0, of
     de 1.5-vergelijking eruit). Dan verschijnt hier alsnog een zin, en zakt deze
     toets -- terecht, want dan vertelt hij een lid iets over zichzelf op grond
     van twee keer klikken. */
  const uur = new Date().getHours();
  const zwak = {};
  zwak['map-werk|' + uur] = { n: 2, t: Date.now() };      // onder de drempel
  zwak['map-media|' + uur] = { n: 1.8, t: Date.now() };   // en geen duidelijke koploper

  await metLid('aan', async ({ page }) => {
    await page.waitForTimeout(3500);
    const soort = await page.evaluate(() => document.getElementById('osWereldRahul').getAttribute('data-soort'));
    assert.notEqual(soort, 'ritme',
      'hij doet een uitspraak over je ritme terwijl er geen patroon is');
  }, zwak);
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
  }, null, false);
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
      /* AFTELLEN TOT HIJ VERSCHOVEN IS, met een ruime bovengrens -- en niet een
         vaste tijd afwachten en dan oordelen. Een gezonde machine is binnen een
         paar seconden klaar; een machine die vier browsers tegelijk draait,
         tekent minder beelden per seconde en heeft langer nodig. Met een vaste
         wachttijd meet je dan de drukte in plaats van de hemel. De uitkomst is
         dezelfde meting, hij krijgt alleen de tijd die hij nodig heeft. */
      const meet = (a, b) => {
        let aanA = 0, aanB = 0, gelijk = 0;
        for (let i = 3; i < a.data.length; i += 4) {
          /* Ook het zwakste stof telt. Een helderheidsademhaling verandert de
             alpha, maar niet of het stofpunt er staat; alpha > 0 meet dus de
             vorm van het veld en niet zijn tijdelijke lichtsterkte. */
          const x = a.data[i] > 0, y = b.data[i] > 0;
          if (x) aanA++;
          if (y) aanB++;
          if (x && y) gelijk++;
        }
        const totaal = a.data.length / 4;
        const gemA = totaal ? aanA / totaal : 0;
        const gemB = totaal ? aanB / totaal : 0;
        /* Pearson-correlatie meet het RUIMTELIJKE beeld en niet alleen hoeveel
           pixels toevallig oplichten. Een globale helderheidsademhaling mag
           daardoor veranderen zonder als beweging te tellen; een vast
           stofpatroon blijft sterk gecorreleerd, een verschoven veld niet. */
        const spreiding = Math.sqrt(gemA * (1 - gemA) * gemB * (1 - gemB));
        const samenhang = spreiding
          ? Math.max(-1, Math.min(1, (gelijk / totaal - gemA * gemB) / spreiding)) : 1;
        const rauw = aanA ? gelijk / aanA : 1;
        return { aanA, aanB, gelijk, totaal, rauw, samenhang };
      };
      /* De nulmeting hoort bij het HUIDIGE doek. Tijdens de opbouw kan
         hangHemel() dat doek legitiem vervangen zodra de definitieve maat
         bekend is. Een losse voorwacht op zeven gelijke DOM-verwijzingen kon
         daardoor onder runnerbelasting twintig seconden lang zijn teller
         resetten zonder ooit de hemel te meten. Hier vernieuwt een wissel de
         nulmeting en loopt dezelfde begrensde inhoudsmeting gewoon door. */
      let a = null, r = null, beste = null, stabiel = 0, wissels = 0, zonderDoek = 0;
      for (let n = 0; n < 80; n++) {
        if (!a) {
          a = lees();
          if (!a) { zonderDoek++; await new Promise((k) => setTimeout(k, 750)); continue; }
        }
        await new Promise((k) => setTimeout(k, 750));
        const b = lees();
        if (!b) { zonderDoek++; a = null; beste = null; stabiel = 0; continue; }
        if (a.cv !== b.cv) { wissels++; a = b; beste = null; stabiel = 0; continue; }
        r = meet(a, b);
        stabiel++;
        /* Een ademend veld kan later toevallig weer meer pixels van de
           nulmeting raken. Dat maakt de eerdere, daadwerkelijk waargenomen
           beweging niet onwaar. Bewaar daarom de sterkste geldige meting van
           het HUIDIGE doek; een doekwissel wist hem hierboven terecht uit. */
        if (r.aanA && (!beste || r.samenhang < beste.samenhang)) beste = r;
        if (beste && beste.samenhang < 0.2) break; // ruim onder de eis: klaar
        if (stabiel >= 40) break;                        // dezelfde bovengrens als voorheen
      }
      return (beste || r) ? { ...(beste || r), wissels, zonderDoek } : {
        fout: 'geen stabiel sterrendoek binnen de meetgrens (' + wissels +
          ' wissels, ' + zonderDoek + ' keer afwezig)'
      };
    });
    assert.ok(!r.fout, 'de meting kon niet worden gedaan: ' + r.fout);

    assert.ok(r.aanA > 400,
      'er hoort een hemel te staan om te meten (opgelichte punten: ' + r.aanA + ')');
    assert.ok(r.samenhang < 0.35,
      'de hemel staat grotendeels stil: de ruimtelijke beeldcorrelatie is ' +
      Math.round(r.samenhang * 100) + '% (ruwe overlap ' + Math.round(r.rauw * 100) +
      '%). Het stofveld hoort mee te bewegen, niet als gebakken plaatje onder de ' +
      'draaiende sterren te liggen.');
  }, null, false);
});

test('Rahul zegt het EEN keer: in de ring, niet ook nog in de draad eronder',
  { skip: overslaan }, async () => {
  /* De regel is aangescherpt terwijl het ritme erbij kwam, en dat is de moeite
     waard om hier vast te leggen.

     WAS: alles wat Rahul zei ging naar de gouden ring, en de draad bleef dicht
     zodat het er niet twee keer stond.

     IS: zijn TERUGVALZIN ("er ligt niets dringends") krijgt de ring niet meer.
     De hele afspraak van die ring is dat hij er niet is tot Rahul iets HEEFT,
     en die zin is per definitie het tegenovergestelde -- dat is hem die netjes
     meldt dat er niets is. Het bleef ook niet bij lelijk: tikte je het ritme
     weg, dan kwam zijn lege zin er meteen voor in de plaats. Je zegt "laat maar"
     en krijgt er iets anders voor terug.

     Deze toets meet daarom allebei de helften.

     DE MUTATIE: laat rahulZei() de lege zin gewoon tonen (haal de `leeg`-tak
     eruit). Helft 2 zakt dan meteen. */
  await metLid('aan', async ({ page }) => {
    // 1. HEEFT hij iets, dan staat het in de ring en NIET ook in de draad
    const echt = await page.evaluate(async () => {
      RTGWereld.rahulZei('Je vlucht naar Lissabon is verplaatst naar 14:20.');
      await new Promise((k) => setTimeout(k, 300));
      const ring = document.getElementById('osWereldRahul');
      return {
        soort: ring.getAttribute('data-soort'),
        toon: ring.getAttribute('data-toon'),
        tekst: ring.querySelector('span').textContent,
        draadZichtbaar: getComputedStyle(document.getElementById('osAiDraad')).display !== 'none'
      };
    });
    assert.equal(echt.toon, 'ja', 'heeft Rahul iets, dan hoort de ring op te komen');
    assert.equal(echt.soort, 'rahul', 'en dan draagt de ring zijn bericht');
    assert.match(echt.tekst, /Lissabon/, 'de ring hoort te tonen wat hij zei');
    assert.equal(echt.draadZichtbaar, false,
      'de draad hoort dicht te blijven; anders staat dezelfde zin er twee keer');

    // en een tik opent het hele gesprek alsnog
    const na = await page.evaluate(async () => {
      document.getElementById('osWereldRahul').click();
      await new Promise((k) => setTimeout(k, 300));
      return {
        draadZichtbaar: getComputedStyle(document.getElementById('osAiDraad')).display !== 'none',
        ringZichtbaar: getComputedStyle(document.getElementById('osWereldRahul')).display !== 'none'
      };
    });
    assert.equal(na.draadZichtbaar, true, 'na een tik op de ring hoort het gesprek open te staan');
    assert.equal(na.ringZichtbaar, false, 'en dan hoort de ring te wijken');
  });

  // 2. heeft hij NIETS, dan blijft de ring dicht -- ook al zegt hij dat netjes
  await metLid('aan', async ({ page }) => {
    /* Een vers lid heeft geen seintjes, geen verwachtingen en niets geparkeerd,
       dus Rahul komt uit op zijn terugvalzin. Precies het geval dat de ring
       niet hoort te halen. */
    await page.waitForFunction(() => {
      const dr = document.getElementById('osAiDraad');
      return dr && dr.children.length > 0;
    }, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({
      draadTekst: document.getElementById('osAiDraad').lastElementChild.textContent,
      ringZichtbaar: getComputedStyle(document.getElementById('osWereldRahul')).display !== 'none',
      soort: document.getElementById('osWereldRahul').getAttribute('data-soort')
    }));
    assert.match(r.draadTekst, /niets dringends|nothing urgent/i,
      'deze helft meet de terugvalzin; hij zei iets anders: ' + r.draadTekst);
    assert.ok(!r.ringZichtbaar || r.soort === 'ritme',
      '"er ligt niets dringends" staat in de gouden ring; die is er voor als hij WEL iets heeft');
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
