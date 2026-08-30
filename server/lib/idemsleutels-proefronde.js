/* ============================================================================
   IDEM-SLEUTELS -- DE ZESENTWINTIG DIE DE UITGEBREIDE PROEFOPSTELLING ZICHTBAAR
   MAAKTE (30 augustus 2026).

   Deel van ./idemsleutels.js.

   Deze routes zaten tot vandaag achter een dichte deur: de proef had geen gezin
   op /api/rtf/, geen klas, en geen document. Toen die drie voorwerpen er waren
   (scripts/lib/idemwereld.js), kwamen 325 deuren open en gaven 123 routes voor
   het eerst een uitslag. Zesentwintig daarvan zeiden hetzelfde:

       MET een sleutel wordt de herhaling opgevangen.
       ZONDER sleutel DEED DE TWEEDE OPROEP HET WERK OPNIEUW.

   Dat is de echte dubbeltik, en hij was nooit eerder te zien -- niet omdat
   niemand keek, maar omdat de proef er niet bij kwam. Dat is precies waarvoor
   een proefopstelling wordt uitgebreid.

   Ze zijn stuk voor stuk gelezen en vallen in drie soorten, en de derde krijgt
   met opzet GEEN regel.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- 1. BERICHTEN AAN OUDERS, en die wil je nooit twee keer sturen ----

     Een mededeling, een nieuwsbrief of een huiswerkopgave die er twee keer
     staat, is niet alleen slordig: hij komt bij elk gezin twee keer binnen. Alle
     zeven eisen een verplicht veld dat zegt WAT er ontstaat (tekst of titel),
     dus een leeg lijf kan hier niets maken -- de fout uit
     ./idemsleutels-nooit.js is hier niet mogelijk. */
  'POST /api/foundation/school/mededeling': { zelfdeVerzoek: true },        // tekst, verplicht
  'POST /api/foundation/school/directie/mededeling': { zelfdeVerzoek: true },// tekst, verplicht
  'POST /api/foundation/school/nieuwsbrief': { zelfdeVerzoek: true },       // titel + tekst, allebei verplicht
  'POST /api/foundation/school/huiswerk/maak': { zelfdeVerzoek: true },     // titel, verplicht
  'POST /api/foundation/school/excursie/maak': { zelfdeVerzoek: true },     // titel, verplicht
  'POST /api/foundation/school/bijdrage/maak': { zelfdeVerzoek: true },     // titel + bedrag, allebei verplicht
  /* De telefoonboom BOUWT OPNIEUW uit de huidige klaslijst en zet het alarm op
     null; twee keer draaien laat dezelfde boom achter. Wat de proef zag bewegen
     was de tijdstempel. Een regel hoort er toch: een tweede boom bouwen tijdens
     een alarm zet dat alarm stil, en dat is precies het verkeerde moment. */
  'POST /api/foundation/school/telefoonboom/maak': { zelfdeVerzoek: true },

  /* ---- 2. HET KANTOORPAKKET, drie handelingen maal drie kringen ----

     Dezelfde laag (kern/office/samen.js) hangt onder het lid, het kantoor en de
     zaak. Een opmerking eist een verplichte tekst, dus een leeg lijf maakt er
     geen.

     DELEN EN BEHEREN STONDEN HIER OOK EN ZIJN ERAF (zie ./idemsleutels-nooit.js).
     Hun antwoord op een herhaling is een BESLUIT en geen echo. */
  'POST /api/kantoorpakket/opmerking': { zelfdeVerzoek: true },
  'POST /api/office/kantoorpakket/opmerking': { zelfdeVerzoek: true },
  'POST /api/supplier/kantoorpakket/opmerking': { zelfdeVerzoek: true },

  /* ---- 3. DE RTF-KANT: wat er ontstaat, en wat er met opzet twee keer mag ----

     Eerst wat je niet dubbel wilt. */
  'POST /api/rtf/baby/entry-maak': { zelfdeVerzoek: true },        // een moment in het babyboek
  'POST /api/rtf/leren/project-maak': { zelfdeVerzoek: true },     // titel
  'POST /api/rtf/leren/schrijf-bewaar': { zelfdeVerzoek: true },   // bewaren is overschrijven
  'POST /api/rtf/tiener/boek': { zelfdeVerzoek: true },
  'POST /api/rtf/kantoorpakket/maak': { zelfdeVerzoek: true },     // zelfde reden als de andere kantoorpakketten
  'POST /api/rtf/social/pin/live': { zelfdeVerzoek: true },

  /* En de drie die met opzet GEEN duplicaatregel krijgen -- de moeilijke helft,
     en alle drie met een precedent in dit huis. */
  'POST /api/rtf/spel/sudoku-nieuw': { nietIdempotent: true,
    waarom: 'wie twee keer op "nieuwe puzzel" drukt, wil een nieuwe puzzel. Zelfde besluit als bij ' +
      '/api/member/spel/sudoku-nieuw, dat om deze reden in ./idemsleutels-nooit.js staat' },
  'POST /api/rtf/spel/team-nieuw': { nietIdempotent: true,
    waarom: 'twee teams met dezelfde naam zijn twee teams; de kern begrenst dat zelf en een dubbeltik ' +
      'kost hoogstens een teamplek. Zelfde lezing als /api/member/spel/team-nieuw' },
  'POST /api/rtf/baby/moment-ai': { nietIdempotent: true,
    waarom: 'een vraag aan het model: twee keer vragen is twee antwoorden, en een ouder die het eerste ' +
      'niet mooi vond vraagt het opnieuw. Zelfde lezing als de concierge- en bijlesvragen' }
};

module.exports = { SLEUTELS };
