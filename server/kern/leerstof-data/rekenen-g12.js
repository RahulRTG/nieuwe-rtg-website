/* RTG School, leerlijn rekenen groep 1 en 2. Hoort bij
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
module.exports.REKENEN_G12 = [

  { groep: 1, doelen: [
    { id: 'rekenen.g1.tellen-tot-10', naam: 'Tellen tot 10',
      les: 'Tellen doe je een voor een: 1, 2, 3... Wijs elk ding aan terwijl je telt, dan tel je niets dubbel.',
      uitleg: [
        { soort: 'stap', tekst: 'Leg je vinger op het eerste ding en zeg "een". Schuif door naar het volgende en zeg "twee". Het laatste getal dat je zegt, is hoeveel het er zijn.' },
        { soort: 'praktijk', tekst: 'Tel de treden van de trap terwijl je omhoog loopt. Elke voet is een getal; boven weet je hoeveel treden er zijn.' }],
      gen: { soort: 'tel', max: 10 } },
    { id: 'rekenen.g1.terugtellen', naam: 'Terugtellen vanaf 10',
      les: 'Terugtellen is tellen de andere kant op: 10, 9, 8... Elk getal is er een minder dan het vorige.',
      vereist: ['rekenen.g1.tellen-tot-10'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Aftellen voor een raket: tien, negen, acht... en bij nul gaat hij. Dat is precies terugtellen.' },
        { soort: 'visueel', tekst: 'Denk aan tien vingers. Voor elk getal doe je er een omlaag. Als alle vingers omlaag zijn, ben je bij nul.' }],
      gen: { soort: 'buur', max: 10 } },
    { id: 'rekenen.g1.meer-minder', naam: 'Meer, minder, evenveel',
      les: 'Kijk naar twee groepjes. Waar liggen er meer? Je mag ze twee aan twee wegstrepen om het te zien.',
      vereist: ['rekenen.g1.tellen-tot-10'],
      uitleg: [
        { soort: 'stap', tekst: 'Pak uit elk groepje er een tegelijk weg. Het groepje dat overhoudt, had er meer. Raken ze tegelijk leeg, dan waren het er evenveel.' },
        { soort: 'eenvoudig', tekst: 'Meer is: er blijven er over. Minder is: je bent eerder leeg.' }],
      gen: { soort: 'vergelijk', max: 10 } },
    { id: 'rekenen.g1.vormen', naam: 'Vormen herkennen',
      les: 'Een cirkel is rond, een vierkant heeft vier gelijke zijden, een driehoek heeft er drie.',
      uitleg: [
        { soort: 'praktijk', tekst: 'Een bord is een cirkel, een raam is meestal een vierkant of rechthoek, een punt van een pizza is een driehoek.' },
        { soort: 'stap', tekst: 'Tel de hoeken. Geen hoeken: cirkel. Drie hoeken: driehoek. Vier hoeken: vierkant of rechthoek.' }],
      gen: { soort: 'vorm' } }
  ]},

  { groep: 2, doelen: [
    { id: 'rekenen.g2.tellen-tot-20', naam: 'Tellen tot 20',
      les: 'Na de 10 gaat het tellen gewoon door: elf, twaalf, dertien... Let op: elf en twaalf klinken anders dan de rest.',
      vereist: ['rekenen.g1.tellen-tot-10'],
      uitleg: [
        { soort: 'stap', tekst: 'Vanaf dertien hoor je het getal zelf terug: drie-tien, vier-tien, vijf-tien. Alleen elf en twaalf doen niet mee.' },
        { soort: 'visueel', tekst: 'Twee handen zijn tien. Voor elf leg je er nog een vinger bij, voor twaalf twee. Zo tel je door boven de tien.' }],
      gen: { soort: 'tel', max: 20 } },
    { id: 'rekenen.g2.erbij-eraf-5', naam: 'Erbij en eraf tot 5',
      les: 'Erbij is samen doen: 2 en nog 1 is 3. Eraf is weghalen: van 4 gaat er 1 af, dan houd je 3 over.',
      vereist: ['rekenen.g1.tellen-tot-10', 'rekenen.g1.terugtellen'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Je hebt drie koekjes en krijgt er een: doortellen, vier. Je eet er een op: terugtellen, drie.' },
        { soort: 'stap', tekst: 'Bij erbij tel je door vanaf het grootste getal. Bij eraf tel je terug. Je hoeft nooit opnieuw bij een te beginnen.' }],
      gen: { soort: 'som', op: 'beide', max: 5 } },
    { id: 'rekenen.g2.erbij-eraf-10', naam: 'Erbij en eraf tot 10',
      les: 'Tot tien werkt hetzelfde als tot vijf, maar de getallen zijn groter. Ken je de vaste tweetallen (5 en 5, 6 en 4), dan hoef je niet te tellen.',
      vereist: ['rekenen.g2.erbij-eraf-5'],
      uitleg: [
        { soort: 'visueel', tekst: 'Denk aan twee handen. 7 is een hele hand plus twee vingers. 7 + 2 is dus die hand plus vier vingers: negen.' },
        { soort: 'eenvoudig', tekst: 'Leer de paren die samen tien zijn: 1-9, 2-8, 3-7, 4-6, 5-5. Daarmee kun je bijna alles tot tien in een keer.' }],
      gen: { soort: 'som', op: 'beide', max: 10 } },
    { id: 'rekenen.g2.getalrij', naam: 'De getalrij: wat komt ervoor en erna',
      les: 'Elk getal heeft een buurman. Voor de 7 komt de 6, na de 7 komt de 8.',
      vereist: ['rekenen.g2.tellen-tot-20'],
      uitleg: [
        { soort: 'visueel', tekst: 'Zie de getallen als een lange straat met huisnummers. Ernaast links is een minder, ernaast rechts is een meer.' },
        { soort: 'stap', tekst: 'Erna? Tel een door. Ervoor? Tel een terug. Meer hoef je niet te doen.' }],
      gen: { soort: 'buur', max: 20 } }
  ]}
];
