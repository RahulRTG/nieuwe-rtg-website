/* ============================================================================
   HET OPSLAGCONTRACT VAN DE VRIENDENLAAG -- de deur naar de vijf sociale lijsten.

   ../sociaal.js (blokkeren, melden, de verbinding opzoeken), ./snaps.js (snaps
   en verhalen) en ./vrienden/contact.js en ./vrienden/verbinden.js (verzoeken,
   ouder-meekijk, ontkoppelen) schreven rechtstreeks in db.data, en vervingen
   een lijst op tien plekken met een filter. De vorm stond nergens: de code ging
   ervan uit dat kern/initdata de lijsten bij de start had neergezet.

   - `lijst(naam)` geeft de lijst, en zet hem als lege lijst neer als hij er
     niet is -- de stand die initdata bij de start toch al maakte.
   - `zet(naam, lijst)` vervangt hem, alleen met een lijst.

   WAT HIER MET OPZET NIET IN STAAT:
   - de contact-PIN (contactPins, contactPinRetired, contactPinSecurity). Dat
     is een beveiligingslaag met een eigen index (./pin-index.js) en eigen
     tombstones; die hoort zijn eigen ronde te krijgen en niet mee te liften.
   - de regels: wie beschermd is, wie een voogd nodig heeft, wie geblokkeerd
     is. Die blijven in ../sociaal.js en ./vrienden. Dit is een deur, geen poort.
   - de lezers buiten de vriendenlaag (de radar van kern/ontmoeting, het
     netwerk en de feed van kern/wereld, kern/vergeten). Een volgende ronde.
   ========================================================================== */
'use strict';

const REGISTER = {
  connections: { soort: 'lijst', wat: 'verbindingen tussen twee handles (RTG en RTF), met status en voogd-wacht' },
  blocks:      { soort: 'lijst', wat: 'blokkades: door wie, van wie' },
  reports:     { soort: 'lijst', wat: 'meldingen van misbruik voor de backoffice, gekapt op 5000' },
  snaps:       { soort: 'lijst', wat: 'snaps; de foto staat versleuteld in de mediastore, hier alleen de verwijzing' },
  stories:     { soort: 'lijst', wat: '24-uursverhalen, een per persoon' }
};

module.exports = function maakSociaalOpslag({ db }) {
  if (!db) throw new Error('kern/sociaal/opslag: zonder db is er niets om te bewaren');

  function eis(naam) {
    if (!REGISTER[naam]) throw new Error('kern/sociaal/opslag: onbekende collectie "' + naam + '" -- zet hem eerst in het REGISTER');
  }
  function lijst(naam) {
    eis(naam);
    if (!Array.isArray(db.data[naam])) db.data[naam] = [];
    return db.data[naam];
  }
  function zet(naam, waarde) {
    eis(naam);
    if (!Array.isArray(waarde)) throw new Error('kern/sociaal/opslag: "' + naam + '" hoort een lijst te zijn');
    db.data[naam] = waarde;
    return waarde;
  }
  /* Welke van deze collectienamen bestaan er nu in de opslag -- voor de gerichte
     save van ../sociaal.js, die ook de PIN-sleutels meeneemt. Leest alleen. */
  const aanwezig = (namen) => namen.filter(k => Object.hasOwn(db.data, k));
  return { lijst, zet, aanwezig, REGISTER };
};

module.exports.REGISTER = REGISTER;
