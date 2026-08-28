/* DE LEDENSLEUTEL: van `user-<id>` naar het account-id, op een plek.

   Een lid reist door dit huis als een SLEUTEL en niet als een id. De
   operationele lagen kennen `user-8291`, de kluis kent 8291, en ergens moet
   het een het ander worden. Dat "ergens" was tot nu toe zeventien plekken:
   zeventien keer dezelfde reguliere expressie, zeventien keer `Number(m[1])`,
   en zeventien keer een eigen antwoord op de vraag wat er gebeurt bij een gast
   (die heeft geen id) of bij rommel.

   WAAROM DAT ERG IS, en niet alleen onnetjes. Ze liepen al uiteen: de een
   schreef `String(key || '')`, de ander `String(key)`, en wie er ooit een
   sleutelvorm bij zou zetten (een tweede soort account, een sleutel met een
   achtervoegsel) moest zeventien plekken vinden om hem te laten meetellen.
   Zestien daarvan aanpassen en er een vergeten geeft geen foutmelding maar een
   lid dat op een enkel scherm niet bestaat. Dat is precies de fout die LAT.md
   regel 4 beschrijft: twee waarheden over dezelfde vraag, en de eerste keer dat
   ze uiteenlopen weet niemand welke geldt.

   ZUIVER, EN DAAROM HIER. Deze functie kent de kluis niet en vraagt niets aan
   de wereld: sleutel erin, getal of null eruit. Wat er daarna met dat id
   gebeurt -- `getUserById`, `getMemberState`, `staffPositions` -- verschilt per
   laag en blijft daar staan. Alleen de vertaling is gedeeld.

   NIET GAST-VIJANDIG: een persona of gast heeft geen account en levert dus
   null. Dat is geen fout maar het antwoord, en elke aanroeper hoort het als
   zodanig te behandelen. */

'use strict';

const VORM = /^user-(\d+)$/;

/* Het account-id achter een ledensleutel, of null.

   Null bij alles wat geen sleutel is: een gast, een persona, een lege waarde,
   een sleutel van een andere soort. `Number.isSafeInteger` sluit de rand af
   waar de reeks cijfers wel op de vorm past maar niet meer als getal klopt --
   een id dat stilletjes afrondt zou een lid aan een ANDER dossier koppelen, en
   dat is de ene fout die hier echt niet mag. */
function idVanKey(key) {
  const m = VORM.exec(String(key == null ? '' : key));
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) ? id : null;
}

module.exports = { idVanKey, LEDENSLEUTEL: VORM };
