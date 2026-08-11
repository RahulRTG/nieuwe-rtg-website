/* App-gids data, deel1b: het vervolg van ./deel1.js, dat over de 10 kB ging
   toen RTG Wereld erbij kwam. Zie ../appgids.js voor de uitleg.

   De knip zit op een entry-grens, zoals bij deel6b en deel10b. Dat hij hier
   toevallig ook op een onderwerp valt -- hierboven de sociale en huishoudelijke
   apps, hier het geld en de vrije tijd -- is meegenomen en geen regel: een
   gidslijst is een lijst. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/loonstrook.html': G('Mijn loon: je loonstroken van alle bedrijven waar je werkt, in gewone taal.',
    ['Zie per periode wat er bruto binnenkwam en wat er afging', 'Lees waarom het bedrag zo uitkwam, stap voor stap',
      'Kijk wie je identiteitsgegevens opvroeg, en waarom'],
    'Alleen afgeronde loonruns komen hier; een proefberekening van je werkgever is nog geen loonstrook.'),
  '/apps/spelen.html': G('Spelen: bordspellen en partyspellen met vrienden, live tegen elkaar.',
    ['Start een lobby en nodig vrienden uit', 'Kies een spel: van dammen tot Magnaat', 'Praat mee in de spelchat'],
    'Sommige spellen hebben een leeftijdspoort; dat regelt de app automatisch netjes voor je.'),
  /* Het spelscherm heette eerst scherm.html en stond daarmee OVER het Tweede
     scherm van de zaak-app heen -- twee takken die hetzelfde pad kozen zonder
     elkaar te kennen. De kassaknop opende ineens een spelavond. Vandaar een
     eigen pad; de dubbele-sleutel-controle over de gids ving het. */
  '/apps/spelscherm.html': G('Het gedeelde spelscherm: een lopend potje op de televisie, voor iedereen in de kamer.',
    ['Open een potje in de app en kies "Op het grote scherm"', 'Typ de code hier over', 'Iedereen speelt gewoon op zijn eigen telefoon'],
    'Dit scherm kijkt alleen mee: het heeft geen inlog en toont nooit iemands eigen kaarten of letters.'),
  '/apps/voertuig.html': G('RTG Voertuig: een voertuig uit uw vloot, met zijn papieren en of hij vandaag mag rijden.',
    ['Open er een uit de vloot, of rechtstreeks met een adres (?voertuig=id)',
      'Lees of hij inzetbaar is -- en zo niet, om welke reden precies',
      'Zie welke verplichte papieren er zijn en welke bijna aflopen'],
    'Een verplicht document zonder geldige einddatum telt hier als ONGELDIG en niet als "vast wel in orde": een grens die bij twijfel doorlaat, is geen grens.'),
  '/apps/rit.html': G('RTG Rit: een van uw eigen ritten, van aanvraag tot afrekening.',
    ['Kies een rit, of open er een rechtstreeks met een adres (?rit=ref)',
      'Lees de route, de tijden en wat hij kost',
      'Zie welke vervoerder, welk voertuig en welke chauffeur eraan hangen'],
    '"Nog niet toegewezen" is een echte stand en geen ontbrekend gegeven: een rit wordt aangevraagd voordat er een auto aan hangt.')
};
