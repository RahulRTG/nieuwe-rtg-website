/* De veertien allergenen van Verordening (EU) 1169/2011, bijlage II -- de
   wettelijke lijst die een keuken moet kunnen noemen. Eén lijst voor het huis:
   de tafellijst van de zaak (kern/tafelwensen.js) en de gastenlijst van Table
   (kern/rechterhand/table.js) kiezen uit dezelfde codes, zodat "noten" bij de
   een niet "notenmengsel" heet bij de ander. */
const ALLERGENEN = Object.freeze(['gluten', 'schaaldieren', 'eieren', 'vis', 'pinda', 'noten', 'soja', 'melk',
  'selderij', 'mosterd', 'sesam', 'sulfiet', 'lupine', 'weekdieren']);

/* Wat een lid aanvinkt, terug als codes in de volgorde van de lijst.
   null = er is niets meegegeven (laat staan wat er stond); false = er zit een
   code tussen die niet op de lijst staat (weigeren, niet stil weglaten). */
function kiesAllergenen(ruw) {
  if (ruw === undefined) return null;
  const lijst = Array.isArray(ruw) ? ruw.map(x => String(x)) : [];
  if (lijst.some(x => !ALLERGENEN.includes(x))) return false;
  return ALLERGENEN.filter(a => lijst.includes(a));
}
const LIJSTFOUT = Object.freeze({ status: 400, error: 'Kies de allergenen uit de lijst; iets anders kan als korte aanvulling.' });

module.exports = { ALLERGENEN, kiesAllergenen, LIJSTFOUT };
