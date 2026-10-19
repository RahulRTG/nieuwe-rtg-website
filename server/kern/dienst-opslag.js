/* ============================================================================
   DE OPSLAG VAN DE DIENST -- de prikklok en het verlof van een zaak, achter EEN
   schrijvende deur.

   Drie routebestanden van het personeel (routes/staff/dienst.js,
   dienst-klok.js en collega.js) schreven rechtstreeks in db.data.klok en
   db.data.verlof, elk met een eigen "maak de la als hij er niet is"-regel. Twee
   daarvan waren al eens gerepareerd omdat de la BOVEN de keuring ontstond (zie
   de pauze in dienst-klok.js en de correctie in collega.js); de regel stond dus
   op drie plekken, en elke vierde schrijver moest hem opnieuw leren.

   TWEE BEWONERS IN DB.DATA.KLOK. Onder een ZAAKCODE staat de prikklok (een
   lijst diensten), onder een LIDSLEUTEL staan de wekkers en timers van
   kern/klok.js. Deze deur kent alleen de eerste; kern/lidboard/werkbeleid.js
   zegt in zijn kop hetzelfde. Dat het een collectie is met twee vormen is een
   bestaande schuld en wordt hier niet opgelost -- wel staat hij nu op een plek
   die het zegt.

   DE VERTROUWENSPERSOON STAAT HIER MET OPZET NIET IN. db.data.trustLine is wat
   een medewerker buiten zijn werkgever om schrijft (routes/staff/
   dienst-vertrouwen.js). Hem in dezelfde deur als de klok van die werkgever
   zetten zou precies de nabijheid scheppen die dat bestand verbiedt.

   LEZEN MAAKT NIETS AAN. `klok(code)` en `verlof(code)` geven een lege lijst als
   er niets is en schrijven die niet terug; `zet...` is de enige weg erin.

   WAT DIT BESTAND NIET DOET: geen uren rekenen (klokVan, kern/personeel.js),
   geen kap (4000 en 2000 blijven bij de route), geen rechten. En de lezers
   buiten het personeel (payroll, fiscaal, zaak, backoffice, horeca, werkbeleid)
   staan hier nog niet achter: dat is een volgende ronde.
   ========================================================================== */
'use strict';
const { eigenVeld } = require('./util');

const REGISTER = {
  klok:   { soort: 'kaart', wat: 'per zaakcode: de prikklok (diensten, pauzes, correcties); per lidsleutel: kern/klok.js' },
  verlof: { soort: 'kaart', wat: 'per zaakcode: verlof- en ziekmeldingen, de goedkeuringsstroom van de zaak' }
};

module.exports = function maakDienstOpslag({ db }) {
  if (!db) throw new Error('kern/dienst-opslag: zonder db is er niets om te bewaren');

  const isKaart = (w) => !!w && typeof w === 'object';
  const lijstVan = (naam, code) => {
    const v = eigenVeld(isKaart(db.data[naam]) ? db.data[naam] : null, code);
    return Array.isArray(v) ? v : [];
  };
  const zet = (naam, code, lijst) => {
    if (!isKaart(db.data[naam])) db.data[naam] = {};
    db.data[naam][code] = lijst;
    return lijst;
  };

  return {
    REGISTER,
    klok: (code) => lijstVan('klok', code),
    zetKlok: (code, lijst) => zet('klok', code, lijst),
    verlof: (code) => lijstVan('verlof', code),
    zetVerlof: (code, lijst) => zet('verlof', code, lijst)
  };
};

module.exports.REGISTER = REGISTER;
