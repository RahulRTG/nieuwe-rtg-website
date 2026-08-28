/* DE OMVANGGRENS VOOR EEN SERVERMODULE.

   Tienduizendvierentwintig bytes. Niet omdat er iets magisch is aan 10 kB, maar
   omdat een bestand daarboven in de praktijk niet meer in een hoofd past en de
   keuring dan altijd hetzelfde vindt: vier onderwerpen in een bestand, en een
   wijziging aan het ene raakt het andere.

   Hij staat hier en niet in scripts/keuring.js omdat scripts/deltapoort.js
   dezelfde grens moet kennen: de keuring TELT wat er over is, de poort houdt
   tegen dat er nieuwe bijkomen. Twee getallen die uiteen kunnen lopen is het
   ergste van beide -- dan bewaakt de poort een grens die de meter niet meet. */
'use strict';

const GRENS = 10240;

module.exports = { GRENS };
