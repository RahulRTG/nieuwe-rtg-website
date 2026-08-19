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
/* alleSchermen() loopt public/apps af. Het 404-scherm staat in public/site en
   viel daarmee buiten de keuring -- terwijl het juist een scherm is dat een
   bezoeker onverwacht krijgt. Er is geen derde plek: dit zijn alle .html onder
   public. */
const PAGINAS = alleSchermen().concat(['/site/404.html']);

/* DE BROWSER KOMT UIT scripts/lib/scherm.js EN NIET UIT EEN EIGEN LADER.

   Hier stond een laadPlaywright() met een terugval die nooit draaide, want
   `require('playwright')` slaagt ook als de browser erachter ontbreekt. Op deze
   machine wees de standaard Playwright naar chromium-1234 terwijl er 1194
   stond: deze scan meldde zich dus af met "geen browser" terwijl er een was --
   en dan staat er in TOEGANKELIJK.md een nul die niemand gemeten heeft. Zie de
   kop van die module voor de hele vindwijze. */
const { laadScherm: laadPlaywright, herkomst: browserHerkomst } = require('./lib/scherm');

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
          env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '', STUN_UIT: '1' }
        });
        const basis = 'http://127.0.0.1:' + poort;
        const stop = () => { try { kind.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} };
        for (let i = 0; i < 300; i++) {
          try { if ((await fetch(basis + '/api/health')).ok) return klaar({ basis, stop }); } catch (e) { /* nog niet op */ }
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

  /* De keuring gaat via evaluate en niet via addScriptTag: de echte server stuurt
     een CSP met nonce mee en die blokkeert een inline script. In een IIFE, want
     evaluate met een string verwacht een expressie en BRON begint met functies. */
  const KEUR = '(function(){' + BRON + '\nreturn window.__a11yKeur()})()';

  let totaal = 0, contrastTotaal = 0;
  const perRonde = [];

  for (const ronde of [{ naam: 'uitgelogd', token: null }, { naam: 'ingelogd', token: lid.token }]) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    if (ronde.token) {
      await context.addInitScript((t) => {
        try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      }, ronde.token);
    }
    const page = await context.newPage();
    let struct = 0, contr = 0;
    console.log(`\n[a11y] ===== ronde ${ronde.naam.toUpperCase()} (${PAGINAS.length} schermen) =====`);

    for (const pad of PAGINAS) {
      await page.goto(basis + pad, { waitUntil: 'load' });
      await page.waitForTimeout(600); // laat intro-animaties (opacity) uitlopen
      let res;
      try { res = await page.evaluate(KEUR); }
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
  await telefoon.addInitScript((t) => {
    try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
  }, lid.token);
  await telefoon.addCookies([{ name: 'rtg_hand', value: hand, url: basis }]);
  const tel = await telefoon.newPage();
  console.log(`\n[a11y] ===== ronde TELEFOON, ${hand}handig (${PAGINAS.length} schermen, 390x844, ingelogd) =====`);
  for (const pad of PAGINAS) {
    await tel.goto(basis + pad, { waitUntil: 'load' });
    await tel.waitForTimeout(600);
    /* De mobiele meting eerst, want die is goedkoop en hangt niet af van de
       tweede meetronde die het raakvlak soms nodig heeft. */
    try {
      const m = await tel.evaluate(MOB(hand));
      mobiu.gemeten++;
      const waar = pad + ' [' + hand + ']';
      if (m.venster !== 390) mobiu.breed.push(waar + ': het venster is ' + m.venster + ' en niet 390 -- deze meting zegt niets');
      else if (m.inhoud > m.venster + 2) mobiu.breed.push(waar + ': ' + m.inhoud + 'px' + (m.dwinger ? ' door ' + m.dwinger : ''));
      if (m.leeg) mobiu.leeg.push(waar + ': het werkvlak draagt ' + m.tekens + ' tekens en ' + m.beelden + ' beelden');
      for (const b of m.balkenBuiten) mobiu.balk.push(waar + ': ' + b);
      if (!m.hoofd) mobiu.geenHoofd.push(waar);
      else if (m.gebreken.length) mobiu.duim.push(waar + ' \u2014 ' + m.hoofd.naam + ' (' + m.hoofd.merk + '): ' + m.gebreken.join('; '));
    } catch (e) {
      mobiu.breed.push(pad + ' [' + hand + ']: de mobiele meting kon niet draaien -- ' + e.message.split('\n')[0]);
    }
    if (hand !== 'rechts') continue;   // het raakvlak hangt niet van de hand af
    let res;
    try { res = await tel.evaluate(RAAK); }
    catch (e) {
      console.error(`[a11y] ${pad} (raakvlak): de meting kon niet draaien -- ${e.message.split('\n')[0]}`);
      continue;
    }
    /* WIE IETS VINDT, MEET NOG EEN KEER. Een scherm dat binnenkomt met een
       schaal-animatie staat 600ms na load op 99,827%, en dan meet een knop van
       precies 24 pixels er 23,96 -- dat is een moment en geen maat. Zo meldde
       zorgbalie.html een pil die klopte.

       Wachten tot ALLE animaties uit zijn was de eerste poging, en die kostte te
       veel: op de meeste schermen loopt er altijd iets (de wereldklok tikt), dus
       liep bijna elke pagina tegen de tijdgrens aan en werd de ronde drie keer zo
       traag. Een tweede meting kost alleen iets op de schermen die iets vinden,
       en dat zijn er hopelijk nul. Een scherm dat PERMANENT geschaald is, meldt
       zich in die tweede meting gewoon weer -- en terecht, want dan is de knop
       ook echt te klein. */
    if (res.klein.length) {
      try {
        await tel.waitForFunction(
          () => !document.getAnimations || document.getAnimations().every(a => a.playState !== 'running'),
          null, { timeout: 1500 });
      } catch (e) { /* een scherm dat blijft bewegen meten we zoals het staat */ }
      await tel.waitForTimeout(300);
      try { res = await tel.evaluate(RAAK); } catch (e) { /* de eerste meting blijft staan */ }
    }
    if (res.klein.length) {
      raakTotaal += res.klein.length;
      console.log(`\n[a11y] ${pad} (raakvlak): ${res.klein.length} onder ${raakvlak.GRENS}x${raakvlak.GRENS}`);
      for (const w of res.klein.slice(0, 6)) console.log(`  · ${w}`);
    }
  }
  await telefoon.close();
  }
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
  const fouten = [];
  if (totaal > 0) fouten.push(`${totaal} structurele overtreding(en) -- die zijn in beide staten hard nul`);
  if (uitgelogd.contr > grens.uitgelogd.contrast)
    fouten.push(`${uitgelogd.contr} contrastfouten uitgelogd, de grens is ${grens.uitgelogd.contrast}`);
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
  if (fouten.length) {
    console.error('\n[a11y] MISLUKT:');
    for (const f of fouten) console.error('  · ' + f);
    process.exit(1);
  }
  if (raakOordeel.melding) console.log(raakOordeel.melding);
  if (mobielOordeel.melding) console.log(mobielOordeel.melding);
  if (ingelogd.contr < grens.ingelogd.contrast)
    console.log(`\n[a11y] De grens kan strakker: ingelogd ${ingelogd.contr} tegen ${grens.ingelogd.contrast} in A11Y-INGELOGD.json.`);
  console.log(`\n[a11y] ${PAGINAS.length} schermen, uitgelogd EN ingelogd. Structuur nul in beide staten; ` +
    `contrast uitgelogd nul, ingelogd ${ingelogd.contr} binnen de grens van ${grens.ingelogd.contrast}. ` +
    `Raakvlak op telefoonformaat: ${raakTotaal} onder ${raakvlak.GRENS}x${raakvlak.GRENS}. ` +
    `Telefoonronde over twee handen: ${mobiu.breed.length} te breed, ${mobiu.leeg.length} leeg, ` +
    `${mobiu.balk.length} balk buiten beeld, ${mobiu.duim.length} buiten duimbereik; ` +
    `${mobiu.geenHoofd.length} metingen zonder aangewezen hoofdhandeling (werkvoorraad, geen gebrek).`);
})().catch((e) => { console.error('[a11y] fout:', e); process.exit(1); });
