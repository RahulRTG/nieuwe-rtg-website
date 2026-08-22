/* RTG School, leerlijn rekenen groep 3 en 4. Hoort bij
   ./rekenen-boven.js; ./rekenen.js voegt ze samen.

   Elk leerdoel draagt vier dingen:
   - een vaste id -- het leerpaspoort verwijst ernaar en die verandert nooit;
   - `vereist`: wat eronder ligt. Een kind dat vastloopt op optellen tot 20
     mist meestal niet "oefening" maar het splitsen eronder;
   - `uitleg`: dezelfde stof in andere vormen. Wie de eerste uitleg niet snapt,
     is niet geholpen met diezelfde uitleg nog een keer;
   - `gen`: parameters waarmee de motor onbeperkt verse opgaven maakt.

   De uitleg is met de hand geschreven en kort gehouden: een scherm vol tekst
   leest een kind van zeven niet. Wat er staat moet kloppen, in gewone taal,
   zonder uitroeptekens en zonder aanmoediging -- de som is al moeilijk genoeg. */
module.exports.REKENEN_G34 = [
  { groep: 3, doelen: [
    { id: 'rekenen.g3.splitsen', naam: 'Getallen splitsen',
      les: 'Elk getal kun je splitsen: 8 is 5 en 3, maar ook 4 en 4. Splitsen is de sleutel voor snel rekenen.',
      vereist: ['rekenen.g2.erbij-eraf-10'],
      uitleg: [
        { soort: 'visueel', tekst: 'Leg acht knikkers neer en schuif ze in twee groepjes. Hoe je ook schuift, samen blijft het acht.' },
        { soort: 'stap', tekst: 'Noem het eerste stukje, en vraag: hoeveel moet erbij om het hele getal te halen? Dat tweede stukje is het antwoord.' },
        { soort: 'praktijk', tekst: 'Splitsen gebruik je bij alles wat later komt: 8 + 5 wordt straks 8 + 2 + 3, en dat kan alleen als je 5 durft te splitsen.' }],
      gen: { soort: 'splits', max: 10 } },
    { id: 'rekenen.g3.optellen-tot-20', naam: 'Optellen tot 20',
      les: 'Over de 10 heen rekenen gaat via de 10: 8 + 5 = 8 + 2 + 3 = 13. Maak eerst de 10 vol.',
      vereist: ['rekenen.g3.splitsen'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk hoeveel het eerste getal nog tekortkomt voor tien. Haal dat uit het tweede getal. Tel de rest bij de tien op.' },
        { soort: 'visueel', tekst: 'Vul eerst een rij van tien helemaal vol. Wat overblijft, komt op de tweede rij. De tien plus die rest is je antwoord.' }],
      gen: { soort: 'som', op: '+', max: 20 } },
    { id: 'rekenen.g3.aftrekken-tot-20', naam: 'Aftrekken tot 20',
      les: 'Ook terug gaat via de 10: 13 - 5 = 13 - 3 - 2 = 8. Eerst terug naar de 10, dan de rest.',
      vereist: ['rekenen.g3.optellen-tot-20'],
      uitleg: [
        { soort: 'stap', tekst: 'Ga eerst terug naar tien. Kijk hoeveel je nog moet aftrekken en haal dat van de tien af.' },
        { soort: 'analogie', tekst: 'Het is dezelfde route als bij optellen, maar dan de andere kant op. De tien is onderweg de rustplaats.' }],
      gen: { soort: 'som', op: '-', max: 20 } },
    { id: 'rekenen.g3.dubbel-helft', naam: 'Verdubbelen en halveren',
      les: 'Het dubbele is twee keer zoveel, de helft is eerlijk in tweeen. Het dubbele van 7 is 14; de helft van 14 is 7.',
      vereist: ['rekenen.g3.splitsen'],
      uitleg: [
        { soort: 'stap', tekst: 'Verdubbelen: leg het getal er nog een keer bij. Halveren: verdeel in twee gelijke stapels en tel er een.' },
        { soort: 'praktijk', tekst: 'Halveren is delen door twee. Dat is straks de kortste weg naar de tafel van 4 (het dubbele van 2) en van 8.' }],
      gen: { soort: 'dubbel', max: 20 } },
    { id: 'rekenen.g3.getallen-tot-100', naam: 'Getallen tot 100',
      les: 'Getallen bestaan uit tientallen en eenheden: 47 is 4 tientallen en 7 eenheden.',
      vereist: ['rekenen.g2.getalrij'],
      uitleg: [
        { soort: 'visueel', tekst: 'Denk aan zakjes van tien knikkers plus losse knikkers. 47 is vier zakjes en zeven los.' },
        { soort: 'stap', tekst: 'Het linkercijfer telt de tientallen, het rechtercijfer de losse. Daarom is 74 iets heel anders dan 47.' }],
      gen: { soort: 'buur', max: 100 } },
    { id: 'rekenen.g3.meten-lengte', naam: 'Lengte meten in centimeters en meters',
      les: 'Met een liniaal meet je in centimeters; een meter is honderd centimeter. Begin bij de nul, niet bij de rand.',
      vereist: ['rekenen.g3.getallen-tot-100'],
      uitleg: [
        { soort: 'stap', tekst: 'Leg de nul van de liniaal precies bij het begin. Lees af waar het einde ligt. Dat getal is de lengte.' },
        { soort: 'praktijk', tekst: 'Een pen is ongeveer 15 centimeter, een deur ongeveer 2 meter. Zulke ijkpunten helpen je schatten.' }],
      gen: { soort: 'meten', eenheid: 'lengte' } }
  ]},

  { groep: 4, doelen: [
    { id: 'rekenen.g4.optellen-tot-100', naam: 'Optellen en aftrekken tot 100',
      les: 'Reken in stappen: eerst de tientallen, dan de eenheden. 47 + 25 = 47 + 20 + 5 = 72.',
      vereist: ['rekenen.g3.getallen-tot-100', 'rekenen.g3.optellen-tot-20'],
      uitleg: [
        { soort: 'stap', tekst: 'Splits het tweede getal in tientallen en eenheden. Tel eerst de tientallen erbij, dan de eenheden.' },
        { soort: 'visueel', tekst: 'Zie een getallenlijn. Je maakt eerst grote sprongen van tien en daarna kleine stapjes van een.' }],
      gen: { soort: 'som', op: 'beide', max: 100 } },
    { id: 'rekenen.g4.tafels-1-5-10', naam: 'De tafels van 1 tot en met 5 en 10',
      les: 'Een tafel is steeds dezelfde sprong: 3 x 4 is 4 + 4 + 4. De tafel van 10 is het makkelijkst: er komt een 0 achter.',
      vereist: ['rekenen.g3.dubbel-helft', 'rekenen.g4.optellen-tot-100'],
      uitleg: [
        { soort: 'stap', tekst: 'Keersommen zijn sprongen van gelijke grootte. 4 x 5 is vier sprongen van vijf: 5, 10, 15, 20.' },
        { soort: 'eenvoudig', tekst: 'De tafel van 2 is verdubbelen. De tafel van 4 is twee keer verdubbelen. De tafel van 5 eindigt altijd op 0 of 5.' },
        { soort: 'praktijk', tekst: 'Vier pakken met elk vijf koeken: 4 x 5 = 20 koeken. Zo zie je waarom keer sneller is dan alles bij elkaar optellen.' }],
      gen: { soort: 'tafel', tafels: [1, 2, 3, 4, 5, 10] } },
    { id: 'rekenen.g4.klok-heel-half', naam: 'Klokkijken: hele en halve uren',
      les: 'De kleine wijzer zegt het uur, de grote wijzer zegt hoe ver dat uur is. Recht omhoog is heel uur; recht omlaag is half.',
      vereist: ['rekenen.g2.getalrij'],
      uitleg: [
        { soort: 'visueel', tekst: 'De grote wijzer loopt een hele ronde in een uur. Halverwege die ronde staat hij onderaan: dat is half.' },
        { soort: 'stap', tekst: 'Kijk eerst naar de kleine wijzer voor het uur, daarna naar de grote voor de minuten. Nooit andersom.' }],
      gen: { soort: 'klok', stap: 30 } },
    { id: 'rekenen.g4.kalender', naam: 'De kalender: dagen, weken en maanden',
      les: 'Een week heeft zeven dagen, een jaar twaalf maanden. De meeste maanden hebben 30 of 31 dagen; februari heeft er 28.',
      vereist: ['rekenen.g4.optellen-tot-100'],
      uitleg: [
        { soort: 'stap', tekst: 'Hoeveel dagen in een aantal weken? Keer zeven. Van dag naar dag verder tellen doe je met de rij van zeven dagnamen.' },
        { soort: 'praktijk', tekst: 'Op je verjaardag over drie weken: tel drie keer zeven dagen door, en je komt op dezelfde dag van de week uit.' }],
      gen: { soort: 'kalender' } },
    { id: 'rekenen.g4.geld', naam: 'Rekenen met geld',
      les: 'Munten en briefjes tel je van groot naar klein. Betalen en terugkrijgen is een aftreksom.',
      vereist: ['rekenen.g4.optellen-tot-100'],
      uitleg: [
        { soort: 'stap', tekst: 'Begin bij het grootste briefje en tel omlaag. Bij wisselgeld: tel vanaf de prijs door tot je bij het betaalde bedrag bent.' },
        { soort: 'praktijk', tekst: 'Iets kost 7 euro en je betaalt met 10: tel door van 7 naar 10, dat zijn er 3. Doortellen is makkelijker dan aftrekken.' }],
      gen: { soort: 'geld', max: 20 } },
    { id: 'rekenen.g4.meten-inhoud', naam: 'Inhoud en gewicht meten',
      les: 'Inhoud meet je in liters, gewicht in kilo\'s. Een liter is tien deciliter; een kilo is duizend gram.',
      vereist: ['rekenen.g3.meten-lengte'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Een pak melk is een liter. Een pak suiker is een kilo. Daarmee kun je alles wat je in de winkel ziet, schatten.' },
        { soort: 'stap', tekst: 'Van groot naar klein is keer: liters naar deciliters is keer tien. Van klein naar groot is delen.' }],
      gen: { soort: 'meten', eenheid: 'inhoud' } }
  ]}
];
