/* Mutatiecontract van de Live Circle (Reizen & Veilig). Een route: het maken.
   De duplicaatregel staat in ./idemsleutels-veiligmoment.js, met de reden en de
   prijs; zie ./mutatiecontracten.js voor de vorm en de begrippen. */
'use strict';

const AFGETEKEND = { door: 'Claude (afbouw ronde 3), op grond van route, kern en een toets op een echte server; niet door een mens nagelezen', op: '2026-10-11' };

const CONTRACTEN = {
  'POST /api/veiligheid/moment/maak': {
    mutatieId: 'veiligheid.moment.maak', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    hoe: 'De idempoort (lib/idem-poort.js) speelt een woordelijk gelijk verzoek van dezelfde sessie binnen vijf seconden af in plaats van een tweede Live Circle te maken (zelfdeVerzoek in lib/idemsleutels-veiligmoment.js). Een ander woord, een andere duur of een andere ontvanger is een ander verzoek en maakt gewoon een tweede.',
    bewijs: { gemeten: 'test/veiligmoment-dubbeltik.test.js stuurt hetzelfde formulier twee keer tegelijk naar een echte server: een Live Circle bij het lid, een aankomst bij de zaak; met een andere titel ontstaan er twee. VOLTOOIPROEF.json link:reizen herstelbaar schakel 2 meet hetzelfde in de testwereld.', op: '2026-10-11' },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
