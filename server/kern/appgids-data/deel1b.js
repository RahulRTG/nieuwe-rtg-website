/* App-gids data, deel1b: het vervolg van ./deel1.js, dat over de 10 kB ging
   toen RTG Wereld erbij kwam. Zie ../appgids.js voor de uitleg.

   De knip zit op een entry-grens, zoals bij deel6b en deel10b. Dat hij hier
   toevallig ook op een onderwerp valt -- hierboven de sociale en huishoudelijke
   apps, hier het geld en de vrije tijd -- is meegenomen en geen regel: een
   gidslijst is een lijst. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/bank.html': G('RTG Rekening: je saldo, afschriften en betalingen in de vertrouwde RTG-stijl.',
    ['Bekijk je saldo en afschriften', 'Zet spaardoelen en volg ze', 'Vraag krediet aan; een mens beoordeelt'],
    'De AI adviseert, een mens beslist; zeker bij geld houden we die volgorde altijd aan.'),
  '/apps/balans.html': G('RTG Balans: je financiële overzicht en de boekhoudhulp.',
    ['Bekijk inkomsten en uitgaven per maand', 'Laat de AI-boekhouder meedenken', 'Exporteer voor je administratie'],
    'Tien minuten per week naar je balans kijken voorkomt de meeste geldverrassingen.'),
  '/apps/loonstrook.html': G('Mijn loon: je loonstroken van alle bedrijven waar je werkt, in gewone taal.',
    ['Zie per periode wat er bruto binnenkwam en wat er afging', 'Lees waarom het bedrag zo uitkwam, stap voor stap',
      'Kijk wie je identiteitsgegevens opvroeg, en waarom'],
    'Alleen afgeronde loonruns komen hier; een proefberekening van je werkgever is nog geen loonstrook.'),
  '/apps/sport.html': G('RTG Sport: kampen, lessen en sportieve activiteiten van partners.',
    ['Bekijk het aanbod en de data', 'Meld je aan voor een kamp of les', 'Stel een vraag aan de organisatie'],
    'Begin klein: één vast uur per week houd je langer vol dan een groots plan.'),
  '/apps/spelen.html': G('Spelen: bordspellen en partyspellen met vrienden, live tegen elkaar.',
    ['Start een lobby en nodig vrienden uit', 'Kies een spel: van dammen tot Magnaat', 'Praat mee in de spelchat'],
    'Sommige spellen hebben een leeftijdspoort; dat regelt de app automatisch netjes voor je.'),
  '/apps/scherm.html': G('Het gedeelde scherm: een lopend potje op de televisie, voor iedereen in de kamer.',
    ['Open een potje in de app en kies "Op het grote scherm"', 'Typ de code hier over', 'Iedereen speelt gewoon op zijn eigen telefoon'],
    'Dit scherm kijkt alleen mee: het heeft geen inlog en toont nooit iemands eigen kaarten of letters.')
};
