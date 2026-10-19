/* HET IDEM-REGISTER, deel Magnaat FROM ZERO -- zelfde register, eigen bestand.

   Twee routes, en ze vragen het tegenovergestelde (MAGNAAT.md, V1):
     - `staat` kijkt en rekent de klok bij. Hij LEEST: het antwoord hoort de
       stand van NU te zijn. Hier stond `zelfdeVerzoek`, met als reden "hetzelfde
       antwoord is juist". Dat klopt alleen zolang er tussen twee keer kijken
       niets gebeurt -- en dat doet het wel: het lid sluit zijn dag af (`actie`)
       en kijkt dan opnieuw met dezelfde lege body. Binnen het venster kreeg hij
       dan de stand van VOOR zijn zet terug (test/magnaathardening.e2e.js V5:
       dag 1 waar het scherm dag 2 toonde). Dat bleef verborgen zolang de poort
       een antwoord boven 1 kB niet herhaalde; sinds 292ddb701 doet hij dat wel.
       Herhalen is veilig zonder de poort: het leven ontstaat bij de eerste
       aanraking en een tweede maakt er geen tweede (mutatiecontracten-magnaatleven.js),
       en de klok bijrekenen op hetzelfde moment geeft hetzelfde. Zelfde besluit
       als `stad/staat` hieronder.
     - `actie` is een zet in een spel. Nog een keer een half uur plannen of de
       dag afsluiten is een tweede zet en geen dubbeltik; wat maar een keer mag,
       weigert de toestand zelf met een reden, en het geld kan niet dubbel
       doordat elke overdracht een grootboeksleutel draagt. */
'use strict';

const SLEUTELS = {
  'POST /api/member/magnaat/leven/staat': { leest: true },
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
