/* De statische serveerlaag: de strengere CSP met per-antwoord nonce voor
   de app-pagina's, de lichte gzip-cache voor tekstassets (met verse-minify
   detectie uit npm run build) en de express.static-terugval. Een keer
   gemount bij het opstarten vanuit server.js; PUBLIC_DIR en CSP_NONCE gaan
   terug omdat het kern-object ze exporteert. */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

module.exports = ({ app, express }) => {
/* Strengere CSP voor de app-pagina's: geen 'unsafe-inline' voor scripts, maar
   een per-antwoord nonce. We lezen het .html-bestand, geven elke <script> die
   nonce mee en zetten de CSP navenant. De apps gebruiken addEventListener (geen
   inline on-handlers), dus dit werkt zonder ze om te bouwen en sluit de deur
   voor ingespoten scripts. Uit te zetten met RTG_CSP_NONCE=0. Losse statische
   pagina's (bijv. 404) vallen terug op de gewone CSP hierboven. */
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const CSP_NONCE = process.env.RTG_CSP_NONCE !== '0';
app.use((req, res, next) => {
  if (!CSP_NONCE || req.method !== 'GET') return next();
  let rel = req.path;
  if (rel.endsWith('/')) rel += 'index.html';
  if (!rel.endsWith('.html')) return next();
  const bestand = path.join(PUBLIC_DIR, rel);
  if (!bestand.startsWith(PUBLIC_DIR + path.sep)) return next(); // geen path traversal
  fs.readFile(bestand, 'utf8', (err, html) => {
    if (err) return next(); // bestaat niet: laat de statische laag/404 het doen
    const nonce = crypto.randomBytes(16).toString('base64');
    html = html.replace(/<script(?![^>]*\bnonce=)/g, '<script nonce="' + nonce + '"');
    res.set('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'; style-src 'self' 'unsafe-inline'; " +
      "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
      "connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'");
    res.type('html');
    // ook de pagina's zelf gecomprimeerd over de lijn (satelliet en traag mobiel)
    if (html.length > 2048 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.send(zlib.gzipSync(Buffer.from(html), { level: 6 }));
    }
    res.send(html);
  });
});

/* Lichte gzip voor statische tekstassets (js/css/svg/json/webmanifest), met een
   in-memory cache op pad + mtime. De grote app-scripts (leverancier.js ~5000
   regels, app-main.js ~4400) gaan zo ~75% kleiner over de lijn, zonder extra
   dependency (ingebouwde zlib) en zonder per-verzoek opnieuw te comprimeren.
   Valt netjes terug op express.static bij range-verzoeken of onbekende paden. */
const PUBLIC_DIR_STATIC = path.join(__dirname, '..', '..', 'public');
const GZIP_TYPE = { '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const MIN_DIR_STATIC = path.join(PUBLIC_DIR_STATIC, 'dist', 'min');
const gzipCache = new Map(); // absoluut pad -> { mtimeMs, minMtimeMs, gz }
app.get(/\.(?:js|css|svg|json|webmanifest)$/, (req, res, next) => {
  if (req.headers.range) return next(); // range-verzoeken: laat express.static het doen
  if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();
  let rel; try { rel = decodeURIComponent(req.path); } catch (e) { return next(); }
  if (rel.indexOf('..') !== -1) return next();
  const bestand = path.join(PUBLIC_DIR_STATIC, rel);
  if (!bestand.startsWith(PUBLIC_DIR_STATIC)) return next();
  const type = GZIP_TYPE[path.extname(bestand)]; if (!type) return next();
  let st; try { st = fs.statSync(bestand); } catch (e) { return next(); }
  if (!st.isFile()) return next();
  // Is er een verse geminificeerde versie (npm run build)? Dan die serveren,
  // anders de bron. Vers = gebouwd na de laatste bronwijziging (mtime-controle),
  // zodat een lokaal bewerkt bronbestand nooit een oude minify uitserveert.
  let minPad = null, minMtimeMs = 0;
  if (type.indexOf('javascript') !== -1) {
    const kandidaat = path.join(MIN_DIR_STATIC, rel);
    if (kandidaat.startsWith(MIN_DIR_STATIC)) {
      try {
        const mst = fs.statSync(kandidaat);
        if (mst.isFile() && mst.mtimeMs >= st.mtimeMs) { minPad = kandidaat; minMtimeMs = mst.mtimeMs; }
      } catch (e) { /* geen minify aanwezig: bron gebruiken */ }
    }
  }
  let hit = gzipCache.get(bestand);
  if (!hit || hit.mtimeMs !== st.mtimeMs || hit.minMtimeMs !== minMtimeMs) {
    try {
      const bron = fs.readFileSync(minPad || bestand);
      hit = { mtimeMs: st.mtimeMs, minMtimeMs, gz: zlib.gzipSync(bron, { level: 6 }) };
    }
    catch (e) { return next(); }
    if (gzipCache.size > 300) gzipCache.clear();
    gzipCache.set(bestand, hit);
  }
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(hit.gz);
});

app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  return { PUBLIC_DIR, CSP_NONCE };
};
