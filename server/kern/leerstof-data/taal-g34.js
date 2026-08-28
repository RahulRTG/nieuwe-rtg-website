/* RTG School, leerlijn taal groep 3 en 4. Zie de kop van ./taal-g12.js. */
module.exports.TAAL_G34 = [
  { groep: 3, doelen: [
    { id: 'taal.g3.mkm-woorden', naam: 'Korte woorden goed schrijven',
      les: 'Schrijf wat je hoort: eerst de beginklank, dan de klinker, dan de eindklank. K-a-t: kat.',
      vereist: ['taal.g2.eerste-woorden'],
      uitleg: [
        { soort: 'stap', tekst: 'Zeg het woord langzaam en schrijf elke klank die je hoort. Niet meer letters gebruiken dan je klanken hoort.' },
        { soort: 'eenvoudig', tekst: 'Hoor je maar een klank aan het eind, schrijf er dan ook maar een letter. "Bosch" heeft letters die je niet hoort.' }],
      gen: { soort: 'spel', fout: 'dubbel-eind', fout2: 'dubbel-klinker',
        woorden: ['bos', 'vel', 'tak', 'mug', 'pit', 'kam', 'net', 'rug', 'zak', 'bel', 'kop', 'tas', 'pot', 'vin'] } },
    { id: 'taal.g3.tweeklanken', naam: 'Woorden met au, ou, ei en ij',
      les: 'Sommige klanken kun je op twee manieren schrijven. Die woorden moet je gewoon kennen: pauw met au, jij met de lange ij.',
      vereist: ['taal.g3.mkm-woorden'],
      uitleg: [
        { soort: 'eenvoudig', tekst: 'Er is geen regel die zegt wanneer het ei of ij is. Wel helpt het om woordfamilies te onthouden: trein, plein, klein.' },
        { soort: 'praktijk', tekst: 'Schrijf de woorden die je vaak fout doet op een briefje boven je bureau. Zien werkt hier beter dan uitleggen.' }],
      gen: { soort: 'spel', fout: 'ei-ij', fout2: 'au-ou',
        woorden: ['trein', 'klein', 'plein', 'reis', 'geit', 'blauw', 'pauw', 'kabouter', 'zout', 'koud', 'schaduw', 'eiland'] } },
    { id: 'taal.g3.meervoud', naam: 'Meervoud maken',
      les: 'Meer dan een: meestal -en, soms -s. Een kast, twee kasten. Een tafel, twee tafels. Luister wat lekker klinkt.',
      vereist: ['taal.g3.mkm-woorden'],
      uitleg: [
        { soort: 'stap', tekst: 'Zeg het meervoud hardop. Eindigt het woord op -el, -er, -em of -en, dan is het meestal -s. Anders bijna altijd -en.' },
        { soort: 'eenvoudig', tekst: 'Let op de klank: bij "bus" komen er twee s-en (bussen), want anders zou je "buzen" lezen.' }],
      gen: { soort: 'meervoud', woorden: [['kast', 'kasten'], ['tafel', 'tafels'], ['bus', 'bussen'], ['boom', 'bomen'],
        ['huis', 'huizen'], ['fiets', 'fietsen'], ['appel', 'appels'], ['muis', 'muizen'], ['pen', 'pennen'],
        ['bloem', 'bloemen'], ['raam', 'ramen'], ['vogel', 'vogels'], ['stoel', 'stoelen'], ['kip', 'kippen']] } },
    { id: 'taal.g3.hoofdletter-punt', naam: 'Hoofdletter en punt',
      les: 'Een zin begint met een hoofdletter en eindigt met een punt. Namen van mensen, steden en landen krijgen ook een hoofdletter.',
      vereist: ['taal.g3.mkm-woorden'],
      uitleg: [
        { soort: 'stap', tekst: 'Lees je zin terug. Staat er vooraan een hoofdletter en achteraan een punt? Pas dan is de zin af.' },
        { soort: 'praktijk', tekst: 'In een bericht op de telefoon laten mensen dit vaak weg. Op school en later in een sollicitatiebrief valt dat wel op.' }],
      gen: { soort: 'kies', paren: [['Wij gaan morgen naar Utrecht.', 'wij gaan morgen naar utrecht'],
        ['Mijn zus heet Fatima.', 'mijn zus heet fatima.'], ['De hond blaft.', 'de hond blaft'],
        ['In Nederland regent het vaak.', 'in nederland regent het vaak.']] } }
  ]},

  { groep: 4, doelen: [
    { id: 'taal.g4.sch-ng-nk', naam: 'Woorden met sch, ng en nk',
      les: 'School schrijf je met sch, ook al hoor je de h bijna niet. Bang eindigt op ng, bank op nk: luister naar de k.',
      vereist: ['taal.g3.tweeklanken'],
      uitleg: [
        { soort: 'stap', tekst: 'Twijfel je tussen ng en nk? Zeg het woord langzaam. Hoor je aan het eind een k, dan schrijf je nk.' },
        { soort: 'eenvoudig', tekst: 'Sch hoor je aan het begin van school, schaap en schoen. Sg bestaat niet in het Nederlands.' }],
      gen: { soort: 'spel', fout: 'sch-sg', fout2: 'ng-nk',
        woorden: ['school', 'schaap', 'schoen', 'schrift', 'scheer', 'bang', 'ring', 'zingen', 'lang', 'jong'] } },
    { id: 'taal.g4.aai-ooi-oei', naam: 'Woorden met aai, ooi en oei',
      les: 'Haai, mooi en groei: je hoort een j maar schrijft een i. Aai, ooi en oei zijn vaste rijtjes.',
      vereist: ['taal.g3.tweeklanken'],
      uitleg: [
        { soort: 'eenvoudig', tekst: 'Na twee klinkers komt hier altijd een i en nooit een j. Onthoud het rijtje: aai, ooi, oei.' },
        { soort: 'praktijk', tekst: 'Haai, kooi, groei, draai, mooi: het zijn er niet veel. Wie het rijtje kent, doet deze woorden nooit meer fout.' }],
      gen: { soort: 'spel', fout: 'i-j',
        woorden: ['haai', 'mooi', 'groei', 'draai', 'kooi', 'boei', 'saai', 'gooi', 'bloei', 'zwaai'] } },
    { id: 'taal.g4.woordsoorten', naam: 'Woordsoorten: ding, doen of hoe',
      les: 'Een zelfstandig naamwoord is een ding of een persoon (tafel, zus). Een werkwoord is iets doen (lopen, denken). Een bijvoeglijk naamwoord zegt hoe iets is (rood, snel).',
      vereist: ['taal.g3.meervoud'],
      uitleg: [
        { soort: 'stap', tekst: 'Kun je er "de" of "het" voor zetten? Dan is het een zelfstandig naamwoord. Kun je zeggen "ik ga ..."? Dan is het een werkwoord.' },
        { soort: 'analogie', tekst: 'Zelfstandige naamwoorden zijn de spelers, werkwoorden zijn wat ze doen, en bijvoeglijke naamwoorden zijn hun kleur en vorm.' }],
      gen: { soort: 'woordsoort', woorden: {
        'zelfstandig naamwoord': ['tafel', 'hond', 'school', 'fiets', 'zus', 'boom', 'raam', 'brood'],
        'werkwoord': ['lopen', 'eten', 'denken', 'fietsen', 'slapen', 'lezen', 'zingen', 'rennen'],
        'bijvoeglijk naamwoord': ['rood', 'snel', 'groot', 'nat', 'lief', 'oud', 'zwaar', 'stil'] } } },
    { id: 'taal.g4.woordenschat', naam: 'Woorden die hetzelfde betekenen',
      les: 'Veel woorden betekenen bijna hetzelfde: blij en vrolijk, snel en vlug. Met meer woorden kun je preciezer zeggen wat je bedoelt.',
      vereist: ['taal.g3.meervoud'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Als je een woord niet weet, zoek dan een woord dat er dichtbij komt. Zo blijft je verhaal doorlopen.' },
        { soort: 'stap', tekst: 'Lees een onbekend woord niet los, maar kijk naar de hele zin. Meestal verraadt de zin wat het ongeveer betekent.' }],
      gen: { soort: 'woordpaar', paren: [['blij', 'vrolijk'], ['snel', 'vlug'], ['groot', 'enorm'], ['bang', 'angstig'],
        ['mooi', 'prachtig'], ['moe', 'vermoeid'], ['boos', 'kwaad'], ['stil', 'rustig']] } }
  ]}
];
