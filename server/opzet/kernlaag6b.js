/* DE KERN SAMENSTELLEN -- deel 6b.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     werkvenster
     eenaccount
     kantoorgesprek

   WAAROM DIT DEEL BESTAAT. ./kernlaag6.js ging over de tienkilobytegrens van
   keuringsregel 13 toen drie takken er tegelijk iets bijzetten. De naad ligt
   hier omdat alles hieronder over INLOGGEN en werkvensters gaat en niets meer
   over vervoer of media -- zelfde knip als ./kernlaag4b.js en ./kernlaag7b.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, crypto, db, findSupplier, haversine, klokVan, logActivity, loginFails,
    noteFailedTry, pinSlot, rememberSession, save, sessieregister, supplierState } = hulp;

/* Het werkvenster (kern/werkvenster.js): de werkgever bepaalt wanneer
   personeel op de werkpagina en de PDA mag; de server dwingt dat af bij elke
   ingang naar een personeelssessie. Rahul adviseert los daarvan (agenda,
   uren, zorgprofiel) maar blokkeert nooit. */
Object.assign(kern, require('../kern/werkvenster').maakWerkvenster({
  db, save, klokVan, zorgVan: kern.zorgVan, haversine
}));
/* Een account voor alles (kern/eenaccount.js): mensen registreren zich een
   keer; personeel, zaak en kantoor zijn daarna koppelingen aan dat ene
   account (na bewijs van de werk-inlog), en accStart munt exact dezelfde
   sessies als de losse logins. */
Object.assign(kern, require('../kern/eenaccount').maakEenAccount({
  db, save, crypto, accounts, findSupplier, checkCred: kern.checkCred, hasCred: kern.hasCred,
  DEMO: kern.DEMO, DEMO_SUPPLIER: kern.DEMO_SUPPLIER, OFFICE_CODE: kern.OFFICE_CODE,
  veiligGelijk: kern.veiligGelijk, totpOk: kern.totpOk, rememberSession, logInlog: kern.logInlog,
  logActivity, supplierState, officeState: kern.officeState, magWerken: kern.magWerken,
  pinInfo: kern.pinInfo, pinCheck: kern.pinCheck,
  // hetzelfde doel-slot als /api/supplier/login: een pin, een teller
  pinSlot,
  // en dezelfde persoonseis als /api/supplier/login: het ene account is geen achterdeur
  persoonsPoort: kern.persoonsPoort,
  // MIJN RTG blok 3: hier ontstaat een tweede context voor dezelfde mens
  sessieregister
}));
/* Het kantoorgesprek (kern/kantoorgesprek.js): de backoffice binnenkomen door
   met Rahul te praten in plaats van een codeveld in te vullen. Zelfde slot als
   de kantoordeur zelf (bucket 'office:<ip>'), zodat de vriendelijkere weg geen
   zwakkere weg is; wat er ingetypt wordt gaat nergens heen. */
Object.assign(kern, require('../kern/kantoorgesprek').maakKantoorgesprek({
  OFFICE_CODE: kern.OFFICE_CODE, veiligGelijk: kern.veiligGelijk, totpOk: kern.totpOk,
  crypto, rememberSession, officeState: kern.officeState, logInlog: kern.logInlog,
  loginFails, noteFailedTry
}));

};
