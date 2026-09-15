/* ============================================================================
   WAT MAG EEN BRON ZIJN -- de verwijzing die een mens zelf meestuurt.

   DE AANLEIDING (scripts/gluurronde.js, 15 september 2026). De gluurronde meldde
   vier lekken op POST /api/rtf/connect/dossier: "A stuurde een identificator van
   B en kreeg gegevens van B terug". Nagetrokken was er GEEN vertrouwelijkheids-
   lek -- het dossier van B bleef leeg, en wat A terugkreeg was een tekenreeks die
   A zelf had ingestuurd. De ronde had gelijk over wat hij zag en ongelijk over
   wat het betekende.

   MAAR HIJ WEES IETS ECHTS AAN. `bron` nam elke vrije tekst aan, bewaarde hem
   ongezien en gaf hem onveranderd terug. Daarmee kon een mens willekeurige
   inhoud in zijn eigen dossier zetten -- ook de codenaam of de naam van iemand
   anders, in een bak zonder bewaartermijn voor zulke gegevens. Dat is precies
   het pad dat scripts/afleidbaar.js meet: een merker naast een sleutel, die
   samen terugvoeren naar een mens.

   DE REGEL. Elke ontdekking die deze laag uitgeeft, draagt haar herkomst in haar
   id -- `herkomst + ':' + id`, zie de kop van ./ontdekking.js. Een bron die van
   een mens komt, moet dus een verwijzing zijn DIE DEZE LAAG HAD KUNNEN UITGEVEN.
   Anders is het geen verwijzing maar een opmerking, en een dossier is geen
   kladblok.

   WAT DE REGEL NIET IS. Hij zegt niet dat het ding BESTAAT: dat de herkomst
   klopt en de vorm klopt, maakt van `leerstof:bestaatniet` geen les. Voor die
   sterkere vraag is er een opzoeking, en die staat waar hij hoort -- bij de
   naklank, die de maker opzoekt en weigert als hij het ding niet kan plaatsen.
   Dit is de goedkope zeef ervoor, en hij belooft niet meer dan hij doet.

   DE HERKOMSTEN WORDEN GELEZEN EN NIET OVERGETYPT (LAT.md regel 4). Ze komen uit
   de bronmodules zelf; komt er een bron bij, dan hoort zijn naam hier vanzelf in
   plaats van in een tweede lijst die uit de pas gaat lopen.
   ========================================================================== */
'use strict';

const HERKOMSTEN = [
  require('./bron-leerstof').HERKOMST,
  require('./bron-lokaal').HERKOMST,
  /* Het werkregister van kern/mediaos. Geen bronmodule van de mixer -- het werk
     van een mens komt via ./werkbij.js binnen -- dus hier bij naam, met dezelfde
     tekenreeks die werkbij.js aan `herkomst` meegeeft. */
  'mediaos'
];

/* Geen tekens die in een naam of een zin thuishoren: geen spatie, geen komma,
   geen accolade. Een verwijzing is machinetekst. */
const VORM = /^[A-Za-z0-9:._@-]{1,160}$/;

/* DE DUBBELE PUNT WORDT GEZOCHT EN NIET AANGENOMEN, en dat is geen stijl maar een
   fout die hier echt is gemaakt. Eerst stond er `s.slice(0, s.indexOf(':'))`, en
   zonder dubbele punt geeft `indexOf` een -1 -- waarop `slice(0, -1)` het LAATSTE
   TEKEN afknipt in plaats van niets terug te geven. `leerstofX` werd daarmee
   `leerstof`, en kwam er glad doorheen. De proef had vier vormen met een dubbele
   punt en geen enkele zonder; hij stond groen op precies de gevallen die ik had
   bedacht. Vandaar dat `knip < 1` en de lege rest nu allebei een eigen uitgang
   hebben: een herkomst zonder verwijzing erachter wijst ook nergens heen. */
function bronKlopt(bron) {
  const s = String(bron == null ? '' : bron);
  if (!s) return { ok: false, reden: 'leeg' };
  if (!VORM.test(s)) return { ok: false, reden: 'vorm' };
  const knip = s.indexOf(':');
  if (knip < 1 || knip === s.length - 1) return { ok: false, reden: 'herkomst' };
  const herkomst = s.slice(0, knip);
  if (HERKOMSTEN.indexOf(herkomst) < 0) return { ok: false, reden: 'herkomst' };
  return { ok: true, herkomst };
}

/* De weigering zegt WAT er mis is en noemt de herkomsten die er wel zijn --
   GRAMMATICA.md: een verhindering draagt altijd een reden. */
function weigering(reden) {
  if (reden === 'herkomst') {
    return 'Deze verwijzing komt nergens vandaan. Een bron begint met de plek waar hij vandaan komt (' +
      HERKOMSTEN.join(', ') + ') gevolgd door een dubbele punt.';
  }
  if (reden === 'vorm') {
    return 'Dit is geen verwijzing maar tekst. Een bron wijst naar een ding, hij beschrijft er geen.';
  }
  return 'Hier hoort een verwijzing naar het ding waar het over ging.';
}

module.exports = { HERKOMSTEN, bronKlopt, weigering };
