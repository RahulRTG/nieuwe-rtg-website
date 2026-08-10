/* App-gids data, deel1b: het vervolg van ./deel1.js, dat over de 10 kB ging
   toen RTG Wereld erbij kwam. Zie ../appgids.js voor de uitleg.

   De knip zit op een entry-grens, zoals bij deel6b en deel10b. Dat hij hier
   toevallig ook op een onderwerp valt -- hierboven de sociale en huishoudelijke
   apps, hier het geld en de vrije tijd -- is meegenomen en geen regel: een
   gidslijst is een lijst. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/avond.html': G('Een hele avond plannen: Rahul stelt een keten voor van eten, iets drinken en de rit naar huis, binnen je budget en op tijd thuis.',
    ['Zeg vanaf hoe laat, hoe laat je thuis wilt zijn, met hoeveel en wat je per persoon wilt uitgeven',
      'Elke stap draagt zijn reden; wat Rahul niet kan vullen blijft leeg met de uitleg erbij',
      'Onder "Wat zaken van me weten" bepaal je per soort wat een zaak te zien krijgt'],
    'Een tafel is aangevraagd en niet bevestigd: de zaak beslist. Een geboekte rit staat wel vast. Dat verschil staat per stap in het scherm.'),
  /* De twee horeca-gastschermen. Ze staan HIER en niet in deel1 om dezelfde
     reden als de rest van dit bestand: deel1 ging er weer overheen. */
  '/apps/bestellen.html': G('Bestellen bij RTG-horeca buiten de deur: laten bezorgen, zelf afhalen of een foodcourt-mandje bij meer loketten.',
    ['Kies eerst hoe je het wilt hebben; bij bezorgen checkt de zaak je postcode voordat je begint',
      'In de foodcourt-modus blijft je mandje staan als je naar een ander loket gaat',
      'Onder Mijn bestellingen zie je je afhaalcodes en of alles al klaar is'],
    'Bezorgen vraagt je adres en telefoonnummer omdat er iemand langskomt; afhalen alleen een nummer, want de tas ligt klaar op een code.'),
  /* Dit scherm hoort NIET in het rijtje leden-apps dat je vanaf het homescreen
     opent: je komt er via de QR op tafel of op je kamer, vaak zonder lid te
     zijn. De gids staat er wel, want de keuring eist er een per pagina en een
     gast die de gids opent hoort geen algemeen verhaal te krijgen. */
  '/apps/gast.html': G('Aan tafel of op je kamer: de kaart lezen, bestellen vanaf je eigen telefoon en de rekening zien meelopen.',
    ['Scan de QR op tafel; je tafelgenoten doen hetzelfde en zitten dan op dezelfde rekening',
      'Zet een allergie in het eigen veld, niet bij de opmerkingen: dat veld gaat ongefilterd naar de keuken',
      'Op een hotelkamer boek je af op je gastrekening; die code werkt alleen zolang je er logeert'],
    'Een ernstige allergie loopt eerst langs een medewerker; zolang die niet heeft bevestigd begint de keuken er niet aan.'),
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
    'Sommige spellen hebben een leeftijdspoort; dat regelt de app automatisch netjes voor je.')
};
