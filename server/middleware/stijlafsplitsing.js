/* ============================================================================
   HET GROTE INLINE <style>-BLOK UIT DE PAGINA HALEN.

   WAT ER GEMETEN IS. Over alle 258 schermen samen is 4,7 MB HTML, waarvan
   3,5 MB (74%) inline CSS en JS. Bij /apps/app.html is het ene <style>-blok
   92 KB van de 185 KB. Dat blok gaat bij ELK bezoek opnieuw over de lijn en
   wordt bij ELK verzoek opnieuw gecomprimeerd, want het zit in een document
   dat per verzoek een eigen nonce krijgt en dus nooit hergebruikt kan worden.
   Een browser kan het ook nooit bewaren: het is geen bestand, het is pagina.

   Gemeten op /apps/app.html, de hele keten (lezen, stempelen, comprimeren):

     nu                 5,54 ms per bezoek    180 pagina's/seconde
     blok afgesplitst   2,71 ms per bezoek    370 pagina's/seconde

   en over de lijn bij een herhaalbezoek 52.636 -> 28.386 bytes (46% minder),
   plus een los blad van 23.731 bytes brotli dat de browser eenmalig ophaalt
   en daarna uit zijn eigen cache pakt.

   WAAROM ALLEEN DE STIJL EN NIET HET SCRIPT. Dezelfde reden die in de kop van
   ./stijlbundel.js staat: bij CSS bestaat het verschil niet. Een regel die de
   ontleder niet snapt wordt overgeslagen, in een los blad net zo goed als in
   een blok. Bij een script is dat anders, en dat is een aparte afweging die
   hier niet stilzwijgend wordt meegenomen.

   DE CASCADE BLIJFT STAAN. In ./stijlbundel-rij.js staat waarom een <style>
   een rij stijlbladen breekt: samenvoegen over een inline blok heen verschuift
   de cascade, en dan wint er opeens iets anders. Deze laag verplaatst niets --
   de <link> komt op EXACT de plek van het blok dat hij vervangt, dus de
   volgorde waarin de browser de regels ziet is onveranderd. Daarom draait hij
   ook NA stijlbundelHtml: die heeft zijn rijen dan al bepaald met het blok nog
   op zijn plek, en de nieuwe verwijzing wordt niet alsnog een rij in getrokken.

   GEEN SERVERGEHEUGEN, dezelfde keuze als bij de twee bundels ernaast: de
   verwijzing beschrijft zichzelf (welk bestand, welk blok), en de server leest
   dat blok gewoon opnieuw uit de bron. Een tabel op de server zou na een
   herstart leeg zijn, en dan krijgt een pagina die al openstond een 404 op haar
   eigen opmaak -- kaal scherm, geen foutmelding.

   WAAROM HIER WEL EEN VASTE LEVENSDUUR MAG. In ./compressie.js staat waarom
   max-age daar weg is: op een STABIELE url bleef na een update overal de oude
   versie hangen. Dat bezwaar geldt hier niet, want de vingerafdruk van de
   inhoud staat IN de url. Verandert het blok, dan verandert de url mee en
   vraagt de browser een ander adres op. Dezelfde inhoud op hetzelfde adres is
   dus per definitie nog goed, en een herhaalbezoek kost geen verzoek meer --
   ook geen 304.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PAD = '/stijlblok.css';

/* Vanaf welke omvang loont het. Onder deze grens weegt een extra verzoek niet
   op tegen de bytes die je uitspaart; gemeten over public/ liggen er 60
   schermen boven, en die dragen samen het leeuwendeel van de 3,5 MB. */
const DREMPEL = 5000;

/* Alleen een KAAL <style>-blok. Een media=, een een eigen type= of wat dan ook
   hangt gedrag aan het blok, en dat kun je niet naar een los blad verplaatsen
   zonder het te veranderen -- <link> kent dat gedrag anders. Zelfde strengheid
   als de rij-controle in ./stijlbundel-rij.js. */
const STYLE = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;

/* Twee dingen die bij verhuizing stuk zouden gaan, allebei beschreven in
   ./stijlbundel.js:
   - een relatieve url() wordt opgelost tegen de url van het BLAD, niet van het
     document, dus die zou na verhuizing de verkeerde kant op wijzen;
   - een @import is alleen geldig bovenaan een blad.
   Over alle 60 dragers gemeten komt geen van beide voor. Deze controle staat er
   dus niet voor vandaag maar voor de dag dat iemand er een toevoegt: dan blijft
   het blok gewoon inline staan in plaats van stilletjes te verschuiven. */
const REL_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/i;
function magVerhuizen(css) {
  if (/@import/i.test(css)) return false;
  let m; const re = new RegExp(REL_URL.source, 'gi');
  while ((m = re.exec(css))) {
    const a = String(m[2] || '').trim();
    if (a && a[0] !== '/' && a[0] !== '#' && !/^[a-z][a-z0-9+.-]*:/i.test(a)) return false;
  }
  return true;
}

const codeer = (p) => Buffer.from(p, 'utf8').toString('base64url');
const decodeer = (s) => {
  try { return Buffer.from(String(s || ''), 'base64url').toString('utf8'); }
  catch (e) { return ''; }
};
/* Zelfde strengheid als GOED_PAD hiernaast, maar voor de PAGINA: geen spaties,
   geen dubbele punt, geen .., en die (?!\/) zodat //ergens.anders/x.html er niet
   doorheen komt -- dat is voor een browser een volledig adres bij een vreemde
   server. */
const GOED_PAGINA = /^\/(?!\/)[A-Za-z0-9_\-/.]+\.html$/;

const vinger = (css) => crypto.createHash('sha1').update(css).digest('base64url').slice(0, 12);

/* Uit te zetten met RTG_STIJLAFSPLITSING=0, net als de nonce-laag ernaast. De
   pagina valt dan terug op het inline blok: trager en dikker, maar identiek. */
const AAN = String(process.env.RTG_STIJLAFSPLITSING || '1') !== '0';

/* ---- de pagina-kant: blok eruit, verwijzing ervoor in de plaats ---- */
function herschrijfHtml(html, paginaPad) {
  if (!AAN) return html;
  if (!GOED_PAGINA.test(paginaPad) || paginaPad.indexOf('..') !== -1) return html;
  if (html.indexOf('<style') === -1 && html.indexOf('<STYLE') === -1) return html;
  let index = -1;
  STYLE.lastIndex = 0;
  return html.replace(STYLE, (heel, attrs, css) => {
    index++;
    if (String(attrs || '').trim() !== '') return heel;   // niet kaal: laten staan
    if (css.length < DREMPEL) return heel;
    if (!magVerhuizen(css)) return heel;
    return '<link href="' + PAD + '?f=' + codeer(paginaPad) + '&i=' + index +
           '&v=' + vinger(css) + '" rel="stylesheet">';
  });
}

/* ---- de uitleverkant: het blok terugzoeken in de bron ---- */
function blokUit(html, index) {
  let i = -1, gevonden = null;
  STYLE.lastIndex = 0;
  html.replace(STYLE, (heel, attrs, css) => {
    i++;
    if (i === index) gevonden = { attrs: String(attrs || '').trim(), css };
    return heel;
  });
  return gevonden;
}

function stijlafsplitsing(publicDir) {
  const cache = new Map(); // pad -> { mtime, size, blokken: Map(index -> {css, gz, br}) }
  return (req, res, next) => {
    if (req.path !== PAD) return next();
    const paginaPad = decodeer(req.query && req.query.f);
    const index = Number(req.query && req.query.i);
    if (!GOED_PAGINA.test(paginaPad) || paginaPad.indexOf('..') !== -1) {
      return res.status(400).type('text/plain').send('/* geen blok gevraagd */');
    }
    if (!Number.isInteger(index) || index < 0 || index > 200) {
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
      /* Staat het blok er niet meer (de pagina is gewijzigd terwijl er nog een
         oude verwijzing openstond), dan is 404 het eerlijke antwoord: de
         browser heeft dat adres al, en de nieuwe pagina vraagt een nieuwe url. */
      if (!gevonden) return res.status(404).type('text/plain').send('/* blok bestaat niet meer */');
      blok = { css: Buffer.from(gevonden.css, 'utf8') };
      hit.blokken.set(index, blok);
    }

    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding');
    /* De vingerafdruk staat in de url (zie de kop): zelfde adres is per
       definitie dezelfde inhoud, dus dit mag echt lang blijven staan. */
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const ae = String(req.headers['accept-encoding'] || '');
    const br = /\bbr\b/.test(ae), gz = !br && /\bgzip\b/.test(ae);
    /* Stand 6, net als de twee bundels hiernaast: negen tiende van de winst van
       stand 11 voor een vijftigste van de tijd. Eenmalig per blok, daarna uit
       deze cache. */
    if (br) {
      if (!blok.br) blok.br = zlib.brotliCompressSync(blok.css, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } });
      res.setHeader('Content-Encoding', 'br');
      return res.end(blok.br);
    }
    if (gz) {
      if (!blok.gz) blok.gz = zlib.gzipSync(blok.css, { level: 6 });
      res.setHeader('Content-Encoding', 'gzip');
      return res.end(blok.gz);
    }
    return res.end(blok.css);
  };
}

module.exports = { stijlafsplitsing, herschrijfHtml, blokUit, magVerhuizen, codeer, decodeer, PAD, DREMPEL, GOED_PAGINA };
