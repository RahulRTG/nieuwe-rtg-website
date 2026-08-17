/* Toegankelijkheids-scan (npm run a11y):
   serveert public/ statisch, opent elke vlaggenschip-pagina in een echte
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
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const STRICT = process.env.A11Y_STRICT === '1';

// vlaggenschip-schermen: de eerste render (uitgelogd) van de belangrijkste apps
const PAGINAS = [
  '/apps/foundation/index.html',
  '/apps/foundation/vrienden.html',
  '/apps/foundation/school.html',
  '/apps/app.html',
  // het schakelbord waarop een lid zijn privacy regelt: als er ergens geen
  // schermlezer-gat mag zitten, is het hier
  '/apps/boardroom.html',
  '/apps/leverancier.html',
  '/apps/backoffice.html',
  '/apps/personeel.html',
  '/apps/camera.html',
  '/apps/muziek.html',
  '/apps/podium.html',
  '/apps/oog.html',
  '/apps/ghost.html',
  '/apps/flits.html',
  '/apps/theater.html',
  '/apps/geld.html',
  '/apps/passkeys.html',
  /* RTG Veilig staat hier omdat het de app is waarin iemand onder spanning iets
     moet kunnen invullen: een zin typen terwijl er iemand meekijkt, een knop
     vinden terwijl de klok loopt. De vier schermen die hierin opgingen stonden
     nooit in deze lijst; dat was een gat, niet een keuze. */
  '/apps/veilig.html',
  /* RTG Reizen: de wereld boven de reisapps. Staat hier omdat een lijst met
     komende reizen alleen werkt als hij ook zonder muis en met een schermlezer
     te doorlopen is -- het is de app waarin iemand op een station kijkt. */
  '/apps/reizen.html',
  '/apps/ov.html',
  '/apps/ovdienst.html',
  '/apps/ovroutes.html',
  '/apps/clips.html',
  '/apps/scherm.html',
  '/apps/spelscherm.html',
  '/apps/office.html',
  '/apps/vonk.html',
  '/apps/berichten.html',
  '/apps/salon.html',
  '/apps/genootschap.html',
  /* De sociale super-app. Een nieuw scherm hoort meteen in de keuring te staan,
     anders is 'schoon' een aanname in plaats van een meting -- en dat is hier
     nagetrokken: haal de tekst uit een link in de onderbalk weg en deze scan
     meldt 'link-naam' op /apps/wereld.html. Wat hij NIET ziet is wat achter de
     inlog zit (de panelen Ontdek en Profiel staan bij de eerste render op
     hidden); dat geldt voor elk scherm in deze lijst en is de reikwijdte van
     deze scan, niet iets wat dit scherm apart heeft. */
  '/apps/wereld.html',
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

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

function statischeServer() {
  return http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const bestand = path.join(PUB, path.normalize(rel));
    if (!bestand.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    fs.readFile(bestand, (err, data) => {
      if (err) { res.writeHead(404); return res.end('niet gevonden'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(bestand)] || 'application/octet-stream' });
      res.end(data);
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
  const server = statischeServer();
  await new Promise((r) => server.listen(0, r));
  const poort = server.address().port;
  const basis = `http://127.0.0.1:${poort}`;

  let browser;
  try {
    browser = await pw.chromium.launch();
  } catch (e) {
    console.log('[a11y] Kon Chromium niet starten; scan overgeslagen:', e.message);
    server.close();
    process.exit(STRICT ? 1 : 0);
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  let totaal = 0, contrastTotaal = 0;
  for (const pad of PAGINAS) {
    await page.goto(basis + pad, { waitUntil: 'load' });
    await page.waitForTimeout(600); // laat intro-animaties (opacity) uitlopen; anders een tijdelijk lager contrast
    await page.addScriptTag({ content: BRON });
    const res = await page.evaluate(() => window.__a11yKeur());
    // structurele overtredingen falen hard (ondubbelzinnig, zoals axe serious/critical)
    if (res.overtredingen.length) {
      totaal += res.overtredingen.reduce((n, v) => n + v.aantal, 0);
      console.log(`\n[a11y] ${pad}: ${res.overtredingen.length} soort(en) structurele overtreding`);
      for (const v of res.overtredingen) {
        console.log(`  · ${v.id}: ${v.help} (${v.aantal}x)`);
        /* WAAR, net als bij de contrastmelding hieronder. Zonder plaats is een
           structurele overtreding op een pagina met veertig velden een zoektocht
           -- en juist deze meldingen laten de bouw falen, dus daar wil je het
           adres het hardst. */
        for (const w of (v.waar || [])) console.log(`      ${w}`);
      }
    } else {
      console.log(`[a11y] ${pad}: schoon`);
    }
    /* CONTRAST IS NU FATAAL, EN DAT WAS EEN GOEDKOOP MOMENT.

       Het stond adviserend om een goede reden: de achtergrond-heuristiek van
       axe (door lagen en gradients heen) wordt hier niet volledig nagemaakt, en
       een bouw rood maken op een meetverschil is erger dan de melding missen.
       Maar die reden dekt alleen de TWIJFELGEVALLEN, en de keuring meet die al
       niet: hij slaat alleen aan op een element met eigen zichtbare tekst, vol
       dekkende voorgrondkleur en een oplosbare, SOLIDE achtergrond. Wat
       overblijft is geen meetverschil maar een leesbaar/niet-leesbaar oordeel.

       Gemeten op het moment van omzetten: nul contrastmeldingen over alle
       vlaggenschip-pagina's. De poort kostte dus vandaag niets -- en dat is
       precies wanneer je hem moet sluiten, want CLAUDE.md heeft de regel al
       ("bordeaux is nooit een tekstkleur op zwart") en tot nu toe stond die
       regel op papier en niet in de machine. */
    if (res.contrast.length) {
      contrastTotaal += res.contrast.reduce((n, v) => n + v.aantal, 0);
      for (const v of res.contrast) {
        console.log(`  · contrast: ${v.help} (${v.aantal}x)`);
        // WAAR: zonder plaats is een contrastmelding niet te repareren.
        for (const w of (v.waar || [])) console.log(`      ${w}`);
      }
    }
  }
  await browser.close();
  server.close();
  const oordeel = velt(totaal, contrastTotaal);
  for (const regel of oordeel.melding) console.error(regel);
  if (oordeel.faalt) process.exit(1);
  console.log('\n[a11y] Alle vlaggenschip-pagina’s structureel schoon.');
})().catch((e) => { console.error('[a11y] fout:', e); process.exit(1); });
