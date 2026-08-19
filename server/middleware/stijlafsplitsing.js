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

   DE MACHINE ZELF STAAT IN ./blokafsplitsing.js. Deze laag en ./scriptafsplitsing.js
   deden hetzelfde werk met een andere tag; wat hier staat is de AFWEGING (mag
   een stijlblok verhuizen, en wat maakt er een onverplaatsbaar) plus de meting.
   Het gereedschap eromheen -- codering, padcontrole, vingerafdruk, cache,
   compressie, koppen -- staat een keer, hiernaast.

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
const { maakAfsplitsing, codeer, decodeer, DREMPEL, GOED_PAGINA } = require('./blokafsplitsing');

const PAD = '/stijlblok.css';

/* DE DREMPEL ZELF STAAT IN ./blokafsplitsing.js, want hij geldt voor allebei de
   soorten blok. Hij is HIER gemeten, dus de meting staat hier.

   DE GRENS IS GEMETEN, NIET GEKOZEN. Over alle 258 schermen:

     drempel 5000:  60 blokken uit  60 schermen, 0,62 MB uit de HTML
     drempel 3000: 122 blokken uit 121 schermen, 0,85 MB
     drempel 2000: 178 blokken uit 175 schermen, 0,98 MB
     drempel 1500: 203 blokken uit 200 schermen, 1,02 MB
     drempel 1000: 228 blokken uit 216 schermen, 1,05 MB

   De sprong zit tussen 5000 en 3000: het aantal gedekte schermen verdubbelt
   ruim. Daaronder vlakt het af -- van 2000 naar 1000 komt er nog 0,07 MB bij
   voor vijftig extra verzoeken, en dat is de verkeerde ruil.

   3000 HEEFT HIER GESTAAN EN IS TERUGGEDRAAID. Die 0,23 MB extra klinkt goed,
   maar het is ONVERPAKT gemeten, en dat is precies het getal dat misleidt.
   Nagerekend op wat er werkelijk over de lijn gaat, over de 62 schermen die
   het verschil maken:

     minder HTML          75.129 bytes gzip   (1212 per scherm)
     extra verzoeken          62             (1 per scherm)
     los op te halen CSS  77.470 bytes brotli (1250 per scherm)

   Het eerste bezoek wordt er dus iets SLECHTER van: 38 bytes meer en een
   extra verzoek. Pas het herhaalbezoek wint, met 1212 bytes.

   "MAAR OP HTTP/2 IS EEN VERZOEK TOCH BIJNA GRATIS." Dat was het tegenargument,
   en productie draait inderdaad HTTP/2 (npm run live:init zet RTG_TLS=1, en
   web/index.js kiest dan lib/tls: HTTP/2 met HTTP/1.1-terugval). Dus is het
   nagemeten, met een echte browser op 80 ms latentie en 12 Mbit, vijf ronden,
   mediaan, over HTTP/2:

                       drempel 5000    drempel 3000
     kantoren.html        595 ms          620 ms
     ov.html              566 ms          575 ms

   Ook daar dus geen winst op het eerste bezoek, eerder iets verlies. De 1212
   bytes per herhaalbezoek wegen daar niet tegenop. Blijft 5000.

   (Ter vergelijking, dezelfde pagina eerste bezoek: HTTP/1.1 1404 ms tegen
   HTTP/2 1117 ms. Het protocol scheelt 20%; deze drempel scheelt niets.) */
/* Alleen een KAAL <style>-blok. Een media=, een eigen type= of wat dan ook
   hangt gedrag aan het blok, en dat kun je niet naar een los blad verplaatsen
   zonder het te veranderen -- <link> kent dat gedrag anders. Zelfde strengheid
   als de rij-controle in ./stijlbundel-rij.js. */
const STYLE = /<style\b([^>]*)>([\s\S]*?)<\/style>/i;

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

/* Uit te zetten met RTG_STIJLAFSPLITSING=0, net als de nonce-laag ernaast. De
   pagina valt dan terug op het inline blok: trager en dikker, maar identiek. */
const AAN = String(process.env.RTG_STIJLAFSPLITSING || '1') !== '0';

const machine = maakAfsplitsing({
  PAD, TAG: STYLE, naam: 'style', type: 'text/css; charset=utf-8',
  /* Tweehonderd stijlblokken op een pagina is al ruim voorbij alles wat hier
     staat; daarboven is het geen verwijzing van ons. */
  maxIndex: 200, aan: AAN, magVerhuizen,
  verwijzing: (url) => '<link href="' + url + '" rel="stylesheet">'
});

module.exports = { stijlafsplitsing: machine.uitleveren, herschrijfHtml: machine.herschrijfHtml,
  blokUit: machine.blokUit, magVerhuizen, codeer, decodeer, PAD, DREMPEL, GOED_PAGINA };
