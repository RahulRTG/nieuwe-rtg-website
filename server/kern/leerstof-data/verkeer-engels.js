/* RTG School, leerlijn verkeer en Engels (basisschool). Hoort bij
   ./natuur.js; zelfde opzet met tabellen in plaats van vaste vragen.

   Verkeer gaat over regels die je op straat nodig hebt, niet over het
   theorie-examen: wie moet wachten, wat betekent dit bord, en wat doe je bij
   twijfel. Engels begint bij woorden die een kind al kent uit spelletjes en
   liedjes, en gaat naar korte zinnen die je echt gebruikt. */
module.exports.VERKEER = [
  { groep: 4, doelen: [
    { id: 'verkeer.g4.oversteken', naam: 'Veilig oversteken',
      les: 'Stop bij de stoeprand, kijk links, rechts en nog eens links, en steek pas over als er niets aankomt. Op het zebrapad moet verkeer stoppen, maar kijk toch.',
      uitleg: [
        { soort: 'stap', tekst: 'Vier stappen: stoppen, kijken, luisteren, lopen. Loop recht over en ren niet -- rennen maakt je juist minder goed te zien.' },
        { soort: 'praktijk', tekst: 'Tussen geparkeerde auto\'s door oversteken is het gevaarlijkst: jij ziet het verkeer niet en het verkeer ziet jou niet.' }],
      gen: { soort: 'koppel', vraag: 'Wat doe je bij %s?',
        paren: [['een zebrapad', 'kijken en dan oversteken'], ['een stoplicht op rood', 'wachten'],
          ['een stoplicht op groen', 'kijken en dan lopen'], ['geparkeerde auto\'s', 'ergens anders oversteken'],
          ['een drukke weg', 'zoeken naar een oversteekplaats'], ['een fietspad', 'ook daar eerst kijken']] } }
  ]},
  { groep: 5, doelen: [
    { id: 'verkeer.g5.fietsen', naam: 'Veilig fietsen',
      les: 'Rechts houden, hand uitsteken voor je afslaat, en een werkende bel en verlichting. Op de fiets ben je snel maar ook kwetsbaar.',
      vereist: ['verkeer.g4.oversteken'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk om voordat je je hand uitsteekt, en steek uit voordat je stuurt. Eerst kijken, dan aangeven, dan pas draaien.' },
        { soort: 'praktijk', tekst: 'Licht is geen versiering: zonder licht zie een automobilist je pas op tien meter. Met licht op meer dan honderd.' }],
      gen: { soort: 'koppel', vraag: 'Waarom is %s belangrijk op de fiets?',
        paren: [['licht', 'zodat anderen je zien'], ['je hand uitsteken', 'aangeven waar je heen gaat'],
          ['omkijken', 'zien of er iemand achter je rijdt'], ['rechts houden', 'ruimte laten voor inhalen'],
          ['een bel', 'waarschuwen zonder te schrikken'], ['remmen controleren', 'op tijd kunnen stoppen']] } }
  ]},
  { groep: 6, doelen: [
    { id: 'verkeer.g6.borden', naam: 'Verkeersborden lezen',
      les: 'Ronde borden met rood zijn verboden, blauwe ronde borden zijn geboden, driehoeken waarschuwen en rechthoeken geven informatie. De vorm zegt al veel.',
      vereist: ['verkeer.g5.fietsen'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk eerst naar de vorm en de kleur, dan pas naar het plaatje. Rood en rond: het mag niet. Blauw en rond: het moet.' },
        { soort: 'visueel', tekst: 'Een driehoek met de punt naar boven waarschuwt; een omgekeerde driehoek betekent haaientanden: jij verleent voorrang.' }],
      gen: { soort: 'indeling', vraag: 'Wat voor bord is %s?',
        groepen: { 'verbod': ['rond met rode rand', 'eenrichtingsweg gesloten', 'inrijden verboden'],
          'gebod': ['blauw en rond', 'verplicht fietspad', 'rotonde volgen'],
          'waarschuwing': ['driehoek met rode rand', 'gevaarlijke bocht', 'overstekend wild'] } } },
    { id: 'verkeer.g6.voorrang', naam: 'Voorrang: wie mag eerst',
      les: 'Op een gelijkwaardig kruispunt heeft verkeer van rechts voorrang. Haaientanden betekenen dat jij moet wachten; bestuurders die afslaan laten rechtdoorgaand verkeer voor.',
      vereist: ['verkeer.g6.borden'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk eerst of er borden of haaientanden staan. Zo niet, dan geldt de hoofdregel: rechts gaat voor.' },
        { soort: 'eenvoudig', tekst: 'Voorrang krijg je nooit, je neemt hem ook niet. Je kunt hem alleen verlenen -- en bij twijfel doe je dat.' }],
      gen: { soort: 'koppel', vraag: 'Wie moet wachten bij %s?',
        paren: [['haaientanden op straat', 'jij, want jij verleent voorrang'],
          ['een gelijkwaardig kruispunt', 'wie verkeer van rechts heeft'],
          ['een voorrangsweg', 'wie de voorrangsweg op wil'],
          ['een rotonde met haaientanden', 'wie de rotonde op wil'],
          ['een stoplicht op rood', 'iedereen die rood heeft'],
          ['afslaan terwijl er een fietser rechtdoor gaat', 'de bestuurder die afslaat']] } }
  ]},
  { groep: 7, doelen: [
    { id: 'verkeer.g7.examen', naam: 'Klaar voor het verkeersexamen',
      les: 'Het verkeersexamen vraagt drie dingen: de regels kennen, ze op straat toepassen, en vooruitkijken naar wat er kan gebeuren.',
      vereist: ['verkeer.g6.voorrang'],
      uitleg: [
        { soort: 'stap', tekst: 'Rijd de route van tevoren een keer met een volwassene en bespreek bij elk kruispunt hardop wat je doet en waarom.' },
        { soort: 'praktijk', tekst: 'De meeste fouten zijn geen kennisfouten maar kijkfouten: niet omkijken, niet aangeven, of te dicht langs geparkeerde auto\'s.' }],
      gen: { soort: 'koppel', vraag: 'Wat doe je als %s?',
        paren: [['je linksaf wilt', 'omkijken, hand uitsteken, dan pas sturen'],
          ['een auto rechts van je komt op een gelijk kruispunt', 'hem voor laten gaan'],
          ['je een deur van een geparkeerde auto ziet opengaan', 'afremmen en ruimte houden'],
          ['het stoplicht op oranje springt', 'stoppen als dat veilig kan'],
          ['je twijfelt over voorrang', 'wachten en oogcontact zoeken'],
          ['je met meerdere fietsers rijdt', 'hooguit met zijn tweeen naast elkaar']] } }
  ]}
];

const WOORDEN = [
  ['hond', 'dog'], ['kat', 'cat'], ['huis', 'house'], ['school', 'school'], ['boek', 'book'],
  ['water', 'water'], ['vriend', 'friend'], ['broer', 'brother'], ['zus', 'sister'], ['stad', 'city'],
  ['brood', 'bread'], ['fiets', 'bike'], ['boom', 'tree'], ['dag', 'day'], ['nacht', 'night'],
  ['groot', 'big'], ['klein', 'small'], ['snel', 'fast'], ['moeilijk', 'difficult'], ['makkelijk', 'easy'],
  ['lopen', 'to walk'], ['eten', 'to eat'], ['lezen', 'to read'], ['slapen', 'to sleep'], ['spelen', 'to play']
];

module.exports.ENGELS_PO = [
  { groep: 7, doelen: [
    { id: 'engels.g7.woorden', naam: 'Engelse woorden om te beginnen',
      les: 'Veel Engelse woorden lijken op het Nederlands: water is water, school is school. Andere moet je leren: hond is dog, boek is book.',
      uitleg: [
        { soort: 'praktijk', tekst: 'Je kent al meer Engels dan je denkt: uit spelletjes, liedjes en filmpjes. Let er een dag op en tel hoeveel woorden je herkent.' },
        { soort: 'stap', tekst: 'Leer woorden in paren en oefen beide kanten op: van Nederlands naar Engels en terug. Alleen herkennen is niet genoeg om zelf te praten.' }],
      gen: { soort: 'koppel', vraag: 'Wat is "%s" in het Engels?', terug: 'Wat betekent "%s"?', paren: WOORDEN } },
    { id: 'engels.g7.getallen', naam: 'Getallen, kleuren en dagen',
      les: 'One, two, three; red, blue, green; Monday, Tuesday. Dit zijn de woorden die je in elk gesprek en elk spel tegenkomt.',
      vereist: ['engels.g7.woorden'],
      uitleg: [
        { soort: 'stap', tekst: 'De dagen en maanden krijgen in het Engels altijd een hoofdletter: Monday, September. In het Nederlands juist niet.' },
        { soort: 'praktijk', tekst: 'Tel in het Engels bij het traplopen of het opruimen. Getallen leer je door ze te gebruiken, niet door ze op te schrijven.' }],
      gen: { soort: 'koppel', vraag: 'Wat is "%s" in het Engels?', terug: 'Wat betekent "%s"?',
        paren: [['drie', 'three'], ['zeven', 'seven'], ['twaalf', 'twelve'], ['twintig', 'twenty'],
          ['rood', 'red'], ['blauw', 'blue'], ['groen', 'green'], ['geel', 'yellow'],
          ['maandag', 'Monday'], ['woensdag', 'Wednesday'], ['zaterdag', 'Saturday'], ['zondag', 'Sunday']] } }
  ]},
  { groep: 8, doelen: [
    { id: 'engels.g8.zinnen', naam: 'Korte Engelse zinnen',
      les: 'Met een paar vaste zinnen kom je ver: "My name is...", "I am twelve years old", "Where is the station?", "I do not understand".',
      vereist: ['engels.g7.getallen'],
      uitleg: [
        { soort: 'stap', tekst: 'Leer hele zinnen in plaats van losse woorden. Een zin die je kunt zeggen, is bruikbaarder dan tien woorden die je herkent.' },
        { soort: 'praktijk', tekst: '"Sorry, I do not understand. Can you repeat that?" is de nuttigste zin van allemaal: daarmee kom je uit elk gesprek verder.' }],
      gen: { soort: 'koppel', vraag: 'Hoe zeg je "%s" in het Engels?', terug: 'Wat betekent "%s"?',
        paren: [['Ik heet Sam', 'My name is Sam'], ['Ik ben twaalf jaar', 'I am twelve years old'],
          ['Waar is het station?', 'Where is the station?'], ['Ik begrijp het niet', 'I do not understand'],
          ['Hoeveel kost dit?', 'How much is this?'], ['Kunt u dat herhalen?', 'Can you repeat that?'],
          ['Ik kom uit Nederland', 'I am from the Netherlands'], ['Mag ik naar de wc?', 'May I go to the toilet?']] } },
    { id: 'engels.g8.werkwoorden', naam: 'Engelse werkwoorden in het nu',
      les: 'I walk, you walk, he walks: bij he, she en it komt er een s bij. Dat ene kleine verschil is de eerste echte grammaticaregel van het Engels.',
      vereist: ['engels.g8.zinnen'],
      uitleg: [
        { soort: 'analogie', tekst: 'Het lijkt op de t in het Nederlands: ik loop, hij loopt. In het Engels is het een s, en alleen bij he, she en it.' },
        { soort: 'stap', tekst: 'Twijfel je? Zeg de zin met "he" ervoor. Hoort daar een s achter het werkwoord, dan is dat de vorm die je nodig hebt.' }],
      gen: { soort: 'koppel', vraag: 'Wat is de goede vorm: %s', terug: 'Bij welke zin hoort "%s"?',
        paren: [['I ... (to walk)', 'walk'], ['he ... (to walk)', 'walks'], ['she ... (to read)', 'reads'],
          ['we ... (to play)', 'play'], ['it ... (to eat)', 'eats'], ['they ... (to sleep)', 'sleep']] } }
  ]}
];
