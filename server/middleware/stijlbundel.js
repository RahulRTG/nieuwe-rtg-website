/* ============================================================================
   DE STIJLBLADEN IN EEN VERZOEK.

   WAT ER GEMETEN IS, en waarom het juist dit onderdeel is. /apps/app.html doet
   72 verzoeken: 1 document, 57 scripts, 7 stijlbladen, 2 lettertypen, de rest
   klein grut. Van die 72 zijn er precies zeven die het TEKENEN tegenhouden --
   een browser toont geen letter tot elk stijlblad binnen is. De scripts staan
   onderaan de body en houden het beeld niet tegen.

   Zeven blokkerende verzoeken worden er hier een.

   WAAROM ALLEEN DE STIJLBLADEN EN NIET DE SCRIPTS. Twee losse <script>-tags en
   een samengevoegde zijn NIET hetzelfde: gooit de eerste een fout, dan draait
   de tweede in het eerste geval gewoon door en in het tweede geval niet meer.
   Dat is een echt verschil in gedrag, en niet iets om ongemerkt in te ruilen
   voor een paar verzoeken. Bij CSS bestaat dat verschil niet: een regel die de
   ontleder niet snapt wordt overgeslagen, precies zoals in een los bestand.
   Samenvoegen is daar wel een zuivere winst.

   HOE, ZONDER DE BRON AAN TE RAKEN. De nonce-laag (./voordeur.js) leest elke
   pagina toch al om er stempels in te zetten. Die vervangt nu ook een rij
   opeenvolgende stijlbladen door EEN verwijzing. Er verandert niets aan de 198
   pagina's in public/, en het werkt meteen voor allemaal.

   GEEN SERVERGEHEUGEN. De lijst staat IN de verwijzing (base64url), niet in een
   tabel op de server. Een tabel zou na een herstart leeg zijn, en dan krijgt een
   pagina die al openstond een 404 op haar eigen opmaak -- kaal scherm, geen
   foutmelding. Dit kan dat niet: de verwijzing beschrijft zichzelf. Wat er wel
   en niet in mag staat in de controles hieronder; test/stijlbundel.test.js
   loopt ze na.

   RELATIEVE VERWIJZINGEN. url(...) wordt opgelost tegen de URL van het BLAD.
   Onder een derde adres wijst url(Inter.woff2) opeens de verkeerde kant op en
   valt de typografie om. Vandaar dat elke relatieve url() bij het samenvoegen
   absoluut wordt gemaakt tegen zijn eigen map.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const { herschrijfHtml, decodeer, GOED_PAD, PAD } = require('./stijlbundel-rij');
/* De bundel zelf. Leest de bestanden, schrijft relatieve url() om naar het
   absolute pad van hun eigen map, en plakt ze in de gevraagde volgorde aaneen. */
const URL_IN_CSS = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
function absolutUrls(css, mapPad) {
  return css.replace(URL_IN_CSS, (heel, q, adres) => {
    const a = adres.trim();
    // absoluut, data:, blob: of een volledige URL: met rust laten
    if (!a || a[0] === '/' || a[0] === '#' || /^[a-z][a-z0-9+.-]*:/i.test(a)) return heel;
    return 'url(' + q + path.posix.join(mapPad, a) + q + ')';
  });
}

function stijlbundel(publicDir) {
  const cache = new Map(); // sleutel -> { stempel, css, gz, br }
  return (req, res, next) => {
    if (req.path !== PAD) return next();
    const paden = decodeer(req.query && req.query.f);
    if (!paden.length || paden.length > 40) return res.status(400).type('text/plain').send('/* geen bundel gevraagd */');

    const bestanden = [];
    for (const p of paden) {
      if (!GOED_PAD.test(p) || p.indexOf('..') !== -1) return res.status(400).type('text/plain').send('/* ongeldig pad */');
      const abs = path.join(publicDir, p);
      if (!abs.startsWith(publicDir + path.sep)) return res.status(400).type('text/plain').send('/* buiten de webroot */');
      let st; try { st = fs.statSync(abs); } catch (e) { return next(); } // bestaat niet: laat de 404 het doen
      if (!st.isFile()) return next();
      bestanden.push({ p, abs, mtimeMs: st.mtimeMs, size: st.size });
    }

    /* De stempel draagt elk bestand met zijn tijd en maat. Verandert er een,
       dan verandert de stempel, en dan haalt de browser hem opnieuw op. */
    const stempel = bestanden.map(b => b.size.toString(16) + '.' + Math.round(b.mtimeMs).toString(16)).join('_');
    const sleutel = paden.join('|');
    let hit = cache.get(sleutel);
    if (!hit || hit.stempel !== stempel) {
      let css = '';
      try {
        for (const b of bestanden)
          css += '/* ' + b.p + ' */\n' + absolutUrls(fs.readFileSync(b.abs, 'utf8'), path.posix.dirname(b.p)) + '\n';
      } catch (e) { return next(); }
      hit = { stempel, css: Buffer.from(css, 'utf8'), gz: null, br: null };
      if (cache.size > 100) cache.clear();
      cache.set(sleutel, hit);
    }

    const ae = String(req.headers['accept-encoding'] || '');
    const br = /\bbr\b/.test(ae), gz = !br && /\bgzip\b/.test(ae);
    const vorm = br ? 'b' : (gz ? 'g' : 'r');
    const etag = 'W/"sb-' + Buffer.from(stempel).toString('base64url').slice(0, 32) + '-' + vorm + '"';
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (br) {
      if (!hit.br) hit.br = zlib.brotliCompressSync(hit.css, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } });
      res.setHeader('Content-Encoding', 'br');
      return res.end(hit.br);
    }
    if (gz) {
      if (!hit.gz) hit.gz = zlib.gzipSync(hit.css, { level: 6 });
      res.setHeader('Content-Encoding', 'gzip');
      return res.end(hit.gz);
    }
    res.end(hit.css);
  };
}

module.exports = { stijlbundel, herschrijfHtml, absolutUrls, PAD };
