/* ============================================================================
   DE OPSLAG VAN DE RTFOUNDATION -- de wortel db.data.foundation, achter EEN deur.

   ./basis.js is de eigenaar (F(): de wortel met lessen), en twee bestanden
   buiten deze map zetten er een tak in: kern/foundationregistratie-uitgifte.js
   (een goedgekeurde school) en routes/office/partners/kantoorlijsten.js (de
   scholenlijst van het kantoor). Drie keer dezelfde "maak de wortel als hij er
   niet is"-regel, elk in een andere vorm (`|| { lessen: {} }`, een
   typeof-controle, en een toewijzing in een uitdrukking).

   - `wortel()` maakt de wortel aan met lessen, zoals F() deed.
   - `tak(naam)` maakt de wortel en die ene tak aan (als kaart) -- wat de twee
     buitenstaanders deden; de wortel krijgt daar GEEN lessen bij, zodat hij er
     precies zo uitziet als voorheen.
   - `kijk()` maakt niets aan en geeft een lege kaart als er geen wortel is.

   WAT HIER NIET STAAT: de lessen, gezinnen, scholen en klassen zelf -- hun
   regels blijven bij de route die ze kent. Dit is een deur, geen poort.
   ========================================================================== */
'use strict';

module.exports = function maakFoundationOpslag({ db }) {
  if (!db) throw new Error('foundation/opslag: zonder db is er niets om te bewaren');

  const isKaart = (w) => !!w && typeof w === 'object';
  function wortel() {
    if (!db.data.foundation) db.data.foundation = { lessen: {} };
    if (!db.data.foundation.lessen) db.data.foundation.lessen = {};
    return db.data.foundation;
  }
  function tak(naam) {
    if (!isKaart(db.data.foundation)) db.data.foundation = {};
    const f = db.data.foundation;
    if (!isKaart(f[naam])) f[naam] = {};
    return f[naam];
  }
  const kijk = () => (isKaart(db.data && db.data.foundation) ? db.data.foundation : {});
  return { wortel, tak, kijk };
};
