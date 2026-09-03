/* DE OPGESLAGEN STAND LEZEN -- inclusief wat er gebeurt als hij niet te lezen is.

   Los van ./incidentcontrole.js omdat het een BESLISSING is en geen bedrading:
   SEC-LOCK-004 zegt dat een onbekende stand nooit als `normaal` mag doorlopen,
   en die regel hoort ergens te wonen waar je hem kunt vinden en toetsen. Tussen
   de vijf standhandelingen was hij een regel in een hulpfunctie.

   DE REGEL ZELF, en waarom hij niet naar `isolatie` valt: een beschadigd veld
   zette het platform hier in de ZWAKSTE stand, precies op het moment dat er iets
   aan de hand was. Terugvallen op `isolatie` zou het huis platleggen op grond van
   een tikfout -- de knop die volgens BESTUUR.md grens 6.10 niet gebruikt wordt.
   Dus valt hij terug op `beschermd`: de enige stand die geen schakelaar omzet,
   het lezen laat doorlopen en toch de zes bevoorrechte categorieen bevriest.
   kern/isolatie/ordening.js leest dezelfde onbekende waarde op dezelfde manier;
   deze module voert dat uit en velt geen tweede oordeel. */
'use strict';

const klok = require('../lib/klok');

module.exports = function maakStandlezer({ db, MODI, beveilig }) {
  return function techniek() {
    if (!db.data.techniek) db.data.techniek = {};
    const t = db.data.techniek;
    if (!t.functies || typeof t.functies !== 'object') t.functies = {};
    if (!t.zekeringen || typeof t.zekeringen !== 'object') t.zekeringen = {};
    if (!t.incidentcontrole || typeof t.incidentcontrole !== 'object')
      t.incidentcontrole = { modus: 'normaal', revisie: 0, actief: null, audit: [] };
    const s = t.incidentcontrole;
    if (!Array.isArray(s.audit)) s.audit = [];
    if (!Number.isSafeInteger(s.revisie)) s.revisie = 0;
    /* SEC-LOCK-004: EEN ONBEKENDE STAND IS GEEN NORMALE STAND. Hier stond
       `s.modus = 'normaal'` -- een fail-OPEN: een beschadigd veld zette het
       platform in de ZWAKSTE stand, precies als er iets aan de hand was. Naar
       `isolatie` vallen zou het huis platleggen op een tikfout (grens 6.10), dus
       valt hij terug op `beschermd`: de enige stand die geen schakelaar omzet.
       kern/isolatie/ordening.js leest dezelfde waarde net zo. */
    if (!MODI.includes(s.modus)) {
      const was = String(s.modus);
      s.modus = 'beschermd';
      s.standOnbepaald = { was: was.slice(0, 40), at: klok.datum().toISOString() };
      if (beveilig) beveilig.meld('incidentcontrole', 'kritiek',
        'De opgeslagen incidentstand was onleesbaar ("' + was.slice(0, 40) + '"). ' +
        'Teruggevallen op de beschermstand in plaats van op normaal; stel handmatig vast wat er hoort te gelden.',
        { bron: 'incidentcontrole:standOnbepaald' });
    } else if (s.standOnbepaald) delete s.standOnbepaald;
    return { t, s };
  };
};
