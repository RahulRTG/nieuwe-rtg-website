/* Expliciete eigenaarsregels voor het RTG Controleregister.

   Een codepunt wordt pas kantoor-groen wanneer een regel het bewust bij een
   bestaande RTG-ruimte legt. De laatste terugval blijft daarom rood: onbekend
   werk hoort niet stilletjes bij Onderzoek te belanden. Volgorde is gedrag;
   specialistische kamers gaan voor brede bedrijfs- en ledendomeinen. */
'use strict';

/* De tabel zelf staat in ./magnaat-kantoorregels/tabel.js -- zie de kop daar
   voor waarom hij apart woont en waarom de volgorde gedrag is. */
const REGELS = require('./magnaat-kantoorregels/tabel');

module.exports = function kantoorVan(route) {
  const waarde = String(route || '').toLowerCase();
  for (let i = 0; i < REGELS.length; i += 1) {
    const [patroon, id, naam] = REGELS[i];
    if (patroon.test(waarde)) return { id, naam, toewijzing: 'regel', regel: i + 1 };
  }
  return { id: 'onderzoek', naam: 'Onderzoek & data', toewijzing: 'terugval', regel: null };
};

module.exports.REGELS = REGELS;
