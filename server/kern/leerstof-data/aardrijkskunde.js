/* RTG School, leerlijn aardrijkskunde groep 4 t/m 8.

   De bestaande doelen draaiden op 'mc': vier handgeschreven vragen per doel,
   en na twee sessies ken je die vier. Ze staan er nog met dezelfde id -- het
   leerpaspoort verwijst ernaar -- maar putten nu uit een TABEL. Twaalf
   provincies met hun hoofdstad zijn twaalf vragen heen en twaalf terug, en de
   afleiders komen uit dezelfde tabel.

   De topografie is bewust beperkt tot wat een basisschool ook echt behandelt:
   de provincies met hun hoofdsteden, de buurlanden, de grote Europese
   hoofdsteden, de werelddelen en de oceanen. */
const PROVINCIES = [
  ['Groningen', 'Groningen'], ['Friesland', 'Leeuwarden'], ['Drenthe', 'Assen'],
  ['Overijssel', 'Zwolle'], ['Flevoland', 'Lelystad'], ['Gelderland', 'Arnhem'],
  ['Utrecht', 'Utrecht'], ['Noord-Holland', 'Haarlem'], ['Zuid-Holland', 'Den Haag'],
  ['Zeeland', 'Middelburg'], ['Noord-Brabant', "'s-Hertogenbosch"], ['Limburg', 'Maastricht']
];
const EUROPA = [
  ['Frankrijk', 'Parijs'], ['Duitsland', 'Berlijn'], ['Spanje', 'Madrid'], ['Italie', 'Rome'],
  ['Belgie', 'Brussel'], ['Portugal', 'Lissabon'], ['Polen', 'Warschau'], ['Griekenland', 'Athene'],
  ['Oostenrijk', 'Wenen'], ['Zweden', 'Stockholm'], ['Noorwegen', 'Oslo'], ['Denemarken', 'Kopenhagen'],
  ['Ierland', 'Dublin'], ['Hongarije', 'Boedapest'], ['Tsjechie', 'Praag']
];

module.exports.AARDRIJKSKUNDE = [
  { groep: 4, doelen: [
    { id: 'aardrijkskunde.g4.plattegrond', naam: 'De plattegrond van je omgeving',
      les: 'Een plattegrond kijkt van bovenaf naar de wereld. Wegen worden lijnen, gebouwen worden blokjes, water is blauw en groen is park of bos.',
      uitleg: [
        { soort: 'visueel', tekst: 'Stel je voor dat je als een vogel boven je straat vliegt. Wat je dan ziet, is precies wat er op de plattegrond staat.' },
        { soort: 'praktijk', tekst: 'Zoek je eigen school op een kaart in de telefoon. Herken je het schoolplein, de weg ernaartoe en het water in de buurt?' }],
      gen: { soort: 'koppel', vraag: 'Wat betekent %s op een plattegrond?',
        paren: [['blauw', 'water'], ['groen', 'park of bos'], ['een dikke lijn', 'een grote weg'],
          ['een blokje', 'een gebouw'], ['een stippellijn', 'een wandelpad'], ['een kruisje', 'een kerk']] } }
  ]},

  { groep: 5, doelen: [
    { id: 'aardrijkskunde.g5.provincies', naam: 'De twaalf provincies',
      les: 'Nederland heeft twaalf provincies, elk met een hoofdstad. Amsterdam is de hoofdstad van het land, maar de regering zit in Den Haag.',
      vereist: ['aardrijkskunde.g4.plattegrond'],
      uitleg: [
        { soort: 'stap', tekst: 'Leer ze van noord naar zuid: Groningen, Friesland, Drenthe, Overijssel, Flevoland, Gelderland, Utrecht, de twee Hollanden, Zeeland, Brabant, Limburg.' },
        { soort: 'eenvoudig', tekst: 'Let op de instinkers: de hoofdstad van Noord-Holland is Haarlem en niet Amsterdam, en die van Gelderland is Arnhem en niet Nijmegen.' }],
      gen: { soort: 'koppel', vraag: 'Wat is de hoofdstad van %s?', terug: 'Van welke provincie is %s de hoofdstad?', paren: PROVINCIES } },
    { id: 'aardrijkskunde.g5.water', naam: 'Water in Nederland',
      les: 'Nederland ligt laag en leeft met water: de Rijn, de Maas en de Waal stromen naar zee, en dijken en duinen houden de zee tegen.',
      vereist: ['aardrijkskunde.g5.provincies'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Een kwart van Nederland ligt onder zeeniveau. Zonder dijken, duinen en gemalen zou je in grote delen van het land natte voeten hebben.' },
        { soort: 'verhaal', tekst: 'Na de watersnoodramp van 1953 zijn de Deltawerken gebouwd: dammen en keringen die de zee buiten houden.' }],
      gen: { soort: 'koppel', vraag: 'Wat is %s?',
        paren: [['de Rijn', 'een rivier'], ['de Waddenzee', 'een zee'], ['het IJsselmeer', 'een meer'],
          ['een dijk', 'een wal die water tegenhoudt'], ['een gemaal', 'een pomp die water wegpompt'],
          ['de Deltawerken', 'dammen tegen de zee']] } }
  ]},

  { groep: 6, doelen: [
    { id: 'aardrijkskunde.g6.kaartlezen', naam: 'Kaartlezen en windrichtingen',
      les: 'Op een kaart is het noorden bijna altijd boven. De vier hoofdwindrichtingen zijn noord, oost, zuid en west; onthoud ze met "Nooit Opstaan Zonder Wekker".',
      vereist: ['aardrijkskunde.g4.plattegrond'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet de kaart met het noorden naar boven. Rechts is dan oost, onder is zuid en links is west.' },
        { soort: 'praktijk', tekst: 'De zon komt op in het oosten en gaat onder in het westen. Daarmee weet je buiten altijd hoe je staat, ook zonder kompas.' }],
      gen: { soort: 'koppel', vraag: 'Wat hoort bij %s?',
        paren: [['noord', 'boven op de kaart'], ['oost', 'waar de zon opkomt'], ['west', 'waar de zon ondergaat'],
          ['zuid', 'onder op de kaart'], ['de legenda', 'de uitleg van de tekens'], ['de schaal', 'hoeveel keer verkleind']] } },
    { id: 'aardrijkskunde.g6.landschappen', naam: 'Landschappen van Nederland',
      les: 'Zand, klei en veen: de grond bepaalt het landschap en wat er groeit. In het oosten zand en bos, in het westen klei en weiland, in het noorden veen.',
      vereist: ['aardrijkskunde.g5.water'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk naar de bodem en je weet wat er gebeurt: op klei groeit gras voor koeien, op zand groeien bos en heide, op veen is turf gestoken.' },
        { soort: 'verhaal', tekst: 'De polders zijn drooggelegde meren en zeearmen. Flevoland lag nog geen honderd jaar geleden onder water.' }],
      gen: { soort: 'indeling', vraag: 'Bij welk landschap hoort %s?',
        groepen: { 'zandgrond': ['de Veluwe', 'de heide', 'een naaldbos'],
          'kleigrond': ['de polder', 'het weiland met koeien', 'de Betuwe met fruit'],
          'veengrond': ['het turfgebied', 'het laagveenmoeras', 'de Drentse venen'] } } }
  ]},

  { groep: 7, doelen: [
    { id: 'aardrijkskunde.g7.europa', naam: 'Europa: landen en hoofdsteden',
      les: 'Europa telt tientallen landen. Onze buren zijn Duitsland en Belgie; Parijs, Berlijn, Madrid en Rome zijn hoofdsteden van grote landen.',
      vereist: ['aardrijkskunde.g5.provincies'],
      uitleg: [
        { soort: 'stap', tekst: 'Leer eerst de buurlanden en de grote landen. Daarna de landen eromheen, en pas dan de kleine.' },
        { soort: 'praktijk', tekst: 'Kijk op het weerbericht of bij een voetbaltoernooi naar de kaart. Landen die je vaak ziet, onthoud je zonder ze te stampen.' }],
      gen: { soort: 'koppel', vraag: 'Wat is de hoofdstad van %s?', terug: 'Van welk land is %s de hoofdstad?', paren: EUROPA } },
    { id: 'aardrijkskunde.g7.europa-natuur', naam: 'Europa: rivieren, bergen en zeeen',
      les: 'De Alpen liggen in het midden, de grote rivieren stromen ervandaan. De Middellandse Zee ligt in het zuiden, de Noordzee bij ons.',
      vereist: ['aardrijkskunde.g7.europa'],
      uitleg: [
        { soort: 'stap', tekst: 'Rivieren stromen van hoog naar laag. Zoek op de kaart eerst de bergen; de rivieren lopen daar vandaan naar de zee.' },
        { soort: 'praktijk', tekst: 'De Rijn begint in de Zwitserse Alpen en komt bij Rotterdam in zee. Daarom is Rotterdam zo\'n grote haven.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'gebergte': ['de Alpen', 'de Pyreneeen', 'de Karpaten'],
          'rivier': ['de Rijn', 'de Donau', 'de Seine'],
          'zee': ['de Noordzee', 'de Middellandse Zee', 'de Oostzee'] } } }
  ]},

  { groep: 8, doelen: [
    { id: 'aardrijkskunde.g8.wereld', naam: 'De wereld: continenten en oceanen',
      les: 'De aarde heeft zeven werelddelen en vijf oceanen. Europa is klein; Azie is verreweg het grootst en heeft de meeste inwoners.',
      vereist: ['aardrijkskunde.g7.europa'],
      uitleg: [
        { soort: 'stap', tekst: 'Begin bij de wereldkaart als geheel: eerst de werelddelen, dan de oceanen ertussen, en pas daarna losse landen.' },
        { soort: 'eenvoudig', tekst: 'Oceanen liggen tussen de werelddelen in. De Stille Oceaan is de grootste; de Atlantische ligt tussen Europa en Amerika.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'werelddeel': ['Azie', 'Afrika', 'Zuid-Amerika', 'Australie', 'Antarctica'],
          'oceaan': ['de Stille Oceaan', 'de Atlantische Oceaan', 'de Indische Oceaan'],
          'land': ['Brazilie', 'Japan', 'Egypte', 'Canada'] } } },
    { id: 'aardrijkskunde.g8.klimaat', naam: 'Klimaat en weer',
      les: 'Weer is wat er vandaag gebeurt, klimaat is wat er meestal gebeurt. Bij de evenaar is het warm en nat, bij de polen koud en droog.',
      vereist: ['aardrijkskunde.g8.wereld'],
      uitleg: [
        { soort: 'analogie', tekst: 'Weer is je humeur van vandaag, klimaat is je karakter. Een koude dag in juli verandert het klimaat niet.' },
        { soort: 'stap', tekst: 'Hoe dichter bij de evenaar, hoe meer zon er recht op valt en hoe warmer het is. Hoe hoger of hoe dichter bij de polen, hoe kouder.' }],
      gen: { soort: 'koppel', vraag: 'Welk klimaat hoort bij %s?',
        paren: [['de evenaar', 'warm en nat het hele jaar'], ['de Sahara', 'heet en droog'],
          ['Nederland', 'gematigd, met vier seizoenen'], ['de Noordpool', 'koud het hele jaar'],
          ['de hoge bergen', 'kouder naarmate je hoger komt'], ['de Middellandse Zee', 'droge warme zomers, milde winters']] } }
  ]}
];
