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

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

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
  await minifyGedeeld();
  stempelServiceWorkers();
  console.log('[build] klaar.');
})().catch((e) => { console.error('[build] mislukt:', e); process.exit(1); });
