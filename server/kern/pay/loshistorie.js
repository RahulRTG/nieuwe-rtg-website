/* DE BOEKINGSHISTORIE VOOR EEN LOSSE, EIGEN db.data -- en alleen daarvoor.

   Sinds TAKEN.md 4.39 loopt elke grootboekregel van RTG Pay via het
   transactiegrootboek (`payBoekingenVoegToe` uit server/db/tx). Die weg hangt aan
   de PROCESBREDE opslag (server/db/state): hij indexeert op die ene `db.data` en
   schrijft naar dat ene grootboek.

   Vier motor-harnassen (schaduw, soak, pariteit, cutover) en een toets bouwen de
   pay-kern op een EIGEN `db = { data: {} }`, met opzet: ze simuleren de JS-engine
   naast de Rust-motor en mogen de echte opslag niet aanraken. Voor hen zou de
   echte weg naar de verkeerde database schrijven -- erger dan geen weg.

   Daarom staat de losse variant hier, EEN keer, en niet vijf keer als
   `db.data.payBoekingen.unshift(...)` in vijf harnassen. Wat hij mist ten
   opzichte van de echte weg staat er hardop bij, zodat niemand hem per ongeluk
   voor de echte aanziet:

     - geen rij in het transactiegrootboek, dus geen herstel na een crash
     - geen index op de sleutel, dus zoeken is O(N)
     - de staart voorbij de cap verdwijnt HIER wel stilletjes; de echte weg
       schrijft hem eerst naar het archief

   WANNEER MAG HIJ. Alleen als de aanroeper zijn eigen `db.data` meebrengt en de
   historie niet hoeft te overleven. In de server (server/opzet/kernlaag3.js) is
   dat nooit waar; `test/pay-grootboek.test.js` houdt vast dat die de echte weg
   meegeeft. */
'use strict';

const CAP = 50000;   // dezelfde weergavecap als de echte weg; de saldi zijn de waarheid

module.exports = function maakLosseHistorie(db) {
  return function losseVoegToe(rij) {
    const d = db.data || (db.data = {});
    if (!Array.isArray(d.payBoekingen)) d.payBoekingen = [];
    d.payBoekingen.unshift(rij);
    if (d.payBoekingen.length > CAP) d.payBoekingen.length = CAP;
  };
};
