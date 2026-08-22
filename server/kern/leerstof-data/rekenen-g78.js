/* RTG School, leerlijn rekenen groep 7 en 8. Hoort bij ./rekenen-g12.js,
   ./rekenen-g34.js en ./rekenen-g56.js; ./rekenen.js voegt ze samen.

   Groep 8 werkt naar de referentieniveaus 1F (fundament) en 1S (streef) toe;
   die staan per doel in `ref`. Zie de kop van rekenen-g12.js voor wat een
   leerdoel hier draagt. */
module.exports.REKENEN_G78 = [
  { groep: 7, doelen: [
    { id: 'rekenen.g7.breuken-rekenen', naam: 'Rekenen met breuken',
      les: 'Breuken met dezelfde noemer tel je gewoon op: 1/5 + 2/5 = 3/5. Verschillende noemers? Maak ze eerst gelijk.',
      vereist: ['rekenen.g6.breuken-vergelijken'],
      uitleg: [
        { soort: 'stap', tekst: 'Gelijke noemers: tel alleen de tellers op, de noemer blijft staan. Ongelijk: zoek een getal waar beide noemers in passen.' },
        { soort: 'visueel', tekst: 'Twee repen chocola in even grote stukken gesneden kun je zomaar bij elkaar leggen. Zijn de stukken ongelijk, dan moet je eerst opnieuw snijden.' },
        { soort: 'eenvoudig', tekst: 'De noemer zegt hoe groot de stukken zijn en verandert dus niet als je stukken bij elkaar legt. Alleen het aantal verandert.' }],
      gen: { soort: 'breuk-som' } },
    { id: 'rekenen.g7.procenten', naam: 'Procenten',
      les: 'Procent betekent "van de honderd". 25% is een kwart, 50% is de helft. 10% vind je door te delen door 10 -- en daarmee bouw je alles.',
      vereist: ['rekenen.g6.kommagetallen', 'rekenen.g6.breuken-benoemen'],
      uitleg: [
        { soort: 'stap', tekst: 'Reken eerst 10% uit: deel door tien. Daarmee bouw je de rest: 30% is drie keer 10%, 5% is de helft van 10%.' },
        { soort: 'analogie', tekst: 'Procenten zijn breuken met altijd dezelfde noemer, namelijk honderd. 25% is gewoon 25/100, en dat is een kwart.' },
        { soort: 'praktijk', tekst: 'Korting, btw, batterijpercentage, opkomst bij verkiezingen: overal is het "hoeveel van elke honderd".' }],
      gen: { soort: 'procent', procenten: [10, 25, 50, 75, 20] } },
    { id: 'rekenen.g7.verhoudingen', naam: 'Verhoudingstabellen',
      les: 'Kost 3 broden 6 euro, dan kost 1 brood 2 euro en 5 broden 10. De tabel doet links en rechts altijd hetzelfde.',
      vereist: ['rekenen.g5.delen', 'rekenen.g5.tafels-tot-10'],
      uitleg: [
        { soort: 'stap', tekst: 'Ga altijd eerst naar een: deel beide rijen door hetzelfde getal. Vanaf een kun je naar elk ander aantal.' },
        { soort: 'visueel', tekst: 'Zet twee rijen onder elkaar in een tabel. Wat je met de bovenste rij doet, doe je met de onderste. Anders klopt de verhouding niet meer.' }],
      gen: { soort: 'verhouding', max: 12 } },
    { id: 'rekenen.g7.gemiddelde', naam: 'Het gemiddelde',
      les: 'Alles bij elkaar, gedeeld door hoeveel het er zijn. Het gemiddelde van 4, 6 en 8 is 18 : 3 = 6.',
      vereist: ['rekenen.g5.delen', 'rekenen.g5.getallen-tot-1000'],
      uitleg: [
        { soort: 'visueel', tekst: 'Denk aan stapeltjes van verschillende hoogte. Het gemiddelde is de hoogte die je krijgt als je ze eerlijk gelijk maakt.' },
        { soort: 'praktijk', tekst: 'Je rapportcijfer is een gemiddelde. Een lage uitschieter trekt het omlaag, en hoe meer cijfers er zijn, hoe minder een los cijfer uitmaakt.' }],
      gen: { soort: 'gemiddelde', n: 3, max: 20 } },
    { id: 'rekenen.g7.negatieve-getallen', naam: 'Negatieve getallen',
      les: 'Onder de nul gaan de getallen door: -1, -2, -3. Bij -3 graden en zeven graden erbij kom je op 4 uit.',
      vereist: ['rekenen.g5.getallen-tot-1000'],
      uitleg: [
        { soort: 'visueel', tekst: 'Denk aan een thermometer die rechtop staat. Warmer is omhoog, kouder is omlaag; de nul is gewoon een streepje onderweg.' },
        { soort: 'stap', tekst: 'Erbij is naar rechts op de getallenlijn, eraf is naar links. Bij een negatief getal begin je alleen links van de nul.' },
        { soort: 'praktijk', tekst: 'Vriezen, een lift naar de kelder, geld dat je nog moet betalen: allemaal getallen onder de nul.' }],
      gen: { soort: 'negatief', max: 15 } },
    { id: 'rekenen.g7.tabel-grafiek', naam: 'Tabellen en grafieken lezen',
      les: 'Een tabel of grafiek vertelt een verhaal in getallen. Kijk eerst wat er langs de assen staat, dan pas naar de vorm.',
      vereist: ['rekenen.g7.gemiddelde'],
      uitleg: [
        { soort: 'stap', tekst: 'Lees eerst de kop: waar gaat het over, en in welke eenheid? Zoek daarna pas de waarde die je nodig hebt.' },
        { soort: 'praktijk', tekst: 'Een staafdiagram van het weer, een tabel met leenaantallen in de bieb: de hoogste staaf is niet altijd het antwoord op de vraag die er staat.' }],
      gen: { soort: 'tabel' } }
  ]},

  { groep: 8, doelen: [
    { id: 'rekenen.g8.procenten-komma-breuk', naam: 'Procenten, breuken en kommagetallen door elkaar', ref: '1F',
      les: 'Het is drie keer dezelfde taart: 1/4 = 0,25 = 25%. Wie het rijtje kent, kiest per som de makkelijkste vorm. Dit is het 1F-fundament.',
      vereist: ['rekenen.g7.procenten', 'rekenen.g7.breuken-rekenen'],
      uitleg: [
        { soort: 'stap', tekst: 'Van breuk naar kommagetal: deel de teller door de noemer. Van kommagetal naar procent: keer honderd.' },
        { soort: 'eenvoudig', tekst: 'Leer vijf paren uit je hoofd: 1/2 = 50%, 1/4 = 25%, 3/4 = 75%, 1/5 = 20%, 1/10 = 10%. Daarmee kom je bijna overal.' }],
      gen: { soort: 'drieluik' } },
    { id: 'rekenen.g8.grote-bewerkingen', naam: 'Grote bewerkingen en handig rekenen', ref: '1S',
      les: 'Kies je aanpak: uit het hoofd, op papier of schattend. 4 x 998 doe je als 4 x 1000 - 8. Slim is sneller dan hard.',
      vereist: ['rekenen.g6.grote-getallen', 'rekenen.g5.tafels-tot-10'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk eerst naar de getallen. Zit er een bijna-rond getal bij, reken dan met het ronde getal en corrigeer daarna.' },
        { soort: 'analogie', tekst: 'Het is als boodschappen doen: je zoekt de kortste route langs de schappen, niet de route waarin je alles twee keer langsloopt.' }],
      gen: { soort: 'som', op: 'x', max: 1000 } },
    { id: 'rekenen.g8.schatten', naam: 'Schatten en controleren', ref: '1F',
      les: 'Schat voordat je rekent: 39 x 21 is ongeveer 40 x 20 = 800. Een uitkomst van 8000 of 80 klopt dan zeker niet.',
      vereist: ['rekenen.g5.afronden', 'rekenen.g8.grote-bewerkingen'],
      uitleg: [
        { soort: 'stap', tekst: 'Rond beide getallen af op iets makkelijks, reken dat uit, en houd die uitkomst naast je echte antwoord.' },
        { soort: 'praktijk', tekst: 'Bij de kassa, bij een rekenmachine of bij een tikfout: schatten is hoe je merkt dat er iets tien keer te groot is.' }],
      gen: { soort: 'schatten', max: 40 } },
    { id: 'rekenen.g8.verhoudingen-procent', naam: 'Verhoudingen en procenten in echte situaties', ref: '1F',
      les: 'Korting, rente, recepten omrekenen: het is allemaal dezelfde verhoudingstabel. Zet wat je weet in de tabel en vul aan.',
      vereist: ['rekenen.g7.verhoudingen', 'rekenen.g7.procenten'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet twee rijen neer: bedrag en procent. Honderd procent is het hele bedrag; ga via een procent of via tien procent naar wat je zoekt.' },
        { soort: 'praktijk', tekst: 'Een recept voor vier personen omrekenen naar zes is dezelfde som als 50% korting op een jas. Alleen de woorden verschillen.' }],
      gen: { soort: 'korting', procenten: [10, 20, 25, 50] } },
    { id: 'rekenen.g8.kwadraten', naam: 'Kwadraten en wortels', ref: '1S',
      les: 'Een kwadraat is een getal maal zichzelf: 7 x 7 = 49. Andersom heet worteltrekken: de wortel van 49 is 7.',
      vereist: ['rekenen.g5.tafels-tot-10'],
      uitleg: [
        { soort: 'visueel', tekst: 'Een kwadraat is letterlijk een vierkant: 7 bij 7 tegels zijn er 49. Worteltrekken is de zijde terugzoeken bij een bekend vierkant.' },
        { soort: 'stap', tekst: 'Leer de kwadraten tot 12 uit je hoofd. Daarmee herken je in het voortgezet onderwijs meteen waar een som naartoe wil.' }],
      gen: { soort: 'kwadraat', max: 12 } },
    { id: 'rekenen.g8.meten-metriek', naam: 'Het metriek stelsel', ref: '1S',
      les: 'Kilo, hecto, deca, (meter/liter/gram), deci, centi, milli: elke stap is keer of gedeeld door 10. De trap op is delen, de trap af is vermenigvuldigen.',
      vereist: ['rekenen.g4.meten-inhoud', 'rekenen.g3.meten-lengte'],
      uitleg: [
        { soort: 'visueel', tekst: 'Teken de trap met de meter in het midden. Elke tree naar beneden is keer tien, elke tree omhoog is delen door tien.' },
        { soort: 'stap', tekst: 'Tel het aantal treden tussen de twee eenheden. Dat aantal nullen zet je erbij of haal je eraf.' }],
      gen: { soort: 'metriek' } }
  ]}
];
