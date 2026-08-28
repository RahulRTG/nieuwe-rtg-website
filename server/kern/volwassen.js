/* DE 18+-POORT: is dit een volwassen mens, en weet RTG dat?

   Hij hangt onder twee dingen: de progressiegrens van de spellen
   (kern/spellen/grens.js -- alles wat een prestatie BUITEN het potje bewaart)
   en Proost (kern/spellen/gedeeld.js). CLAUDE.md beschrijft hem als
   "paspoort-geboortedatum gecontroleerd en 18 of ouder".

   DAT LAATSTE STOND ER WEL EN HET EERSTE NIET. De poort keek alleen naar de
   leeftijd, en die komt uit een geboortedatum die het lid bij de AANMELDING
   zelf intypt -- routes/auth/account.js zegt daar met zoveel woorden "het
   paspoort komt pas later". Wie zich ouder maakte, kwam er dus gewoon door, en
   het verschil tussen de belofte en de code was van buiten niet te zien.

   DRIE EISEN NU, en ze komen uit een lezing van de kluis:

     account    een eigen RTG-account. RTF-gezinsprofielen en demo-persona's
                hebben er geen en halen de poort dus niet.
     A3         RTG heeft het identiteitsbewijs gezien (kern/betrouwbaarheid.js).
     18 jaar    of ouder.

   HIJ STAAT HIER EN NIET IN DE OPHANGLIJST waar hij vandaan komt. Een regel die
   bepaalt wat er van iemands spel bewaard blijft, hoort vindbaar te zijn onder
   een naam -- en opzet/kernlaag1.js is een lijst die dingen aan elkaar knoopt,
   geen plek waar je een regel zoekt.

   WAT HIJ NIET DOET: het spel tegenhouden. Onder de grens blijft elk spel
   volledig speelbaar; er wordt alleen niets van bewaard. Dat verschil staat in
   kern/spellen/grens.js en is de hele reden dat deze poort mag bestaan. */

'use strict';

const { voldoet, maakLidstand } = require('./betrouwbaarheid');

const MIN_LEEFTIJD = 18;
const MIN_NIVEAU = 'A3';

function maakVolwassen({ accounts, lidstandVan }) {
  const stand = lidstandVan || maakLidstand({ accounts });
  return function volwassen(handle) {
    const st = stand(String(handle || ''));
    return !!(st && st.account && voldoet(st.niveau, MIN_NIVEAU) &&
      st.leeftijd != null && st.leeftijd >= MIN_LEEFTIJD);
  };
}

module.exports = { maakVolwassen, MIN_LEEFTIJD, MIN_NIVEAU };
