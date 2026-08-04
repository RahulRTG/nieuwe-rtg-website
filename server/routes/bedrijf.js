/* Domein "bedrijf": het RTG Werk OS, de werkplek van een hele organisatie.

   Dun bedradingsbestand, zoals de andere domeinen: de laag zelf staat in
   server/bedrijf/ en krijgt de gedeelde kern mee. Wat hier NIET gebeurt is een
   tweede agenda, chat, documentenmap of loonrun bouwen -- die staan al in dit
   huis en worden vanuit de werkplek aangesloten. */
module.exports = (kern) => {
  kern.bedrijf = require('../bedrijf')(kern);
};
