/* Foundation OS, deel "anbi-grondslag": op welke grond de stichting publiceert.

   DIT BESTAND BESTAAT OMDAT EEN STATUS OP TWEE PLEKKEN WERD AANGENOMEN.
   ./jaarverslag.js opent met "een ANBI moet publiceren", bouwt die
   publicatieplicht uit en hangt het stuk onder /publiek -- terwijl ./gift.js
   vastlegt dat de aanvraag bij dit huis nog LOOPT. Die twee lazen elkaar niet.
   Op het scherm spraken ze elkaar nog niet tegen (het jaarstuk gaat over
   publiceren, de gift over aftrekbaarheid), maar het was een aanname die
   ergens tussen "aangevraagd" en "beschikt" een openbare bewering wordt die
   niet klopt. GIFT.md par. 7 noemde hem; dit sluit hem.

   DE REGEL: de ANBI-stand heeft EEN eigenaar, en dat is ./gift.js, want daar
   zet de eigenaar hem. Dit deel LEEST hem en verzint hem niet. Zonder die
   lezer valt hij terug op `onbekend` en niet op `ja` -- de voorzichtige kant,
   zoals bij de fiscale klassen in CLAUDE.md.

   EN VRIJWILLIG PUBLICEREN IS NIET MINDER WAARD. Een stichting die haar
   jaarstuk openbaar maakt zonder dat het moet, doet iets goeds. Doen alsof het
   een plicht is die je vervult, is wat er niet mag: dat leest als een status
   die er nog niet is. Daarom staat er niet "wel of geen ANBI" maar wat er
   vandaag vaststaat, in de woorden van die stand.

   WAT HIER NIET IN ZIT: dit oordeelt niet of de stichting er een ZOU moeten
   zijn, en het vraagt niets aan de Belastingdienst. Het RSIN komt uit de stand
   en wordt alleen getoond als de status `ja` is -- een RSIN naast "aangevraagd"
   suggereert een beschikking die er niet is. */
'use strict';

const ZINNEN = {
  ja: 'De RTFoundation is een ANBI. Dit jaarstuk staat openbaar omdat de publicatieplicht dat vraagt.',
  aangevraagd: 'De aanvraag voor de ANBI-status loopt. Dit jaarstuk staat openbaar omdat de stichting dat zelf wil, en niet omdat het al moet.',
  nee: 'De RTFoundation is geen ANBI. Dit jaarstuk staat openbaar omdat de stichting dat zelf wil.',
  onbekend: 'Of de RTFoundation een ANBI is, staat hier niet vast. Dit jaarstuk staat openbaar omdat de stichting dat zelf wil; lees het niet als een ANBI-publicatie.'
};

/* `lees` geeft { anbi, rsin } en komt uit ./gift.js. Ontbreekt hij, dan is de
   uitkomst `onbekend` -- nooit stilzwijgend de gunstige kant. */
module.exports = (lees) => function grondslag() {
  let g = null;
  try { g = typeof lees === 'function' ? lees() : null; } catch (e) { g = null; }
  const anbi = (g && ZINNEN[g.anbi]) ? g.anbi : 'onbekend';
  const rsin = anbi === 'ja' ? String((g && g.rsin) || '') : '';
  return {
    anbi,
    /* PLICHT of EIGEN KEUS. Een derde waarde zou hier "misschien" zijn, en dat
       is geen grond om iets openbaar op te zetten. */
    grond: anbi === 'ja' ? 'publicatieplicht' : 'eigen keus',
    rsin: rsin || null,
    zegt: ZINNEN[anbi]
  };
};
module.exports.ZINNEN = ZINNEN;
