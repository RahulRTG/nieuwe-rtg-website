/* Bepaalt welke top-level collecties een SQLite-save exact moet bekijken.

   De mutatietracker maakt de gewone weg evenredig met de geraakte collecties.
   Dit bestand beslist nooit dat data duurzaam is: zonder aanwijzingen volgt een
   volledige controle, geld wordt altijd exact bekeken en sqlite.js bevestigt
   een generatie pas nadat de transactie werkelijk is gecommit. Een expliciete
   sleutellijst (save.sleutels) bekijkt precies die collecties; wat de
   auditmotor in eigen rijen bewaart, slaat `overslaan` over en geldt als
   nagekeken, want die eigenaar schrijft het zelf weg. */
'use strict';
// Sleutels van het doel onder de begrotingswikkel, zonder val per collectie.
const { collectieSleutels } = require('../opzet/begroting');

module.exports = function maakSaveplan({ db, mutaties, voorcheck }) {
  return function saveplan(force, vangrail, laatsteJson, { sleutels, overslaan = () => false } = {}) {
    const nu = Date.now();
    const aanwijzingen = mutaties.snapshot();
    const generaties = new Map(aanwijzingen.map(r => [r.collectie, r]));
    const alleNamen = collectieSleutels(db.data);
    const volledig = !sleutels && (!!force || !!vangrail || !laatsteJson.size || !aanwijzingen.length);
    const kandidaten = sleutels ? [...sleutels] : volledig ? alleNamen : [...new Set([
      ...aanwijzingen.map(r => r.collectie),
      ...alleNamen.filter(voorcheck.exactNodig)
    ])];
    const verwijderd = sleutels ? [] : [...new Set((volledig ? [...laatsteJson.keys()] : aanwijzingen.map(r => r.collectie))
      .filter(k => laatsteJson.has(k) && !Object.prototype.hasOwnProperty.call(db.data, k) && !overslaan(k)))];
    // Alleen eigen, opsombare collecties: een aanwijzing voor een verborgen of
    // geërfde eigenschap maakt die nog geen collectie.
    const namen = volledig ? alleNamen
      : kandidaten.filter(k => Object.prototype.propertyIsEnumerable.call(db.data, k));
    const gewijzigd = [];
    const nagekeken = [];
    let uitgesteld = false;

    for (const k of namen) {
      if (overslaan(k)) {
        if (generaties.has(k)) nagekeken.push(generaties.get(k));
        continue;
      }
      if (voorcheck.magOverslaan(k, db.data[k], force, nu)) {
        uitgesteld = true;
        continue;
      }
      /* De trackerproxy is de schrijfgrens, niet het opslagformaat. Via zijn
         begrensde serializer lezen we exact dezelfde target zonder miljoenen
         proxy-getvallen tijdens een volledige veiligheidsronde. */
      const json = mutaties.serialiseerVoorOpslag(db.data[k]);
      voorcheck.onthoud(k, json.length, db.data[k], nu);
      if (generaties.has(k)) nagekeken.push(generaties.get(k));
      if (laatsteJson.get(k) !== json) gewijzigd.push([k, json]);
    }
    for (const k of verwijderd) if (generaties.has(k)) nagekeken.push(generaties.get(k));
    return { gewijzigd, verwijderd, nagekeken, uitgesteld };
  };
};
