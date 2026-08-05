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

const PAD = '/stijlbundel.css';
/* Alleen gewone paden: geen spaties, geen dubbele punten, geen ..

   En let op die (?!\/) op de tweede plek. Zonder die kwam //cdn.example.com/a.css
   erdoorheen: dat is voor een browser een VOLLEDIG ADRES bij een vreemde server,
   maar het begint met een schuine streep en bestaat verder uit toegestane tekens.
   Die zou hier in de bundel belanden, en dan zoekt deze laag naar een bestand
   dat niet bestaat -- waarna de hele bundel een 404 wordt en de pagina AL haar
   opmaak kwijt is. Gevonden door test/stijlbundel.test.js, niet door te kijken. */
const GOED_PAD = /^\/(?!\/)[A-Za-z0-9_\-/.]+\.css$/;

const codeer = (paden) => Buffer.from(paden.join('\n'), 'utf8').toString('base64url');
const decodeer = (s) => {
  try { return Buffer.from(String(s || ''), 'base64url').toString('utf8').split('\n').filter(Boolean); }
  catch (e) { return []; }
};

/* Een rij opeenvolgende <link rel="stylesheet"> wordt EEN verwijzing.

   Bewust streng in wat er meedoet. Alleen een link met precies rel=stylesheet
   en een href die met / begint en op .css eindigt. Alles met een media-, type-,
   of ander attribuut blijft staan zoals het staat -- daar hangt gedrag aan, en
   dat kun je niet samenvoegen zonder het te veranderen. Een rij van een is geen
   winst en wordt overgeslagen. */
const LINK = /<link\b[^>]*>/gi;
/* WAT ER TUSSEN TWEE STIJLBLADEN MAG STAAN zonder dat de rij breekt: witruimte,
   een commentaar, en een uitgesteld script. Meer niet, en daar zit de hele
   redenering in.

   Een <style>-blok mag er NIET tussen staan. Voeg je twee bladen samen over een
   inline blok heen, dan verschuift de cascade: wat eerst won verliest opeens. Dat
   is geen optimalisatie meer maar een andere pagina. /apps/app.html heeft precies
   zo'n geval -- vensters.css staat na een <style> -- en die blijft dus los.

   Een gewoon (niet-uitgesteld) script mag er ook niet tussen: dat draait tijdens
   het ontleden, en zou na het samenvoegen stijl zien die er op dat moment nog
   niet hoorde te zijn. Een uitgesteld script draait pas na het ontleden en kan
   dat verschil niet merken. */
const TUSSEN_OK = /^(?:\s|<!--[\s\S]*?-->|<script\b[^>]*\b(?:defer|async)\b[^>]*>\s*<\/script>)*$/i;
function herschrijfHtml(html) {
  /* Eerst alle bruikbare stijlbladen opzoeken en in rijen groeperen. Pas
     daarna herschrijven -- in een keer, van voor naar achter, zodat de
     posities in de brontekst blijven kloppen. */
  const links = [];
  LINK.lastIndex = 0;
  let m;
  while ((m = LINK.exec(html))) {
    const tag = m[0];
    const rel = /\brel=["']?stylesheet["']?/i.test(tag);
    const href = /\bhref=["']([^"']+)["']/i.exec(tag);
    // wat er nog meer aan attributen staat: alleen href en rel mogen mee. Een
    // media=, een onload=, een fetchpriority= hangt gedrag aan die link, en dat
    // kun je niet samenvoegen zonder het te veranderen.
    const kaal = tag.replace(/<link\b/i, '').replace(/\/?>$/, '')
      .replace(/\bhref=["'][^"']*["']/i, '').replace(/\brel=["']?stylesheet["']?/i, '').trim();
    const bruikbaar = rel && !!href && kaal === '' && GOED_PAD.test(href[1]) && href[1].indexOf('..') === -1;
    links.push({ start: m.index, eind: m.index + tag.length, pad: bruikbaar ? href[1] : null, bruikbaar });
  }

  const rijen = [];
  let huidig = null;
  for (const l of links) {
    if (!l.bruikbaar) { huidig = null; continue; }
    if (huidig && TUSSEN_OK.test(html.slice(huidig[huidig.length - 1].eind, l.start))) huidig.push(l);
    else { huidig = [l]; rijen.push(huidig); }
  }

  const bruikbareRijen = rijen.filter(r => r.length >= 2);
  if (!bruikbareRijen.length) return html;

  const uit = [];
  let laatst = 0;
  for (const rij of bruikbareRijen) {
    // de bundel komt op de plek van de EERSTE link te staan; de cascadevolgorde
    // binnen de bundel is de volgorde waarin ze in de pagina stonden
    uit.push(html.slice(laatst, rij[0].start));
    uit.push('<link href="' + PAD + '?f=' + codeer(rij.map(l => l.pad)) + '" rel="stylesheet">');
    /* Wat er TUSSEN de links stond (een uitgesteld script, een commentaar)
       blijft gewoon staan -- alleen de link-tags zelf verdwijnen. Dit is de
       reden dat er hier per stuk wordt geplakt en niet in een klap geknipt:
       een eerdere versie gooide het uitgestelde script tussen twee bladen weg. */
    for (let i = 1; i < rij.length; i++) uit.push(html.slice(rij[i - 1].eind, rij[i].start));
    laatst = rij[rij.length - 1].eind;
  }
  uit.push(html.slice(laatst));
  return uit.join('');
}

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
