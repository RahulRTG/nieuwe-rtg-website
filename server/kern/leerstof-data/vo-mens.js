/* RTG School, leerlijn voortgezet onderwijs: mens en maatschappij
   (geschiedenis, aardrijkskunde, maatschappijleer, economie, informatica).
   Zie de kop van ./vo-wiskunde.js voor de opzet.

   Bij deze vakken is de verleiding het grootst om meningen te toetsen. Dat
   gebeurt hier niet: wat te toetsen valt zijn begrippen, verbanden en
   jaartallen. Wat een leerling van de slavernij, van klimaatbeleid of van
   ongelijkheid vindt, hoort in een gesprek in de klas en niet in een
   meerkeuzevraag met een goed antwoord. */
const VMBO = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl'];
const ALLE_VO = VMBO.concat(['havo', 'vwo']);
const MBO = ['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4'];

const TIJDVAKKEN = [
  ['de jagers en boeren', -3000], ['de Grieken en Romeinen', -500], ['de monniken en ridders', 800],
  ['de steden en staten', 1300], ['de ontdekkers en hervormers', 1500], ['de regenten en vorsten', 1650],
  ['de pruiken en revoluties', 1750], ['de burgers en stoommachines', 1850],
  ['de wereldoorlogen', 1940], ['de televisie en computer', 1990]
];

module.exports.VO_MENS = [

  { vak: 'geschiedenis', fasen: ALLE_VO, doelen: [
    { id: 'geschiedenis.vo.tijdvakken', naam: 'De tien tijdvakken', ref: '2F',
      les: 'De Nederlandse geschiedenis is ingedeeld in tien tijdvakken, van jagers en boeren tot televisie en computer. Ze geven je een kapstok voor elk jaartal.',
      vereist: ['geschiedenis.g8.overzicht'],
      uitleg: [
        { soort: 'stap', tekst: 'Leer eerst de volgorde en pas daarna de jaartallen. Een gebeurtenis plaatsen in het juiste tijdvak is belangrijker dan het jaar op tien jaar nauwkeurig.' },
        { soort: 'analogie', tekst: 'De tijdvakken zijn de hoofdstukken van een boek. Je hoeft niet elke bladzijde te kennen om te weten in welk hoofdstuk iets staat.' }],
      gen: { soort: 'eerder', gebeurtenissen: TIJDVAKKEN } },
    { id: 'geschiedenis.vo.bronnen', naam: 'Bronnen en betrouwbaarheid', ref: '3F',
      fasen: ['havo', 'vwo'],
      les: 'Een primaire bron komt uit de tijd zelf, een secundaire is er later over geschreven. Beide kunnen gekleurd zijn: vraag altijd wie het schreef en waarom.',
      vereist: ['geschiedenis.vo.tijdvakken'],
      uitleg: [
        { soort: 'stap', tekst: 'Vier vragen bij elke bron: wie maakte hem, wanneer, voor wie, en met welk belang? Pas daarna telt wat er staat.' },
        { soort: 'praktijk', tekst: 'Een dagboek uit 1944 is een primaire bron, een geschiedenisboek uit 2020 een secundaire. Geen van beide is automatisch waar.' }],
      gen: { soort: 'indeling', vraag: 'Wat voor bron is %s?',
        groepen: { 'primaire bron': ['een dagboek uit de oorlog', 'een schilderij uit 1650', 'een brief van een soldaat'],
          'secundaire bron': ['een schoolboek', 'een documentaire van nu', 'een biografie uit 2020'],
          'geen betrouwbare bron': ['een anonieme post op sociale media', 'een reclamefilm', 'een gerucht'] } } }
  ]},

  { vak: 'aardrijkskunde', fasen: ALLE_VO, doelen: [
    { id: 'aardrijkskunde.vo.klimaat', naam: 'Klimaten en landschappen', ref: '2F',
      les: 'Het klimaat hangt af van de ligging ten opzichte van de evenaar, de hoogte en de zee. Daaruit volgt welke landbouw en welke steden er mogelijk zijn.',
      vereist: ['aardrijkskunde.g8.klimaat'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk eerst naar de breedtegraad, dan naar hoogte en zee. Die drie verklaren het grootste deel van elk klimaat op aarde.' },
        { soort: 'praktijk', tekst: 'Nederland heeft milde winters door de Golfstroom, terwijl Canada op dezelfde breedte streng vriest. De zee doet dus veel.' }],
      gen: { soort: 'koppel', vraag: 'Welk klimaat hoort bij %s?',
        paren: [['de evenaar', 'tropisch regenwoud'], ['de keerkringen', 'woestijn'],
          ['West-Europa', 'gematigd zeeklimaat'], ['Siberie', 'landklimaat met strenge winters'],
          ['de poolstreken', 'toendra en ijs'], ['de Middellandse Zee', 'droge zomers, natte winters']] } },
    { id: 'aardrijkskunde.vo.bevolking', naam: 'Bevolking en verstedelijking', ref: '3F',
      fasen: ['havo', 'vwo'],
      les: 'Mensen trekken naar plekken met werk, veiligheid en voorzieningen. Daardoor groeien steden en lopen sommige gebieden juist leeg.',
      vereist: ['aardrijkskunde.vo.klimaat'],
      uitleg: [
        { soort: 'stap', tekst: 'Push en pull: wat duwt mensen weg (droogte, oorlog, geen werk) en wat trekt aan (banen, veiligheid, onderwijs)?' },
        { soort: 'praktijk', tekst: 'In de Randstad stijgen de huizenprijzen terwijl in krimpgebieden scholen sluiten. Dat is dezelfde beweging, van twee kanten bekeken.' }],
      gen: { soort: 'indeling', vraag: 'Is %s een push- of een pullfactor?',
        groepen: { 'pushfactor (duwt weg)': ['langdurige droogte', 'oorlog', 'geen werk', 'onveiligheid'],
          'pullfactor (trekt aan)': ['banen', 'goed onderwijs', 'veiligheid', 'medische zorg'],
          'gevolg': ['verstedelijking', 'krimp op het platteland', 'files', 'woningtekort'] } } }
  ]},

  { vak: 'maatschappijleer', fasen: ALLE_VO, doelen: [
    { id: 'maatschappijleer.vo.rechtsstaat', naam: 'De rechtsstaat', ref: '2F',
      les: 'In een rechtsstaat geldt de wet voor iedereen, ook voor de overheid. De macht is verdeeld: wetgevend, uitvoerend en rechtsprekend.',
      vereist: ['geschiedenis.g8.democratie'],
      uitleg: [
        { soort: 'stap', tekst: 'Drie machten, drie taken: wetten maken, wetten uitvoeren, en rechtspreken. Elk houdt de andere twee in toom.' },
        { soort: 'praktijk', tekst: 'Als de politie je aanhoudt, gelden regels: je hebt recht op een advocaat, en de rechter beslist -- niet de agent.' }],
      gen: { soort: 'koppel', vraag: 'Wie of wat hoort bij %s?',
        paren: [['de wetgevende macht', 'de Tweede en Eerste Kamer'], ['de uitvoerende macht', 'de regering'],
          ['de rechtsprekende macht', 'de onafhankelijke rechter'], ['de grondwet', 'de basisregels van het land'],
          ['een advocaat', 'iemand die je bijstaat in een rechtszaak'], ['het OM', 'de partij die vervolgt namens de samenleving']] } },
    { id: 'maatschappijleer.vo.media', naam: 'Media en meningsvorming', ref: '3F',
      fasen: ['havo', 'vwo'],
      les: 'Nieuws is altijd een keuze: wat wordt getoond, door wie, en wat blijft weg. Een algoritme kiest bovendien voor jou wat je ziet.',
      vereist: ['maatschappijleer.vo.rechtsstaat'],
      uitleg: [
        { soort: 'stap', tekst: 'Vraag bij elk bericht: wie is de bron, wie betaalt hem, en wat wil hij dat ik doe? Drie vragen die de meeste onzin al zeven.' },
        { soort: 'praktijk', tekst: 'Twee mensen met dezelfde app zien een ander nieuwsoverzicht. Dat is geen toeval maar een algoritme dat op klikken stuurt.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'feit': ['de temperatuur van gisteren', 'de uitslag van de verkiezing', 'het aantal inwoners'],
          'mening': ['dit is de beste stad van Nederland', 'de belasting is te hoog', 'die film is saai'],
          'manipulatie': ['een kop die iets anders zegt dan het artikel', 'een grafiek die niet bij nul begint', 'een foto uit een ander jaar'] } } }
  ]}
];
