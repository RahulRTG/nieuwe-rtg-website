/* Bepaalt welke top-level collecties een SQLite-save exact moet bekijken.

   De mutatietracker maakt de gewone weg evenredig met de geraakte collecties.
   Dit bestand beslist nooit dat data duurzaam is: zonder aanwijzingen volgt een
   volledige controle, geld wordt altijd exact bekeken en sqlite.js bevestigt
   een generatie pas nadat de transactie werkelijk is gecommit. */
'use strict';

module.exports = function maakSaveplan({ db, mutaties, voorcheck }) {
  return function saveplan(force, vangrail, laatsteJson) {
    const nu = Date.now();
    const aanwijzingen = mutaties.snapshot();
    const generaties = new Map(aanwijzingen.map(r => [r.collectie, r]));
    const alleNamen = Object.keys(db.data);
    const volledig = !!force || !!vangrail || !laatsteJson.size || !aanwijzingen.length;
    const kandidaten = volledig ? alleNamen : [...new Set([
      ...aanwijzingen.map(r => r.collectie),
      ...alleNamen.filter(voorcheck.exactNodig)
    ])];
    const verwijderd = [...new Set((volledig ? [...laatsteJson.keys()] : aanwijzingen.map(r => r.collectie))
      .filter(k => laatsteJson.has(k) && !Object.prototype.hasOwnProperty.call(db.data, k)))];
    const namen = kandidaten.filter(k => Object.prototype.hasOwnProperty.call(db.data, k));
    const gewijzigd = [];
    const nagekeken = [];
    let uitgesteld = false;

    for (const k of namen) {
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
