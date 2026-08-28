/* App-gids data, deel1b: het vervolg van ./deel1.js, dat over de 10 kB ging
   toen RTG Wereld erbij kwam. Zie ../appgids.js voor de uitleg.

   De knip zit op een entry-grens, zoals bij deel6b en deel10b. Dat hij hier
   toevallig ook op een onderwerp valt -- hierboven de sociale en huishoudelijke
   apps, hier het geld en de vrije tijd -- is meegenomen en geen regel: een
   gidslijst is een lijst. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/rtgone.html': G('RTG One: de gezamenlijke command room voor personeel van RTG en RTF, met werkstromen, besluiten en governance in een gecontroleerde omgeving.',
    ['Bekijk wat vandaag aandacht vraagt', 'Maak vanuit RTMAIL een werkstroom met eigenaar, bewijs en deadline', 'Leg besluiten via de juiste vier-ogenroute vast en volg iedere actie in het auditlog'],
    'Wissel bewust tussen het RTG-huis, het RTF-huis en de gedeelde ruimte; gegevens en rechten blijven per huis afgeschermd.'),
  '/apps/magnaat.html': G('Magnaat Wereld: oefen met echte RTG-werkprocessen in een volledig synthetische ondernemerswereld.',
    ['Kies een functie of servicedossier', 'Werk via de afgeschermde computer en PDA', 'Reken gevolgen veilig door in de economische cockpit'],
    'Geen spelhandeling raakt productiegegevens, echte betalingen of klantcommunicatie.'),
  '/apps/magnaat-kantoor.html': G('Het RTG Controleregister: functies, dekkingsgaten, veilige zelftests, automatische kantoortaken en menselijke fasebesluiten.',
    ['Bekijk de Capability Graph', 'Onderzoek open controlepunten', 'Laat alleen bevoegde mensen een voorstel naar test of pilot zetten'],
    'De Future Engine adviseert; mensen beslissen en iedere pilot blijft een sandbox.'),
  '/apps/ovcontrol.html': G('De OV Control Tower: live zicht op voertuigen, lijnen en geaggregeerde private operaties.',
    ['Bewaak voertuigen en bezetting', 'Vergelijk prestaties per lijn', 'Grijp als bevoegd personeelslid in bij uitzonderingen'],
    'Privéreizen blijven need-to-know: het bord toont capaciteit, nooit het profiel of de route van de hoofdgast.'),
  '/apps/partner-worden.html': G('Partner worden: een gecontroleerde aanvraag voor een zakelijke RTG-werkplek, door elk lid met een pas.',
    ['Meld aan met uw pas', 'Vul bedrijfs- en contactgegevens in', 'Volg de menselijke beoordeling en inrichting'],
    'Een aanvraag zet niets automatisch live; een bevoegde medewerker beoordeelt en activeert.'),
  '/apps/avond.html': G('Een hele avond plannen: Rahul stelt een keten voor van eten, iets drinken en de rit naar huis, binnen je budget en op tijd thuis.',
    ['Zeg vanaf hoe laat, hoe laat je thuis wilt zijn, met hoeveel en wat je per persoon wilt uitgeven',
      'Elke stap draagt zijn reden; wat Rahul niet kan vullen blijft leeg met de uitleg erbij',
      'Onder "Wat zaken van me weten" bepaal je per soort wat een zaak te zien krijgt',
      'Onder elke zaak staat de pols van nu, per bron: gemeten, volgens de zaak, of volgens gasten'],
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
      'Onder "Iets vragen" roep je de bediening of vraag je de rekening; dat kost niets en komt niet op je rekening'],
    'Een ernstige allergie loopt eerst langs een medewerker; zolang die niet heeft bevestigd begint de keuken er niet aan.'),
  '/apps/loonstrook.html': G('Mijn loon: je loonstroken van alle bedrijven waar je werkt, in gewone taal.',
    ['Zie per periode wat er bruto binnenkwam en wat er afging', 'Lees waarom het bedrag zo uitkwam, stap voor stap',
      'Kijk wie je identiteitsgegevens opvroeg, en waarom'],
    'Alleen afgeronde loonruns komen hier; een proefberekening van je werkgever is nog geen loonstrook.'),
  '/apps/spelen.html': G('Spelen: bordspellen en partyspellen met vrienden, live tegen elkaar.',
    ['Start een lobby en nodig vrienden uit', 'Kies een spel: van dammen tot Magnaat', 'Praat mee in de spelchat'],
    'Sommige spellen hebben een leeftijdspoort; dat regelt de app automatisch netjes voor je.'),
  '/apps/magnaat-partnerstudio.html': G('De Magnaat Partnerstudio: bouw als officiële RTG-partner een veilige, speelbare digitale tweeling van uw echte bedrijf.',
    ['Beschrijf uw trainingsdoel en bevestig de gegevensgrenzen', 'Bouw locaties, afdelingen, rollen, aanbod en een volledig werkproces', 'Slaag voor de proef en dien exact die versie in voor menselijke RTG-goedkeuring'],
    'De studio neemt nooit echt geld, productieacties, secrets of echte klantdossiers op; alleen de door RTG goedgekeurde momentopname verschijnt in de game.'),
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
