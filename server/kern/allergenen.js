/* De veertien allergenen van Verordening (EU) 1169/2011, bijlage II -- de
   wettelijke lijst die een keuken moet kunnen noemen. Eén lijst voor het huis:
   de tafellijst van de zaak (kern/tafelwensen.js) en de gastenlijst van Table
   (kern/rechterhand/table.js) kiezen uit dezelfde codes, zodat "noten" bij de
   een niet "notenmengsel" heet bij de ander. */
const ALLERGENEN = Object.freeze(['gluten', 'schaaldieren', 'eieren', 'vis', 'pinda', 'noten', 'soja', 'melk',
  'selderij', 'mosterd', 'sesam', 'sulfiet', 'lupine', 'weekdieren']);

module.exports = { ALLERGENEN };
