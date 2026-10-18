/* ============================================================================
   DE OPSLAG VAN FOUNDATION OS -- de wortel db.data.rtfos en de lijst van
   FOUNDATION-registraties, achter EEN deur.

   Drie bestanden bouwden de wortel elk op hun eigen manier: ./basis.js (alle
   takken uit LEEG), en ../foundationregistratie-register.js en
   ../foundationregistratie-uitgifte.js (elk een kopie van dezelfde drie
   regels voor steden, vrijwilligers en partners). Het register schreef
   daarnaast foundationRegistraties met een toewijzing bij elke aanroep --
   ook bij lezen, en db.data is een bewaakte werkkopie
   (server/db/mutatietracker.js) die zo'n toewijzing als wijziging telt.

   - `wortel(takken)` maakt de wortel en de GEVRAAGDE takken (als lijst) aan,
     en niets meer: elke aanroeper vraagt wat hij al vroeg.
   - `registraties()` maakt de registratielijst aan als hij er niet is;
     `zetRegistraties(lijst)` vervangt hem voor de kap.

   WAT HIER NIET STAAT: de controlemotor (../foundationregistratie.js), de
   bevoegdheden die een besluit geeft (de uitgifte), het bestuur
   (./governance). Dit is een deur, geen poort. De lezers buiten Foundation OS
   (opzet/kernlaag4.js, kern/handelsregelwacht.js) staan er nog niet achter.
   ========================================================================== */
'use strict';

module.exports = function maakRtfosOpslag({ db }) {
  if (!db) throw new Error('kern/rtfos/opslag: zonder db is er niets om te bewaren');

  function wortel(takken) {
    if (!db.data.rtfos || typeof db.data.rtfos !== 'object') db.data.rtfos = {};
    const r = db.data.rtfos;
    for (const k of takken) if (!Array.isArray(r[k])) r[k] = [];
    return r;
  }
  function registraties() {
    if (!Array.isArray(db.data.foundationRegistraties)) db.data.foundationRegistraties = [];
    return db.data.foundationRegistraties;
  }
  function zetRegistraties(lijst) {
    if (!Array.isArray(lijst)) throw new Error('kern/rtfos/opslag: foundationRegistraties hoort een lijst te zijn');
    db.data.foundationRegistraties = lijst;
    return lijst;
  }
  return { wortel, registraties, zetRegistraties };
};
