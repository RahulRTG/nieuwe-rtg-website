/* RTG School, leerlijn voortgezet onderwijs: wiskunde. Per FASE uit de niveauladder in plaats
   van per groep; vmbo is de gedeelde basis, havo bouwt erop voort en vwo weer
   op havo.

   Waarom hier het meeste te winnen viel: van de vierendertig vo-doelen
   draaiden er eenentwintig op 'mc' met vier handgeschreven vragen. Juist bij
   de exacte vakken is elke opgave uit te rekenen -- en dus te genereren. De
   `formule`-generator draagt hier snelheid, dichtheid, de wet van Ohm, arbeid,
   dichtheid en concentratie: een sjabloon met twee getallen en de som die
   daaruit volgt.

   De ids van bestaande doelen zijn ongewijzigd: het leerpaspoort verwijst
   ernaar, ook als de vorm van de opgave verandert. */
const VMBO = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl'];
const ALLE_VO = VMBO.concat(['havo', 'vwo']);

module.exports.VO_WISKUNDE = [

  { vak: 'wiskunde', fasen: ALLE_VO, doelen: [
    { id: 'wiskunde.vo.procenten', naam: 'Rekenen met procenten', ref: '2F',
      les: 'Procent betekent per honderd. 25% van 80 reken je zo: 80 : 100 x 25 = 20. Handig ezelsbruggetje: 10% is delen door 10, en de rest bouw je daaruit op.',
      vereist: ['rekenen.g8.procenten-komma-breuk'],
      uitleg: [
        { soort: 'stap', tekst: 'Reken altijd eerst 1% uit (delen door honderd) of 10% (delen door tien). Alle andere percentages bouw je daaruit op.' },
        { soort: 'praktijk', tekst: 'Btw, korting, rente en een salarisverhoging zijn dezelfde som. Wie 10% kan, kan ze allemaal.' }],
      gen: { soort: 'procent', procenten: [10, 15, 20, 25, 50, 75] } },
    { id: 'wiskunde.vo.verhoudingen', naam: 'Verhoudingstabellen', ref: '2F',
      les: 'Een verhoudingstabel rekent via 1: weet je wat 3 stuks kosten, deel dan eerst door 3 (de prijs van 1) en vermenigvuldig daarna.',
      vereist: ['rekenen.g8.verhoudingen-procent'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet de gegevens in twee rijen. Wat je met de bovenste rij doet, doe je met de onderste; ga via 1 als je vastloopt.' },
        { soort: 'praktijk', tekst: 'Schaal, recept, benzineverbruik, wisselkoers: allemaal dezelfde tabel met andere woorden erboven.' }],
      gen: { soort: 'verhouding', max: 40 } },
    { id: 'wiskunde.vo.kommagetallen', naam: 'Rekenen met kommagetallen', ref: '2F',
      les: 'Zet de getallen onder elkaar met de komma recht onder elkaar; dan tellen tienden bij tienden en eenheden bij eenheden.',
      vereist: ['rekenen.g6.kommagetallen'],
      uitleg: [
        { soort: 'stap', tekst: 'Bij vermenigvuldigen tel je het aantal cijfers achter de komma van beide getallen op; zoveel decimalen krijgt het antwoord.' },
        { soort: 'eenvoudig', tekst: 'Een kommagetal is een breuk in andere kleren: 0,25 is een kwart. Wie dat ziet, schat sneller of het antwoord kan kloppen.' }],
      gen: { soort: 'som', op: 'beide', max: 20, komma: true } },
    { id: 'wiskunde.vo.opp-omtrek', naam: 'Oppervlakte en omtrek', ref: '2F',
      les: 'Omtrek is eromheen lopen: 2 x (lengte + breedte). Oppervlakte is bedekken: lengte x breedte, in vierkante meters.',
      vereist: ['rekenen.g6.omtrek-opp'],
      uitleg: [
        { soort: 'visueel', tekst: 'Omtrek is het hek, oppervlakte is het gras. Verdubbel je beide zijden, dan wordt de omtrek twee keer zo groot en de oppervlakte vier keer.' },
        { soort: 'praktijk', tekst: 'Plinten koop je per meter (omtrek), vloerbedekking per vierkante meter (oppervlakte). Verwar je die twee, dan koop je veel te veel of te weinig.' }],
      gen: { soort: 'opp', max: 12 } },
    { id: 'wiskunde.vo.pythagoras', naam: 'De stelling van Pythagoras', ref: '3F',
      les: 'In een rechthoekige driehoek geldt a-kwadraat plus b-kwadraat is c-kwadraat, waarbij c de schuine zijde is. Daarmee reken je een afstand uit die je niet kunt meten.',
      vereist: ['wiskunde.vo.opp-omtrek', 'rekenen.g8.kwadraten'],
      uitleg: [
        { soort: 'stap', tekst: 'Zoek eerst de rechte hoek. De zijde ertegenover is de schuine zijde en staat altijd alleen aan de kant van het isgelijkteken.' },
        { soort: 'visueel', tekst: 'Teken op elke zijde een vierkant. De twee kleine vierkanten samen hebben precies dezelfde oppervlakte als het grote.' },
        { soort: 'praktijk', tekst: 'Een ladder van vijf meter met de voet een meter van de muur reikt tot bijna vijf meter hoog. Zo reken je hoogtes uit zonder te klimmen.' }],
      gen: { soort: 'pythagoras' } },
    { id: 'wiskunde.havo.lineair', naam: 'Lineaire vergelijkingen oplossen', ref: '3F',
      fasen: ['havo', 'vwo'],
      les: 'Los x op door aan beide kanten hetzelfde te doen: eerst de losse getallen weg, dan delen door het getal voor de x.',
      vereist: ['wiskunde.vo.procenten'],
      uitleg: [
        { soort: 'analogie', tekst: 'Een vergelijking is een balans. Wat je links doet, doe je rechts -- anders slaat hij door en klopt hij niet meer.' },
        { soort: 'stap', tekst: 'Eerst plus en min wegwerken, daarna keer en delen. In die volgorde blijft het altijd overzichtelijk.' }],
      gen: { soort: 'vergelijking', maxA: 9, maxX: 12 } },
    { id: 'wiskunde.havo.functies', naam: 'Lineaire functies en grafieken', ref: '3F',
      fasen: ['havo', 'vwo'],
      les: 'y = ax + b is een rechte lijn. De a is de steilheid (richtingscoefficient), de b is waar de lijn de y-as snijdt.',
      vereist: ['wiskunde.havo.lineair'],
      uitleg: [
        { soort: 'visueel', tekst: 'De b bepaalt waar je begint, de a hoe hard je stijgt. Verdubbel de a en de lijn wordt twee keer zo steil.' },
        { soort: 'praktijk', tekst: 'Een abonnement met vast bedrag plus prijs per maand is precies y = ax + b. De b is het instapbedrag.' }],
      gen: { soort: 'functie', max: 8 } },
    { id: 'wiskunde.havo.statistiek', naam: 'Gemiddelde en spreiding', ref: '3F',
      fasen: ['havo', 'vwo'],
      les: 'Het gemiddelde is de som gedeeld door het aantal. Het zegt niets over spreiding: twee klassen met hetzelfde gemiddelde kunnen heel verschillend zijn.',
      vereist: ['rekenen.g7.gemiddelde'],
      uitleg: [
        { soort: 'stap', tekst: 'Reken eerst het gemiddelde, kijk daarna hoe ver de waarden ervandaan liggen. Die afstand is de spreiding.' },
        { soort: 'praktijk', tekst: 'Een gemiddeld inkomen zegt weinig als een enkeling miljoenen verdient. Daarom staat er in het nieuws vaak ook de mediaan.' }],
      gen: { soort: 'gemiddelde', n: 3, max: 40 } },
    { id: 'wiskunde.vwo.vergelijkingen', naam: 'Vergelijkingen met grotere getallen', ref: '4F',
      fasen: ['vwo'],
      les: 'Dezelfde stappen als bij eenvoudige vergelijkingen, maar met grotere getallen en meer termen. Werk netjes en schrijf elke stap op.',
      vereist: ['wiskunde.havo.lineair'],
      uitleg: [
        { soort: 'stap', tekst: 'Vereenvoudig eerst beide kanten apart (haakjes weg, gelijksoortige termen samen) en pas daarna de balans gebruiken.' },
        { soort: 'eenvoudig', tekst: 'Elke stap opschrijven kost tijd en levert punten op: een fout die je niet ziet, kun je ook niet herstellen.' }],
      gen: { soort: 'vergelijking', maxA: 15, maxX: 30 } },
    { id: 'wiskunde.vwo.machten', naam: 'Machten en wortels', ref: '4F',
      fasen: ['vwo'],
      les: 'Een macht is herhaald vermenigvuldigen: 2^5 is 2 x 2 x 2 x 2 x 2. Worteltrekken is de omgekeerde beweging.',
      vereist: ['rekenen.g8.kwadraten'],
      uitleg: [
        { soort: 'stap', tekst: 'Machten met hetzelfde grondtal vermenigvuldig je door de exponenten op te tellen: 2^3 x 2^4 is 2^7.' },
        { soort: 'praktijk', tekst: 'Groei bij rente op rente, bacterien of het aantal bytes in een bestand: allemaal machten. Daarom groeit dat zo veel sneller dan je verwacht.' }],
      gen: { soort: 'macht', max: 10, maxExp: 3 } }
  ]}
];
