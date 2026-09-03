/* ============================================================================
   RTG SERVICE -- de bedrading.

   De laag bestaat uit acht kleine modules met elk een eigen onderwerp. Dit
   bestand zet ze op elkaar en geeft ze door aan de routes. Er staat hier geen
   regel gedrag: wie iets wil weten over prioriteit, routering, klokken,
   machtiging of bevestiging leest die module en niet dit bestand.

   DE VOLGORDE IS GEEN SMAAK. zaak -> loop -> machtiging -> bevestiging -> patroon
   -> persoonlijk: elk hangt aan de vorige. De bevestiging maakt machtigingen
   aan, de machtiging heeft een zaak nodig als bereik, het patroon schrijft
   uitsluitend via de loop (en dus via de tijdlijn), en de persoonlijke stand
   leest wat het patroon heeft gemeld. Draai het om en er ontstaat een tak waarin
   een machtiging kan bestaan zonder zaak, en dat is de vorm die deze laag
   verbiedt. Het foutsignaal staat er LOS van: het kent geen zaak en geen mens.

   WAT ER NIET IN ZIT, EN WAAROM DAT ZO STAAT: kanalen. Mail, telefoon en
   terugbellen staan in ./klassen.js met `gebouwd: false` en een reden. Een zaak
   uit een van die kanalen is dezelfde zaak; alleen het transport ontbreekt. Wie
   er een bouwt, hoeft aan deze bedrading niets te veranderen. */
'use strict';

module.exports = function maakService({ db, save, crypto, inzagelog, notify, sseToCustomer, sseToOffice, accounts }) {
  const zaken = require('./zaak')({ db, save, crypto });
  const loop = require('./loop')({ zaken, save, notify });
  const machtigingen = require('./machtiging')({ db, save, crypto, zaken, inzagelog });
  const bevestiging = require('./bevestiging')({ db, save, crypto, zaken, machtigingen });
  /* De patroonlaag kijkt vanaf de MELDERS en maakt geen incident: die woont in
     kern/command. Zij levert een vermoeden, een mens beslist. En de persoonlijke
     stand leest wat Service aan melders heeft GEMELD -- niet wat een meter zegt. */
  const patronen = require('./patroon')({ zaken, loop, save, db });
  const persoonlijk = require('./persoonlijk')({ zaken, patronen });
  const foutsignalen = require('./foutsignaal')({ db, save });
  /* De kwaliteitsmeting leest ALLEEN; zij hangt daarom achteraan en niemand
     hangt aan haar. Wat zij meet staat in ./kwaliteit.js, en vooral wat zij
     met opzet NIET meet. */
  const kwaliteit = require('./kwaliteit')({ zaken });
  /* Bellen naar RTG binnen de app: geen provider, geen nummer, en de zaak ligt
     ernaast open. De signaleringskanalen komen van buiten -- deze laag legt zelf
     geen verbinding aan en kijkt niet in het pakket. */
  const gesprekken = require('./gesprek')({ db, save, crypto, zaken, loop, sseToCustomer, sseToOffice });

  /* De derde AI-rol: de enige die iets kan OPENEN, en dus de enige die langs
     de bevestiging van het lid moet. Hij hangt achter machtiging en bevestiging
     omdat hij allebei nodig heeft en zelf niets bewaart. */
  const onderzoeker = require('./onderzoeker')({ zaken, loop, machtigingen, bevestiging, save });

  /* RTMail als INGANG. Hij hangt achteraan omdat hij zaken opent en verder
     niets bezit, en hij krijgt als enige in deze laag de identiteitskluis mee --
     met de plichten die daarbij horen; zie ./post.js. */
  const post = require('./post')({ zaken, loop, accounts, inzagelog });

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
      /* HET SERVICEADRES, want anders bestaat het kanaal wel en weet niemand
         het. Het komt uit ./post.js en wordt hier niet overgetypt -- een tweede
         plek die uitrekent welk adres de servicebus is, is precies waar twee
         ingangen in een andere bus gaan kijken. */
      hulpAdres: post.hulpAdres(),
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
    servicePatronen: patronen, servicePersoonlijk: persoonlijk, serviceFoutsignaal: foutsignalen,
    serviceKwaliteit: kwaliteit, serviceGesprek: gesprekken, serviceOnderzoeker: onderzoeker,
    servicePost: post,
    serviceMens: mens, serviceRouter: router, servicePrioriteit: prioriteit,
    serviceKlassen: klassen, serviceKeuzes: keuzes
  };
};
