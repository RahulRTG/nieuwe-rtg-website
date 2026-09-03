/* ============================================================================
   DE HULPLAAG -- de ledenbalie en RTG Service, samen opgehangen.

   WAAROM SAMEN. Ze delen de ZETEL. Het RTG-kantoor is een ongedeelde ruimte met
   een code die iedereen kent, en zo'n code wijst niemand aan; werk aan het
   account van een lid hoort herleidbaar te zijn tot een mens. De balie kreeg
   daarvoor een zetel op naam, en RTG Service hangt aan diezelfde zetel in plaats
   van er een vierde kantoorpoort naast te zetten.

   WAAROM EEN EIGEN BESTAND. ./kernlaag7.js stond met 10.141 byte al op 99% van
   de grens van keuringsregel 13. Dezelfde reden en dezelfde vorm als
   ./theater.js: een eigen onderwerp, uit de laag getild zonder dat er een tweede
   lijst met doorgegeven namen ontstaat.

   DE VOLGORDE IS GEDRAG. De balie eerst, Service daarna: de klacht bestaat en
   krijgt er een envelop omheen, niet andersom. De envelop wordt daarom als
   FUNCTIE meegegeven (./servicelaag.js) -- de laag die hem maakt bestaat op dat
   moment nog niet.
   ========================================================================== */
'use strict';

module.exports = function hangHulplaagOp(kern, hulp) {
  const { accounts, db, onboarding, save } = hulp;

  /* De ledenbalie (kern/ledenbalie*.js): de afdeling die een lid mag HELPEN --
     zoeken op codenaam of steuncode, het dossier inzien met een reden erbij, een
     wachtwoordherstel in gang zetten, een klacht vastleggen en een abo-wijziging
     VOORSTELLEN.

     Wat hij met opzet NIET kan (merkregels, geen voorzichtigheid): een naam,
     adres of nummer zien; een wachtwoord zien of zetten; Lifestyle of Business
     toekennen. herstelStart komt uit routes/auth/herstel.js -- DEZELFDE stroom als
     /api/auth/forgot, geen tweede kopie. Late binding, want die route hangt later. */
  Object.assign(kern, require('../kern/ledenbalie')({
    db, save, accounts, onboarding,
    geldPasprijzen: () => (kern.geldPasprijzen ? kern.geldPasprijzen() : null),
    magBoardroom: (k) => (kern.magBoardroom ? kern.magBoardroom(k) : false),
    herstelStart: (u, req) => (kern.herstelStart ? kern.herstelStart(u, req) : null),
    // een klacht krijgt een servicezaak omheen; hij blijft van de balie zelf.
    // Een functie, want die laag hangt hieronder en bestaat hier nog niet.
    serviceEnvelop: require('./servicelaag').envelopVoorBalie(kern)
  }));

  /* RTG Service (kern/service/): de gedeelde envelop over de vier hulplijnen
     die dit huis al had -- de AI van de RTG Pass, de menselijke concierge, de
     balie hierboven en RTG Bijstand. Die vier blijven bepalen wat iets
     BETEKENT; Service bepaalt wie eraan werkt, met welke bevoegdheid, en wat
     de melder ziet. Het werk staat in ./servicelaag.js. */
  require('./servicelaag').hangOp(kern, hulp);
};
