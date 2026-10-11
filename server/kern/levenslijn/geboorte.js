/* Levenslijn, deelbestand "geboorte": waar de lijn begint.

   Het JAAR komt uit kern/paspoort.js (paspoortGeboortejaarVan), dat over
   paspoorten gaat en precies dit ene getal teruggeeft. De HERKOMST komt uit
   kern/betrouwbaarheid.js, dezelfde `leeftijdBron` die RTG iD en de stempoort
   tonen: 'paspoort' als de keurder de datum van het document overnam,
   'opgegeven' als hij is zoals het lid hem bij de aanmelding intypte. Hier
   stond eerst bij elk jaartal "uit uw geverifieerde paspoort", ook bij een lid
   dat nooit een document liet zien -- een eigen opgave die zich als feit
   voordeed (LEVEN.md par. 2.10).

   Kan de herkomst niet gevraagd worden, dan GOOIT dit, zodat de bron in stil[]
   belandt (./hulp.js `bron`). Stil terugvallen op "opgegeven" zou bij een lid
   met een gekeurd paspoort iets onwaars zeggen zonder dat iemand het merkt.

   Gemount via ./aanwijzingen.js. */
'use strict';

const { geldigJaar, aanwijzing } = require('./hulp');
const { maakLidstand } = require('../betrouwbaarheid');

module.exports = ({ kern }) => {
  let lidstand = null;
  function bronVan(key) {
    if (!lidstand) {
      if (typeof kern.lidstandVan === 'function') lidstand = kern.lidstandVan;
      else if (kern.accounts) lidstand = maakLidstand({ accounts: kern.accounts });
      else throw new Error('levenslijn: geen kluis om de herkomst van het geboortejaar te vragen');
    }
    return lidstand(key).leeftijdBron;
  }

  /* Geen paspoortjaar (een demo-persona, een gast): geen aanwijzing, en dan
     begint de lijn gewoon later. Dat is eerlijker dan een geraden jaartal. */
  return function geboorte(key) {
    const jaar = geldigJaar(kern.paspoortGeboortejaarVan(key));
    if (jaar === null) return [];
    const gezien = bronVan(key) === 'paspoort';
    return [aanwijzing({ fase: 'geboorte', staat: 'geweest', vanaf: jaar,
      bron: gezien ? 'paspoort' : 'opgegeven',
      wat: gezien
        ? 'geboortejaar ' + jaar + ' uit uw geverifieerde paspoort'
        : 'geboortejaar ' + jaar + ' zoals u het zelf opgaf; RTG heeft het nog niet naast een document gelegd' })];
  };
};
