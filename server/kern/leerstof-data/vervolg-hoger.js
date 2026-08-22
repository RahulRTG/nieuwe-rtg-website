/* RTG School, leerlijn vervolgonderwijs: het hbo en het wo: onderzoek en statistiek.
   Zelfde vorm als de VO-leerlijn: blokken per vak met de fasen waarvoor ze
   gelden. Beroeps- en studievaardigheden in plaats van schoolvakken. */
const MBO = ['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4'];
const HBO = ['hbo-ad', 'hbo-b', 'hbo-m'];
const WO = ['wo-b', 'wo-m', 'wo-phd'];

module.exports.VERVOLG_HOGER = [

  { vak: 'onderzoek', fasen: HBO, doelen: [
    { id: 'onderzoek.hbo.bronnen', naam: 'Bronnen wegen', ref: '4F',
      vereist: ['geschiedenis.vo.bronnen'],
      les: 'Een sterke bron is te herleiden (auteur en datum bekend), te controleren (verwijst zelf naar bronnen) en zo dicht mogelijk bij de oorsprong. Een mening is geen meting.',
      uitleg: [
        { soort: 'stap', tekst: 'Drie vragen per bron: wie zegt het, waarop baseert hij zich, en wat heeft hij erbij te winnen? Pas daarna telt de inhoud.' },
        { soort: 'praktijk', tekst: 'Spreken twee bronnen elkaar tegen, zoek dan een derde die onafhankelijk is van beide. Kiezen wat het beste uitkomt is geen onderzoek.' }],
      gen: { soort: 'indeling', vraag: 'Hoe sterk is %s als bron?',
        groepen: { 'sterk': ['een peer-reviewed onderzoek met data', 'een officieel register', 'een primaire meting'],
          'bruikbaar met voorbehoud': ['een nieuwsartikel met bronvermelding', 'een rapport van een belangenclub', 'een expertinterview'],
          'zwak': ['een anonieme post', 'een reclamefolder', 'een bron zonder datum of auteur'] } } },
    { id: 'statistiek.hbo.gemiddelde', naam: 'Beschrijvende statistiek', ref: '4F',
      vereist: ['wiskunde.havo.statistiek'],
      les: 'Het gemiddelde vertelt het midden, maar niet het hele verhaal: kijk ook naar de spreiding en naar uitschieters voordat je een conclusie trekt.',
      uitleg: [
        { soort: 'stap', tekst: 'Rapporteer altijd drie dingen samen: het midden (gemiddelde of mediaan), de spreiding, en het aantal waarnemingen.' },
        { soort: 'praktijk', tekst: 'Een gemiddelde zonder spreiding is de klassieke misleiding: twee groepen met hetzelfde gemiddelde kunnen totaal verschillend zijn.' }],
      gen: { soort: 'gemiddelde', max: 100 } }
  ]},
  { vak: 'wetenschap', fasen: WO, doelen: [
    { id: 'wetenschap.wo.methode', naam: 'De wetenschappelijke methode', ref: '4F',
      vereist: ['onderzoek.hbo.bronnen'],
      les: 'Een hypothese is pas wetenschappelijk als hij te weerleggen is. Je toetst met een controlegroep, en correlatie is nog geen oorzakelijk verband.',
      uitleg: [
        { soort: 'stap', tekst: 'Formuleer wat je zou zien als je ONGELIJK hebt. Kun je dat niet, dan is je hypothese niet toetsbaar en dus geen hypothese.' },
        { soort: 'praktijk', tekst: 'IJsverkoop en verdrinkingen stijgen samen. Niet omdat het een het ander veroorzaakt, maar omdat het in beide gevallen zomer is.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'toetsbare hypothese': ['deze pil verlaagt de bloeddruk meer dan een placebo', 'meer licht geeft snellere groei', 'groep A onthoudt meer dan groep B'],
          'niet toetsbaar': ['alles gebeurt met een reden', 'dit medicijn werkt bij wie erin gelooft', 'de natuur wil het zo'],
          'denkfout': ['correlatie als oorzaak lezen', 'alleen bevestigend bewijs zoeken', 'conclusie trekken zonder controlegroep'] } } },
    { id: 'statistiek.wo.begrippen', naam: 'Statistische kernbegrippen', ref: '4F',
      vereist: ['statistiek.hbo.gemiddelde'],
      les: 'De mediaan is het middelste getal en trekt zich niets aan van uitschieters; het gemiddelde wel. Een grotere steekproef maakt een schatting stabieler, niet automatisch juister.',
      uitleg: [
        { soort: 'stap', tekst: 'Scheve verdeling? Rapporteer de mediaan. Symmetrisch? Het gemiddelde mag. En noem altijd de spreiding erbij.' },
        { soort: 'praktijk', tekst: 'Een steekproef van tienduizend vrijwilligers uit een forum is minder waard dan duizend willekeurig getrokken mensen. Representativiteit gaat voor omvang.' }],
      gen: { soort: 'koppel', vraag: 'Wat betekent %s?',
        paren: [['de mediaan', 'het middelste getal, ongevoelig voor uitschieters'],
          ['de standaarddeviatie', 'hoe ver waarden gemiddeld van het gemiddelde liggen'],
          ['significant', 'waarschijnlijk geen toeval'], ['representatief', 'de steekproef lijkt op de populatie'],
          ['een uitschieter', 'een waarde die ver buiten de rest ligt'],
          ['de p-waarde', 'de kans op dit resultaat als er geen effect is']] } }
  ]}
];
