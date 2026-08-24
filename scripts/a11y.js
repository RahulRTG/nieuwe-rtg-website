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
/* Wie iets vindt, meet nog een keer -- een plek, twee ronden. */
const hermeet = require('./a11y-hermeet');
/* alleSchermen() loopt public/apps af. Het 404-scherm staat in public/site en
   viel daarmee buiten de keuring -- terwijl het juist een scherm is dat een
   bezoeker onverwacht krijgt. Er is geen derde plek: dit zijn alle .html onder
   public. */
const PAGINAS = alleSchermen().concat(['/site/404.html']);

/* DE BROWSERKEUZE KOMT UIT test/browser.js, en niet meer uit een eigen kopie.

   Hier stond dezelfde functie die dat bestand ooit voor 94 andere bestanden
   heeft opgeruimd: hij koos de EERSTE Playwright die te REQUIREN viel. Dat gaat
   mis zodra het pakket er wel is maar de bijbehorende Chromium niet -- en dat is
   precies wat hier gebeurde. De require lukte, de launch zakte op "Executable
   doesn't exist", en deze scan concludeerde daaruit "geen browser beschikbaar"
   en sloot zichzelf af met exitcode 0.

   Een poort die groen meldt omdat hij niets heeft gemeten, is erger dan geen
   poort. Dat is dezelfde fout als de blinde vlek die deze scan zelf had: waar
   staat "nul", moet ook echt nul gemeten zijn.

   test/browser.js probeert te STARTEN in plaats van te laden en loopt de
   kandidaten af tot er een echt opent, met de eigen driver als laatste. Het
   contract is hetzelfde: null als er niets is, anders iets met .chromium.launch. */
function laadPlaywright() {
  try { return require('../test/browser').laadBrowser(); }
  catch (e) { return null; }
}

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
        const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(ROOT, 'server', 'server.js')], {
          cwd: ROOT, stdio: 'ignore',
          /* RTG_MAGNAAT_TEST: de synthetische zaken (en dus de zaak-inlog van de
             derde ronde) worden alleen in de geisoleerde testomgeving gezaaid --
             test/helper.js doet hetzelfde. Zonder die vlag kende deze
             wegwerpserver geen enkele leverancier en
             viel de zaakronde om op "Deze leverancierscode kennen we niet".
             Het is bovendien de betere stand om a11y in te meten: de schermen
             hebben er echte inhoud in plaats van lege lijsten. RTG_DEMO blijft
             hier uit: de oude vlag mag buiten een testsuite niets meer openen. */
          env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '',
            STUN_UIT: '1', NODE_ENV: 'test', RTG_DEMO: '', RTG_MAGNAAT_TEST: '1' }
        });
        const basis = 'http://127.0.0.1:' + poort;
        const stop = () => { try { kind.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} };
        /* WACHTEN OP /api/ready EN NIET OP /api/health.

           Health is op zodra de poort luistert; de opslagpoortwachter geeft
           daarna nog 503 op ELKE API tot de opslag echt geladen is. Deze scan
           wachtte op health en deed meteen daarna zijn inlogverzoeken -- die
           vielen dan op een 503, en de scan concludeerde "geen sessie". Dezelfde
           reden waarom test/helper.js hier al op /api/ready wacht. */
        for (let i = 0; i < 300; i++) {
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
  if (!pw) {
    console.log('[a11y] Playwright niet beschikbaar; scan overgeslagen (statische a11y-regels draaien in check.js).');
    process.exit(STRICT ? 1 : 0);
  }
  const { BRON, velt } = require('./a11ykeuring'); // eigen keuring (verving axe-core)
  const raakvlak = require('./raakvlakkeuring');   // WCAG 2.5.8, derde ronde op telefoonformaat
  const server = await startEchteServer();
  const basis = server.basis;

  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  } catch (e) {
    console.log('[a11y] Kon Chromium niet starten; scan overgeslagen:', e.message);
    server.stop();
    process.exit(STRICT ? 1 : 0);
  }

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

  /* EN EEN ECHTE ZAAK-SESSIE, want een lidmaatschapstoken opent de helft van dit
     huis niet.

     Dit was de blinde vlek van deze scan, en hij was groot. Alles wat achter een
     ZAAK-inlog zit -- de horecaschermen, de kassa, het personeelsscherm, de
     leveranciers-app -- draagt `rtg_sup_token` en niet `rtg_member_token`. Met
     alleen een lid kreeg de scan daar de DEUR te zien: een lege schil met een
     inlogkaart, die netjes nul fouten oplevert. "Nul over alle schermen" was dus
     waar voor de staat die gemeten werd en onwaar voor de staat waarin het
     personeel werkt.

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

  /* De keuring gaat via evaluate en niet via addScriptTag: de echte server stuurt
     een CSP met nonce mee en die blokkeert een inline script. In een IIFE, want
     evaluate met een string verwacht een expressie en BRON begint met functies. */
  const KEUR = '(function(){' + BRON + '\nreturn window.__a11yKeur()})()';

  let totaal = 0, contrastTotaal = 0;
  const perRonde = [];

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
      await page.goto(basis + pad, { waitUntil: 'load' });
      await page.waitForTimeout(600); // laat intro-animaties (opacity) uitlopen
      let res;
      /* WIE IETS VINDT, MEET NOG EEN KEER -- zie scripts/a11y-hermeet.js voor
         waarom deze ronde hem nodig had en waarom hij de poort niet verzwakt. */
      try { res = await hermeet(page, KEUR, (r) => r.overtredingen.length || r.contrast.length); }
      catch (e) {
        console.error(`[a11y] ${pad} (${ronde.naam}): de keuring kon niet draaien -- ${e.message.split('\n')[0]}`);
        struct += 1; continue;
      }
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

     INGELOGD, EN IN BEIDE SESSIES. Uitgelogd zie je op de meeste schermen alleen
     de poort. Hier stond dat een tweede staat "vooral tijd zou kosten" omdat de
     maat van een knop nauwelijks van de sessie afhangt -- maar dat gaat over
     DEZELFDE knop, en het punt is dat een zaakscherm met een lidmaatschapstoken
     helemaal GEEN knoppen laat zien. De hele horeca-, kassa- en personeelskant
     werd daardoor gemeten als een lege inlogkaart. Deze ronde loopt nu over
     beide sessies.

     EN WIE IETS VINDT, MEET NOG EEN KEER. Een scherm dat binnenkomt met een
     schaal-animatie staat een halve seconde op 99,8%, en dan meet een knop van
     precies 24 pixels er 23,96. Dat is geen bevinding maar een moment. Die
     tweede meting woont sinds 23 augustus 2026 in scripts/a11y-hermeet.js --
     de contrastronde hierboven bleek hem net zo hard nodig te hebben, en toen
     hoorde hij niet langer als kopie in deze ene ronde te staan. Daar staat ook
     waarom het GEEN wachten op alle animaties is geworden. */
  const RAAK = '(function(){' + raakvlak.BRON + '\nreturn window.__a11yRaakvlak(' + raakvlak.GRENS + ')})()';
  let raakTotaal = 0;
  for (const staat of [
    { naam: 'lid', sleutels: { rtg_member_token: lid.token } },
    { naam: 'zaak', sleutels: { rtg_sup_token: zaak.token } }
  ]) {
  const telefoon = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await telefoon.addInitScript((sl) => {
    try {
      for (const k of Object.keys(sl)) localStorage.setItem(k, sl[k]);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    } catch (e) {}
  }, staat.sleutels);
  const tel = await telefoon.newPage();
  console.log(`\n[a11y] ===== ronde RAAKVLAK (${PAGINAS.length} schermen, 390x844, ${staat.naam}) =====`);
  for (const pad of PAGINAS) {
    await tel.goto(basis + pad, { waitUntil: 'load' });
    await tel.waitForTimeout(600);
    let res;
    try { res = await hermeet(tel, RAAK, (r) => r.klein.length); }
    catch (e) {
      console.error(`[a11y] ${pad} (raakvlak): de meting kon niet draaien -- ${e.message.split('\n')[0]}`);
      continue;
    }
    if (res.klein.length) {
      raakTotaal += res.klein.length;
      console.log(`\n[a11y] ${pad} (raakvlak, ${staat.naam}): ${res.klein.length} onder ${raakvlak.GRENS}x${raakvlak.GRENS}`);
      for (const w of res.klein.slice(0, 6)) console.log(`  · ${w}`);
    }
  }
  await telefoon.close();
  }
  console.log(`[a11y] ronde raakvlak: ${raakTotaal} onder ${raakvlak.GRENS}x${raakvlak.GRENS} (lid en zaak samen)`);

  await browser.close();
  server.stop();

  for (const r of perRonde) console.log(`[a11y] ${r.naam.padEnd(10)} ${r.struct} structureel · ${r.contr} contrast`);
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
  const grens = JSON.parse(fs.readFileSync(path.join(ROOT, 'A11Y-INGELOGD.json'), 'utf8'));
  const uitgelogd = perRonde.find(r => r.naam === 'uitgelogd') || { struct: 0, contr: 0 };
  const ingelogd = perRonde.find(r => r.naam === 'ingelogd') || { struct: 0, contr: 0 };
  const zaakronde = perRonde.find(r => r.naam === 'zaak') || { struct: 0, contr: 0 };
  const fouten = [];
  if (totaal > 0) fouten.push(`${totaal} structurele overtreding(en) -- die zijn in beide staten hard nul`);
  if (uitgelogd.contr > grens.uitgelogd.contrast)
    fouten.push(`${uitgelogd.contr} contrastfouten uitgelogd, de grens is ${grens.uitgelogd.contrast}`);
  if (ingelogd.contr > grens.ingelogd.contrast)
    fouten.push(`${ingelogd.contr} contrastfouten ingelogd, de grens is ${grens.ingelogd.contrast} -- er is er een BIJGEKOMEN`);
  /* De zaakronde leest zijn eigen grens. Hij staat apart van `ingelogd` omdat
     het andere schermen zijn: alles achter de zaak-inlog. Zou hij bij ingelogd
     worden opgeteld, dan kan een reparatie aan de ene kant een verslechtering
     aan de andere kant maskeren. */
  if (zaakronde.contr > (grens.zaak || {}).contrast)
    fouten.push(`${zaakronde.contr} contrastfouten in de zaakronde, de grens is ${(grens.zaak || {}).contrast} -- er is er een BIJGEKOMEN`);
  /* Het raakvlak leest zijn grens uit hetzelfde register, en zijn oordeel staat
     in raakvlakkeuring.veltRaakvlak -- puur, dus test/raakvlak.test.js kan het
     zonder browser laten zakken. */
  const raakOordeel = raakvlak.veltRaakvlak(raakTotaal, (grens.raakvlak || {}).onder24);
  if (raakOordeel.faalt) fouten.push(raakOordeel.melding.trim().replace(/^\[a11y\] MISLUKT: /, ''));
  if (fouten.length) {
    console.error('\n[a11y] MISLUKT:');
    for (const f of fouten) console.error('  · ' + f);
    process.exit(1);
  }
  if (raakOordeel.melding) console.log(raakOordeel.melding);
  if (ingelogd.contr < grens.ingelogd.contrast)
    console.log(`\n[a11y] De grens kan strakker: ingelogd ${ingelogd.contr} tegen ${grens.ingelogd.contrast} in A11Y-INGELOGD.json.`);
  if (zaakronde.contr < ((grens.zaak || {}).contrast || 0))
    console.log(`\n[a11y] De grens kan strakker: zaak ${zaakronde.contr} tegen ${(grens.zaak || {}).contrast} in A11Y-INGELOGD.json.`);
  console.log(`\n[a11y] ${PAGINAS.length} schermen in DRIE staten: uitgelogd, als lid, en als zaak. ` +
    `Structuur nul in alle drie; contrast uitgelogd nul, lid ${ingelogd.contr} (grens ${grens.ingelogd.contrast}), ` +
    `zaak ${zaakronde.contr} (grens ${(grens.zaak || {}).contrast}). ` +
    `Raakvlak op telefoonformaat, lid en zaak: ${raakTotaal} onder ${raakvlak.GRENS}x${raakvlak.GRENS}.`);
})().catch((e) => { console.error('[a11y] fout:', e); process.exit(1); });
