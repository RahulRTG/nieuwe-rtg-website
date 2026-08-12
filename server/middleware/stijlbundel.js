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
const crypto = require('crypto');

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

/* @import OPLOSSEN, want samenvoegen maakt hem stuk.

   Een @import is alleen geldig BOVENAAN een blad. Plak je twee bladen aaneen,
   dan staat de @import van het tweede opeens middenin, en gooit de ontleder hem
   weg -- zonder fout, zonder melding. Precies dat gebeurde toen shared/rtg-ui.css
   de materialen, het ontwerpsysteem en de vier thema's ging insluiten: los
   werkte het, gebundeld verdween het, en het scherm zag er hetzelfde uit als
   ervoor. Dat is het gemeenste soort stuk, want er is niets aan te zien.

   Wat een @import BETEKENT is: zet de regels van dat blad hier neer. Dus doet
   deze laag dat ook letterlijk, op de plek van de regel zelf, zodat de cascade
   klopt. Alleen eigen paden (dezelfde controle als voor de bundel), met een
   diepte- en kringbewaking, en de ingesloten bladen tellen mee voor de stempel
   -- anders verandert de bundel niet als een ingesloten blad wel verandert. */
const IMPORT = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*;/gi;
function metImports(abs, p, publicDir, gebruikt, gezien, diepte) {
  let css;
  try { css = fs.readFileSync(abs, 'utf8'); } catch (e) { return ''; }
  css = absolutUrls(css, path.posix.dirname(p));
  if (diepte > 4) return css;
  return css.replace(IMPORT, (heel, q1, a1, q2, a2) => {
    const doel = (a1 || a2 || '').trim();
    // vreemde bladen, media-varianten en alles wat niet een eigen .css-pad is: laten staan
    if (!GOED_PAD.test(doel) || doel.indexOf('..') !== -1) return heel;
    const dAbs = path.join(publicDir, doel);
    if (!dAbs.startsWith(publicDir + path.sep)) return heel;
    if (gezien.has(dAbs)) return '/* @import ' + doel + ': al ingesloten */';
    let st; try { st = fs.statSync(dAbs); } catch (e) { return heel; }
    if (!st.isFile()) return heel;
    gezien.add(dAbs);
    gebruikt.push({ p: doel, abs: dAbs, mtimeMs: st.mtimeMs, size: st.size });
    return '/* @import ' + doel + ' */\n' +
      metImports(dAbs, doel, publicDir, gebruikt, gezien, diepte + 1);
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

    /* Eerst bouwen, DAN stempelen. De stempel moet ook de ingesloten bladen
       dekken: verandert rtg-themas.css maar niet rtg-ui.css die hem insluit,
       dan zou een stempel over alleen de gevraagde bladen gelijk blijven en
       serveert de cache een bundel met de oude thema's -- onvindbaar, want het
       bestand op schijf klopt wel. */
    let css = '';
    const gezien = new Set(bestanden.map(b => b.abs));
    const alles = bestanden.slice();
    try {
      for (const b of bestanden)
        css += '/* ' + b.p + ' */\n' + metImports(b.abs, b.p, publicDir, alles, gezien, 0) + '\n';
    } catch (e) { return next(); }

    const stempel = alles.map(b => b.size.toString(16) + '.' + Math.round(b.mtimeMs).toString(16)).join('_');
    const sleutel = paden.join('|');
    let hit = cache.get(sleutel);
    if (!hit || hit.stempel !== stempel) {
      hit = { stempel, css: Buffer.from(css, 'utf8'), gz: null, br: null };
      if (cache.size > 100) cache.clear();
      cache.set(sleutel, hit);
    }

    const ae = String(req.headers['accept-encoding'] || '');
    const br = /\bbr\b/.test(ae), gz = !br && /\bgzip\b/.test(ae);
    const vorm = br ? 'b' : (gz ? 'g' : 'r');
    /* HASHEN EN DAN AFKAPPEN, NIET ANDERSOM. Hier stond
       `Buffer.from(stempel).toString('base64url').slice(0, 32)`: de stempel
       zelf, afgekapt op 32 tekens. Die 32 tekens base64 dragen 24 bytes van de
       stempel, en de stempel is "grootte.mtime_grootte.mtime_..." per blad --
       dus hij dekte de eerste een a twee bladen en verder niets.

       Wat dat deed: wijzig je het VIJFDE blad (canvas.css), dan blijft de ETag
       letterlijk gelijk en antwoordt de server 304 Not Modified op een bundel
       die wel degelijk veranderd is. De browser houdt de oude stijl, en op
       schijf klopt alles -- de onvindbaarste soort. Het is precies de fout waar
       de opmerking twintig regels hierboven al voor waarschuwt, alleen een
       stap later in dezelfde functie: de stempel dekte de bladen wel, en de
       ETag gooide dat weer weg.

       Bij een HASH mag afkappen wel: elke byte van de invoer raakt elke byte
       van de uitvoer, dus 22 tekens sha1 hangen nog steeds van alle bladen af. */
    const etag = 'W/"sb-' + crypto.createHash('sha1').update(stempel).digest('base64url').slice(0, 22) +
      '-' + vorm + '"';
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
