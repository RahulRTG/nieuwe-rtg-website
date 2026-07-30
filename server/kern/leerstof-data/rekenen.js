/* RTG School, leerlijn rekenen groep 1 t/m 8. Elk leerdoel heeft een vaste
   id (het leerpaspoort verwijst ernaar), een korte les in gewone taal, en
   generator-parameters waarmee de oefenmotor onbeperkt verse sommen maakt --
   geen twee kinderen krijgen dezelfde rij. Ref = het referentieniveau waar
   het doel naartoe werkt (1F = fundament eind basisschool, 1S = streef). */
module.exports.REKENEN = [
  { groep: 1, doelen: [
    { id: 'rekenen.g1.tellen-tot-10', naam: 'Tellen tot 10', les: 'Tellen doe je een voor een: 1, 2, 3... Wijs elk ding aan terwijl je telt, dan tel je niets dubbel.', gen: { soort: 'tel', max: 10 } },
    { id: 'rekenen.g1.meer-minder', naam: 'Meer, minder, evenveel', les: 'Kijk naar twee groepjes. Waar liggen er meer? Je mag ze twee aan twee wegstrepen om het te zien.', gen: { soort: 'vergelijk', max: 10 } },
    { id: 'rekenen.g1.vormen', naam: 'Vormen herkennen', les: 'Een cirkel is rond, een vierkant heeft vier gelijke zijden, een driehoek heeft er drie.', gen: { soort: 'vorm' } }
  ]},
  { groep: 2, doelen: [
    { id: 'rekenen.g2.tellen-tot-20', naam: 'Tellen tot 20', les: 'Na de 10 gaat het tellen gewoon door: elf, twaalf, dertien... Let op: elf en twaalf klinken anders dan de rest.', gen: { soort: 'tel', max: 20 } },
    { id: 'rekenen.g2.erbij-eraf-5', naam: 'Erbij en eraf tot 5', les: 'Erbij is samen doen: 2 en nog 1 is 3. Eraf is weghalen: van 4 gaat er 1 af, dan houd je 3 over.', gen: { soort: 'som', op: 'beide', max: 5 } },
    { id: 'rekenen.g2.getalrij', naam: 'De getalrij: wat komt ervoor en erna', les: 'Elk getal heeft een buurman. Voor de 7 komt de 6, na de 7 komt de 8.', gen: { soort: 'buur', max: 20 } }
  ]},
  { groep: 3, doelen: [
    { id: 'rekenen.g3.optellen-tot-20', naam: 'Optellen tot 20', les: 'Over de 10 heen rekenen gaat via de 10: 8 + 5 = 8 + 2 + 3 = 13. Maak eerst de 10 vol.', gen: { soort: 'som', op: '+', max: 20 } },
    { id: 'rekenen.g3.aftrekken-tot-20', naam: 'Aftrekken tot 20', les: 'Ook terug gaat via de 10: 13 - 5 = 13 - 3 - 2 = 8. Eerst terug naar de 10, dan de rest.', gen: { soort: 'som', op: '-', max: 20 } },
    { id: 'rekenen.g3.splitsen', naam: 'Getallen splitsen', les: 'Elk getal kun je splitsen: 8 is 5 en 3, maar ook 4 en 4. Splitsen is de sleutel voor snel rekenen.', gen: { soort: 'splits', max: 10 } },
    { id: 'rekenen.g3.getallen-tot-100', naam: 'Getallen tot 100', les: 'Getallen bestaan uit tientallen en eenheden: 47 is 4 tientallen en 7 eenheden.', gen: { soort: 'buur', max: 100 } }
  ]},
  { groep: 4, doelen: [
    { id: 'rekenen.g4.tafels-1-5-10', naam: 'De tafels van 1 tot en met 5 en 10', les: 'Een tafel is steeds dezelfde sprong: 3 x 4 is 4 + 4 + 4. De tafel van 10 is het makkelijkst: er komt een 0 achter.', gen: { soort: 'tafel', tafels: [1, 2, 3, 4, 5, 10] } },
    { id: 'rekenen.g4.optellen-tot-100', naam: 'Optellen en aftrekken tot 100', les: 'Reken in stappen: eerst de tientallen, dan de eenheden. 47 + 25 = 47 + 20 + 5 = 72.', gen: { soort: 'som', op: 'beide', max: 100 } },
    { id: 'rekenen.g4.klok-heel-half', naam: 'Klokkijken: hele en halve uren', les: 'De kleine wijzer zegt het uur, de grote wijzer zegt hoe ver dat uur is. Recht omhoog is heel uur; recht omlaag is half.', gen: { soort: 'klok', stap: 30 } },
    { id: 'rekenen.g4.geld', naam: 'Rekenen met geld', les: 'Munten en briefjes tel je van groot naar klein. Betalen en terugkrijgen is een aftreksom.', gen: { soort: 'geld', max: 20 } }
  ]},
  { groep: 5, doelen: [
    { id: 'rekenen.g5.tafels-tot-10', naam: 'Alle tafels tot en met 10', les: 'Ken je de tafel van 4, dan is die van 8 het dubbele. De tafels ken je pas als je ze door elkaar durft.', gen: { soort: 'tafel', tafels: [2, 3, 4, 5, 6, 7, 8, 9, 10] } },
    { id: 'rekenen.g5.delen', naam: 'Delen: de tafel andersom', les: 'Delen is eerlijk verdelen, en het is de tafel achterstevoren: 24 : 6 vraagt "hoeveel keer 6 past in 24?"', gen: { soort: 'deel', tafels: [2, 3, 4, 5, 6, 7, 8, 9, 10] } },
    { id: 'rekenen.g5.getallen-tot-1000', naam: 'Getallen tot 1000', les: 'Duizend heeft drie stapjes: honderdtallen, tientallen, eenheden. 358 = 300 + 50 + 8.', gen: { soort: 'som', op: 'beide', max: 1000 } },
    { id: 'rekenen.g5.klok-minuten', naam: 'Klokkijken op de minuut', les: 'Elke streep op de klok is een minuut; van cijfer naar cijfer zijn er vijf. Kwart over is 15 minuten na het hele uur.', gen: { soort: 'klok', stap: 5 } }
  ]},
  { groep: 6, doelen: [
    { id: 'rekenen.g6.breuken-benoemen', naam: 'Breuken herkennen en benoemen', les: 'Een breuk is een eerlijk deel: 1/4 is een van de vier gelijke stukken. Hoe groter het getal onder de streep, hoe kleiner het stuk.', gen: { soort: 'breuk-benoem' } },
    { id: 'rekenen.g6.kommagetallen', naam: 'Kommagetallen', les: 'Achter de komma wonen de tienden en honderdsten: 2,5 is twee-en-een-half. Geld is stiekem al kommarekenen.', gen: { soort: 'som', op: 'beide', max: 100, komma: 1 } },
    { id: 'rekenen.g6.grote-getallen', naam: 'Grote getallen tot een miljoen', les: 'Grote getallen lees je in groepjes van drie: 245.300 is 245 duizend en 300.', gen: { soort: 'buur', max: 1000000, stap: 100 } },
    { id: 'rekenen.g6.omtrek-opp', naam: 'Omtrek en oppervlakte', les: 'Omtrek is eromheen lopen: alle zijden bij elkaar. Oppervlakte is hoeveel tegels erin passen: lengte x breedte.', gen: { soort: 'opp', max: 12 } }
  ]},
  { groep: 7, doelen: [
    { id: 'rekenen.g7.procenten', naam: 'Procenten', les: 'Procent betekent "van de honderd". 25% is een kwart, 50% is de helft. 10% vind je door te delen door 10 -- en daarmee bouw je alles.', gen: { soort: 'procent', procenten: [10, 25, 50, 75, 20] } },
    { id: 'rekenen.g7.breuken-rekenen', naam: 'Rekenen met breuken', les: 'Breuken met dezelfde noemer tel je gewoon op: 1/5 + 2/5 = 3/5. Verschillende noemers? Maak ze eerst gelijk.', gen: { soort: 'breuk-som' } },
    { id: 'rekenen.g7.verhoudingen', naam: 'Verhoudingstabellen', les: 'Kost 3 broden 6 euro, dan kost 1 brood 2 euro en 5 broden 10. De tabel doet links en rechts altijd hetzelfde.', gen: { soort: 'verhouding', max: 12 } },
    { id: 'rekenen.g7.gemiddelde', naam: 'Het gemiddelde', les: 'Alles bij elkaar, gedeeld door hoeveel het er zijn. Het gemiddelde van 4, 6 en 8 is 18 : 3 = 6.', gen: { soort: 'gemiddelde', n: 3, max: 20 } }
  ]},
  { groep: 8, doelen: [
    { id: 'rekenen.g8.procenten-komma-breuk', naam: 'Procenten, breuken en kommagetallen door elkaar', les: 'Het is drie keer dezelfde taart: 1/4 = 0,25 = 25%. Wie het rijtje kent, kiest per som de makkelijkste vorm. Dit is het 1F-fundament.', ref: '1F', gen: { soort: 'drieluik' } },
    { id: 'rekenen.g8.grote-bewerkingen', naam: 'Grote bewerkingen en handig rekenen', les: 'Kies je aanpak: uit het hoofd, op papier of schattend. 4 x 998 doe je als 4 x 1000 - 8. Slim is sneller dan hard.', ref: '1S', gen: { soort: 'som', op: 'x', max: 1000 } },
    { id: 'rekenen.g8.verhoudingen-procent', naam: 'Verhoudingen en procenten in echte situaties', les: 'Korting, rente, recepten omrekenen: het is allemaal dezelfde verhoudingstabel. Zet wat je weet in de tabel en vul aan.', ref: '1F', gen: { soort: 'procent', procenten: [5, 15, 30, 40, 60] } },
    { id: 'rekenen.g8.meten-metriek', naam: 'Het metriek stelsel', les: 'Kilo, hecto, deca, (meter/liter/gram), deci, centi, milli: elke stap is keer of gedeeld door 10. De trap op is delen, de trap af is vermenigvuldigen.', ref: '1S', gen: { soort: 'metriek' } }
  ]}
];
