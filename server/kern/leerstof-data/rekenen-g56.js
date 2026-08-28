/* RTG School, leerlijn rekenen groep 5 en 6. Hoort bij ./rekenen-g12.js,
   ./rekenen-g34.js en ./rekenen-g78.js; ./rekenen.js voegt ze samen.
   Zie de kop van rekenen-g12.js voor wat een leerdoel hier draagt. */
module.exports.REKENEN_G56 = [
  { groep: 5, doelen: [
    { id: 'rekenen.g5.tafels-tot-10', naam: 'Alle tafels tot en met 10',
      les: 'Ken je de tafel van 4, dan is die van 8 het dubbele. De tafels ken je pas als je ze door elkaar durft.',
      vereist: ['rekenen.g4.tafels-1-5-10'],
      uitleg: [
        { soort: 'eenvoudig', tekst: 'De moeilijke tafels bouw je uit makkelijke: 6 x 7 is 5 x 7 plus nog een keer 7. En 9 x 7 is 10 x 7 min 7.' },
        { soort: 'stap', tekst: 'Oefen niet op volgorde. Een tafel die je alleen opdreunt van 1 tot 10, ken je niet: je kent het liedje.' },
        { soort: 'analogie', tekst: 'Keer is omkeerbaar: 3 x 8 is evenveel als 8 x 3. Daarmee is de helft van alle sommen die je moet leren al gratis.' }],
      gen: { soort: 'tafel', tafels: [2, 3, 4, 5, 6, 7, 8, 9, 10] } },
    { id: 'rekenen.g5.delen', naam: 'Delen: de tafel andersom',
      les: 'Delen is eerlijk verdelen, en het is de tafel achterstevoren: 24 : 6 vraagt "hoeveel keer 6 past in 24?"',
      vereist: ['rekenen.g5.tafels-tot-10'],
      uitleg: [
        { soort: 'stap', tekst: 'Vraag jezelf: keer hoeveel is dit? Bij 24 : 6 zoek je het getal dat met 6 vermenigvuldigd 24 geeft.' },
        { soort: 'praktijk', tekst: 'Vierentwintig knikkers eerlijk over zes kinderen: ieder vier. Delen is verdelen, en de tafel vertelt je hoeveel.' }],
      gen: { soort: 'deel', tafels: [2, 3, 4, 5, 6, 7, 8, 9, 10] } },
    { id: 'rekenen.g5.delen-met-rest', naam: 'Delen met rest',
      les: 'Niet alles gaat op. 17 : 5 is 3, en er blijft 2 over: 3 rest 2. De rest is altijd kleiner dan waardoor je deelt.',
      vereist: ['rekenen.g5.delen'],
      uitleg: [
        { soort: 'stap', tekst: 'Zoek het grootste getal uit de tafel dat er nog onder past. Wat er dan nog over is, is de rest.' },
        { soort: 'praktijk', tekst: 'Zeventien koeken over vijf kinderen: ieder drie, en twee koeken blijven op de schaal liggen. Die twee zijn de rest.' },
        { soort: 'eenvoudig', tekst: 'Als de rest even groot of groter is dan de deler, heb je te weinig verdeeld. Er kan er dan nog een bij.' }],
      gen: { soort: 'deelrest', max: 10 } },
    { id: 'rekenen.g5.getallen-tot-1000', naam: 'Getallen tot 1000',
      les: 'Duizend heeft drie stapjes: honderdtallen, tientallen, eenheden. 358 = 300 + 50 + 8.',
      vereist: ['rekenen.g4.optellen-tot-100'],
      uitleg: [
        { soort: 'stap', tekst: 'Reken van links naar rechts: eerst de honderdtallen, dan de tientallen, dan de rest. Zo blijf je overzicht houden.' },
        { soort: 'visueel', tekst: 'Denk aan dozen van honderd, zakjes van tien en losse knikkers. Elk cijfer telt zijn eigen soort.' }],
      gen: { soort: 'som', op: 'beide', max: 1000 } },
    { id: 'rekenen.g5.afronden', naam: 'Afronden op tientallen en honderdtallen',
      les: 'Afronden is naar het dichtstbijzijnde ronde getal gaan. Kijk naar het cijfer erachter: 5 of hoger gaat omhoog, lager gaat omlaag.',
      vereist: ['rekenen.g5.getallen-tot-1000'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet je vinger op de plaats waarop je afrondt. Kijk naar het cijfer rechts daarvan. Vanaf 5 rond je omhoog, daaronder omlaag.' },
        { soort: 'praktijk', tekst: 'Afronden gebruik je om te schatten. 297 + 104 is ongeveer 300 + 100, dus rond de 400. Zo merk je een fout van tien keer te veel meteen.' }],
      gen: { soort: 'afronden', stappen: [10, 100] } },
    { id: 'rekenen.g5.klok-minuten', naam: 'Klokkijken op de minuut',
      les: 'Elke streep op de klok is een minuut; van cijfer naar cijfer zijn er vijf. Kwart over is 15 minuten na het hele uur.',
      vereist: ['rekenen.g4.klok-heel-half'],
      uitleg: [
        { soort: 'stap', tekst: 'Tel de grote wijzer in sprongen van vijf: 1 is vijf over, 2 is tien over, 3 is kwart over.' },
        { soort: 'visueel', tekst: 'De klok is een cirkel van zestig. Rechts is de eerste helft (over), links de tweede (voor het volgende uur).' }],
      gen: { soort: 'klok', stap: 5 } },
    { id: 'rekenen.g5.tijdsduur', naam: 'Hoe lang duurt het',
      les: 'Tijdsduur is het verschil tussen twee tijden. Van 8:45 tot 10:20 reken je via het hele uur: eerst naar 9:00, dan verder.',
      vereist: ['rekenen.g5.klok-minuten'],
      uitleg: [
        { soort: 'stap', tekst: 'Spring eerst naar het eerstvolgende hele uur, dan met hele uren zo ver mogelijk, en tel de laatste minuten erbij.' },
        { soort: 'praktijk', tekst: 'Een film begint om 19:40 en duurt tot 21:15. Naar 20:00 is 20 minuten, naar 21:00 is een uur, en dan nog 15: een uur en 35 minuten.' }],
      gen: { soort: 'tijdsduur' } }
  ]},

  { groep: 6, doelen: [
    { id: 'rekenen.g6.breuken-benoemen', naam: 'Breuken herkennen en benoemen',
      les: 'Een breuk is een eerlijk deel: 1/4 is een van de vier gelijke stukken. Hoe groter het getal onder de streep, hoe kleiner het stuk.',
      vereist: ['rekenen.g5.delen'],
      uitleg: [
        { soort: 'visueel', tekst: 'Denk aan een pizza. Het getal onder de streep zegt in hoeveel stukken hij is gesneden, het getal erboven hoeveel jij er hebt.' },
        { soort: 'eenvoudig', tekst: 'Onder de streep staat hoe groot de stukken zijn: hoe hoger dat getal, hoe kleiner elk stuk. 1/8 is dus kleiner dan 1/4.' }],
      gen: { soort: 'breuk-benoem' } },
    { id: 'rekenen.g6.breuken-vergelijken', naam: 'Breuken vergelijken',
      les: 'Welke is groter: 2/3 of 1/2? Met dezelfde noemer kijk je naar de teller. Anders maak je ze eerst gelijknamig, of je vergelijkt met een half.',
      vereist: ['rekenen.g6.breuken-benoemen'],
      uitleg: [
        { soort: 'stap', tekst: 'Vergelijk allebei met een half. Is de teller meer dan de helft van de noemer, dan is de breuk groter dan een half.' },
        { soort: 'visueel', tekst: 'Teken twee even lange repen en verdeel ze allebei. Nu zie je met je ogen welk stuk verder komt.' },
        { soort: 'praktijk', tekst: 'Bij 3/4 pizza of 2/3 pizza kies je 3/4: er ontbreekt maar een kwart, tegen een derde bij de ander.' }],
      gen: { soort: 'breukvergelijk' } },
    { id: 'rekenen.g6.kommagetallen', naam: 'Kommagetallen',
      les: 'Achter de komma wonen de tienden en honderdsten: 2,5 is twee-en-een-half. Geld is stiekem al kommarekenen.',
      vereist: ['rekenen.g6.breuken-benoemen', 'rekenen.g5.getallen-tot-1000'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Euro\'s en centen zijn kommagetallen: 3,25 euro is drie euro en 25 cent, oftewel drie en een kwart.' },
        { soort: 'stap', tekst: 'Zet bij optellen de komma\'s onder elkaar. Dan staan de tienden onder de tienden, net zoals de tientallen onder de tientallen.' }],
      gen: { soort: 'som', op: 'beide', max: 100, komma: 1 } },
    { id: 'rekenen.g6.grote-getallen', naam: 'Grote getallen tot een miljoen',
      les: 'Grote getallen lees je in groepjes van drie: 245.300 is 245 duizend en 300.',
      vereist: ['rekenen.g5.getallen-tot-1000'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet vanaf rechts een punt na elke drie cijfers. Lees dan groepje voor groepje: eerst de duizenden, dan de rest.' },
        { soort: 'praktijk', tekst: 'Inwoners van een stad, kilometers naar de maan, euro\'s in een begroting: zonder groepjes van drie lees je zulke getallen verkeerd.' }],
      gen: { soort: 'buur', max: 1000000, stap: 100 } },
    { id: 'rekenen.g6.omtrek-opp', naam: 'Omtrek en oppervlakte',
      les: 'Omtrek is eromheen lopen: alle zijden bij elkaar. Oppervlakte is hoeveel tegels erin passen: lengte x breedte.',
      vereist: ['rekenen.g5.tafels-tot-10', 'rekenen.g3.meten-lengte'],
      uitleg: [
        { soort: 'visueel', tekst: 'Omtrek is het hek om de tuin. Oppervlakte is het gras binnen dat hek.' },
        { soort: 'stap', tekst: 'Omtrek: alle vier de zijden optellen, of 2 x (lengte + breedte). Oppervlakte: lengte keer breedte.' },
        { soort: 'praktijk', tekst: 'Voor een rand behang reken je omtrek; voor de vloerbedekking oppervlakte. Dezelfde kamer, twee heel verschillende sommen.' }],
      gen: { soort: 'opp', max: 12 } },
    { id: 'rekenen.g6.schaal', naam: 'Schaal en plattegronden',
      les: 'Schaal 1 : 100 betekent dat 1 centimeter op papier 100 centimeter in het echt is. Op de kaart meten, dan omrekenen.',
      vereist: ['rekenen.g6.grote-getallen', 'rekenen.g3.meten-lengte'],
      uitleg: [
        { soort: 'stap', tekst: 'Meet de afstand op de kaart in centimeters. Vermenigvuldig met het getal achter de dubbele punt. Reken daarna om naar meters of kilometers.' },
        { soort: 'praktijk', tekst: 'Een plattegrond van je klas op schaal 1 : 50: een tafel van 1 cm op papier is in het echt 50 cm.' }],
      gen: { soort: 'schaal' } }
  ]}
];
