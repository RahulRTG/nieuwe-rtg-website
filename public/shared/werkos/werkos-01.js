/* ============================== RTG Werk-OS ==============================
   De gedeelde werklaag volgt het RTG Command Canvas. De app zelf toont eerst
   haar gemeten stand, aandacht en werk van vandaag. Pas daarna volgt het
   register met werkvlakken. Geen tweede huisstijl, geen springboard en geen
   verzonnen merk: deze laag gebruikt uitsluitend de RTG-tokens en glyfen die
   de onderliggende app al draagt.

   De verborgen tabbar blijft het model. WerkOS spiegelt dat model in een
   register, een compacte commandobalk en het Command Center. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);

  /* Presentatie: /ds/componenten/werkos.css, statisch geladen door iedere host. */
