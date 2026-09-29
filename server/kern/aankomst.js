/* De bevestigde aankomst (NAVIGATIE.md N3 en N13). Een eigen module en geen
   functie in ./live.js: de live-laag wordt in server/opzet/diensten.js
   opgebouwd, en elke naam die daar bijkomt moet door server/server.js, dat al
   over de omvanggrens staat. Deze regel heeft alleen `db` nodig en wordt in
   server/opzet/kernlaag5.js in de kern gezet. */
'use strict';

module.exports = ({ db }) => {
  /* AANKOMST WORDT BEVESTIGD, NIET GEMETEN (NAVIGATIE.md N3 en N13). Hier zette
     /api/live/update `arrived` zodra een opgeslagen positie binnen 150 m van de
     bestemming lag, en daarop ging een deur open. Nu is een aankomst een
     bevestiging van het LID of van de ZAAK -- wie het eerst bevestigt is genoeg,
     en er is geen positie voor nodig (een lid dat zijn locatie niet deelt, komt
     evengoed aan). Deze functie zet alleen de stand; wie bevestigt, meldt het
     zelf aan de ander, want de woorden verschillen per kant. */
  function bevestigAankomst(key, door) {
    const L = db.data.live[key];
    if (!L || !L.active) return { status: 409, error: 'Er is geen lopende reis.' };
    if (!L.destCode) return { status: 409, error: 'Deze reis heeft geen bestemming om bij aan te komen.' };
    if (L.arrived) return { status: 200, al: true, L };
    L.arrived = true;
    L.aankomst = { door, at: new Date().toISOString() };
    return { status: 200, al: false, L };
  }

  return { bevestigAankomst };
};
