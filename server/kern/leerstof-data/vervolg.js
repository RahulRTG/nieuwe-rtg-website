/* RTG School, leerlijn vervolgonderwijs: mbo (beroepsgericht), hbo en wo.
   Zelfde vorm als de VO-leerlijn: blokken per vak met de fasen waarvoor ze
   gelden. Beroeps- en studievaardigheden in plaats van schoolvakken. */
const MBO = ['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4'];
const HBO = ['hbo-ad', 'hbo-b', 'hbo-m'];
const WO = ['wo-b', 'wo-m', 'wo-phd'];

module.exports.VERVOLG = [
  { vak: 'rekenen', fasen: MBO, doelen: [
    /* De voorkennis wijst hier naar de basisschool, en dat is geen slordigheid
       maar het punt van een graaf: een mbo'er die vastloopt op beroepsrekenen
       mist meestal geen beroepsuitleg maar de verhoudingstabel uit groep 7.
       De motor mag dat zeggen in plaats van meer van hetzelfde te geven. */
    { id: 'rekenen.mbo.beroep', naam: 'Rekenen op de werkvloer', ref: '2F',
      vereist: ['rekenen.g8.verhoudingen-procent'],
      les: 'Beroepsrekenen is verhoudingen: weet je de prijs of hoeveelheid van 1, dan kun je alles schalen. Reken altijd eerst terug naar 1.',
      uitleg: [
        { soort: 'stap', tekst: 'Zet de gegevens in twee rijen en reken eerst terug naar een stuk, een meter of een uur. Vanaf een is elke hoeveelheid een keersom.' },
        { soort: 'praktijk', tekst: 'Materiaal bestellen, een offerte narekenen, een receptuur opschalen: het is telkens dezelfde tabel met andere woorden erboven.' }],
      gen: { soort: 'verhouding', max: 60 } },
    { id: 'rekenen.mbo.geld', naam: 'Geldzaken en wisselgeld', ref: '2F',
      vereist: ['rekenen.g8.procenten-komma-breuk'],
      les: 'Tel terug vanaf het betaalde bedrag: van de prijs naar het ronde tientje, dan naar het betaalde bedrag. Zo klopt de kassa altijd.',
      uitleg: [
        { soort: 'stap', tekst: 'Ga van de prijs naar het eerstvolgende hele bedrag, dan met hele euro\'s naar het betaalde bedrag. Alles wat je onderweg optelde, is het wisselgeld.' },
        { soort: 'praktijk', tekst: 'Btw, korting en een fooi zijn procenten van een bedrag; het rijtje 10%, 5% en 1% is aan de kassa genoeg om alles uit het hoofd te doen.' }],
      gen: { soort: 'geld', max: 50 } }
  ]},
  { vak: 'burgerschap', fasen: MBO, doelen: [
    { id: 'burgerschap.mbo.kennis', naam: 'Burgerschap: hoe het land werkt', ref: '2F',
      les: 'De Tweede Kamer maakt wetten en controleert de regering; de rechter toetst onafhankelijk; de gemeente regelt wat dichtbij is, van paspoort tot vergunning.',
      gen: { soort: 'mc', vragen: [
        ['Wie controleert de regering?', 'de Tweede Kamer', 'de politie', 'de burgemeester'],
        ['Waar haal je een paspoort?', 'bij de gemeente', 'bij de provincie', 'bij de rechtbank'],
        ['Wie spreekt recht in Nederland?', 'een onafhankelijke rechter', 'de minister', 'de Eerste Kamer'],
        ['Verkiezingen voor de Tweede Kamer zijn normaal elke:', 'vier jaar', 'twee jaar', 'zes jaar']
      ] } }
  ]},
  { vak: 'onderzoek', fasen: HBO, doelen: [
    { id: 'onderzoek.hbo.bronnen', naam: 'Bronnen wegen', ref: '4F',
      les: 'Een sterke bron is te herleiden (auteur en datum bekend), te controleren (verwijst zelf naar bronnen) en zo dicht mogelijk bij de oorsprong. Een mening is geen meting.',
      gen: { soort: 'mc', vragen: [
        ['Welke bron is voor onderzoek het sterkst?', 'een gepubliceerd onderzoek met methode en data', 'een anonieme post', 'een reclamefolder'],
        ['Wat maakt een bron controleerbaar?', 'verwijzingen naar de onderliggende bronnen', 'veel lezers', 'een mooie opmaak'],
        ['Een primaire bron is:', 'het oorspronkelijke materiaal zelf', 'een samenvatting ervan', 'een mening erover'],
        ['Twee bronnen spreken elkaar tegen. Wat doe je?', 'een derde, onafhankelijke bron zoeken', 'de leukste kiezen', 'beide negeren']
      ] } },
    { id: 'statistiek.hbo.gemiddelde', naam: 'Beschrijvende statistiek', ref: '4F',
      les: 'Het gemiddelde vertelt het midden, maar niet het hele verhaal: kijk ook naar de spreiding en naar uitschieters voordat je een conclusie trekt.',
      gen: { soort: 'gemiddelde', max: 100 } }
  ]},
  { vak: 'wetenschap', fasen: WO, doelen: [
    { id: 'wetenschap.wo.methode', naam: 'De wetenschappelijke methode', ref: '4F',
      les: 'Een hypothese is pas wetenschappelijk als hij te weerleggen is. Je toetst met een controlegroep, en correlatie is nog geen oorzakelijk verband.',
      gen: { soort: 'mc', vragen: [
        ['Een goede hypothese is:', 'toetsbaar en te weerleggen', 'altijd waar', 'een mening van een expert'],
        ['Waarvoor dient een controlegroep?', 'om het effect met iets te kunnen vergelijken', 'om sneller klaar te zijn', 'om meer deelnemers te hebben'],
        ['Correlatie betekent:', 'dat twee dingen samen bewegen', 'dat het een het ander veroorzaakt', 'dat het toeval bewezen is'],
        ['Peer review is:', 'toetsing door onafhankelijke vakgenoten', 'een stemming onder studenten', 'een samenvatting door de auteur']
      ] } },
    { id: 'statistiek.wo.begrippen', naam: 'Statistische kernbegrippen', ref: '4F',
      les: 'De mediaan is het middelste getal en trekt zich niets aan van uitschieters; het gemiddelde wel. Een grotere steekproef maakt een schatting stabieler, niet automatisch juister.',
      gen: { soort: 'mc', vragen: [
        ['Welke maat is ongevoelig voor uitschieters?', 'de mediaan', 'het gemiddelde', 'de som'],
        ['Een grotere steekproef maakt een schatting:', 'stabieler', 'altijd juist', 'overbodig'],
        ['Een steekproef moet vooral:', 'representatief zijn', 'zo groot mogelijk zijn', 'uit vrijwilligers bestaan'],
        ['"Significant" betekent in de statistiek:', 'waarschijnlijk geen toeval', 'belangrijk voor iedereen', 'groot van omvang']
      ] } }
  ]}
];
