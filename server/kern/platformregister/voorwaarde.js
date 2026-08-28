/* Het platformregister (deelmodule): DE ONTBREKENDE VOORWAARDE.

   Eigen bestand omdat ../samenstellen.js met dit blok erin over de 10 kB-grens
   ging (keuringsregel 13), en omdat het een eigen begrip is: samenstellen.js
   maakt van vier bronnen EEN recordvorm, dit beantwoordt de vraag "wat ontbreekt
   er om dit te kunnen bewijzen". */
'use strict';

/* ---- WAT ONTBREEKT ER OM DIT DING TE KUNNEN BEWIJZEN ----

   "ONGEMETEN" IS EERLIJK EN ONBRUIKBAAR. Het noemt geen voorwaarde, dus er valt
   geen werk van te maken -- alleen een getal om je zorgen over te maken. Sinds
   scripts/waarom.js bestaat, zegt elke route in zijn EIGEN woorden wat eraan
   ontbreekt: een bestaand object, andere velden, een andere rol, een dienst die
   aan staat. Hier wordt dat opgeteld naar het niveau waarop een mens denkt.

   ALLEEN DE GROOTSTE GROEP, en met het aantal erbij. Een ding met veertig routes
   heeft zelden een enkele oorzaak; drie soorten naast elkaar leest als ruis, en
   een gemiddelde bestaat hier niet. Wie het precies wil weten, heeft het
   routedossier.

   ONTBREEKT WAAROM.json, dan staat er NIETS -- geen "onbekend" en geen lege
   streep. Een veld dat er altijd is maar soms niets betekent, wordt gelezen als
   een meting (LAT.md regel 3 en 12). */
function ontbrekendeVoorwaarde(rijen, waarom) {
  if (!waarom || !rijen.length) return null;
  const per = new Map();
  for (const r of rijen) {
    const w = waarom[r.methode + ' ' + r.pad];
    if (!w || !w.soort || w.soort === 'bereikt') continue;
    const bij = per.get(w.soort) || { soort: w.soort, aantal: 0, voorbeeld: null };
    bij.aantal++;
    if (!bij.voorbeeld) bij.voorbeeld = r.methode + ' ' + r.pad + ' -- ' + w.omdat;
    per.set(w.soort, bij);
  }
  if (!per.size) return null;
  return [...per.values()].sort((a, b) => b.aantal - a.aantal)[0];
}

module.exports = { ontbrekendeVoorwaarde };
