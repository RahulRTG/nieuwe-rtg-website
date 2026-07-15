/* Frontend-build (npm run build):
   1. minify de gedeelde JS naar public/dist met een content-hash in de naam,
      en schrijf een manifest + een groottrapport;
   2. stempel de service-worker CACHE-namen op een content-hash van hun shell,
      zodat de cache automatisch verandert als er iets wijzigt (geen handmatige
      versie-bumps meer, en nooit meer een verouderde cache).
   Idempotent: verandert er niets aan de bron, dan verandert er niets. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');
const { bundels, schrijfBundels } = require('./bundel');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

// De mappen met losse delen van de grote app-scripts: die worden gebundeld en
// niet zelf uitgeserveerd, dus overslaan bij het minificeren.
const DEEL_MAPPEN = new Set(Object.values(bundels).map((m) => path.join(PUB, m)));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Loop public/ af en verzamel alle serveerbare .js-bestanden. De service-workers
// en de dist-map slaan we over: een SW laten we bewust ongemoeid, en dist is de
// uitvoer zelf.
function verzamelJs(dir, uit) {
  for (const naam of fs.readdirSync(dir)) {
    const p = path.join(dir, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (naam === 'dist' || DEEL_MAPPEN.has(p)) continue;
      verzamelJs(p, uit);
    } else if (naam.endsWith('.js') && naam !== 'sw.js') {
      uit.push(p);
    }
  }
  return uit;
}

// Minify elke serveerbare .js naar public/dist/min/<zelfde-pad>. De server
// serveert dit bestand transparant op de originele URL zolang het verser is dan
// de bron (mtime-controle), en valt anders terug op de bron. Geen hash in de
// naam: de service-worker en de cache-headers regelen de versiebeheersing al.
async function minifyServe() {
  const bronnen = verzamelJs(PUB, []);
  const minRoot = path.join(PUB, 'dist', 'min');
  fs.rmSync(minRoot, { recursive: true, force: true }); // stale entries opruimen
  let voor = 0, na = 0, aantal = 0;
  for (const f of bronnen) {
    const code = fs.readFileSync(f, 'utf8');
    let min;
    try {
      const res = await minify(code, { compress: true, mangle: true });
      min = res.code || code;
    } catch (e) { min = code; } // kan het niet gecomprimeerd worden, dan de bron
    const doel = path.join(minRoot, path.relative(PUB, f));
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    fs.writeFileSync(doel, min);
    voor += Buffer.byteLength(code); na += Buffer.byteLength(min); aantal++;
  }
  console.log(`[build] serveerbaar geminificeerd: ${aantal} bestanden, ${voor} -> ${na} bytes (${Math.round((1 - na / voor) * 100)}% kleiner)`);
}

async function minifyGedeeld() {
  const bronnen = ['apps/util.js', 'apps/translate.js', 'apps/geo.js', 'shared/realtime.js', 'apps/foundation/sessie.js']
    .map((p) => path.join(PUB, p)).filter((f) => fs.existsSync(f));
  const dist = path.join(PUB, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const manifest = {};
  let voor = 0, na = 0;
  for (const f of bronnen) {
    const code = fs.readFileSync(f, 'utf8');
    const res = await minify(code, { compress: true, mangle: true });
    const min = res.code || code;
    const naam = path.basename(f).replace(/\.js$/, '') + '.' + sha(min).slice(0, 10) + '.min.js';
    fs.writeFileSync(path.join(dist, naam), min);
    manifest[path.relative(PUB, f).replace(/\\/g, '/')] = 'dist/' + naam;
    voor += Buffer.byteLength(code); na += Buffer.byteLength(min);
  }
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[build] geminificeerd: ${bronnen.length} bestanden, ${voor} -> ${na} bytes (${Math.round((1 - na / voor) * 100)}% kleiner)`);
}

function stempelServiceWorkers() {
  for (const sw of ['sw.js', 'apps/foundation/sw.js']) {
    const p = path.join(PUB, sw);
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, 'utf8');
    const m = s.match(/const CACHE = '([^']*)';/);
    if (!m) { console.warn('[build] geen CACHE in', sw); continue; }
    const delen = m[1].split('-'); delen.pop(); // laatste segment (versie/hash) eraf
    const prefix = delen.join('-') || 'cache';
    // shell-bestanden ophalen en samen met de sw-logica hashen
    const shell = (s.match(/'\/[^']+'/g) || []).map((x) => x.slice(2, -1)).filter((r) => /\.(html|js|css|svg|webmanifest)$/.test(r));
    const h = crypto.createHash('sha256');
    for (const r of shell) { try { h.update(fs.readFileSync(path.join(PUB, r))); } catch (e) {} }
    h.update(s.replace(/const CACHE = '[^']*';/, '')); // de sw-code zelf telt ook mee
    const hash = h.digest('hex').slice(0, 8);
    const nieuw = prefix + '-' + hash;
    if (m[1] !== nieuw) { s = s.replace(/const CACHE = '[^']*';/, `const CACHE = '${nieuw}';`); fs.writeFileSync(p, s); }
    console.log(`[build] service-worker ${sw}: CACHE = ${nieuw}`);
  }
}

(async () => {
  const gebundeld = schrijfBundels();
  console.log('[build] gebundeld: ' + (gebundeld.length ? gebundeld.join(', ') : 'bundels al actueel'));
  await minifyGedeeld();
  await minifyServe();
  stempelServiceWorkers();
  console.log('[build] klaar.');
})().catch((e) => { console.error('[build] mislukt:', e); process.exit(1); });
