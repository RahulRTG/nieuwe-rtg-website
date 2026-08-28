/* RTG School: de catalogus van denkfouten -- wat er gedacht is, en waarom het
   anders werkt. Dit bestand is DATA; de regels die een fout antwoord aan een
   van deze patronen koppelen staan in ./leerstof-denkfout.js.

   Elke tekst legt uit wat er gedacht is en waarom het anders gaat. Er staat
   nergens "fout", "helaas" of "jammer": een denkfout is een aanwijzing en geen
   oordeel. De vorm verwijst naar UITLEG_SOORTEN in ./leerstof-fabric.js en
   bepaalt WELKE andere uitleg een leerling erbij krijgt (Explain Differently).

   Een id verandert nooit: hij staat in tellingen bij klassen en in toetsen. */
const DENKFOUTEN = {
  'maal.plus-in-plaats-van-maal': { naam: 'keer gelezen als plus', vorm: 'visueel',
    uitleg: 'Je hebt de twee getallen bij elkaar opgeteld. Keer is iets anders dan plus: 3 x 7 betekent zeven, drie keer achter elkaar.' },
  'plus.maal-in-plaats-van-plus': { naam: 'plus gelezen als keer', vorm: 'visueel',
    uitleg: 'Je hebt de getallen vermenigvuldigd. Bij plus leg je de twee hoeveelheden naast elkaar en tel je door.' },
  'plus.min-in-plaats-van-plus': { naam: 'het minteken gelezen', vorm: 'stap',
    uitleg: 'Je hebt afgetrokken waar er opgeteld moest worden. Kijk eerst welk teken er staat en zeg het hardop.' },
  'min.plus-in-plaats-van-min': { naam: 'het plusteken gelezen', vorm: 'stap',
    uitleg: 'Je hebt opgeteld waar er afgetrokken moest worden. Kijk eerst welk teken er staat en zeg het hardop.' },
  'delen.maal-in-plaats-van-delen': { naam: 'delen gelezen als keer', vorm: 'visueel',
    uitleg: 'Je hebt vermenigvuldigd. Delen is het omgekeerde: je verdeelt het getal in gelijke groepjes.' },
  'delen.rest-weggelaten': { naam: 'de rest weggelaten', vorm: 'stap',
    uitleg: 'Het hele deel klopt. Wat overblijft hoort er ook bij: dat is de rest.' },
  'breuken.noemer-opgeteld': { naam: 'noemer meegeteld', vorm: 'visueel',
    uitleg: 'Je hebt de noemers ook bij elkaar opgeteld. De noemer zegt in hoeveel stukken iets is verdeeld; die verandert niet als je stukken bij elkaar legt.' },
  'eenheden.niet-omgerekend': { naam: 'eenheid niet omgerekend', vorm: 'praktijk',
    uitleg: 'Je hebt het getal laten staan zoals het er stond. Een andere eenheid vraagt om omrekenen: hoeveel van de kleine passen er in de grote?' },
  'eenheden.factor-tien-mis': { naam: 'een nul te veel of te weinig', vorm: 'stap',
    uitleg: 'Je rekende de goede kant op, maar met een nul verschil. Loop de stappen van de maatladder een voor een af.' },
  'procent.percentage-als-antwoord': { naam: 'het percentage teruggegeven', vorm: 'stap',
    uitleg: 'Je hebt het percentage zelf opgeschreven. De vraag is hoe groot dat deel van het hele getal is.' },
  'procent.niet-door-honderd': { naam: 'niet door honderd gedeeld', vorm: 'stap',
    uitleg: 'Je hebt met het hele percentage vermenigvuldigd. Procent betekent "per honderd", dus daarna deel je nog door 100.' },
  'negatief.min-genegeerd': { naam: 'het minteken overgeslagen', vorm: 'visueel',
    uitleg: 'Je rekende met het getal zonder het minteken. Onder nul tel je verder op de getallenlijn, langs de nul heen.' },
  'negatief.verkeerde-kant': { naam: 'de verkeerde kant op', vorm: 'visueel',
    uitleg: 'Warmer worden betekent naar rechts op de getallenlijn, ook als je onder nul begint.' },
  'dt.t-vergeten': { naam: 'stam zonder t', vorm: 'stap',
    uitleg: 'Bij hij, zij of het komt er een t achter de stam. Bij ik niet.' },
  'dt.t-te-veel': { naam: 'stam met een t te veel', vorm: 'stap',
    uitleg: 'Bij ik is het de kale stam. De t hoort bij hij, zij en het.' },
  'afronden.verkeerde-kant': { naam: 'de andere kant afgerond', vorm: 'stap',
    uitleg: 'Je rondde de andere kant op. Kijk naar het cijfer erachter: is dat 5 of hoger, dan ga je omhoog.' },
  'algemeen.eentje-ernaast': { naam: 'eentje ernaast', vorm: 'eenvoudig',
    uitleg: 'Je zat er precies een naast. Vaak is er een stap te veel of te weinig geteld.' },
  'algemeen.cijfers-omgedraaid': { naam: 'cijfers omgedraaid', vorm: 'eenvoudig',
    uitleg: 'De cijfers kloppen, maar staan omgekeerd. Lees het antwoord nog eens hardop terug.' }
};


module.exports = { DENKFOUTEN };
