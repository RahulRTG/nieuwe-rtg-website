/* Domein "supplier" (deelmodule): events, catering, keuken-menu en mise en place.
   Opgeknipt in vier domeindelen die elk op de gedeelde kern draaien; deze
   samensteller mount ze een keer bij het opstarten. */
module.exports = (kern) => {
  require('./events/planning')(kern);
  require('./events/catering')(kern);
  require('./events/keuken')(kern);
  require('./events/mep')(kern);
};
