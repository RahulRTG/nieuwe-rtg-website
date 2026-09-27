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
    waarom: 'een zet in een spel: twee keer een uur plannen of de dag afsluiten zijn twee zetten, en eenmalige zetten weigert de toestand zelf' },
  /* Samen in een Oudwijk (kern/magnaat-leven/stad.js): een dubbeltik op maken, meedoen, beginnen of
     verlaten is dezelfde handeling nog een keer; een zet in de stad is een zet, en een tweede keer
     de dag afsluiten verandert niets (je bent al klaar). */
  /* Staat LEEST: in een gedeelde stad verandert hij door wat een ANDER doet, dus een herhaling van vijf
     seconden geleden is een oud antwoord en geen dubbeltik. */
  'POST /api/member/magnaat/stad/staat': { leest: true },
  'POST /api/member/magnaat/stad/maak': { zelfdeVerzoek: true },
  'POST /api/member/magnaat/stad/doe': { zelfdeVerzoek: true },
  'POST /api/member/magnaat/stad/start': { zelfdeVerzoek: true },
  'POST /api/member/magnaat/stad/verlaat': { zelfdeVerzoek: true },
  'POST /api/member/magnaat/stad/actie': { nietIdempotent: true,
    waarom: 'een zet in een gedeelde stad: twee keer plannen is twee blokken; de dag twee keer afsluiten weigert de toestand, want je bent al klaar' }
};

module.exports = { SLEUTELS };
