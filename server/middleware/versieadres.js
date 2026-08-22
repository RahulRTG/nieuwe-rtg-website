/* ============================================================================
   ELKE VERWIJZING KRIJGT DE VERSIE VAN HET BESTAND IN HAAR ADRES.

   WAT ER GEMETEN IS. /apps/app.html doet 68 verzoeken. Bij een HERHAALBEZOEK
   zijn dat er nog steeds 67, waarvan 62 een 304: samen 43 KB, dus de bytes
   zijn allang in orde. Maar het duurt (echte browser, 80 ms latentie, 12 Mbit,
   mediaan van vijf):

     HTTP/1.1   eerste 1471 ms   herhaal 1313 ms
     HTTP/2     eerste 1132 ms   herhaal  900 ms

   Negenhonderd milliseconde voor 43 KB. Die tijd zit niet in bytes maar in
   zevenenzestig keer navragen "is dit nog goed?". Elk antwoord is een paar
   bytes en toch een rondje.

   HET ANTWOORD IS NIET LANGER CACHEN MAAR ANDERS ADRESSEREN. Zolang een
   verwijzing /shared/klok.js heet, MOET de browser navragen: het adres zegt
   niets over de inhoud. Staat de vingerafdruk van het bestand IN het adres,
   dan is navragen zinloos -- hetzelfde adres is per definitie dezelfde inhoud.
   Dan mag de kop `immutable` en kost een herhaalbezoek nul verzoeken.

   In ./compressie.js staat waarom max-age daar ooit weg moest: op een STABIELE
   url bleef na een update overal de oude versie hangen. Dat bezwaar valt hier
   weg, en om precies dezelfde reden als bij ./stijlafsplitsing.js: verandert
   het bestand, dan verandert het adres mee.

   WAT DIT VOOR DE SERVICE WORKER BETEKENT. public/sw.js vraagt bewust altijd na
   (`cache: 'no-cache'`), en de reden staat er eerlijk bij: nieuwe html naast een
   oud script bouwt het beginscherm niet meer op, en dat is een zwart scherm
   zonder foutmelding. Die angst is terecht -- maar hij kan hier structureel niet
   meer uitkomen. Nieuwe html verwijst naar een NIEUW adres; een oud script komt
   dus nooit meer naast nieuwe html te staan, want de nieuwe html vraagt er niet
   meer om. Daarom mag de SW een verwijzing met vingerafdruk wel uit zijn cache
   halen, en alleen die.

   DE PRIJS. Per paginaverzoek moeten de betrokken bestanden gestat worden. Voor
   /apps/app.html zijn dat er 37, samen 0,100 ms -- gemeten, 200 ronden. Dat is
   ruis naast de 2,7 ms die de pagina zelf kost, en het wordt bovendien gecachet
   op mtime.

   WAT ER BEWUST NIET MEEDOET. Alleen een KAAL, absoluut pad naar een .js of
   .css onder public/. Een adres dat al een querystring draagt (de stijl- en
   scriptbundel dragen hun lijst daarin) blijft zoals het is: die twee hebben
   hun eigen ETag-laag en hun eigen redenen, en er gaat hier niets overheen.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

/* Uit te zetten met RTG_VINGERAFDRUK=0. Dan valt alles terug op de oude
   ETag-en-navragen-weg: trager, maar identiek. */
const AAN = String(process.env.RTG_VINGERAFDRUK || '1') !== '0';

/* Alleen gewone paden: geen spaties, geen dubbele punt, geen .., en die (?!\/)
   zodat //elders.example/x.js er niet doorheen komt -- dat is voor een browser
   een volledig adres bij een vreemde server. Zelfde strengheid als GOED_PAD in
   ./stijlbundel-rij.js.

   WEES EERLIJK OVER WAT DIT IS: een witte lijst, geen slot. Haal je hem weg,
   dan zakt er geen enkele toets -- want uitbreken uit public/ wordt gestopt
   door de padcontrole in vingerVan() hieronder, en DIE zakt wel als je hem
   weghaalt (test 4b). Deze regel bepaalt dus alleen WAARAAN we ons wagen, niet
   wat er tegengehouden wordt. */
const GOED = /^\/(?!\/)[A-Za-z0-9_\-/.]+\.(?:js|css)$/;

/* De vingerafdruk: grootte en wijzigingstijd, allebei in hex. Geen hash over de
   inhoud -- dat zou elk bestand bij elk paginaverzoek moeten lezen, en mtime
   plus grootte verandert bij elke echte wijziging net zo goed. De cache eronder
   maakt het bovendien een stat in plaats van een read. */
const cache = new Map(); // pad -> { mtimeMs, v }
function vingerVan(publicDir, rel) {
  const bestand = path.join(publicDir, rel);
  if (!bestand.startsWith(publicDir + path.sep)) return null;
  let st;
  try { st = fs.statSync(bestand); } catch (e) { return null; }
  if (!st.isFile()) return null;
  const hit = cache.get(rel);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.v;
  const v = st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16);
  cache.set(rel, { mtimeMs: st.mtimeMs, v });
  return v;
}

/* src="/pad.js" en href="/pad.css" krijgen ?v=... Een adres dat al een ? draagt
   blijft ongemoeid (zie de kop).

   HET ATTRIBUUT MOET OP WITRUIMTE BEGINNEN, en dat is geen detail. Met `\b`
   ervoor matchte ook `data-src=` en `xlink:href=` -- een woordgrens valt immers
   ook na een streepje of dubbele punt. Vandaag staat er in geen enkel scherm
   zo'n attribuut met een .js of .css erin (nagegaan over alle 258), dus het is
   nu nog niemands probleem. Maar de dag dat iemand een eigen lazy-loader met
   data-src schrijft, zou die stilzwijgend een ?v= krijgen van een laag die daar
   niets mee te maken heeft. In html gaat aan een attribuut altijd witruimte
   vooraf, dus die eis kost niets en sluit de val. */
const VERWIJZING = /(\s)(src|href)=("|')(\/[^"'?#>]+\.(?:js|css))\3/gi;

/* BINNEN EEN <script> OF <style> BLIJVEN WE OVERAL VANAF.

   Daar is `src="/x.js"` geen attribuut maar TEKST, en tekst met dezelfde vorm
   komt hier echt voor: /apps/websitestudio.html bouwt in een inline script de
   HTML van een website die een lid EXPORTEERT, en daarin staat letterlijk
   `'<link href="/fonts/fonts.css" rel="stylesheet">'`. Zonder deze grens
   plakte deze laag onze eigen bestandsstempel in elke geexporteerde site --
   onzin op een vreemde server, en het verklapt de wijzigingstijden van onze
   bestanden aan iedereen die zo'n export opent.

   Daarom: knip de pagina op de script- en stijlblokken, en herschrijf alleen
   wat ertussen ligt. Dat is ook precies wat we bedoelen -- een verwijzing is
   een attribuut in de opmaak, nooit iets in de inhoud van een script.

   Let op: alleen de INHOUD blijft met rust. De opentag zelf is gewoon opmaak,
   en juist daar staat de src= van een extern script die wel gestempeld hoort te
   worden. Een eerdere versie sloeg het hele element over en liet daarmee elk
   <script src> ongestempeld -- precies de helft van het werk. */
const BLOK = /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi;

function herschrijfHtml(html, publicDir) {
  if (!AAN || !html) return html;
  const stempelIn = (stuk) => stuk.replace(VERWIJZING, (heel, wit, attr, q, rel) => {
    if (!GOED.test(rel) || rel.indexOf('..') !== -1) return heel;
    const v = vingerVan(publicDir, rel);
    if (!v) return heel;                       // bestaat niet: laat staan
    return wit + attr + '=' + q + rel + '?v=' + v + q;
  });
  const uit = [];
  let laatst = 0, m;
  BLOK.lastIndex = 0;
  while ((m = BLOK.exec(html))) {
    uit.push(stempelIn(html.slice(laatst, m.index)));
    uit.push(stempelIn(m[1]));                 // de opentag: wel stempelen
    uit.push(m[3]);                            // de inhoud: onaangeraakt
    uit.push(m[4]);
    laatst = m.index + m[0].length;
  }
  uit.push(stempelIn(html.slice(laatst)));
  return uit.join('');
}

/* Draagt dit verzoek een vingerafdruk? Zo ja, dan mag het antwoord een jaar
   blijven staan. Wordt gebruikt door ./compressie.js. */
function heeftVinger(req) {
  return AAN && !!(req && req.query && req.query.v);
}

module.exports = { herschrijfHtml, heeftVinger, vingerVan, GOED, AAN };
