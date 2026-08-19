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

   DE MACHINE ZELF STAAT IN ./blokafsplitsing.js, gedeeld met
   ./stijlafsplitsing.js. Wat hier staat is de afweging voor SCRIPT: waarom een
   blok mag verhuizen zonder dat de uitvoervolgorde schuift, en de twee dingen
   die het wel zouden breken.

   GEEN SERVERGEHEUGEN, en de vingerafdruk in de url: zelfde keuzes en zelfde
   redenen als bij ./stijlafsplitsing.js, zie die kop.
   ========================================================================== */
'use strict';
const { maakAfsplitsing, codeer, decodeer, DREMPEL, GOED_PAGINA } = require('./blokafsplitsing');

const PAD = '/scriptblok.js';

/* Alleen een KAAL blok: geen src (dan is het al een bestand), en geen type,
   defer, async of wat dan ook. Een type="module" of een importmap heeft ander
   gedrag dat een gewone <script src> niet nadoet. */
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/i;

function magVerhuizen(js) {
  if (/document\s*\.\s*write/.test(js)) return false;
  if (/currentScript/.test(js)) return false;
  return true;
}

/* Uit te zetten met RTG_SCRIPTAFSPLITSING=0. De pagina valt dan terug op het
   inline blok: dikker en trager, maar identiek. */
const AAN = String(process.env.RTG_SCRIPTAFSPLITSING || '1') !== '0';

const machine = maakAfsplitsing({
  PAD, TAG: SCRIPT, naam: 'script', type: 'application/javascript; charset=utf-8',
  /* Ruimer dan bij de stijl: een scherm draagt hier tientallen scripttags
     (elke <script src> telt mee in de nummering), de zwaarste tegen de honderd. */
  maxIndex: 500, aan: AAN, magVerhuizen,
  verwijzing: (url) => '<script src="' + url + '"></script>'
});

module.exports = { scriptafsplitsing: machine.uitleveren, herschrijfHtml: machine.herschrijfHtml,
  blokUit: machine.blokUit, magVerhuizen, codeer, decodeer, PAD, DREMPEL, GOED_PAGINA };
