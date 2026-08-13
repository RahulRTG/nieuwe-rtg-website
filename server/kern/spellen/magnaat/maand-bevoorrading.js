/* Magnaat: WAAR DE GOEDEREN VAN DEZE MAAND VANDAAN KOMEN.

   Afgesplitst van ./maand.js toen ./keten.js erbij kwam, en de naad is dezelfde
   als daar: dat bestand gaat over de VOLGORDE van een wereldmaand -- eerst de
   druk, dan de bevoorrading, dan iedere zaak, dan de lasten -- en dit bestand
   over EEN van die stappen. De volgorde ligt vast sinds fase A; de bevoorrading
   is precies de stap die met elke fase groeit (fase B zette er de contracten
   in, deze fase de vrije markt), en twee dingen met zo'n verschillend tempo
   horen niet in een bestand.

   ================== EN DE VOLGORDE BINNEN DEZE STAP IS DE UITLEG ==================

     1. wat er aan CONTRACTEN vastligt -- voordat er iets gerekend is, want een
        levering gaat voor de vrije verkoop (./handel.js), dus die capaciteit
        moet vergeven zijn voordat de eerste klant binnenkomt
     2. wat elke leverancier daarvan waarmaakt, naar rato bij een tekort
     3. wat de VRIJE MARKT met de rest doet (./keten.js)

   DAT 1 VOOR 3 KOMT IS DE HELE WAARDE VAN EEN CONTRACT: voorrang bij schaarste,
   geen korting. Wat er daarna nergens vandaan kan komen, komt van buiten de
   wereld en heet daar dan ook zo. */
'use strict';

const { levering } = require('./stap');
const KETEN = require('./keten');

/* NAAR RATO EN NIET "WIE HET EERST GETEKEND HEEFT". Komt een leverancier tekort,
   dan delen al zijn afnemers mee in dat tekort -- anders bepaalt de volgorde in
   een object wie er failliet gaat, en dat is geen economie maar een sortering. */
function contracten(st, arbeid, wieHeeft) {
  const actief = (st.contracten || []).filter(c => c.status === 'loopt'
    && st.maand + 1 >= c.startMaand && st.maand < c.eindMaand);
  const toezegging = {}, ontvangst = {};
  for (const c of actief) {
    const t = toezegging[c.leverancierId] = toezegging[c.leverancierId] || { eenheden: 0, bedrag: 0 };
    t.eenheden += c.eenheden; t.bedrag += c.bedrag;
  }
  /* Met dezelfde functie die de eigen maand van die leverancier straks gebruikt;
     een tweede som over dezelfde capaciteit is een tweede antwoord. */
  const leverDeel = {};
  for (const [id, t] of Object.entries(toezegging)) {
    const w = wieHeeft(st, id);
    leverDeel[id] = w ? levering(w.v, arbeid, t.eenheden).deel : 0;
  }
  for (const c of actief) {
    const geleverd = c.eenheden * (leverDeel[c.leverancierId] || 0);
    const o = ontvangst[c.afnemerId] = ontvangst[c.afnemerId] || {};
    o[c.soort] = (o[c.soort] || 0) + geleverd;
  }
  return { actief, toezegging, ontvangst, leverDeel };
}

/* DE HELE STAP. Verandert `st.keten` en de kassen; geeft terug wat de rest van
   de maand nodig heeft. */
function bevoorraden(st, arbeid, wieHeeft) {
  const uit = contracten(st, arbeid, wieHeeft);
  const alleZaken = [];
  const eigenaarVan = {};
  for (const [h, rij] of Object.entries(st.vestigingen))
    for (const v of rij) { alleZaken.push({ h, v }); eigenaarVan[v.id] = h; }
  st.keten = KETEN.verdeel(st, { arbeid, alleZaken,
    toezegging: uit.toezegging, ontvangst: uit.ontvangst });
  KETEN.betaal(st, st.keten, (vid) => eigenaarVan[vid]);
  return uit;
}

module.exports = { contracten, bevoorraden };
