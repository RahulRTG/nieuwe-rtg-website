/* Magnaat na 1.0: DE GETALLEN VAN GROEIEN, als je van je eigen bedrijf leeft.

   Drie manieren om groter te worden, en elk kost iets anders:
     - KREDIET bij de bank: geld nu, met rente, terug in vaste termijnen. De
       bank leent alleen op wat je bedrijf aantoonbaar binnenhaalde.
     - EEN FILIAAL: een tweede plek, met een eigen huur. Je wordt er
       zichtbaarder van, maar half zo veel als op je hoofdplek.
     - EEN OVERNAME: je koopt een concurrent. Zijn klanten zoeken voortaan jou,
       maar er blijft altijd minstens een concurrent over.
   Geld in centen, rente en factoren in procenten. */
'use strict';

const KREDIET = {
  max: 2500000,          // nooit meer dan € 25.000
  omzetDagen: 56,        // de bank kijkt naar de laatste acht weken
  omzetFactor: 2,        // en leent hooguit twee keer wat er binnenkwam
  minimum: 100000,       // en niet minder dan € 1.000
  rente: 6,              // procent over het hele bedrag, verdeeld over de termijnen
  termijnen: 6,
  elke: 28,
  bank: 'Oudwijkse Bank'
};

const FILIAAL = { zichtbaar: 50, teamMin: 1, extraMensen: 2 };   // procent van de zichtbaarheid; iemand die er staat; plek voor twee mensen meer

const OVERNAME = {
  perPromille: 3000,     // een concurrent kost € 30 per promille marktaandeel
  minimum: 600000,       // en nooit minder dan € 6.000
  overblijven: 1,        // er blijft er altijd minstens een over
  klantKans: 60,         // procent kans per week dat een van zijn vaste klanten jou zoekt
  /* Wie er werkte, komt met het bedrijf mee: een ervaren kracht, in dienst. */
  mens: { rol: 'ervaren', contract: 'dienst', dagen: [1, 2, 4], minuten: 480, uurloon: 2000, tempo: 100 },
  mensen: { pixel: 'Noor', noord: 'Sem', snel: 'Lotte', licht: 'Iris', kader: 'Bram', klik: 'Mo', balans: 'Eva', boek: 'Ties', goedkoop: 'Fenna' }
};

module.exports = { KREDIET, FILIAAL, OVERNAME };
