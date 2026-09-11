/* NEDERLAND ALS GEVAL VAN DE MOTOR -- niet de motor zelf.

   De routemotor stond onder deze naam en was al generiek: hij leest een SQLite
   met r-tree-indexen en een binaire graaf. Wat hem aan een land vastbond waren
   drie waarden, en die staan nu HIER: het vak, de bestandsnamen en de naam die
   in elk antwoord meegaat. De motor is verhuisd naar ./gebiednet.js.

   WAAROM DIT BESTAND BLIJFT BESTAAN in plaats van dat elke aanroeper zelf een
   gebied samenstelt: Nederland is het enige gebied waarvan RTG het pakket zelf
   bouwt uit een CC0-bron (scripts/navigatie-nederland.js, het NWB van
   Rijkswaterstaat). Dat is een ander verhaal dan een ODbL-gebied uit de
   catalogus, en het staat op een andere plek in RTG_DATA_DIR omdat het er al
   stond voordat er gebiedscodes waren. Wie dat wegpoetst, breekt elke
   bestaande installatie.

   `RTG_NAV_NL_DB` blijft daarom ook staan: scripts/navigatie-nederland.js en
   test/navigatie.test.js zetten hem. */
'use strict';

const path = require('node:path');
const { maakGebiedNet } = require('./gebiednet');

/* Het omhullende vak van Nederland. Een rechthoek en dus GEEN grens -- hij
   bevat Belgisch en Duits land. Dat is niet erg zolang hij alleen beslist welk
   PAKKET geprobeerd wordt en niet welk land iemand in staat; ./gebiedkeuze.js
   is de plek die dat onderscheid draagt. */
const NL = { lat0: 50.70, lat1: 53.72, lng0: 3.20, lng1: 7.30 };
const binnenNederland = p => p && Number(p.lat) >= NL.lat0 && Number(p.lat) <= NL.lat1
  && Number(p.lng) >= NL.lng0 && Number(p.lng) <= NL.lng1;

function standaardPad() {
  const data = process.env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  return process.env.RTG_NAV_NL_DB || path.join(data, 'navigatie', 'nederland.sqlite');
}

/* De graafmap hangt aan het BESTAND en niet aan de datamap: test en script
   geven een eigen pad mee, en de graaf ligt ernaast. Dit is exact het pad dat
   er stond -- een tweede pakket in dezelfde map las anders de graaf van
   Nederland en rekende er een Franse route op. */
const maakNederlandNet = ({ bestand = standaardPad(), haversine }) => maakGebiedNet({
  bestand,
  graafMap: path.join(path.dirname(bestand), 'nederland-graaf'),
  gebied: { code: 'nederland', naam: 'Nederland', netwerk: 'NWB', vak: NL },
  haversine
});

module.exports = { maakNederlandNet, binnenNederland, NL, standaardPad };
