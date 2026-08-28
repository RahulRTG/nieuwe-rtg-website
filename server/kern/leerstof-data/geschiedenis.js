/* RTG School, leerlijn geschiedenis groep 5 t/m 8.

   De bestaande doelen (zelfde ids) draaiden op vier handgeschreven
   meerkeuzevragen. Nu putten ze uit tabellen: gedateerde gebeurtenissen leveren
   honderden "wat was eerder"-vragen, en de eeuw-generator laat een kind
   rekenen met jaartallen in plaats van ze op te dreunen.

   Wat er bewust NIET in staat: oordelen. De slavernij, de wereldoorlogen en de
   dekolonisatie staan er met feiten en jaartallen; wat een kind ervan vindt,
   is een gesprek in de klas en geen meerkeuzevraag. */
const GEBEURTENISSEN = [
  ['de eerste boeren in Nederland', -5000], ['de hunebedden', -3000],
  ['de Romeinen in Nederland', 50], ['Karel de Grote', 800],
  ['de eerste steden met stadsrechten', 1250], ['de pest in Europa', 1350],
  ['de boekdrukkunst van Gutenberg', 1450], ['de Tachtigjarige Oorlog', 1568],
  ['de VOC', 1602], ['de Gouden Eeuw', 1650], ['de Franse Revolutie', 1789],
  ['de afschaffing van de slavernij in Suriname', 1863], ['de eerste trein in Nederland', 1839],
  ['de Eerste Wereldoorlog', 1914], ['het kiesrecht voor vrouwen in Nederland', 1919],
  ['de Tweede Wereldoorlog', 1940], ['de watersnoodramp', 1953],
  ['de eerste mens op de maan', 1969], ['de val van de Muur', 1989],
  ['de euro als betaalmiddel', 2002]
];

module.exports.GESCHIEDENIS = [
  { groep: 5, doelen: [
    { id: 'geschiedenis.g5.vroeger', naam: 'Van jagers tot boeren',
      les: 'Eerst trokken mensen rond en jaagden ze. Toen ze leerden zaaien en dieren houden, bleven ze op een plek wonen: dat is het begin van dorpen en steden.',
      uitleg: [
        { soort: 'stap', tekst: 'Rondtrekken betekent alles meenemen wat je hebt. Blijven wonen betekent voorraad, huizen en meer mensen bij elkaar.' },
        { soort: 'verhaal', tekst: 'De hunebedden in Drenthe zijn gebouwd door boeren, ruim vijfduizend jaar geleden. Ze sleepten stenen van vele tonnen zonder wielen of machines.' }],
      gen: { soort: 'indeling', vraag: 'Bij welke tijd hoort %s?',
        groepen: { 'jagers en verzamelaars': ['rondtrekken achter dieren aan', 'een tent van huiden', 'een speer van vuursteen'],
          'de eerste boeren': ['akkers met graan', 'een hunebed', 'vee in een weide'],
          'de eerste steden': ['een markt', 'stadsrechten', 'een stadsmuur'] } } },
    { id: 'geschiedenis.g5.tijdlijn', naam: 'De tijdlijn: wat was eerder',
      les: 'Geschiedenis staat op volgorde. Je hoeft geen jaartallen uit je hoofd te kennen om te weten wat eerder was; wel welke gebeurtenis waar op de lijn hoort.',
      vereist: ['geschiedenis.g5.vroeger'],
      uitleg: [
        { soort: 'visueel', tekst: 'Teken een lijn van links naar rechts. Links is lang geleden, rechts is nu. Elke gebeurtenis krijgt een streepje op die lijn.' },
        { soort: 'eenvoudig', tekst: 'Jaartallen voor het jaar nul tellen terug: 3000 voor Christus is eerder dan 50 na Christus.' }],
      gen: { soort: 'eerder', gebeurtenissen: GEBEURTENISSEN } }
  ]},

  { groep: 6, doelen: [
    { id: 'geschiedenis.g6.gouden-eeuw', naam: 'De Gouden Eeuw',
      les: 'In de zeventiende eeuw werd Nederland rijk door handel over zee. Die rijkdom kwam voor een deel uit koloniale handel en slavernij; beide horen bij hetzelfde verhaal.',
      vereist: ['geschiedenis.g5.tijdlijn'],
      uitleg: [
        { soort: 'stap', tekst: 'De VOC haalde specerijen uit Azie en verkocht ze hier met grote winst. Amsterdam werd daardoor een van de rijkste steden van Europa.' },
        { soort: 'verhaal', tekst: 'Van dezelfde winst zijn de grachtenpanden gebouwd die er nu nog staan. En op dezelfde schepen zijn mensen verhandeld als slaaf.' }],
      gen: { soort: 'koppel', vraag: 'Wat hoort bij %s?',
        paren: [['de VOC', 'handel op Azie'], ['de WIC', 'handel op Amerika en Afrika'],
          ['Rembrandt', 'schilder in de zeventiende eeuw'], ['de grachtengordel', 'gebouwd van handelswinst'],
          ['een fluitschip', 'een goedkoop vrachtschip'], ['de stadhouder', 'de hoogste bestuurder van die tijd']] } },
    { id: 'geschiedenis.g6.eeuwen', naam: 'Rekenen met eeuwen',
      les: 'Een eeuw is honderd jaar. Het jaar 1650 hoort bij de zeventiende eeuw: je telt de eeuw waarin het jaar valt, en dat is er altijd een meer dan het eerste cijferpaar.',
      vereist: ['geschiedenis.g5.tijdlijn'],
      uitleg: [
        { soort: 'stap', tekst: 'Neem de eerste twee cijfers van het jaartal en tel er een bij op: 1650 wordt 16 + 1 = de zeventiende eeuw. Bij ronde jaren als 1600 blijft het de zestiende.' },
        { soort: 'eenvoudig', tekst: 'De eerste eeuw loopt van jaar 1 tot 100. Daarom loopt de eeuw altijd honderd jaar voor op wat het jaartal lijkt te zeggen.' }],
      gen: { soort: 'eeuw', gebeurtenissen: GEBEURTENISSEN.filter(g => g[1] > 0) } }
  ]},

  { groep: 7, doelen: [
    { id: 'geschiedenis.g7.wereldoorlogen', naam: 'De wereldoorlogen',
      les: 'De Eerste Wereldoorlog (1914-1918) ging aan Nederland voorbij; in de Tweede (1940-1945) werd Nederland bezet. In die oorlog zijn meer dan honderdduizend Nederlandse Joden vermoord.',
      vereist: ['geschiedenis.g6.eeuwen'],
      uitleg: [
        { soort: 'stap', tekst: 'Onthoud de vier jaartallen als paren: 1914-1918 en 1940-1945. Daartussen ligt het interbellum, de tijd tussen de twee oorlogen.' },
        { soort: 'verhaal', tekst: 'Op 4 mei herdenken we de slachtoffers, op 5 mei vieren we de bevrijding. Die twee dagen achter elkaar zijn geen toeval.' }],
      gen: { soort: 'koppel', vraag: 'Wat hoort bij %s?',
        paren: [['1914-1918', 'de Eerste Wereldoorlog'], ['1940-1945', 'de Tweede Wereldoorlog'],
          ['4 mei', 'dodenherdenking'], ['5 mei', 'bevrijdingsdag'],
          ['het verzet', 'mensen die zich tegen de bezetter keerden'], ['onderduiken', 'je verbergen voor de bezetter']] } },
    { id: 'geschiedenis.g7.slavernij', naam: 'Slavernij en kolonien',
      les: 'Nederland had kolonien in Azie, Amerika en Afrika en verhandelde mensen als slaaf. In 1863 werd de slavernij in Suriname en op de Antillen afgeschaft; Indonesie werd in 1949 onafhankelijk.',
      vereist: ['geschiedenis.g6.gouden-eeuw'],
      uitleg: [
        { soort: 'stap', tekst: 'Kolonien waren gebieden die door een ander land werden bestuurd, met winst voor dat land. Slavernij betekende dat mensen eigendom waren van anderen.' },
        { soort: 'verhaal', tekst: 'Keti Koti betekent "de ketenen zijn gebroken" en wordt elk jaar op 1 juli gevierd, de dag van de afschaffing.' }],
      gen: { soort: 'koppel', vraag: 'Wat hoort bij %s?',
        paren: [['1863', 'afschaffing van de slavernij'], ['Keti Koti', 'de herdenking op 1 juli'],
          ['Suriname', 'kolonie in Zuid-Amerika'], ['Nederlands-Indie', 'kolonie in Azie'],
          ['1949', 'Indonesie onafhankelijk'], ['de WIC', 'de compagnie van de trans-Atlantische handel']] } }
  ]},

  { groep: 8, doelen: [
    { id: 'geschiedenis.g8.democratie', naam: 'Nederland na de oorlog: democratie',
      les: 'Na 1945 is Nederland opgebouwd tot de democratie van nu: iedereen vanaf achttien mag stemmen, de Tweede Kamer maakt wetten en de rechter oordeelt onafhankelijk.',
      vereist: ['geschiedenis.g7.wereldoorlogen'],
      uitleg: [
        { soort: 'stap', tekst: 'Drie machten houden elkaar in evenwicht: de regering bestuurt, het parlement controleert en maakt wetten, de rechter spreekt recht.' },
        { soort: 'praktijk', tekst: 'Vrouwen kregen in 1919 kiesrecht, en pas sinds 1972 mag je stemmen vanaf achttien. Democratie is niet af, maar gegroeid.' }],
      gen: { soort: 'koppel', vraag: 'Wat doet %s?',
        paren: [['de Tweede Kamer', 'wetten maken en de regering controleren'], ['de regering', 'het land besturen'],
          ['de rechter', 'onafhankelijk recht spreken'], ['de gemeente', 'regelen wat dichtbij is'],
          ['de Eerste Kamer', 'wetten toetsen voordat ze ingaan'], ['de koning', 'een ceremoniele rol vervullen']] } },
    { id: 'geschiedenis.g8.overzicht', naam: 'De grote lijn door de tijd',
      les: 'Alles wat je in groep 5 tot en met 8 hebt gehad, staat op een lijn: van jagers en boeren, via Romeinen, middeleeuwen en Gouden Eeuw, naar de wereldoorlogen en het Nederland van nu.',
      vereist: ['geschiedenis.g8.democratie', 'geschiedenis.g7.slavernij'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet bij elke gebeurtenis de vraag: kwam dit voor of na de Gouden Eeuw? Die ene ankerpunt haalt de meeste twijfel weg.' },
        { soort: 'praktijk', tekst: 'Op het voortgezet onderwijs komen hier de tien tijdvakken bij. Wie de grote lijn kent, hoeft die alleen nog maar te benoemen.' }],
      gen: { soort: 'eerder', gebeurtenissen: GEBEURTENISSEN } }
  ]}
];
