/* Toegankelijkheids-scan (npm run a11y):
   serveert public/ statisch, opent elke vlaggenschip-pagina in een echte
   browser, injecteert axe-core en faalt bij een 'serious' of 'critical'
   overtreding. Dit vangt contrast-, label- en landmark-fouten die je met
   statische regels niet betrouwbaar ziet.

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
  '/apps/index.html',
  '/apps/foundation/index.html',
  '/apps/foundation/vrienden.html',
  '/apps/foundation/school.html',
  '/apps/app.html',
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
  '/apps/wbw.html',
  '/apps/passkeys.html',
  '/apps/ov.html',
  '/apps/ovdienst.html',
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
  const axeBron = fs.readFileSync(require.resolve('axe-core'), 'utf8');
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
  let totaal = 0;
  for (const pad of PAGINAS) {
    await page.goto(basis + pad, { waitUntil: 'load' });
    await page.waitForTimeout(600); // laat intro-animaties (opacity) uitlopen; anders meet axe een tijdelijke lagere contrast
    await page.addScriptTag({ content: axeBron });
    const res = await page.evaluate(async () => {
      // scan de zichtbare eerste render; verborgen alternatieve views tellen niet mee
      return await window.axe.run(document, { resultTypes: ['violations'],
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] } });
    });
    const ernstig = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (ernstig.length) {
      totaal += ernstig.length;
      console.log(`\n[a11y] ${pad}: ${ernstig.length} ernstige overtreding(en)`);
      for (const v of ernstig) console.log(`  · ${v.impact.toUpperCase()} ${v.id}: ${v.help} (${v.nodes.length}x)`);
    } else {
      console.log(`[a11y] ${pad}: schoon`);
    }
  }
  await browser.close();
  server.close();
  if (totaal) { console.error(`\n[a11y] MISLUKT: ${totaal} ernstige overtreding(en).`); process.exit(1); }
  console.log('\n[a11y] Alle vlaggenschip-pagina’s schoon (0 serious/critical).');
})().catch((e) => { console.error('[a11y] fout:', e); process.exit(1); });
