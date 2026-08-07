/* De woordenlijst van de openbare ruimte: EEN lijst categorieen voor de hele
   stad. Pure data, geen gedrag.

   Waarom dit een eigen bestandje is en niet drie keer een const: dezelfde
   begrippen werden op drie plekken los opgeschreven. kern/gemeente had acht
   categorieen ('verlichting', 'afval', 'wegdek', ...), kern/stad toonde de
   bewoner er vijf met andere namen ('licht', 'water', 'geluid', ...), en de
   veldwerklijst maakte er weer eigen soorten van. Een bewoner die een kapotte
   lantaarn meldde in Mijn Stad en een buurman die hetzelfde meldde bij de
   gemeente, kwamen daardoor in twee stelsels terecht die elkaar nooit konden
   herkennen -- en dus in twee klussen voor dezelfde paal.

   CATS en PLOEG stonden eerder in kern/gemeente/index.js en horen daar niet
   meer: de gemeente is een LEZER van deze lijst, geen eigenaar. UIT_STAD is de
   vertaling van de vijf woorden waarin Mijn Stad met bewoners praat; die vijf
   blijven bestaan, want "riool" is geen woord waarin iemand een plas op straat
   meldt. */

// de categorieen zoals ze in de stad heten
const CATS = {
  verlichting: 'Straatverlichting', afval: 'Afval & vuil', wegdek: 'Wegdek & stoep',
  groen: 'Groen & bomen', riool: 'Riool & water', overlast: 'Overlast', speeltuin: 'Speeltuin', overig: 'Overig'
};

// welke ploeg een categorie standaard oppakt
const PLOEG = {
  verlichting: 'openbare werken', afval: 'reiniging', wegdek: 'openbare werken', groen: 'groenbeheer',
  riool: 'openbare werken', overlast: 'handhaving', speeltuin: 'openbare werken', overig: 'openbare werken'
};

/* Welke SOORT object een categorie meestal betreft. Hierdoor hangt een melding
   aan een ding uit het register ("lantaarn O-3f2a") in plaats van aan een vage
   plek, en kan de afhankelijkheidsgraaf de gedeelde oorzaak zoeken. null =
   deze categorie gaat niet over een geregistreerd object (overlast, wegdek). */
const OBJECTSOORT = {
  verlichting: 'lantaarn', afval: 'container', riool: 'put', groen: 'boom',
  speeltuin: 'speeltoestel', wegdek: null, overlast: null, overig: null
};

// de standaardprioriteit per categorie; een kritiek object trekt hem later op
const PRIO = {
  verlichting: 'normaal', afval: 'laag', wegdek: 'normaal', groen: 'laag',
  riool: 'hoog', overlast: 'normaal', speeltuin: 'hoog', overig: 'normaal'
};

// de vijf woorden waarin Mijn Stad met bewoners praat -> de stedelijke lijst
const UIT_STAD = { licht: 'verlichting', afval: 'afval', water: 'riool', geluid: 'overlast', anders: 'overig' };

module.exports = { CATS, PLOEG, OBJECTSOORT, PRIO, UIT_STAD };
