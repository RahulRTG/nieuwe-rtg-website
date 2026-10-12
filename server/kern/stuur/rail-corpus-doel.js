/* EEN DOEL UITSPREKEN -- Rahul als ingang, de knelpuntmotor als bron.

   Besluit van de eigenaar (11 oktober 2026): iemand zegt tegen Rahul wat hij
   wil bereiken, en RTG laat zien welke wegen er bestaan. Geen scherm voor de
   knelpuntmotor en geen tweede motor -- Rahul roept /api/knelpunt aan, op de
   LEZEN-lijst van ./beleid-lijsten.js.

   WAT DEZE REGEL WEL EN NIET DOET. Hij haalt de kaart (de echte resolver) en
   doet dan EEN leesaanroep, met uitsluitend het doel in het lijf: geen context,
   geen codenaam, geen profiel. Wat de motor teruggeeft gaat als tool-antwoord
   terug; de afsluitende zin hieronder belooft daarom niets over de INHOUD van
   die wegen -- een vaste tekst die zou zeggen welke wegen er zijn, zou ze
   verzinnen. Wat er werkelijk terugkwam, staat in de acties van het antwoord.

   De sleutel is de genormaliseerde zin (./rail-corpus.js). */
'use strict';

const doel = 'ik wil mijn eigen bedrijf beginnen';

module.exports = {
  [doel]: {
    stappen: [
      { tools: [{ name: 'kaart', input: {} }] },
      { tools: [{ name: 'doe', input: { pad: '/api/knelpunt', zeker: true,
        begrepen: 'nazoeken welke wegen RTG heeft voor het doel dat dit lid uitspreekt',
        body: { doel } } }] }
    ],
    projectie: 'Ik heb nagezocht welke wegen RTG voor dit doel heeft. Ze staan er zonder volgorde, ' +
      'met wat ze niet regelen; kies zelf welke je wilt verkennen.'
  }
};
