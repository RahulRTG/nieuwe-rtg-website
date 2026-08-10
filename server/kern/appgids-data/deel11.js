/* De app-gids, deel 11: de staart van deel 1.

   Deel 1 groeide over de 10 KB-grens die het modulebeleid stelt (README.md,
   "Modulebeleid"), en de keuring in scripts/check.js merkte dat meteen. Geknipt
   op een entry-grens -- geld, sport en spelen -- precies zoals deel 8 en 9 ooit
   de staarten van deel 4 en 5 werden. De samengevoegde gids is er niet door
   veranderd; test/bibliotheek.test.js zou het zien als dat wel zo was. */

const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/werkruimte.html': G('RTG Workspace: uw werkruimte op een groot scherm, waar meerdere RTG-apps naast elkaar draaien en elkaar begrijpen.',
    ['Open een wereld uit de console links; hij verschijnt als eigen vlak',
     'Pak de gouden greep bovenaan een vlak om het te verplaatsen, of sleep het naar een schermrand om het vast te zetten',
     'Druk op Cmd-K (of Ctrl-K) om iets te zoeken of te openen zonder de muis'],
    'Dit is geen grotere telefoon-app: op een groot scherm hoort er meer RTG te staan, niet hetzelfde maar uitgerekt. De apps blijven zelfstandig; de werkruimte verbindt ze alleen.'),
  '/apps/wbw.html': G('Wie betaalt wat: groepsuitgaven bijhouden met een live balans.',
    ['Maak een groep en zet uitgaven erin', 'Zie live wie wat voorschoot', 'Verreken in één keer via RTG Pay'],
    'Direct na de vakantie verrekenen voorkomt het eeuwige "dat komt nog wel".'),
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
};
