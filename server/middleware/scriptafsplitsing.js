/* ============================================================================
   HET GROTE INLINE <script>-BLOK UIT DE PAGINA HALEN.

   De tegenhanger van ./stijlafsplitsing.js, en om dezelfde reden: over alle 258
   schermen is 74% van de HTML inline CSS en JS. De stijl is er al uit; dit is
   de andere helft. 146 blokken in 143 schermen, samen 2,33 MB, die bij elk
   bezoek opnieuw over de lijn gaan en bij elk verzoek opnieuw door de
   compressor -- want een pagina draagt een eigen nonce en is dus nooit twee
   keer hetzelfde. Een browser kan het ook nooit bewaren: het is geen bestand,
   het is pagina.

   WAAROM DIT MAG, TERWIJL ./scriptbundel.js ZO VOORZICHTIG IS. Die kop
   waarschuwt hier expliciet voor:

     "Twee losse <script>-tags en een samengevoegde zijn NIET hetzelfde: gooit
      de eerste een fout, dan draait de tweede in het eerste geval gewoon door
      en in het tweede geval niet meer."

   Dat argument gaat over SAMENVOEGEN. Hier wordt niets samengevoegd: een blok
   gaat een-op-een naar een eigen bestand, op zijn eigen plek, met zijn eigen
   grens. Gooit het een fout, dan gebeurt er precies wat er nu ook gebeurt --
   dit blok stopt, het volgende draait door. De eigenschap die dat argument
   beschermde blijft dus overeind; alleen de vorm verandert.

   EN DE VOLGORDE DAN. Een gewoon (niet-uitgesteld) extern script blokkeert de
   ontleder net zo goed als een inline blok: de browser haalt het op, voert het
   uit, en gaat pas daarna verder. Uitvoervolgorde en de staat van het document
   op het moment van uitvoeren zijn dus gelijk. Dat is ook precies waarom
   ./scriptbundel-rij.js alleen UITGESTELDE scripts samenvoegt -- daar zou de
   volgorde wel verschuiven. Hier niet.

   TWEE DINGEN DIE HET WEL ZOUDEN BREKEN, en die daarom worden tegengehouden:
   - document.write(): dat schrijft op de plek van het SCRIPT in de ontleder.
     Vanuit een extern bestand tijdens het ontleden werkt dat nog, maar het is
     precies het soort verschil dat je niet wilt riskeren.
   - document.currentScript: dat wijst na verhuizing naar een ander element,
     met een src waar er eerst geen was.
   Over alle 146 blokken gemeten komt geen van beide voor. Deze controle staat
   er dus niet voor vandaag maar voor de dag dat iemand er een toevoegt.

   GEEN SERVERGEHEUGEN, en de vingerafdruk in de url: zelfde keuzes en zelfde
   redenen als bij ./stijlafsplitsing.js, zie die kop.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PAD = '/scriptblok.js';

/* Zelfde grens als bij de stijl, en om dezelfde reden nagemeten: onder deze
   omvang weegt een extra verzoek niet op tegen de bytes. */
const DREMPEL = 5000;

/* Alleen een KAAL blok: geen src (dan is het al een bestand), en geen type,
   defer, async of wat dan ook. Een type="module" of een importmap heeft ander
   gedrag dat een gewone <script src> niet nadoet. */
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

function magVerhuizen(js) {
  if (/document\s*\.\s*write/.test(js)) return false;
  if (/currentScript/.test(js)) return false;
  return true;
}

const codeer = (p) => Buffer.from(p, 'utf8').toString('base64url');
const decodeer = (s) => {
  try { return Buffer.from(String(s || ''), 'base64url').toString('utf8'); }
  catch (e) { return ''; }
};
const GOED_PAGINA = /^\/(?!\/)[A-Za-z0-9_\-/.]+\.html$/;
const vinger = (js) => crypto.createHash('sha1').update(js).digest('base64url').slice(0, 12);

/* Uit te zetten met RTG_SCRIPTAFSPLITSING=0. De pagina valt dan terug op het
   inline blok: dikker en trager, maar identiek. */
const AAN = String(process.env.RTG_SCRIPTAFSPLITSING || '1') !== '0';

/* ---- de pagina-kant ---- */
function herschrijfHtml(html, paginaPad) {
  if (!AAN) return html;
  if (!GOED_PAGINA.test(paginaPad) || paginaPad.indexOf('..') !== -1) return html;
  if (html.indexOf('<script') === -1 && html.indexOf('<SCRIPT') === -1) return html;
  let index = -1;
  SCRIPT.lastIndex = 0;
  return html.replace(SCRIPT, (heel, attrs, js) => {
    index++;
    if (String(attrs || '').trim() !== '') return heel;   // niet kaal: laten staan
    if (js.length < DREMPEL) return heel;
    if (!magVerhuizen(js)) return heel;
    return '<script src="' + PAD + '?f=' + codeer(paginaPad) + '&i=' + index +
           '&v=' + vinger(js) + '"></script>';
  });
}

/* ---- de uitleverkant ---- */
function blokUit(html, index) {
  let i = -1, gevonden = null;
  SCRIPT.lastIndex = 0;
  html.replace(SCRIPT, (heel, attrs, js) => {
    i++;
    if (i === index) gevonden = { attrs: String(attrs || '').trim(), js };
    return heel;
  });
  return gevonden;
}

function scriptafsplitsing(publicDir) {
  const cache = new Map(); // pad -> { stempel, blokken: Map(index -> {js, gz, br}) }
  return (req, res, next) => {
    if (req.path !== PAD) return next();
    const paginaPad = decodeer(req.query && req.query.f);
    const index = Number(req.query && req.query.i);
    if (!GOED_PAGINA.test(paginaPad) || paginaPad.indexOf('..') !== -1) {
      return res.status(400).type('text/plain').send('/* geen blok gevraagd */');
    }
    if (!Number.isInteger(index) || index < 0 || index > 500) {
      return res.status(400).type('text/plain').send('/* geen blok gevraagd */');
    }
    const bestand = path.join(publicDir, paginaPad);
    if (!bestand.startsWith(publicDir + path.sep)) return res.status(400).type('text/plain').send('/* buiten de map */');

    let st;
    try { st = fs.statSync(bestand); } catch (e) { return next(); }
    const stempel = st.mtimeMs + ':' + st.size;

    let hit = cache.get(paginaPad);
    if (!hit || hit.stempel !== stempel) { hit = { stempel, blokken: new Map() }; cache.set(paginaPad, hit); }
    let blok = hit.blokken.get(index);
    if (!blok) {
      let html;
      try { html = fs.readFileSync(bestand, 'utf8'); } catch (e) { return next(); }
      const gevonden = blokUit(html, index);
      if (!gevonden) return res.status(404).type('text/plain').send('/* blok bestaat niet meer */');
      blok = { js: Buffer.from(gevonden.js, 'utf8') };
      hit.blokken.set(index, blok);
    }

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const ae = String(req.headers['accept-encoding'] || '');
    const br = /\bbr\b/.test(ae), gz = !br && /\bgzip\b/.test(ae);
    if (br) {
      if (!blok.br) blok.br = zlib.brotliCompressSync(blok.js, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } });
      res.setHeader('Content-Encoding', 'br');
      return res.end(blok.br);
    }
    if (gz) {
      if (!blok.gz) blok.gz = zlib.gzipSync(blok.js, { level: 6 });
      res.setHeader('Content-Encoding', 'gzip');
      return res.end(blok.gz);
    }
    return res.end(blok.js);
  };
}

module.exports = { scriptafsplitsing, herschrijfHtml, blokUit, magVerhuizen, codeer, decodeer, PAD, DREMPEL, GOED_PAGINA };
