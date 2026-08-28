/* Toegankelijkheids-scan (npm run a11y):
   serveert public/ statisch, opent ELK scherm onder public/apps in een echte
   browser, injecteert de EIGEN keuring (scripts/a11ykeuring.js, verving axe-core)
   en faalt bij een ondubbelzinnige structurele overtreding (afbeelding zonder
   alt, veld zonder label, knop/link zonder naam, geen lang, lege titel).
   Kleurcontrast telt mee als fout (was adviserend; zie velt() in a11ykeuring.js).

   De scan heeft een browser nodig. Is Playwright of Chromium er niet (zoals
   op een kale CI zonder browsers), dan slaat de scan zichzelf netjes over met
   exitcode 0 in plaats van te breken; scripts/check.js bewaakt intussen de
   statische a11y-regels die altijd draaien. Forceer falen-bij-afwezigheid met
   A11Y_STRICT=1. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const STRICT = process.env.A11Y_STRICT === '1';

/* ALLE SCHERMEN, EN NIET MEER EEN LIJST MET DE HAND.

   Hier stond een opsomming van 32 "vlaggenschip"-schermen. Dat was 12% van de
   258 schermen onder public/apps, en de andere 227 kregen alleen de statische
   regels uit check.js. Een poort die als volledig voelt en een achtste meet is
   erger dan geen poort: hij maakt "schoon" tot een aanname.

   Erger nog: die lijst moest met de hand bij. Bij /apps/wereld.html staat in de
   oude opmerking letterlijk "een nieuw scherm hoort meteen in de keuring te
   staan, anders is 'schoon' een aanname" -- en dat is precies wat een handmatige
   lijst niet kan garanderen.

   De inventaris komt nu uit scripts/schermen.js, dezelfde functie waarmee de
   schermdekking wordt geteld. Die heeft er ook het principe bij staan: geen
   uitzonderingslijst, want wie een scherm niet wil laten toetsen moet dat kunnen
   uitleggen, en die uitleg hoort in TAKEN.md en niet in een filter hier.

   WAT DE SCAN NOG STEEDS NIET ZIET: de ingelogde staat. Elk scherm wordt bij de
   EERSTE render bekeken, uitgelogd, en alles wat achter de inlog opengaat blijft
   ongemeten. Dat is de volgende stap en geen eigenschap van deze lijst. */
const { alleSchermen } = require('./schermen');
const { ontleedDeel, verdeel } = require('./lib/delen');
/* WIE IETS VINDT, MEET NOG EEN KEER -- zie scripts/a11y-hermeet.js. Kwam met
   main mee (7bb6a6e8) en was bij de samenvoeging van 24 augustus stil verdwenen:
   de module bleef staan, haar aanroepers niet. Twee volle scans op dezelfde code
   gaven toen twee verschillende uitkomsten. */
const hermeet = require('./a11y-hermeet');
/* alleSchermen() loopt public/apps af. Het 404-scherm staat in public/site en
   viel daarmee buiten de keuring -- terwijl het juist een scherm is dat een
   bezoeker onverwacht krijgt. Er is geen derde plek: dit zijn alle .html onder
   public. */
const ALLE_PAGINAS = alleSchermen().concat(['/site/404.html']);

/* OPGEDEELD METEN, EEN KEER OORDELEN (27 augustus 2026).

     --deel=2/4          meet alleen dit kwart van de schermen
     --meting=<bestand>  schrijf de RUWE tellingen daarheen en vel geen oordeel

   Waarom die twee bij elkaar horen: het oordeel van deze scan is een budget over
   de HELE ronde (A11Y-INGELOGD.json). Een deel dat zijn eigen kwart tegen dat
   budget legt, laat vier keer zoveel door. Dus meet een deel alleen, en telt
   scripts/a11y-oordeel.js de delen op voordat er een oordeel valt. Zonder deze
   vlaggen doet dit script precies wat het altijd deed: alles meten en zelf
   oordelen -- dat is wat `npm run a11y` lokaal draait. */
const deelVlag = (process.argv.find(a => a.startsWith('--deel=')) || '').slice(7);
const deel = (() => {
  if (!deelVlag) return null;
  const d = ontleedDeel(deelVlag);
  if (!d) { console.error('[a11y] --deel verwacht de vorm N/M met 1 <= N <= M, kreeg: ' + deelVlag); process.exit(2); }
  return d;
})();
const metingUit = (process.argv.find(a => a.startsWith('--meting=')) || '').slice(9);
const PAGINAS = verdeel(ALLE_PAGINAS, deel);
if (!PAGINAS.length) {
  console.error('[a11y] dit deel heeft geen schermen; dat is geen groene ronde maar een lege.');
  process.exit(2);
}

/* DE BROWSER KOMT UIT scripts/lib/scherm.js EN NIET UIT EEN EIGEN LADER.

   Hier stond een laadPlaywright() met een terugval die nooit draaide, want
   `require('playwright')` slaagt ook als de browser erachter ontbreekt. Op deze
   machine wees de standaard Playwright naar chromium-1234 terwijl er 1194
   stond: deze scan meldde zich dus af met "geen browser" terwijl er een was --
   en dan staat er in TOEGANKELIJK.md een nul die niemand gemeten heeft. Zie de
   kop van die module voor de hele vindwijze. */
/* DE BROWSERKEUZE KOMT SINDS 23 AUGUSTUS UIT test/browser.js (main): die
   probeert te STARTEN in plaats van te laden en loopt de kandidaten af tot er
   een echt opent. Dat is de sterkere reparatie van dezelfde valse "geen
   browser" die scripts/lib/scherm.js eerder ving: een require die slaagt
   terwijl de Chromium erachter ontbreekt. herkomst() blijft uit lib/scherm
   komen -- test/browser.js heeft die functie niet. */
/* EEN SCHERM DAT ZICHZELF WEGSTUURT, LAAT DE HELE KEURING NIET VALLEN.

   Een pagina die na het laden zelf naar een ander adres springt (een poort, een
   apparaatgrens) onderbreekt de VOLGENDE goto: Playwright gooit dan
   "Navigation to ... is interrupted by another navigation". Die worp stond
   buiten elke vangst, dus na 273 schermen maal drie thema's viel de hele ronde
   om op een enkel scherm -- op 27 augustus 2026 was dat kantoorpda.html onder
   royal, terwijl champagne en bordeaux er net op tijd langs waren. Dat is een
   race en geen oordeel.

   Twee keer proberen dus, met een adempauze ertussen zodat de sprong van het
   vorige scherm klaar is. Lukt het dan nog niet, dan is het WEL een bevinding:
   een scherm dat niet te keuren is, telt hier als gebrek en wordt niet
   stilzwijgend overgeslagen. */
async function ga(pg, url) {
  try { await pg.goto(url, { waitUntil: 'load' }); return null; }
  catch (e) {
    try {
      await pg.waitForTimeout(700);
      await pg.goto(url, { waitUntil: 'load' });
      return null;
    } catch (e2) { return e2.message.split('\n')[0]; }
  }
}

function laadPlaywright() {
  try { return require('../test/browser').laadBrowser(); }
  catch (e) { try { return require('./lib/scherm').laadScherm(); } catch (e2) { return null; } }
}
const { herkomst: browserHerkomst } = require('./lib/scherm');

/* DE ECHTE SERVER, NIET EEN STATISCHE MAP.

   Hier stond een klein http-servertje dat public/ uitdeelde. Dat kan geen
   ingelogde staat leveren: geen /api, geen sessie, dus keurde de scan alleen de
   uitgelogde eerste render. Voor vrijwel elk scherm in dit huis is dat de
   buitenkant van de deur -- gemeten op /apps/app.html: uitgelogd 367 tekens
   zichtbare tekst, ingelogd 769. Meer dan de helft was ongemeten.

   Twee dingen die daarbij veranderen. De echte server stuurt een CSP mee met een
   nonce, en daardoor wordt een geinjecteerd inline script GEBLOKKEERD: de keuring
   gaat nu via page.evaluate (dat loopt buiten de CSP om) in plaats van via
   addScriptTag. En hij heeft een wegwerpdatamap nodig, want de scan maakt een
   echt proeflid aan. Zelfde opzet als de proef-familie in scripts/. */
function startEchteServer() {
  const net = require('net');
  const { spawn } = require('child_process');
  const os = require('os');
  return new Promise((klaar, mis) => {
    const s = net.createServer();
    s.unref(); s.on('error', mis);
    s.listen(0, '127.0.0.1', () => {
      const poort = s.address().port;
      s.close(async () => {
        const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-a11y-'));
        const kind = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], {
          cwd: ROOT, stdio: 'ignore',
          /* RTG_DEMO: de demozaken (en dus de zaak-inlog van de derde ronde)
             worden alleen in demostand gezaaid -- test/helper.js doet hetzelfde.
             Zonder die vlag kent deze wegwerpserver geen enkele leverancier en
             valt de zaakronde om op "Deze leverancierscode kennen we niet". Het
             is bovendien de betere stand om a11y in te meten: de schermen hebben
             er echte inhoud in plaats van lege lijsten. */
          env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '',
            STUN_UIT: '1', NODE_ENV: 'test', RTG_DEMO: '', RTG_MAGNAAT_TEST: '1' }
        });
        const basis = 'http://127.0.0.1:' + poort;
        const stop = () => { try { kind.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} };
        for (let i = 0; i < 300; i++) {
          /* WACHTEN OP /api/ready EN NIET OP /api/health: health is op zodra de
             poort luistert, maar de opslagpoortwachter geeft daarna nog 503 op
             ELKE API tot de opslag echt geladen is. */
          try { if ((await fetch(basis + '/api/ready')).ok) return klaar({ basis, stop }); } catch (e) { /* nog niet op */ }
          await new Promise(r => setTimeout(r, 200));
        }
        stop(); mis(new Error('de server kwam niet op'));
      });
    });
  });
}

(async () => {
  const pw = laadPlaywright();
  console.log('[a11y] browser: ' + browserHerkomst());
  if (!pw) {
    console.log('[a11y] Playwright niet beschikbaar; scan overgeslagen (statische a11y-regels draaien in check.js).');
    process.exit(STRICT ? 1 : 0);
  }
  const { BRON, velt } = require('./a11ykeuring'); // eigen keuring (verving axe-core)
  const raakvlak = require('./raakvlakkeuring');   // WCAG 2.5.8, derde ronde op telefoonformaat
  const mobiel = require('./mobielkeuring');       // past het, en is het met een duim te doen (GRAMMATICA.md)
  const server = await startEchteServer();
  const basis = server.basis;

  /* DE BROWSER WORDT GEZOCHT EN NIET OP EEN PLEK VERWACHT.

     Playwright zoekt de build die bij ZIJN versie hoort ("chromium_headless_
     shell-1234"). Staat er een andere op de machine -- een omgeving die
     browsers voorinstalleert, een distro-chromium, een andere pin -- dan
     faalde de start en sloeg deze scan zichzelf over. Dat is de duurste
     uitkomst die er is: er ligt een prima browser op schijf en de poort meldt
     "overgeslagen" met exitcode 0, dus alles ziet er groen uit terwijl er 258
     schermen ongekeurd blijven.

     Dus: eerst de gepinde build, en anders de eerste die er echt staat. Welke
     het werd staat in de uitvoer, want een keuring die niet zegt waarmee hij
     gemeten heeft, is een keuring die je niet kunt narekenen. */
  const kandidaten = [
    process.env.RTG_CHROMIUM,
    process.env.PLAYWRIGHT_BROWSERS_PATH && path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'),
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'
  ].filter(p => { try { return p && fs.existsSync(p); } catch (e) { return false; } });

  let browser, waarmee = 'de gepinde Playwright-build';
  try {
    /* RTG_CHROMIUM wijst een browser aan die niet op de plek staat die het
       pakket verwacht (een ontwikkelbak met een eigen chromium). Leeg is
       undefined en dus precies het gedrag van hiervoor. Lukt ook dat niet,
       dan lopen we de kandidaat-paden af voor we het opgeven. */
    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.RTG_CHROMIUM || undefined });
  } catch (eerste) {
    for (const pad of kandidaten) {
      try {
        browser = await pw.chromium.launch({ executablePath: pad, args: ['--no-sandbox'] });
        waarmee = pad;
        break;
      } catch (e2) { /* volgende kandidaat */ }
    }
    if (!browser) {
      console.log('[a11y] Kon Chromium niet starten; scan overgeslagen:', eerste.message);
      if (kandidaten.length) console.log('[a11y] geprobeerd:', kandidaten.join(', '));
      server.stop();
      process.exit(STRICT ? 1 : 0);
    }
  }
  console.log('[a11y] browser:', waarmee);

  /* Een echt proeflid, zodat de tweede ronde een ECHTE sessie heeft en niet een
     verzonnen token dat de server toch weigert. */
  const u = Date.now().toString().slice(-8);
  const lid = await fetch(basis + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Keurlid', email: 'keur' + u + '@x.nl', phone: '06' + u,
      password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' })
  }).then(r => r.json()).catch(() => ({}));
  if (!lid || !lid.token) {
    console.error('[a11y] MISLUKT: geen proeflid, dus de ingelogde ronde zou stil worden overgeslagen.');
    await browser.close(); server.stop(); process.exit(1);
  }

  /* EN EEN ZAAK-SESSIE, WANT DAAR WERKT HET PERSONEEL.

     Teruggezet op 25 augustus 2026. Deze ronde kwam met main mee (f330a015) en
     is bij de samenvoeging van 24 augustus stil verdwenen: die nam onze versie
     van dit bestand wholesale over om de tablet- en tweehandige rondes te
     behouden, en gooide daarmee de derde staat weg zonder dat iemand het zag.
     Het register wist het nog wel -- A11Y-INGELOGD.json draagt nog steeds het
     `zaak`-blok met zijn nullen -- dus stond er een grens die niets meer mat.
     Precies de fout die dit blok kwam opheffen, in omgekeerde richting.

     Gemeten op 23 augustus 2026, met de hand, over negen horecaschermen: zonder
     zaak-sessie 0 structureel en 0 contrast, met zaak-sessie 1 structureel en 15
     contrast. Precies dezelfde schermen. Dat verschil hoort in de poort te
     zitten en niet in het hoofd van wie het toevallig een keer heeft nagemeten. */
  const roster = await fetch(basis + '/api/supplier/roster', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'KIKUNOI' })
  }).then(r => r.json()).catch(() => ({}));
  const baas = ((roster || {}).staff || []).find(x => x.role === 'manager') || ((roster || {}).staff || [])[0];
  const zaak = baas ? await fetch(basis + '/api/supplier/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'KIKUNOI', staffId: baas.id, pin: '1234' })
  }).then(r => r.json()).catch(() => ({})) : {};
  if (!zaak || !zaak.token) {
    console.error('[a11y] MISLUKT: geen zaak-sessie, dus de zaakronde zou stil worden overgeslagen.');
    console.error('        roster: ' + JSON.stringify(roster).slice(0, 200));
    console.error('        inlog:  ' + JSON.stringify(zaak).slice(0, 200));
    await browser.close(); server.stop(); process.exit(1);
  }

  /* EN EEN GEZIN, WANT ANDERS MEET DE TELEFOONRONDE VIJFENVIJFTIG KEER EEN DEUR.

     Dit is de duurste meetfout van de hele ronde geweest. De RTF-leerling- en
     gezinsschermen hangen achter een tweede deur (apps/foundation/sessie.js:
     "Deze ruimte blijft nog dicht -- kies eerst jouw eigen profiel"), en die
     deur staat LOS van het RTG-lidmaatschap. Met alleen `lid` opende geen enkel
     van die schermen: de keuring mat vijfenvijftig keer hetzelfde slot en
     rapporteerde ze alle vijfenvijftig als "geen hoofdhandeling". Dat is geen
     bevinding maar een blinde vlek met een getal eromheen -- 22% van het
     platform stond in het register als gemeten terwijl het nooit open is
     geweest.

     Een gezin plus een profiel kost twee POSTs. De e2e-toetsen deden dit al
     (test/rtfagenda.e2e.js); de keuring niet. */
  const gezin = await fetch(basis + '/api/foundation/gezin/maak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    /* bevoegdGezin en privacyAkkoord zijn sinds 22 augustus 2026 verplicht: een
       gezin aanmaken vraagt om een bevestiging dat je dat mag en de
       privacy-uitleg begrijpt (server/foundation/gezin.js). Deze scan bootst een
       echte gebruiker na, dus hij bevestigt ze net als die gebruiker -- en niet
       door de poort te omzeilen met NODE_ENV=test. */
    body: JSON.stringify({ gezinsnaam: 'Keurgezin', naam: 'Papa', pin: '1234',
      bevoegdGezin: true, privacyAkkoord: true })
  }).then(r => r.json()).catch(() => ({}));
  if (!gezin || !gezin.token) {
    console.error('[a11y] MISLUKT: geen proefgezin, dus de RTF-schermen zouden achter hun deur blijven staan.');
    await browser.close(); server.stop(); process.exit(1);
  }
  const RTF_SESSIE = { code: gezin.code, token: gezin.token, profiel: { naam: 'Papa', beheerder: true } };

  /* EN EEN LEERLINGPROFIEL VOOR DE CAMPUS. Dat is het ene RTF-scherm dat een
     gezinstoken NIET opent: "De Campus is de persoonlijke werkplek van een
     leerlingprofiel". Een profieltoken opent hem wel, maar sluit de blokken die
     alleen een beheerder ziet (het maakblok van klusjes, beheer.html), dus het
     gezinsprofiel blijft de standaard en dit token wordt alleen voor campus
     ingezet. De geboortedatum moet erbij: zonder leeftijd komt de leeftijdspoort
     ervoor ("Vul eerst de geboortedatum in"). */
  const kind = await fetch(basis + '/api/foundation/gezin/profiel/maak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: gezin.code, token: gezin.token, naam: 'Milan', rol: 'kind',
      groep: 'kind', kleur: '#3A7BD5', geboortedatum: '2015-04-04' })
  }).then(r => r.json()).catch(() => ({}));
  const kiesKind = (kind && kind.profiel) ? await fetch(basis + '/api/foundation/gezin/profiel/kies', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: gezin.code, token: gezin.token, profielId: kind.profiel.id })
  }).then(r => r.json()).catch(() => ({})) : {};
  const RTF_KIND = (kiesKind && kiesKind.token)
    ? { code: gezin.code, token: kiesKind.token, profiel: kiesKind.profiel } : null;
  if (!RTF_KIND) console.error('[a11y] LET OP: geen leerlingprofiel -- /apps/foundation/campus.html wordt aan zijn deur gemeten.');
  /* Wat hier NIET lukt, en dat staat er liever dan een stil gat: bord.html en
     schrift.html hangen achter een TIJDELIJKE SCHOOLPAS -- een klassleutel die
     alleen in de tab van een lopende les bestaat en na dertig minuten vervalt.
     Die is niet aan te maken zonder een les te starten (/api/les/maak, met een
     model erachter). Die twee worden dus aan hun deur gemeten; zie
     TOEGANKELIJK.md. */
  const EIGEN_SESSIE = { '/apps/foundation/campus.html': RTF_KIND };

  /* EN EEN LES, WANT DAARMEE GAAN DE LAATSTE TWEE DEUREN OPEN.

     /apps/foundation/bord.html en schrift.html hangen achter een TIJDELIJKE
     SCHOOLPAS (shared/rtg-school-session.js): een klassleutel die alleen in
     sessionStorage van die tab staat en na dertig minuten vervalt. Ik had die
     twee opgeschreven als "niet aan te maken zonder een model achter
     /api/les/maak" -- en dat was verkeerd gemeten. Die route heeft een
     handmatige werkmodus (CLAUDE.md: zonder model blijven de kernprocessen
     beschikbaar) en levert gewoon een les met een code.

     Allebei de schermen nemen code en sleutel uit de URL over. Twee schermen
     die aan hun deur gemeten werden, worden nu aan hun inhoud gemeten. */
  const les = await fetch(basis + '/api/les/maak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onderwerp: 'breuken', groep: 'groep 6', aantal: 3 })
  }).then(r => r.json()).catch(() => ({}));
  const mee = (les && les.code) ? await fetch(basis + '/api/les/mee', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: les.code, naam: 'Milan' })
  }).then(r => r.json()).catch(() => ({})) : {};
  const EIGEN_PAD = {};
  if (les && les.code && les.leraarToken) {
    EIGEN_PAD['/apps/foundation/bord.html'] =
      '/apps/foundation/bord.html?code=' + les.code + '&t=' + les.leraarToken;
  }
  if (les && les.code && mee && mee.deelnemerToken) {
    EIGEN_PAD['/apps/foundation/schrift.html'] =
      '/apps/foundation/schrift.html?code=' + les.code + '&t=' + mee.deelnemerToken;
  }
  if (Object.keys(EIGEN_PAD).length < 2) {
    console.error('[a11y] LET OP: geen schoolpas -- bord.html en/of schrift.html worden aan hun deur gemeten.');
  }

  /* De keuring gaat via evaluate en niet via addScriptTag: de echte server stuurt
     een CSP met nonce mee en die blokkeert een inline script. In een IIFE, want
     evaluate met een string verwacht een expressie en BRON begint met functies. */
  const KEUR = '(function(){' + BRON + '\nreturn window.__a11yKeur()})()';

  let totaal = 0, contrastTotaal = 0;
  const perRonde = [];
  /* De dekking van deze poort, opgeteld over alles wat hij bekijkt. Zie de kop
     bij `dekking` in a11ykeuring.js: dit getal stond met de hand geteld in twee
     documenten en was mis. */
  const dekking = { gemeten: 0, url: 0, onzichtbaar: 0, alfanul: 0 };
  const telDekking = (d) => { if (d) for (const k of Object.keys(dekking)) dekking[k] += d[k] || 0; };

  /* Drie staten, en elke staat zet zijn EIGEN sleutels. Niet allebei de tokens
     tegelijk: een scherm dat zowel een lid als een zaak herkent, kiest dan zelf
     welke het toont, en dan meet de scan iets wat in het echt zelden voorkomt. */
  for (const ronde of [
    { naam: 'uitgelogd', sleutels: null },
    { naam: 'ingelogd', sleutels: { rtg_member_token: lid.token } },
    { naam: 'zaak', sleutels: { rtg_sup_token: zaak.token } }
  ]) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    if (ronde.sleutels) {
      await context.addInitScript((s) => {
        try {
          for (const k of Object.keys(s)) localStorage.setItem(k, s[k]);
          localStorage.setItem('rtg_cookieinfo_v1', '1');
        } catch (e) {}
      }, ronde.sleutels);
    }
    const page = await context.newPage();
    let struct = 0, contr = 0;
    console.log(`\n[a11y] ===== ronde ${ronde.naam.toUpperCase()} (${PAGINAS.length} schermen) =====`);

    for (const pad of PAGINAS) {
      const misging = await ga(page, basis + pad);
      if (misging) {
        console.error(`[a11y] ${pad} (${ronde.naam}): niet te openen -- ${misging}`);
        struct += 1; continue;
      }
      await page.waitForTimeout(600); // laat intro-animaties (opacity) uitlopen
      let res;
      try { res = await hermeet(page, KEUR, (r) => r.overtredingen.length || r.contrast.length); }
      catch (e) {
        console.error(`[a11y] ${pad} (${ronde.naam}): de keuring kon niet draaien -- ${e.message.split('\n')[0]}`);
        struct += 1; continue;
      }
      telDekking(res.dekking);
      if (res.overtredingen.length) {
        struct += res.overtredingen.reduce((n, v) => n + v.aantal, 0);
        console.log(`\n[a11y] ${pad} (${ronde.naam}): ${res.overtredingen.length} soort(en) structurele overtreding`);
        for (const v of res.overtredingen) {
          console.log(`  · ${v.id}: ${v.help} (${v.aantal}x)`);
          for (const w of (v.waar || [])) console.log(`      ${w}`);
        }
      }
      if (res.contrast.length) {
        contr += res.contrast.reduce((n, v) => n + v.aantal, 0);
        console.log(`\n[a11y] ${pad} (${ronde.naam}):`);
        for (const v of res.contrast) {
          console.log(`  · contrast: ${v.help} (${v.aantal}x)`);
          for (const w of (v.waar || [])) console.log(`      ${w}`);
        }
      }
    }
    await context.close();
    perRonde.push({ naam: ronde.naam, struct, contr });
    totaal += struct; contrastTotaal += contr;
    console.log(`[a11y] ronde ${ronde.naam}: ${struct} structureel, ${contr} contrast`);
  }

  /* ===== DERDE RONDE: HET RAAKVLAK (WCAG 2.5.8) =====================
     Apart, en om drie redenen die er alle drie toe doen.

     TELEFOONFORMAAT. 2.5.8 gaat over aanwijzen met een vinger, dus meet deze
     ronde op 390x844 en niet op het bureaubladvenster van de twee ronden
     hierboven. Diezelfde knop kan op een breed scherm ruim genoeg zijn.

     INGELOGD. Uitgelogd zie je op de meeste schermen alleen de poort. De maat
     van een knop hangt bovendien nauwelijks van de sessie af, dus een tweede
     staat zou vooral tijd kosten.

     EN WIE IETS VINDT, MEET NOG EEN KEER. Een scherm dat binnenkomt met een
     schaal-animatie staat een halve seconde op 99,8%, en dan meet een knop van
     precies 24 pixels er 23,96. Dat is geen bevinding maar een moment. Zie de
     opmerking bij die tweede meting hieronder voor waarom het GEEN wachten op
     alle animaties is geworden. */
  const RAAK = '(function(){' + raakvlak.BRON + '\nreturn window.__a11yRaakvlak(' + raakvlak.GRENS + ')})()';
  const MOB = (hand) => '(function(){' + mobiel.BRON + '\nreturn window.__mobielKeur(' + JSON.stringify({
    hand, maat: mobiel.MAAT, onder: mobiel.ONDER, smal: mobiel.SMAL, kwart: mobiel.ANKERKWART
  }) + ')})()';
  let raakTotaal = 0;
  /* TWEE HANDEN, EN DAAROM STAAT ER EEN LUS OMHEEN.

     Sinds shared/hand.js legt het huis de dingen aan de kant van de duim, en
     welke kant dat is verschilt per mens (ADAPTIEF.md, ankerzijde/duimzijde).
     Een scherm dat alleen voor rechtshandigen klopt is niet af, en dat is
     alleen te zien door het twee keer te meten.

     Het RAAKVLAK draait maar een keer: die maat hangt niet van de hand af, en
     twee keer meten zou hem dubbel tellen. */
  const mobiu = { breed: [], leeg: [], balk: [], duim: [], geenHoofd: [], gemeten: 0 };
  for (const hand of ['rechts', 'links']) {
  const telefoon = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await telefoon.addInitScript((z) => {
    try {
      localStorage.setItem('rtg_member_token', z.token);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_lang', 'nl');
      /* zie de opmerking bij RTF_SESSIE: zonder dit staat een kwart van de
         schermen achter zijn eigen deur en meet deze ronde die deur */
      localStorage.setItem('rtf_sessie', JSON.stringify(z.rtf));
    } catch (e) {}
  }, { token: lid.token, rtf: RTF_SESSIE });
  await telefoon.addCookies([{ name: 'rtg_hand', value: hand, url: basis }]);
  const tel = await telefoon.newPage();
  /* DE RONDE DRAAGT NU EEN INKEPING, EN DAT MISTE HIJ VANAF HET BEGIN.

     Een browservenster heeft geen statusbalk en geen thuisstreep, dus
     env(safe-area-inset-*) is er nul -- en een scherm dat die zone negeert ziet
     er in de keuring perfect uit. Vijf schermen deden dat en dat kwam boven met
     een SCHERMAFDRUK VAN EEN ECHT TOESTEL, niet met een meting: de bovenste
     strook liep onder de klok door en de menuknop lag op de eerste tab.

     59 boven en 34 onder zijn de maten van een iPhone met Dynamic Island. Ze
     staan hier als getal en niet als toestelnaam: wat we meten is "er is een
     zone die niet van ons is", niet "dit ene toestel". */
  try {
    const cdp = await telefoon.newCDPSession(tel);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
  } catch (e) {
    console.error('[a11y] LET OP: deze browser kent Emulation.setSafeAreaInsetsOverride niet -- '
      + 'de telefoonronde meet ZONDER inkeping en ziet dus geen enkel gebrek in de veilige zone.');
  }
  console.log(`\n[a11y] ===== ronde TELEFOON, ${hand}handig (${PAGINAS.length} schermen, 390x844, ingelogd) =====`);
  for (const pad of PAGINAS) {
    /* Een scherm met een eigen sessie krijgt die na het eerste bezoek en dan een
       herlading -- addInitScript() STAPELT en geldt voor elke volgende pagina,
       dus daarmee zou het leerlingprofiel de rest van de ronde meelopen. Zetten
       en terugzetten in localStorage blijft bij dit ene scherm. */
    const eigen = EIGEN_SESSIE[pad];
    const telMis = await ga(tel, basis + (EIGEN_PAD[pad] || pad));
    if (telMis) { console.error(`[a11y] ${pad} (telefoon): niet te openen -- ${telMis}`); continue; }
    if (eigen) {
      try {
        await tel.evaluate((z) => { try { localStorage.setItem('rtf_sessie', JSON.stringify(z)); } catch (e) {} }, eigen);
        await tel.reload({ waitUntil: 'load' });
      } catch (e) { /* dan meten we hem zoals hij staat */ }
    }
    await tel.waitForTimeout(600);
    /* De mobiele meting eerst, want die is goedkoop en hangt niet af van de
       tweede meetronde die het raakvlak soms nodig heeft. */
    try {
      let m = await tel.evaluate(MOB(hand));
      /* WIE IETS VINDT, MEET NOG EEN KEER -- zelfde reden als bij het raakvlak
         hieronder, en het is hier precies zo misgegaan. /apps/kantoorpda.html
         stuurt door naar de personeels-app, en die kaart komt binnen met een
         schaal-animatie: 600ms na load stond een knop met min-height:44px op
         43,67 hoog. Dat is een moment en geen maat. Een scherm dat PERMANENT te
         klein of te hoog staat, meldt zich in de tweede meting gewoon weer.

         Alleen bij een gebrek, want dat kost alleen iets op de schermen die iets
         vinden -- en dat zijn er hopelijk nul. */
      /* Elke bevinding krijgt een tweede meting, niet alleen een duimgebrek --
         dat was de eerste versie en die was te smal. /apps/wereld.html meldde
         zich als LEEG in de volle ronde en niet als hij alleen draait: dat
         scherm haalt zijn inhoud op en 600ms is onder belasting soms te kort.
         Een scherm dat ECHT niets toont, meldt zich in de tweede meting gewoon
         weer -- dat is precies waarom het een tweede meting is en geen
         uitzondering. */
      if (m.leeg || m.balkenBuiten.length || m.inhoud > m.venster + 2 || (m.hoofd && m.gebreken.length)) {
        try {
          await tel.waitForFunction(
            () => !document.getAnimations || document.getAnimations().every(a => a.playState !== 'running'),
            null, { timeout: 1500 });
        } catch (e) { /* een scherm dat blijft bewegen meten we zoals het staat */ }
        await tel.waitForTimeout(300);
        try { m = await tel.evaluate(MOB(hand)); } catch (e) { /* de eerste meting blijft staan */ }
      }
      mobiu.gemeten++;
      const waar = pad + ' [' + hand + ']';
      if (m.venster !== 390) mobiu.breed.push(waar + ': het venster is ' + m.venster + ' en niet 390 -- deze meting zegt niets');
      else if (m.inhoud > m.venster + 2) mobiu.breed.push(waar + ': ' + m.inhoud + 'px' + (m.dwinger ? ' door ' + m.dwinger : ''));
      if (m.leeg) mobiu.leeg.push(waar + ': het werkvlak draagt ' + m.tekens + ' tekens en ' + m.beelden + ' beelden'
        + '\n      werkvlak: "' + (m.werkvlak || '') + '"'
        + '\n      main:     "' + (m.hoofdHTML || '') + '"');
      for (const b of m.balkenBuiten) mobiu.balk.push(waar + ': ' + b);
      if (!m.hoofd) mobiu.geenHoofd.push(waar);
      else if (m.gebreken.length) mobiu.duim.push(waar + ' \u2014 ' + m.hoofd.naam + ' (' + m.hoofd.merk + '): ' + m.gebreken.join('; '));
    } catch (e) {
      mobiu.breed.push(pad + ' [' + hand + ']: de mobiele meting kon niet draaien -- ' + e.message.split('\n')[0]);
    }
    if (eigen) {
      try { await tel.evaluate((z) => { try { localStorage.setItem('rtf_sessie', JSON.stringify(z)); } catch (e) {} }, RTF_SESSIE); } catch (e) {}
    }
    if (hand !== 'rechts') continue;   // het raakvlak hangt niet van de hand af
    let res;
    try { res = await hermeet(tel, RAAK, (r) => r.klein.length); }
    catch (e) {
      console.error(`[a11y] ${pad} (raakvlak): de meting kon niet draaien -- ${e.message.split('\n')[0]}`);
      continue;
    }
    /* De tweede meting zit in hermeet() hierboven; hier stond een eigen kopie. */
    if (res.klein.length) {
      raakTotaal += res.klein.length;
      console.log(`\n[a11y] ${pad} (raakvlak): ${res.klein.length} onder ${raakvlak.GRENS}x${raakvlak.GRENS}`);
      for (const w of res.klein.slice(0, 6)) console.log(`  · ${w}`);
    }
  }
  await telefoon.close();
  }
  /* ===== VIJFDE RONDE: DE TABLETBAND =========================================

     ADAPTIEF.md kent telefoon (<640), tablet (640-999) en bureau (>=1000). De
     rondes hierboven meten 390 en het bureaubladvenster; alles ertussen was tot
     vandaag NOOIT door een browser getekend, en dat is geen detail: een gebrek
     kan precies daar zitten en nergens anders.

     Dat bleek ook. Op /apps/rtg.html is een dossierregel een link naar een
     betaalpagina: op 390 breekt hij af en meet 74 hoog, op 700 en 834 past hij
     op een regel en meet 20. Op /apps/salon.html geldt hetzelfde voor de naam
     boven een post (23). Allebei onzichtbaar voor de raakvlakronde, want die
     meet 390 -- waar het toevallig goed gaat.

     EEN BREEDTE EN NIET TWEE. De eerste meting draaide 700 en 834 naast elkaar
     en gaf op allebei exact dezelfde twee vondsten; een tweede venster kost dan
     een ronde en levert niets. 834 is een iPad staand -- ruim boven de 760 waar
     de duimregels van rtg-ui.css ophouden, dus dit meet de ECHTE tabletvorm en
     niet nog een keer de telefoonvorm.

     WAT HIER NIET GEMETEN WORDT: leegte en duimbereik. Die twee gaan over een
     hand aan een telefoon (GRAMMATICA.md), en een tablet ligt op tafel. Breedte
     en raakvlak gaan wel over elk toestel dat je aanraakt. */
  const tabletC = await browser.newContext({ viewport: { width: 834, height: 1112 }, serviceWorkers: 'block' });
  await tabletC.addInitScript((z) => {
    try {
      localStorage.setItem('rtg_member_token', z.token);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtf_sessie', JSON.stringify(z.rtf));
    } catch (e) {}
  }, { token: lid.token, rtf: RTF_SESSIE });
  const tab = await tabletC.newPage();
  console.log(`\n[a11y] ===== ronde TABLET (${PAGINAS.length} schermen, 834x1112, ingelogd) =====`);
  const tabu = { breed: [], klein: [], gemeten: 0 };
  for (const pad of PAGINAS) {
    const tabMis = await ga(tab, basis + (EIGEN_PAD[pad] || pad));
    if (tabMis) { console.error(`[a11y] ${pad} (tablet): niet te openen -- ${tabMis}`); continue; }
    await tab.waitForTimeout(600);
    try {
      const m = await tab.evaluate(MOB('rechts'));
      tabu.gemeten++;
      if (m.venster === 834 && m.inhoud > m.venster + 2) {
        tabu.breed.push(pad + ': ' + m.inhoud + 'px' + (m.dwinger ? ' door ' + m.dwinger : ''));
      }
    } catch (e) { /* dit scherm meet niet; de breedte-teller blijft eerlijk */ }
    let res;
    try { res = await tab.evaluate(RAAK); } catch (e) { continue; }
    if (res.klein.length) {
      /* wie iets vindt, meet nog een keer -- zelfde reden als hierboven */
      try {
        await tab.waitForFunction(
          () => !document.getAnimations || document.getAnimations().every(a => a.playState !== 'running'),
          null, { timeout: 1500 });
      } catch (e) {}
      await tab.waitForTimeout(300);
      try { res = await tab.evaluate(RAAK); } catch (e) {}
      if (res.klein.length) {
        tabu.klein.push(pad + ': ' + res.klein.slice(0, 4).join(' | '));
        console.log(`\n[a11y] ${pad} (tablet): ${res.klein.length} onder ${raakvlak.GRENS}x${raakvlak.GRENS}`);
        for (const w of res.klein.slice(0, 6)) console.log(`  \u00b7 ${w}`);
      }
    }
  }
  await tabletC.close();
  console.log(`[a11y] ronde tablet: ${tabu.gemeten} schermen op 834 \u2014 ` +
    `${tabu.breed.length} te breed, ${tabu.klein.length} met een te klein raakvlak`);
  for (const x of tabu.breed) console.log(`  \u00b7 te breed: ${x}`);

  console.log(`[a11y] ronde raakvlak: ${raakTotaal} onder ${raakvlak.GRENS}x${raakvlak.GRENS}`);
  const mobielTotaal = mobiu.breed.length + mobiu.leeg.length + mobiu.balk.length + mobiu.duim.length;
  console.log(`[a11y] ronde telefoon: ${mobiu.gemeten} metingen over twee handen \u2014 ` +
    `${mobiu.breed.length} te breed, ${mobiu.leeg.length} leeg, ${mobiu.balk.length} balk buiten beeld, ` +
    `${mobiu.duim.length} buiten duimbereik, ${mobiu.geenHoofd.length} zonder aangewezen hoofdhandeling`);
  for (const [kop, lijst] of [['te breed', mobiu.breed], ['leeg', mobiu.leeg],
    ['balk buiten beeld', mobiu.balk], ['buiten duimbereik', mobiu.duim]]) {
    if (!lijst.length) continue;
    console.log(`\n[a11y] telefoon \u2014 ${kop} (${lijst.length}):`);
    for (const r of lijst.slice(0, 40)) console.log('  \u00b7 ' + r);
    if (lijst.length > 40) console.log(`  \u00b7 ... en nog ${lijst.length - 40}`);
  }

  /* ===== VIERDE RONDE: DE DRIE ANDERE THEMA'S =======================
     De drie ronden hierboven keuren EEN stand: onyx, want dat is waar
     rtg-themas.js op terugvalt als er niets gekozen is. Een lid dat champagne,
     bordeaux of royal kiest, kreeg dus een huis dat nooit gemeten was.

     Wat dat kostte, is een keer geteld voordat deze ronde er stond: onder
     champagne -- het enige LICHTE thema -- 116 stukken tekst die onzichtbaar
     waren, niet slecht leesbaar maar onzichtbaar, tot 1,01:1. Bijna allemaal
     dezelfde fout in twee spiegelbeelden: een vlak dat zijn grond hard donker
     schildert en zijn inkt uit het thema haalt, of andersom. Bordeaux en royal
     hadden daar nul van; die zijn allebei donker, net als onyx, dus de fout viel
     er niet op. Precies daarom moet dit een RONDE zijn en geen steekproef: wat
     je niet meet, gaat kapot in de stand die je niet gebruikt.

     De ronde draait INGELOGD, want uitgelogd zie je op de meeste schermen alleen
     de poort. Structuur telt hier niet apart mee -- die hangt niet van een thema
     af en staat in de twee ronden hierboven al hard op nul; komt er hier toch
     iets, dan is dat een echte vondst en valt de scan. */
  const THEMAS = ['champagne', 'bordeaux', 'royal'];
  const perThema = [];
  console.log(`\n[a11y] ===== ronde THEMA'S (${THEMAS.length} x ${PAGINAS.length} schermen, ingelogd) =====`);
  for (const thema of THEMAS) {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.addInitScript((o) => {
      try {
        localStorage.setItem('rtg_member_token', o.t);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_thema_v2', o.thema);
      } catch (e) {}
    }, { t: lid.token, thema });
    const pg = await ctx.newPage();
    let struct = 0, contr = 0;
    for (const pad of PAGINAS) {
      const misging = await ga(pg, basis + pad);
      if (misging) {
        console.error(`[a11y] ${pad} (${thema}): niet te openen -- ${misging}`);
        struct += 1; continue;
      }
      await pg.waitForTimeout(600);
      let res;
      try { res = await hermeet(pg, KEUR, (r) => r.overtredingen.length || r.contrast.length); }
      catch (e) {
        console.error(`[a11y] ${pad} (${thema}): de keuring kon niet draaien -- ${e.message.split('\n')[0]}`);
        struct += 1; continue;
      }
      telDekking(res.dekking);
      if (res.overtredingen.length) {
        struct += res.overtredingen.reduce((n, v) => n + v.aantal, 0);
        console.log(`\n[a11y] ${pad} (${thema}): ${res.overtredingen.length} soort(en) structurele overtreding`);
        for (const v of res.overtredingen) console.log(`  · ${v.id}: ${v.help} (${v.aantal}x)`);
      }
      if (res.contrast.length) {
        contr += res.contrast.reduce((n, v) => n + v.aantal, 0);
        console.log(`\n[a11y] ${pad} (${thema}):`);
        for (const v of res.contrast) {
          console.log(`  · contrast: ${v.help} (${v.aantal}x)`);
          for (const w of (v.waar || [])) console.log(`      ${w}`);
        }
      }
    }
    await ctx.close();
    totaal += struct;
    perThema.push({ thema, struct, contr });
    console.log(`[a11y] thema ${thema}: ${struct} structureel, ${contr} contrast`);
  }

  await browser.close();
  server.stop();

  for (const r of perRonde) console.log(`[a11y] ${r.naam.padEnd(10)} ${r.struct} structureel · ${r.contr} contrast`);
  {
    const wegbaar = dekking.gemeten + dekking.url + dekking.alfanul;
    const pct = (n) => wegbaar ? (n / wegbaar * 100).toFixed(1) + '%' : '-';
    console.log(`[a11y] dekking: van ${wegbaar} zichtbare tekstelementen zijn er ` +
      `${dekking.gemeten} gewogen (${pct(dekking.gemeten)}); ` +
      `${dekking.url} overgeslagen om een onberekenbare grond (${pct(dekking.url)}), ` +
      `${dekking.alfanul} om een letter met alfa nul (${pct(dekking.alfanul)}).`);
  }
  /* DE RATEL IS OP NUL AANGEKOMEN, EN DAT IS DE HELE BEDOELING GEWEEST.

     De ingelogde ronde bracht 25 contrastfouten mee die nooit eerder gemeten
     waren -- negen unieke plekken, vrijwel allemaal het accent als kleine tekst
     op een donkere grond. Die op dag een hard afkeuren zou betekenen: de poort
     staat rood tot iemand negen CSS-plekken heeft nagelopen, en dan wordt hij
     uitgezet. Die op nul zetten zou liegen. Dus stond er een bovengrens die
     alleen omlaag mocht.

     Op 17 augustus 2026 zijn die negen plekken gerepareerd en meet de ingelogde
     ronde nul. De grens in A11Y-INGELOGD.json staat daarmee op nul en de poort
     is hard in BEIDE staten, op structuur en op contrast. De constructie
     hieronder blijft staan zoals hij is: hij leest het getal uit het register,
     dus als iemand ooit weer ruimte nodig heeft moet hij dat DAAR opschrijven,
     met een reden, en niet hier in de code wegwerken. */
  const meting = { perRonde, totaal, raakTotaal, paginas: PAGINAS.length,
    deel: deel ? deel.nr + '/' + deel.totaal : 'heel' };

  /* EEN DEEL OORDEELT NIET. Het schrijft wat het gezien heeft en zwijgt verder;
     scripts/a11y-oordeel.js telt de delen op en velt daarna een keer het oordeel
     tegen het budget van de hele ronde. Zie scripts/lib/a11yoordeel.js. */
  if (metingUit) {
    fs.mkdirSync(path.dirname(path.resolve(metingUit)), { recursive: true });
    fs.writeFileSync(metingUit, JSON.stringify(meting, null, 2) + '\n');
    console.log(`\n[a11y] deel ${meting.deel}: ${PAGINAS.length} schermen gemeten, ` +
      `${totaal} structureel, ${contrastTotaal} contrast, ${raakTotaal} raakvlak -> ${metingUit}`);
    console.log('[a11y] dit deel velt geen oordeel; dat doet scripts/a11y-oordeel.js over alle delen samen.');
    return;
  }

  /* DE RATEL IS OP NUL AANGEKOMEN, EN DAT IS DE HELE BEDOELING GEWEEST.

     De ingelogde ronde bracht 25 contrastfouten mee die nooit eerder gemeten
     waren -- negen unieke plekken, vrijwel allemaal het accent als kleine tekst
     op een donkere grond. Die op dag een hard afkeuren zou betekenen: de poort
     staat rood tot iemand negen CSS-plekken heeft nagelopen, en dan wordt hij
     uitgezet. Die op nul zetten zou liegen. Dus stond er een bovengrens die
     alleen omlaag mocht.

     Op 17 augustus 2026 zijn die negen plekken gerepareerd en meet de ingelogde
     ronde nul. De grens in A11Y-INGELOGD.json staat daarmee op nul en de poort
     is hard in BEIDE staten, op structuur en op contrast. De constructie
     blijft staan zoals hij is: hij leest het getal uit het register, dus als
     iemand ooit weer ruimte nodig heeft moet hij dat DAAR opschrijven, met een
     reden, en niet hier in de code wegwerken. */
  const grens = JSON.parse(fs.readFileSync(path.join(ROOT, 'A11Y-INGELOGD.json'), 'utf8'));
  const uitgelogd = perRonde.find(r => r.naam === 'uitgelogd') || { struct: 0, contr: 0 };
  const ingelogd = perRonde.find(r => r.naam === 'ingelogd') || { struct: 0, contr: 0 };
  const zaakronde = perRonde.find(r => r.naam === 'zaak') || { struct: 0, contr: 0 };
  const fouten = [];
  if (totaal > 0) fouten.push(`${totaal} structurele overtreding(en) -- die zijn in beide staten hard nul`);
  if (uitgelogd.contr > grens.uitgelogd.contrast)
    fouten.push(`${uitgelogd.contr} contrastfouten uitgelogd, de grens is ${grens.uitgelogd.contrast}`);
  /* De zaakronde weegt APART en wordt niet bij de ingelogde opgeteld: als twee
     staten in een getal worden opgeteld, kan een reparatie aan de ene kant een
     verslechtering aan de andere maskeren. */
  if (zaakronde.contr > ((grens.zaak || {}).contrast || 0))
    fouten.push(`${zaakronde.contr} contrastfouten in de zaakronde, de grens is ${(grens.zaak || {}).contrast} -- er is er een BIJGEKOMEN`);
  if (ingelogd.contr > grens.ingelogd.contrast)
    fouten.push(`${ingelogd.contr} contrastfouten ingelogd, de grens is ${grens.ingelogd.contrast} -- er is er een BIJGEKOMEN`);
  /* Het raakvlak leest zijn grens uit hetzelfde register, en zijn oordeel staat
     in raakvlakkeuring.veltRaakvlak -- puur, dus test/raakvlak.test.js kan het
     zonder browser laten zakken. */
  const raakOordeel = raakvlak.veltRaakvlak(raakTotaal, (grens.raakvlak || {}).onder24);
  if (raakOordeel.faalt) fouten.push(raakOordeel.melding.trim().replace(/^\[a11y\] MISLUKT: /, ''));
  /* En de telefoonronde velt op dezelfde manier: het oordeel staat puur in
     mobielkeuring.veltMobiel, zodat test/mobiel.test.js de poort kan laten
     dichtgaan zonder een browser. Het aantal schermen ZONDER aangewezen
     hoofdhandeling doet hier niet mee -- dat is werkvoorraad en geen gebrek
     (GRAMMATICA.md). */
  const mobielOordeel = mobiel.veltMobiel(
    { breed: mobiu.breed.length, leeg: mobiu.leeg.length, balk: mobiu.balk.length, duim: mobiu.duim.length },
    grens.telefoon || {});
  if (mobielOordeel.faalt) fouten.push(mobielOordeel.melding.trim().replace(/^\[a11y\] MISLUKT op telefoonformaat:\s*/, 'op telefoonformaat: '));
  /* De tabletband telt mee in het oordeel, anders is hij een rapport dat niemand
     leest. Zelfde grens als de andere twee: nul. */
  const tabGrens = (grens.tablet || {});
  if (tabu.breed.length > (tabGrens.breed || 0)) {
    fouten.push(`${tabu.breed.length} scherm(en) dat op 834 buiten beeld loopt, de grens is ${tabGrens.breed || 0}`);
  }
  if (tabu.klein.length > (tabGrens.klein || 0)) {
    fouten.push(`${tabu.klein.length} scherm(en) met een raakvlak onder ${raakvlak.GRENS}x${raakvlak.GRENS} op tabletformaat, de grens is ${tabGrens.klein || 0}`);
  }
  /* DE ACCOLADE HIERBOVEN IS OP 22 AUGUSTUS 2026 TERUGGEZET, en wat zij tegenhield
     is het hele oordeel. Bij de samenvoeging van 20 augustus (9c7411c8) raakte zij
     zoek en schoof haar sluiting naar het einde van de functie. Alles hieronder --
     de themaronde, `if (fouten.length) process.exit(1)` en de slotregel -- lag
     daarmee BINNEN deze tabletcontrole, en die staat op nul. De poort telde dus
     nog wel (137 contrastfouten uitgelogd, 124 ingelogd, 148 op royal) en velde
     niets: exit 0, zonder slotregel. Dezelfde soort fout als de inlogrem die wel
     telde en niet remde, en hij is precies zo onzichtbaar: de inspringing bleef
     kloppen, dus het LAS goed.
     Wat dit leert over de poort zelf: een keuring die slaagt hoort haar eigen
     slotregel te schrijven, want de afwezigheid daarvan was het enige spoor.
  */
  /* DE THEMA'S STAAN OP NUL, EN DAT WAS EEN WEG VAN TWEE DAGEN.
     Hier stond dat ze een BOVENGRENS hadden en geen nul, met de reden erbij: wat
     er na de onzichtbare tekst overbleef leek EEN soort -- het goud en de andere
     accenten als kleine tekst -- en dat is een merkbesluit dat de vormtaal raakt.
     Op dag een hard afkeuren zou de poort rood zetten tot iemand dat besluit
     nam, en dan wordt zo'n poort uitgezet.

     Het bleek geen merkbesluit maar een token dat niet meethemaat, en daarna nog
     een: --rtg-soft en --rtg-muted droegen een alfa, en een alfa zegt niets over
     leesbaarheid. Alle drie de thema's staan nu op nul (20 augustus 2026).

     De constructie blijft staan omdat hij de nul BEWAAKT en niet omdat er ruimte
     in zit: het getal per thema mag alleen omlaag, en een thema zonder getal in
     het register is een fout en geen vrijstelling. */
  for (const t of perThema) {
    const bg = (grens.themas || {})[t.thema];
    if (bg === undefined) {
      fouten.push(`thema ${t.thema} staat niet in A11Y-INGELOGD.json -- een ronde zonder grens keurt niets`);
      continue;
    }
    if (t.contr > bg) fouten.push(`${t.contr} contrastfouten op thema ${t.thema}, de grens is ${bg} -- er is er een BIJGEKOMEN`);
  }
  if (fouten.length) {
    console.error('\n[a11y] MISLUKT:');
    for (const f of fouten) console.error('  · ' + f);
    process.exit(1);
  }
  if (raakOordeel.melding) console.log(raakOordeel.melding);
  if (mobielOordeel.melding) console.log(mobielOordeel.melding);
  if (ingelogd.contr < grens.ingelogd.contrast)
    console.log(`\n[a11y] De grens kan strakker: ingelogd ${ingelogd.contr} tegen ${grens.ingelogd.contrast} in A11Y-INGELOGD.json.`);
  /* De tip "kan strakker" houdt rekening met de wiebel die in het register staat.
     Zonder dat vuurt hij bij ELKE ronde, want de grens staat bewust een paar
     boven de meting -- en een tip die altijd afgaat, leert mensen hem negeren. */
  const marge = grens.themamarge || 0;
  for (const t of perThema) {
    const bg = (grens.themas || {})[t.thema];
    if (bg !== undefined && t.contr + marge < bg)
      console.log(`[a11y] De grens kan strakker: thema ${t.thema} ${t.contr} tegen ${bg} in A11Y-INGELOGD.json (wiebelmarge ${marge}).`);
  }
  /* De slotregel noemde het contrast uitgelogd altijd "nul", omdat het dat een
     tijd lang was. Toen de meting op 19 augustus 2026 verlopen leerde lezen was
     het dat niet meer, en stond er een getal boven deze regel dat hem tegensprak.
     Een samenvatting die een ander getal noemt dan de meting eronder, is erger
     dan geen samenvatting: hij is precies wat mensen overnemen. */
  console.log(`\n[a11y] ${PAGINAS.length} schermen, uitgelogd EN ingelogd. Structuur nul in beide staten; ` +
    `contrast uitgelogd ${uitgelogd.contr} (grens ${grens.uitgelogd.contrast}), ` +
    `ingelogd ${ingelogd.contr} (grens ${grens.ingelogd.contrast}). ` +
    `Raakvlak op telefoonformaat: ${raakTotaal} onder ${raakvlak.GRENS}x${raakvlak.GRENS}. ` +
    `Telefoonronde over twee handen: ${mobiu.breed.length} te breed, ${mobiu.leeg.length} leeg, ` +
    `${mobiu.balk.length} balk buiten beeld, ${mobiu.duim.length} buiten duimbereik; ` +
    `${mobiu.geenHoofd.length} metingen zonder aangewezen hoofdhandeling (werkvoorraad, geen gebrek). ` +
    `Tabletronde op 834: ${tabu.breed.length} te breed, ${tabu.klein.length} met een te klein raakvlak. ` +
    `Thema's: ` + perThema.map(t => `${t.thema} ${t.contr} (grens ${(grens.themas || {})[t.thema]})`).join(', ') + '.');

})().catch((e) => { console.error('[a11y] fout:', e); process.exit(1); });
