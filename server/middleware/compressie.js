/* Alles gecomprimeerd over de lijn.

   Twee lagen, want ze hebben elk een andere bron. De eerste wikkelt de
   JSON-antwoorden van de API's in; die worden per verzoek opgebouwd en zijn
   dus nooit hetzelfde. De tweede serveert de statische bestanden (js, css,
   svg) en die veranderen juist bijna nooit, dus die bewaren we gecomprimeerd
   in het geheugen.

   Waarom dit ertoe doet: op een smalle of trage verbinding, satelliet,
   buitengebied, traag mobiel, scheelt dit 70 tot 90 procent per antwoord. De
   grote app-scripts gaan zo ongeveer vier keer kleiner de deur uit. Zonder
   extra pakket: de zlib die in Node zit volstaat.

   Beide lagen moeten VOOR de routers hangen, anders missen die de wikkel. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GZIP_TYPE = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};
const wilGzip = req => /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));

/* De API-antwoorden. Kleine antwoorden laten we met rust: onder ongeveer een
   kilobyte kost comprimeren meer dan het oplevert. */
function jsonGzip() {
  return (req, res, next) => {
    if (!wilGzip(req)) return next();
    const gewoonJson = res.json.bind(res);
    res.json = (data) => {
      let s;
      try { s = JSON.stringify(data); } catch (e) { return gewoonJson(data); }
      if (typeof s !== 'string' || s.length < 1024 || res.headersSent) return gewoonJson(data);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.send(zlib.gzipSync(Buffer.from(s), { level: 6 }));
    };
    next();
  };
}

/* De statische tekstbestanden, met een cache op pad plus wijzigingstijd.

   Als er een geminificeerde versie klaarstaat (npm run build) serveren we die,
   maar alleen als hij verser is dan de bron. Zonder die controle zou een
   lokaal bewerkt bestand stilletjes een oude minify uitserveren, en dan zit je
   te zoeken naar een wijziging die er wel staat maar niet aankomt. */
function statischGzip(publicDir) {
  const MIN_DIR = path.join(publicDir, 'dist', 'min');
  const cache = new Map(); // absoluut pad -> { mtimeMs, minMtimeMs, gz }
  return (req, res, next) => {
    if (req.headers.range) return next(); // range-verzoeken: laat express.static het doen
    if (!wilGzip(req)) return next();
    let rel; try { rel = decodeURIComponent(req.path); } catch (e) { return next(); }
    if (rel.indexOf('..') !== -1) return next();
    const bestand = path.join(publicDir, rel);
    if (!bestand.startsWith(publicDir)) return next();
    const type = GZIP_TYPE[path.extname(bestand)]; if (!type) return next();
    let st; try { st = fs.statSync(bestand); } catch (e) { return next(); }
    if (!st.isFile()) return next();

    let minPad = null, minMtimeMs = 0;
    if (type.indexOf('javascript') !== -1) {
      const kandidaat = path.join(MIN_DIR, rel);
      if (kandidaat.startsWith(MIN_DIR)) {
        try {
          const mst = fs.statSync(kandidaat);
          if (mst.isFile() && mst.mtimeMs >= st.mtimeMs) { minPad = kandidaat; minMtimeMs = mst.mtimeMs; }
        } catch (e) { /* geen minify aanwezig: bron gebruiken */ }
      }
    }
    let hit = cache.get(bestand);
    if (!hit || hit.mtimeMs !== st.mtimeMs || hit.minMtimeMs !== minMtimeMs) {
      try {
        const bron = fs.readFileSync(minPad || bestand);
        hit = { mtimeMs: st.mtimeMs, minMtimeMs, gz: zlib.gzipSync(bron, { level: 6 }) };
      } catch (e) { return next(); }
      if (cache.size > 300) cache.clear();
      cache.set(bestand, hit);
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(hit.gz);
  };
}

module.exports = { jsonGzip, statischGzip, GZIP_TYPE, wilGzip };
