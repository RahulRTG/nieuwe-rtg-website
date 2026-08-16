/* Bedrijfsmodel van de Magnaat Partnerstudio. De publicatieworkflow wordt door
   magnaat-partnerstudio.js afzonderlijk gemonteerd; dit kleine koppelvlak houdt
   de bestaande modulenaam voor de profiel- en bouwsteenaanroepers. */
'use strict';

module.exports = ({ basis }) => require('./magnaat-partnerstudio-bedrijf')({ basis });
