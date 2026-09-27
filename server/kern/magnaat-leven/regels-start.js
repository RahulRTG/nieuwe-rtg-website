/* Magnaat na 1.0: WAAR JE BEGINT. Niet iedereen begint in de keuken. Een startpositie
   verschuift drie dingen: de baan (werkgever, uren, loon, de extra dienst), wat
   er op de bank staat bovenop het startgeld van de moeilijkheid, en eventueel
   een eigen vaste last. De keten zelf verandert niet, en de drempel om
   zelfstandig te worden rekent met het loon van DEZE baan: wie minder verdient,
   hoeft minder te vervangen, maar heeft ook minder om op terug te vallen. */
'use strict';

/* De periode van de vaste lasten komt uit ./regels.js, zodat hij op een plek woont. */
module.exports = (PERIODE) => {
  const STARTPOSITIES = {
    keuken: { naam: 'De keuken', uitleg: '24 uur per week in een brasserie, en bijna niets op de bank', huur: null,
      beschrijving: 'een baan in de keuken', baan: {}, extraKas: 0, verplichting: null },
    student: { naam: 'Student', uitleg: 'een bijbaan van 20 uur, een goedkope studentenkamer, en elke vier weken aflossen op je studieschuld',
      beschrijving: 'een bijbaan en een studieschuld',
      baan: { werkgever: 'Supermarkt De Linde', functie: 'Vakkenvuller', urenPerWeek: 20, dienstdagen: [1, 5], uurloon: 1150,
        extra: { dag: 3, minuten: 240, loon: 4600 } },
      extraKas: 0, huur: 42000,
      verplichting: { id: 'studie', naam: 'Aflossing studieschuld', leverancier: 'de studiefinanciering', bedrag: 6000, elke: PERIODE, eerste: 20,
        uitstel: { dagen: 7, kosten: 0 } } },
    erfenis: { naam: 'Een kleine erfenis', uitleg: '16 uur in een bakkerij, en € 8.000 van je tante op de bank',
      beschrijving: 'een erfenis en een baan in de bakkerij',
      baan: { werkgever: 'Bakkerij Van Dam', functie: 'Verkoper', urenPerWeek: 16, dienstdagen: [1, 5], uurloon: 1125,
        extra: { dag: 3, minuten: 420, loon: 7875 } },
      extraKas: 800000, verplichting: null }
  };
  return STARTPOSITIES;
};
