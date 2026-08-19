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

function laadPlaywright() {
  const paden = [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'];
  for (const p of paden) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); }
    catch (e) { /* volgende pad */ }
  }
  // Geen Playwright-pakket? Val terug op onze eigen browser-driver (CDP over de
  // pipe-transport), maar alleen als er echt een Chromium-binary staat.
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
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
    /* RTG_CHROMIUM wijst een browser aan die niet op de plek staat die het
       pakket verwacht (een ontwikkelbak met een eigen chromium). Leeg is
       undefined en dus precies het gedrag van hiervoor. */
    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.RTG_CHROMIUM || undefined });
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
  const telefoon = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await telefoon.addInitScript((t) => {
    try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
  }, lid.token);
  const tel = await telefoon.newPage();
  const RAAK = '(function(){' + raakvlak.BRON + '\nreturn window.__a11yRaakvlak(' + raakvlak.GRENS + ')})()';
  let raakTotaal = 0;
  console.log(`\n[a11y] ===== ronde RAAKVLAK (${PAGINAS.length} schermen, 390x844, ingelogd) =====`);
  for (const pad of PAGINAS) {
    await tel.goto(basis + pad, { waitUntil: 'load' });
    await tel.waitForTimeout(600);
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
  console.log(`[a11y] ronde raakvlak: ${raakTotaal} onder ${raakvlak.GRENS}x${raakvlak.GRENS}`);

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
      await pg.goto(basis + pad, { waitUntil: 'load' });
      await pg.waitForTimeout(600);
      let res;
      try { res = await pg.evaluate(KEUR); }
      catch (e) {
        console.error(`[a11y] ${pad} (${thema}): de keuring kon niet draaien -- ${e.message.split('\n')[0]}`);
        struct += 1; continue;
      }
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
  /* DE THEMA'S HEBBEN EEN BOVENGRENS EN GEEN NUL, en dat is geen zwakkere poort
     maar een eerlijkere. De onzichtbare tekst is weg en staat hard op nul; wat
     er onder de thema's overblijft is EEN soort: het goud en de andere accenten
     als KLEINE tekst. Dat is een merkbesluit (MATERIAAL.md: goud is een
     vulkleur en geen tekstkleur) en geen instelfout, en het raakt de vormtaal.
     Die op dag een hard afkeuren zou betekenen: de poort staat rood tot iemand
     dat besluit heeft genomen, en dan wordt hij uitgezet.

     Dus staat er per thema een getal dat alleen OMLAAG mag. Komt er ergens een
     bevinding bij -- ook een onzichtbare -- dan gaat het getal omhoog en zakt de
     scan. Een thema zonder getal in het register is een fout en geen vrijstelling. */
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
    `Thema's: ` + perThema.map(t => `${t.thema} ${t.contr} (grens ${(grens.themas || {})[t.thema]})`).join(', ') + '.');
})().catch((e) => { console.error('[a11y] fout:', e); process.exit(1); });
