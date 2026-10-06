/* DE KERN SAMENSTELLEN -- deel 6b.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     werkvenster
     eenaccount
     kantoorgesprek
     arrivalpas

   WAAROM DIT DEEL BESTAAT. ./kernlaag6.js ging over de tienkilobytegrens van
   keuringsregel 13 toen drie takken er tegelijk iets bijzetten. De naad ligt
   hier omdat alles hieronder over INLOGGEN en werkvensters gaat en niets meer
   over vervoer of media -- zelfde knip als ./kernlaag4b.js en ./kernlaag7b.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, crypto, db, findSupplier, haversine, klokVan, logActivity, loginFails,
    noteFailedTry, pinSlot, rememberSession, save, sessieregister, supplierState } = hulp;

require('./library')(kern, hulp);
require('./loop-fabric')(kern, hulp);

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
  // de kantooruitnodiging claimt in een collectietransactie (kern/kantoor/uitnodiging.js)
  bewerkCollectie: hulp.bewerkCollectie,
  // en dezelfde persoonseis als /api/supplier/login: het ene account is geen achterdeur
  persoonsPoort: kern.persoonsPoort,
  // MIJN RTG blok 3: hier ontstaat een tweede context voor dezelfde mens
  sessieregister,
  // stap twee (VRIJHEID.md par. 6a): een zetel in de RTG-zaak is de kantoorsleutel
  rtgZetel: (key) => kern.vrijheid.rtgZetel.zetelVan(key),
  // B10: de passkey aan de kantoordeur; een getter, want de zware poort komt later
  zwaarVan: () => kern.zwaarbewijs
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

/* De Arrival Pass van Invisible Arrival (kern/arrivalpas.js): een 128-bit
   gastbearer die alleen als hash in `arrivalToegang` staat en in een
   collectietransactie wordt uitgegeven, geroteerd, gebruikt en ingetrokken. */
kern.arrivalpas = require('../kern/arrivalpas')({ db, bewerkCollectie: hulp.bewerkCollectie, crypto });
/* De sleutel per Zaakdoos (kern/zaakdoos/sleutels.js, besluit B12): uitgeven,
   roteren en intrekken in een collectietransactie; de vloot, het kantoor en de
   manager van de zaak delen dit ene register. */
kern.doosSleutels = require('../kern/zaakdoos/sleutels').doosSleutelsVan({ db, save: hulp.save,
  bewerkCollectie: hulp.bewerkCollectie, crypto });
/* De personeelsuitnodiging (routes/supplier/werving/uitnodiging.js): EEN
   instantie met de collectietransactie. Werving en supplier maakten er elk een
   eigen met alleen `kern`, en kern draagt bewerkCollectie niet -- dus de claim
   nam stil de niet-transactionele weg, over twee instances niet atomair. */
kern.personeelsUitnodiging = require('../routes/supplier/werving/uitnodiging')({
  kern: Object.assign(Object.create(kern), { bewerkCollectie: hulp.bewerkCollectie }) });
/* De personeelscode van het partnerkanaal (kern/partnerpersoneelscode.js, B14):
   128 bits per medewerker, alleen als hash, en een boeking claimt een gebruik
   in de collectietransactie. De partnercode zelf is een openbare attributie. */
kern.partnerPersoneelscode = require('../kern/partnerpersoneelscode').personeelscodesVan({ db, crypto,
  bewerkCollectie: hulp.bewerkCollectie,
  zoekPartner: code => kern.findPartner(code) });
/* B21: de oude, zelfgekozen staff.code gaat bij de opslagstart uit de opslag
   (kern/partnerpersoneelscode-migratie.js; aangeroepen vanuit server.js). */
kern.partnerOudeCodes = require('../kern/partnerpersoneelscode-migratie')({
  bewerkCollectie: hulp.bewerkCollectie });

};
