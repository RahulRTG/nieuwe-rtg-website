/* Vakbewijs (deelmodule): AFTEKENEN EN INTREKKEN.

   De twee handelingen die een MENS VAN RTG met een stuk doet. Ze staan los van
   het vastleggen in ../vakbewijs.js, en die naad is echt: daar beweert een
   AANVRAGER iets over zichzelf, hier zet RTG er zijn naam onder of haalt hem er
   weer af. Dat zijn twee onderwerpen met twee soorten fouten.

   TWEE REGELS DIE NIET MOGEN SNEUVELEN.

   1. EEN AFTEKENING ZONDER NAAM IS GEEN AFTEKENING. Dezelfde regel en dezelfde
      zin als bij de bedrijfskant (kern/aanmeldingen/bewijs.js). Een knop die
      stilletjes "backoffice" invult, maakt van een aftekening een vinkje.

   2. EEN INGETROKKEN STUK VERDWIJNT NIET. Wie het weggooit, gooit ook weg dat
      het er ooit was -- en juist dat wil je terugzien als er iets misgaat. */
'use strict';

module.exports = ({ vind, toon, nu, kap, save }) => {
  /* Een mens tekent af. Op een NAAM, want een aftekening zonder naam is geen
     aftekening -- zelfde regel en zelfde zin als bij de bedrijfskant. */
  function vakbewijsTeken(sleutel, wat, door) {
    const v = vind(sleutel, kap(wat, 60));
    if (!v) return { status: 404, error: 'Dit stuk is hier niet ingediend.' };
    if (v.ingetrokken) return { status: 409, error: 'Dit stuk is ingetrokken.' };
    if (v.afgetekend) return { status: 409, error: 'Dit stuk is al afgetekend.' };
    const naam = kap(door, 60);
    if (!naam) return { status: 400, error: 'Wie tekent af? Een aftekening zonder naam is geen aftekening.' };
    v.afgetekend = { door: naam, at: nu() };
    save();
    return { ok: true, vakbewijs: toon(v),
      grens: 'Vastgelegd is dat ' + naam + ' het stuk heeft gezien. RTG is geen inspectie en toetst de inhoud niet.' };
  }

  /* Intrekken. Een stuk verdwijnt NIET uit de lijst: wie het weggooit, gooit ook
     weg dat het er ooit was, en juist dat wil je terugzien als er iets misgaat. */
  function vakbewijsIntrek(sleutel, wat, door, reden) {
    const v = vind(sleutel, kap(wat, 60));
    if (!v) return { status: 404, error: 'Dit stuk is hier niet ingediend.' };
    const naam = kap(door, 60);
    if (!naam) return { status: 400, error: 'Wie trekt dit in?' };
    v.ingetrokken = { door: naam, at: nu(), reden: kap(reden, 200) || null };
    save();
    return { ok: true, vakbewijs: toon(v) };
  }

  return { vakbewijsTeken, vakbewijsIntrek };
};
