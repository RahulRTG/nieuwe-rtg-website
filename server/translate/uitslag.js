/* WAT WORDT DE UITSLAG VAN EEN MODELREGEL, EN MAG ZIJ BLIJVEN?

   Drie bronnen kunnen een vertaling leveren en ze zijn niet gelijkwaardig: het
   model (het beste, maar het kan er ook naast zitten), het huiswoordenboek (met
   de hand nagerekend, dekt weinig) en de brontaal (nooit fout, nooit vertaald).
   Deze module kiest ertussen en zegt of de uitkomst permanent mag worden.

   DE VOLGORDE VOLGT UIT EEN RANGORDE VAN SCHADE. Onvertaalde tekst is
   vervelend; tekst die iets ANDERS zegt dan er stond is een fout die het lid
   niet kan zien -- hij leest immers zijn eigen taal. Daarom valt een afgewezen
   modelregel terug in plaats van door te gaan.

   HET WOORDENBOEK GAAT NIET LANGS DE KEURING, en dat is geen omissie: die tabel
   is met de hand geschreven en bevat cellen die legitiem gelijk zijn aan het
   Nederlands (Afrikaans "les" is werkelijk "les"). Een poort die zulke cellen
   afwijst, haalt een goede vertaling van het scherm. */
'use strict';
const { keur } = require('../kern/taalkeuring');

/* `typeof === string` en niet de waarheidswaarde: een LEEG modelantwoord is
   falsy, en dat sloeg de keuring stilzwijgend over -- de terugval klopte wel,
   maar de teller zei dat er niets was afgewezen. Een poort die zijn eigen
   vangst niet telt, is niet na te rekenen. */
function beslis({ bron, modelRegel, lokaal, naar, tel }) {
  const regel = typeof modelRegel === 'string' ? modelRegel : null;
  const uitspraak = regel != null ? keur(bron, regel, naar) : null;
  if (uitspraak && tel) tel[uitspraak.oordeel] = (tel[uitspraak.oordeel] || 0) + 1;

  const bruikbaar = uitspraak && uitspraak.oordeel !== 'afgewezen' ? regel : null;
  const tekst = bruikbaar || lokaal || bron;
  /* Permanent worden mag alleen wat GOED is gekeurd. Kwam de tekst niet van het
     model (woordenboek of brontaal), dan is er niets te keuren en telt de
     herkomst: het woordenboek is al nagerekend. */
  const magBewaren = !uitspraak || tekst !== regel || uitspraak.oordeel === 'goed';
  return { tekst, magBewaren, uitspraak };
}

module.exports = { beslis };
