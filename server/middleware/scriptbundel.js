/* ============================================================================
   DE UITGESTELDE SCRIPTS IN EEN VERZOEK.

   WAAROM DIT ER EERST NIET WAS, EN NU WEL. In de kop van ./stijlbundel.js staat
   waarom daar bewust ALLEEN stijlbladen werden samengevoegd:

     "Twee losse <script>-tags en een samengevoegde zijn NIET hetzelfde: gooit
      de eerste een fout, dan draait de tweede in het eerste geval gewoon door
      en in het tweede geval niet meer."

   Dat argument klopt, en het is precies de storing waar dit huis deze week op
   stukliep: een leeg beginscherm doordat een onderdeel omviel en de rest
   meesleepte. Zomaar samenvoegen zou die val groter maken in plaats van
   kleiner.

   Er is een manier die het verschil wegneemt: elk script krijgt in de bundel
   ZIJN EIGEN try/catch. Gooit er een, dan draaien de volgende gewoon door --
   net als bij losse tags -- en de console noemt het bestand bij naam, wat bij
   losse tags niet eens gebeurt. De eigenschap die het argument beschermde
   blijft dus overeind; alleen het aantal verzoeken verandert.

   DAT MAG NIET STIL. Twee dingen zijn nagemeten voordat dit erin ging:
   - Geen van de 53 scripts van /apps/app.html declareert iets op het hoogste
     niveau met const, let of class. Dat is wat het omwikkelen onveilig zou
     maken: die drie zijn blok-gebonden en zouden binnen de try blijven hangen,
     terwijl var en function dat niet zijn. Nul treffers, gemeten met grep over
     alle betrokken bestanden.
   - Alleen UITGESTELDE scripts doen mee (zie ./scriptbundel-rij.js). Een gewoon
     script draait tijdens het ontleden en zou na samenvoegen een andere pagina
     zien.

   WAT HET OPLEVERT. /apps/app.html laadde 53 losse scripts. Op deze machine
   valt dat weg; op een telefoon met mobiel internet is elk verzoek een heen en
   weer, en meldde een gebruiker "hij laadt heel lang" bij een scherm dat
   daardoor leeg bleef.

   GEEN SERVERGEHEUGEN, zelfde keuze als bij de stijlbundel: de lijst staat IN
   de verwijzing (base64url), niet in een tabel die na een herstart leeg is.
   Een pagina die al openstond zou anders een 404 krijgen op haar eigen scripts.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const { herschrijfHtml, decodeer, GOED_PAD, PAD } = require('./scriptbundel-rij');

/* Elk bestand in zijn eigen try/catch, met zijn naam in de melding. Dit is de
   hele reden dat samenvoegen hier mag; zie de kop. */
function omwikkel(pad, bron) {
  return '/* ' + pad + ' */\ntry {\n' + bron +
    '\n} catch (e) { console.error("[rtg] script ' + pad + ' ging mis:", e); }\n';
}

function scriptbundel(publicDir) {
  const cache = new Map(); // sleutel -> { stempel, js, gz, br }
  return (req, res, next) => {
    if (req.path !== PAD) return next();
    const paden = decodeer(req.query && req.query.f);
    if (!paden.length || paden.length > 60) return res.status(400).type('text/plain').send('/* geen bundel gevraagd */');

    const bestanden = [];
    for (const p of paden) {
      if (!GOED_PAD.test(p) || p.indexOf('..') !== -1) return res.status(400).type('text/plain').send('/* ongeldig pad */');
      const abs = path.join(publicDir, p);
      if (!abs.startsWith(publicDir + path.sep)) return res.status(400).type('text/plain').send('/* buiten de webroot */');
      let st; try { st = fs.statSync(abs); } catch (e) { return next(); }
      if (!st.isFile()) return next();
      bestanden.push({ p, abs, mtimeMs: st.mtimeMs, size: st.size });
    }

    /* De stempel draagt elk bestand met zijn tijd en maat: verandert er een,
       dan verandert de stempel en haalt de browser hem opnieuw op. */
    const stempel = bestanden.map(b => b.size.toString(16) + '.' + Math.round(b.mtimeMs).toString(16)).join('_');
    const sleutel = paden.join('|');
    let hit = cache.get(sleutel);
    if (!hit || hit.stempel !== stempel) {
      let js = '';
      try {
        for (const b of bestanden) js += omwikkel(b.p, fs.readFileSync(b.abs, 'utf8'));
      } catch (e) { return next(); }
      hit = { stempel, js: Buffer.from(js, 'utf8'), gz: null, br: null };
      if (cache.size > 100) cache.clear();
      cache.set(sleutel, hit);
    }

    const ae = String(req.headers['accept-encoding'] || '');
    const br = /\bbr\b/.test(ae), gz = !br && /\bgzip\b/.test(ae);
    const vorm = br ? 'b' : (gz ? 'g' : 'r');
    const etag = 'W/"scb-' + Buffer.from(stempel).toString('base64url').slice(0, 32) + '-' + vorm + '"';
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (br) {
      if (!hit.br) hit.br = zlib.brotliCompressSync(hit.js, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } });
      res.setHeader('Content-Encoding', 'br');
      return res.end(hit.br);
    }
    if (gz) {
      if (!hit.gz) hit.gz = zlib.gzipSync(hit.js, { level: 6 });
      res.setHeader('Content-Encoding', 'gzip');
      return res.end(hit.gz);
    }
    res.end(hit.js);
  };
}

module.exports = { scriptbundel, herschrijfHtml, omwikkel, PAD };
