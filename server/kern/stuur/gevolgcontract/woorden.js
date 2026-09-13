/* ============================================================================
   DE WOORDEN VAN HET GEVOLGCONTRACT -- de graden, de soorten en de geleende
   classificaties, los van de keuring die ze gebruikt.

   WAAROM DEZE LAAG `gevolg` HEET EN NIET `effect`, en dat is geen smaak. Het
   woord `effect` is in dit huis vijf keer bezet, en twee daarvan zitten zo dicht
   op deze laag dat een lezer ze voor hetzelfde houdt:

     server/kern/isolatie/effecten.js    HET EFFECTMODEL: welke platformWERKWOORDEN
       een pad draagt (`GELD_BEWEGEN`, `IDENTITEIT_WIJZIGEN`) met vier eigen graden
       (verklaard/afgeleid/vermoed/onbekend), om te beslissen wat er in isolatie
       dichtgaat. Grofmazig en categorisch, en met een ANDERE gradenladder dan deze.
     scripts/effectcontracten.js         de VOORSTELLEN voor NOT_APPLICABLE-
       mutatiecontracten, op twee runtime-meters. Een letter verschil van de naam
       die deze laag eerst droeg.
     server/effectmeter.js, test/effectmeter.test.js, test/effectdekking.test.js

   Die laatste is de duurste: `test/effectdekking.test.js` bestond al en toetst de
   DERDE BRON VAN HET EFFECTMODEL. Deze laag heette bij het schrijven
   `effectdekking`, dus er stonden een meter en een toets met dezelfde naam die
   over verschillende dingen gingen. Dat is exact de fout die SEMANTIEK.json meet
   (105 van 123 gedeelde namen dragen meer dan een betekenis) en die BEWIJSMACHINE.md
   de duurste van het huis noemt -- hier bijna gemaakt door de laag die valse
   zekerheid moest voorkomen. Vandaar `gevolg`: hetzelfde woord als
   ../gevolg.js, dat de meting doet waar dit de verklaring naast legt.

   WAT DE TWEE LAGEN VAN ELKAAR WILLEN. Het effectmodel zegt WAT VOOR SOORT
   handeling dit is; het gevolgcontract zegt WAT ER GEBEURT als je hem uitvoert.
   Ze worden niet samengevoegd en ze lenen niets van elkaar, met een uitzondering
   die het waard is: de classificaties komen uit ../../envelop.js, want een tweede
   woordenlijst voor hetzelfde zou de botsing zijn die deze kop beschrijft.
   ========================================================================== */
'use strict';

/* De vier huisgraden. Niet hier bedacht: kern/objectlaag/pagina.js en
   kern/identiteit/sessievelden.js dragen deze lijst al woordelijk, en BESTUUR.md
   maakt er de huisregel van. Let op dat dit NIET de vier graden van het
   effectmodel zijn: die heten verklaard/afgeleid/vermoed/onbekend en zeggen
   WAARUIT iets volgt, terwijl deze zeggen HOE HARD het vaststaat. */
const GRADEN = Object.freeze(['onbekend', 'vermoed', 'gemeten', 'bewezen']);

/* De soorten gevolg. Vier, en ze verschillen in WIE ze kan vaststellen:

     direct      de opslag verandert -- gevolg.js kan dit MEten
     afgeleid    volgt uit het directe gevolg (uren, dekking, een plafond)
     buiten      valt buiten elke collectie: mail, sms, een provider, een bank
     mislukking  wat er achterblijft als de handeling halverwege stopt

   Alleen `direct` is machinaal te bevestigen. Dat is geen reden om de andere drie
   weg te laten -- het is de reden dat ze hun graad zelf moeten dragen. */
const SOORTEN = Object.freeze(['direct', 'afgeleid', 'buiten', 'mislukking']);

/* De classificaties uit kern/envelop.js. Hier overgeschreven zou een tweede
   woordenlijst zijn; dus wordt hij geleend en bij een botsing valt deze weg. */
let ENVELOPKLASSEN = null;
function klassen() {
  if (ENVELOPKLASSEN) return ENVELOPKLASSEN;
  /* Een OBJECT met de reden per klasse, geen lijst -- daarom Object.keys. Dat de
     vorm anders was dan hier eerst stond, is precies waarom hij geleend wordt en
     niet overgeschreven: een kopie had die vorm nooit gecorrigeerd. */
  try { ENVELOPKLASSEN = Object.keys(require('../../envelop').CLASSIFICATIES || {}); } catch (e) { ENVELOPKLASSEN = []; }
  if (!ENVELOPKLASSEN.length) ENVELOPKLASSEN = ['onbekend'];
  return ENVELOPKLASSEN;
}

module.exports = { GRADEN, SOORTEN, klassen };
