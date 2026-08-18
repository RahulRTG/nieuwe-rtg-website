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
/* BROTLI WAAR HET KAN, GZIP WAAR HET MOET.

   Brotli zit sinds Node 11 in dezelfde zlib die hier al gebruikt wordt -- geen
   pakket, geen build-stap. Op onze eigen bestanden gemeten scheelt hij 10 tot
   18 procent ten opzichte van gzip; op de app-bundel 108 KB -> 88 KB. Dat is
   per eerste bezoek zo'n vijftig kilobyte die niet over een mobiele verbinding
   hoeft.

   Waarom er dan nog gzip is: elke browser van de laatste tien jaar kent
   brotli, maar niet elke tussenliggende proxy, en een client die het niet
   vraagt hoort het niet te krijgen. De keuze volgt dus de Accept-Encoding-kop
   van de client en nooit een aanname van ons.

   DE KWALITEIT IS GEMETEN, NIET GEKOZEN. Op onze eigen app-bundel (397 KB):

     gzip-6       108 KB     9 ms
     brotli-5      98 KB    11 ms    9% kleiner dan gzip
     brotli-6      96 KB    13 ms   10%
     brotli-9      94 KB    42 ms   12%
     brotli-11     88 KB   707 ms   18%

   Stand 11 stond hier eerst, want "het wordt toch maar een keer gecomprimeerd".
   Dat klopte niet: het gebeurt bij het EERSTE VERZOEK, en met tweeenzeventig
   bestanden op een pagina liep de laadtijd van 608 ms naar 2061 ms. De eerste
   bezoeker na een herstart betaalde dus de hele rekening. Gemeten met een echte
   browser, niet beredeneerd -- en daarom staat hij nu op 6: negen tiende van de
   winst voor een vijftigste van de tijd. Wil iemand die laatste acht procent,
   dan hoort stand 11 in de BUILD (npm run build) en niet in het verzoek.

   Een JSON-antwoord wordt per verzoek opgebouwd en nooit hergebruikt; die
   krijgt stand 4, ongeveer even snel als gzip en nog steeds kleiner. */
const wilBrotli = req => /\bbr\b/.test(String(req.headers['accept-encoding'] || ''));
const BR_STATISCH = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } };
const BR_ANTWOORD = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } };

/* De API-antwoorden. Kleine antwoorden laten we met rust: onder ongeveer een
   kilobyte kost comprimeren meer dan het oplevert. */
function jsonGzip() {
  return (req, res, next) => {
    const br = wilBrotli(req);
    if (!br && !wilGzip(req)) return next();
    const gewoonJson = res.json.bind(res);
    res.json = (data) => {
      let s;
      try { s = JSON.stringify(data); } catch (e) { return gewoonJson(data); }
      if (typeof s !== 'string' || s.length < 1024 || res.headersSent) return gewoonJson(data);
      /* ASYNCHROON, EN DAT IS HIER GEEN SMAAKKWESTIE.

         Dit stond op brotliCompressSync/gzipSync, en die doen hun rekenwerk OP
         DE EVENT-LOOP: zolang zlib bezig is staat de hele server stil, ook voor
         verzoeken die niets met dit antwoord te maken hebben. Gemeten met gzip-6
         op een echt API-antwoord: 0,8 ms bij 164 kB, 4,2 ms bij 827 kB, 16,3 ms
         bij 3320 kB (brotli-4 vergelijkbaar). Dat lijkt weinig tot je het maal
         de doorvoer doet -- bij 300 van die verzoeken per seconde is het een
         kwart seconde per seconde, en het slaat neer op de p99 van ELK verzoek,
         ook de kleine die zelf niet eens gecomprimeerd worden.

         De asynchrone vorm rekent in de threadpool en levert byte-voor-byte
         dezelfde uitvoer (nagemeten met Buffer.equals). De statische laag
         hieronder blijft synchroon: die comprimeert een bestand EEN keer en
         bewaart het, dus daar valt geen herhaald werk weg te halen.

         De koppen worden pas gezet als de compressie GELUKT is: zou
         Content-Encoding er al staan en de compressie daarna falen, dan beloofde
         het antwoord een verpakking die er niet is. */
      const bron = Buffer.from(s);
      const klaar = (err, uit) => {
        if (res.headersSent) return;
        if (err || !uit) {
          /* Niets slaat stil over (LAT.md regel 5): onverpakt bezorgen is de
             juiste uitwijk, maar hij hoort geteld te worden. De synchrone vorm
             zou hier gegooid hebben en dus zichtbaar zijn geweest. */
          try { require('../log').log.warn('compressie mislukt (' + (err && err.message) + '); onverpakt bezorgd.'); } catch (e) {}
          return gewoonJson(data);
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', br ? 'br' : 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.send(uit);
      };
      if (br) zlib.brotliCompress(bron, BR_ANTWOORD, klaar);
      else zlib.gzip(bron, { level: 6 }, klaar);
      return res;
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
    const br = wilBrotli(req);
    if (!br && !wilGzip(req)) return next();
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
    /* BEIDE VORMEN IN DE CACHE, en pas gemaakt wanneer er om gevraagd wordt.
       Alles vooraf comprimeren zou bij het opstarten honderden bestanden twee
       keer door brotli-11 halen; zo betaalt alleen het eerste verzoek per
       bestand per vorm. */
    let hit = cache.get(bestand);
    if (!hit || hit.mtimeMs !== st.mtimeMs || hit.minMtimeMs !== minMtimeMs) {
      hit = { mtimeMs: st.mtimeMs, minMtimeMs, gz: null, br: null, pad: minPad || bestand };
      if (cache.size > 300) cache.clear();
      cache.set(bestand, hit);
    }
    const vorm = br ? 'br' : 'gz';
    if (!hit[vorm]) {
      try {
        const bron = fs.readFileSync(hit.pad);
        hit[vorm] = br ? zlib.brotliCompressSync(bron, BR_STATISCH) : zlib.gzipSync(bron, { level: 6 });
      } catch (e) { return next(); }
    }
    /* Geen max-age meer: met een vaste levensduur bleef na een update overal
       (browser en Cloudflare-edge) tot uren lang een OUD script hangen naast
       de NIEUWE html, en die mix brak de app zonder foutmelding (leeg
       beginscherm). "no-cache" betekent: bewaren mag, maar eerst even
       navragen -- dat navragen is met de ETag hieronder een 304 van een paar
       bytes, en Cloudflare cachet zulke antwoorden niet aan de rand. */
    /* DE VORM HOORT IN DE ETAG. Zonder dat verschil kan een tussenliggende
       cache een brotli-antwoord teruggeven op een verzoek dat alleen gzip
       aankan (of andersom) -- zelfde ETag, andere bytes. Vary alleen is daar
       niet genoeg gebleken in de praktijk. */
    const etag = 'W/"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + (minMtimeMs ? '-m' + Math.round(minMtimeMs).toString(16) : '') + '-' + (br ? 'b' : 'g') + '"';
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Encoding', br ? 'br' : 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.end(hit[vorm]);
  };
}

module.exports = { jsonGzip, statischGzip, GZIP_TYPE, wilGzip, wilBrotli };
