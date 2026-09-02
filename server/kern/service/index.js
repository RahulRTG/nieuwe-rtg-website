/* ============================================================================
   RTG SERVICE -- de bedrading.

   De laag bestaat uit acht kleine modules met elk een eigen onderwerp. Dit
   bestand zet ze op elkaar en geeft ze door aan de routes. Er staat hier geen
   regel gedrag: wie iets wil weten over prioriteit, routering, klokken,
   machtiging of bevestiging leest die module en niet dit bestand.

   DE VOLGORDE IS GEEN SMAAK. zaak -> loop -> machtiging -> bevestiging: elk
   hangt aan de vorige. De bevestiging maakt machtigingen aan, de machtiging
   heeft een zaak nodig als bereik, en de loop is de enige die de tijdlijn
   schrijft. Draai het om en er ontstaat een tak waarin een machtiging kan
   bestaan zonder zaak, en dat is precies de vorm die deze laag verbiedt.

   WAT ER NIET IN ZIT, EN WAAROM DAT ZO STAAT: kanalen. Mail, telefoon en
   terugbellen staan in ./klassen.js met `gebouwd: false` en een reden. Een zaak
   uit een van die kanalen is dezelfde zaak; alleen het transport ontbreekt. Wie
   er een bouwt, hoeft aan deze bedrading niets te veranderen. */
'use strict';

module.exports = function maakService({ db, save, crypto, inzagelog, notify }) {
  const zaken = require('./zaak')({ db, save, crypto });
  const loop = require('./loop')({ zaken, save, notify });
  const machtigingen = require('./machtiging')({ db, save, crypto, zaken, inzagelog });
  const bevestiging = require('./bevestiging')({ db, save, crypto, zaken, machtigingen });

  const mens = require('./mens');
  const router = require('./router');
  const prioriteit = require('./prioriteit');
  const klassen = require('./klassen');

  /* Wat een scherm nodig heeft om een formulier te tekenen: de soorten, de
     onderwerpen, de kanalen die echt bestaan. AFGELEID uit ./klassen.js en
     nergens overgetypt -- een tweede lijst in een scherm is de plek waar een
     nieuw onderwerp een half jaar niet verschijnt. */
  function keuzes() {
    return {
      soorten: Object.entries(klassen.SOORTEN).map(([id, s]) => ({ id, naam: s.naam, wat: s.wat })),
      onderwerpen: Object.entries(klassen.ONDERWERPEN).map(([id, o]) => ({ id, naam: o.naam })),
      kanalen: Object.entries(klassen.KANALEN).filter(([, k]) => k.gebouwd).map(([id, k]) => ({ id, naam: k.naam })),
      /* De niet-gebouwde kanalen gaan MEE, met hun reden. Een scherm dat alleen
         toont wat er is, laat een lezer denken dat de rest niet bestaat in
         plaats van dat hij nog niet is aangesloten. */
      nogNiet: Object.entries(klassen.KANALEN).filter(([, k]) => !k.gebouwd).map(([id, k]) => ({ id, naam: k.naam, waarom: k.waarom })),
      teams: router.keuzelijst(),
      prioriteiten: Object.entries(prioriteit.LADDER).map(([id, p]) => ({ id, naam: p.naam, wat: p.wat }))
    };
  }

  /* ALLES ONDER EEN VOORVOEGSEL, EN NIETS PLAT. De verleiding is om `open`,
     `lijst`, `stand` en `bericht` gewoon op de kern te zetten -- dat leest
     prettig in een route. Maar de kern is EEN object waar honderd domeinen op
     worden samengevoegd (server/opzet/kernlaag*.js), en `stand` is een woord dat
     dit huis al op meer plekken gebruikt. Wie hier plat exporteert, overschrijft
     stilletjes een ander domein of wordt er stilletjes door overschreven -- de
     fout die kern/command/bijstand.js aan beide kanten laat FAILEN in plaats van
     laat gebeuren. Vandaar: alles achter `service*`, ook waar dat langer is. */
  return {
    serviceZaken: zaken, serviceLoop: loop,
    serviceMachtiging: machtigingen, serviceBevestiging: bevestiging,
    serviceMens: mens, serviceRouter: router, servicePrioriteit: prioriteit,
    serviceKlassen: klassen, serviceKeuzes: keuzes
  };
};
