/* HET IDEM-REGISTER, deel Magnaat FROM ZERO -- zelfde register, eigen bestand.

   Twee routes, en ze vragen het tegenovergestelde (MAGNAAT.md, V1):
     - `staat` kijkt en rekent de klok bij. Een woordelijk gelijk verzoek binnen
       het venster is een herhaling; hetzelfde antwoord is juist.
     - `actie` is een zet in een spel. Nog een keer een half uur plannen of de
       dag afsluiten is een tweede zet en geen dubbeltik; wat maar een keer mag,
       weigert de toestand zelf met een reden, en het geld kan niet dubbel
       doordat elke overdracht een grootboeksleutel draagt. */
'use strict';

const SLEUTELS = {
  'POST /api/member/magnaat/leven/staat': { zelfdeVerzoek: true },
  'POST /api/member/magnaat/leven/actie': { nietIdempotent: true,
    waarom: 'een zet in een spel: twee keer een uur plannen of de dag afsluiten zijn twee zetten, en eenmalige zetten weigert de toestand zelf' }
};

module.exports = { SLEUTELS };
