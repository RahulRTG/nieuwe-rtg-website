/* ============================================================================
   HET OPSLAGCONTRACT VAN DE BEDRIJVENKANT -- de deur naar de werkruimtes, de
   tenants en de herstelproefruimtes.

   Tien bestanden keken rechtstreeks in db.data: bedrijf/index.js (de eigenaar
   van de werkruimtes) en negen in kern/tenant (register, brug, bootstrap,
   bewijs, uitgang, levensloop, herstelproef, contract). Vijf daarvan schreven,
   en de "maak hem als hij er niet is"-regel stond er in drie vormen: met
   `|| {}`, met een typeof-controle, en als toewijzing in een uitdrukking. Dit
   is de laag die TENANT.md de buitenkant van de bedrijvenkant noemt -- de
   isolatie tussen organisaties rust erop -- en juist daar hoort de vraag
   "waar staat dit" EEN antwoord te hebben.

   PAKKEN EN KIJKEN ZIJN TWEE DINGEN.
   - `werkruimtes()`, `tenants()`, `herstelproefRuimtes()` MAKEN aan, in
     precies de vorm die hun schrijver altijd gebruikte.
   - `werkruimtesKijk()` en `tenantsKijk()` maken niets aan en geven een lege
     kaart als er niets is -- wat de lezers met `|| {}` al deden.
   - `zetHerstelproefRuimtes(lijst)` vervangt de lijst.

   WAT DIT BESTAND MET OPZET NIET DOET: geen isolatie- of toegangsregels (die
   wonen in register.js en bedrijf/deuren.js), geen quotum (contract.js), geen
   uitvoer of vernietiging (uitgang.js, levensloop.js). Het is een deur, geen
   poort.
   ========================================================================== */
'use strict';

const REGISTER = {
  werkruimtes:         { soort: 'kaart', wat: 'per werkruimtecode: de werkruimte van RTG Bedrijf (bedrijf/index.js)' },
  tenants:             { soort: 'kaart', wat: 'per organisatie: de tenant met zijn werkruimtes, contract en herstelproeven (./register.js)' },
  herstelproefRuimtes: { soort: 'lijst', wat: 'tijdelijke werkruimtes van een lopende herstelproef (./herstelproef.js)' }
};

module.exports = function maakTenantOpslag({ db }) {
  if (!db) throw new Error('kern/tenant/opslag: zonder db is er niets om te bewaren');

  const isKaart = (w) => !!w && typeof w === 'object';
  return {
    REGISTER,
    /* Voorwaardelijk aanmaken en niet `x = x || {}`: db.data is een bewaakte
       werkkopie (server/db/mutatietracker.js), en een toewijzing van dezelfde
       waarde markeert de collectie toch als gewijzigd. */
    werkruimtes: () => { if (!db.data.werkruimtes) db.data.werkruimtes = {}; return db.data.werkruimtes; },
    werkruimtesKijk: () => db.data.werkruimtes || {},
    tenants: () => { if (!isKaart(db.data.tenants)) db.data.tenants = {}; return db.data.tenants; },
    tenantsKijk: () => db.data.tenants || {},
    herstelproefRuimtes: () => { if (!db.data.herstelproefRuimtes) db.data.herstelproefRuimtes = []; return db.data.herstelproefRuimtes; },
    zetHerstelproefRuimtes: (lijst) => {
      if (!Array.isArray(lijst)) throw new Error('kern/tenant/opslag: herstelproefRuimtes hoort een lijst te zijn');
      db.data.herstelproefRuimtes = lijst;
      return lijst;
    }
  };
};

module.exports.REGISTER = REGISTER;
