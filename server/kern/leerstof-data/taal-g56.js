/* RTG School, leerlijn taal groep 5 en 6. Zie de kop van ./taal-g12.js. */
module.exports.TAAL_G56 = [
  { groep: 5, doelen: [
    { id: 'taal.g5.klankgroepen', naam: 'Klankgroepen horen',
      les: 'Een klankgroep is een stukje woord met een klinkerklank: bo-men zijn er twee, va-kan-tie zijn er drie. Klap ze mee.',
      vereist: ['taal.g3.meervoud'],
      uitleg: [
        { soort: 'stap', tekst: 'Zeg het woord langzaam en klap bij elke klinkerklank. Het aantal klappen is het aantal klankgroepen.' },
        { soort: 'praktijk', tekst: 'Dit is de voorbereiding op de spellingregels erna: of je een letter verdubbelt, hangt af van de klankgroep waarin hij staat.' }],
      gen: { soort: 'klankgroep', woorden: [['bomen', 2], ['vakantie', 3], ['school', 1], ['tafel', 2], ['olifant', 3],
        ['huis', 1], ['appel', 2], ['computer', 3], ['boek', 1], ['fietsen', 2], ['banaan', 2], ['telefoon', 3]] } },
    { id: 'taal.g5.open-gesloten', naam: 'Open en gesloten lettergrepen',
      les: 'Bomen heeft een open lettergreep: bo-men, een o die zichzelf lang maakt. Bommen heeft er twee m-en om de o kort te houden.',
      vereist: ['taal.g5.klankgroepen'],
      uitleg: [
        { soort: 'stap', tekst: 'Hak het woord in klankgroepen. Eindigt een klankgroep op een klinker, dan blijft die klinker lang en schrijf je er maar een.' },
        { soort: 'visueel', tekst: 'Denk aan een deur: staat hij open (bo-), dan mag de klank naar buiten en klinkt hij lang. Zit hij dicht (bom-), dan blijft de klank kort.' },
        { soort: 'eenvoudig', tekst: 'Lange klank in een open stukje: een letter. Korte klank die kort moet blijven: verdubbel de medeklinker erachter.' }],
      gen: { soort: 'spel', fout: 'dubbel-klinker',
        woorden: ['bomen', 'muren', 'spelen', 'ramen', 'lopen', 'wagen', 'vader', 'meten', 'schoten', 'malen'] } },
    { id: 'taal.g5.eind-d-t', naam: 'Een d of een t aan het eind',
      les: 'Hoor je een t aan het eind? Maak het woord langer: hond wordt honden, dus schrijf je een d.',
      vereist: ['taal.g3.meervoud'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet het woord in het meervoud of zeg er "-en" achter. Hoor je dan een d, schrijf dan een d.' },
        { soort: 'praktijk', tekst: 'Hond-honden, paard-paarden, brood-broden. Kat-katten geeft een t, dus die schrijf je met een t.' }],
      gen: { soort: 'spel', fout: 'd-t',
        woorden: ['hond', 'paard', 'brood', 'bord', 'hand', 'wind', 'kind', 'strand', 'rond', 'mond'] } },
    { id: 'taal.g5.tegenstellingen', naam: 'Tegenstellingen',
      les: 'Sommige woorden zijn elkaars tegenpool: groot en klein, licht en donker. Ze helpen je een tekst begrijpen en beschrijven.',
      vereist: ['taal.g4.woordenschat'],
      uitleg: [
        { soort: 'praktijk', tekst: 'In verhalen zetten schrijvers tegenstellingen naast elkaar: arm tegenover rijk, oud tegenover jong. Daardoor valt het verschil op.' },
        { soort: 'stap', tekst: 'Vraag jezelf af: wat is precies het omgekeerde? Niet zomaar iets anders, maar de andere kant van dezelfde lijn.' }],
      gen: { soort: 'woordpaar', soortVraag: 'tegenstelling',
        paren: [['groot', 'klein'], ['licht', 'donker'], ['warm', 'koud'], ['snel', 'langzaam'],
          ['vroeg', 'laat'], ['zwaar', 'licht'], ['vol', 'leeg'], ['open', 'dicht']] } }
  ]},

  { groep: 6, doelen: [
    { id: 'taal.g6.verkleinwoorden', naam: 'Verkleinwoorden',
      les: 'Klein maken doe je met -je, -tje of -pje: boom wordt boompje, ring wordt ringetje. Luister welk stukje past.',
      vereist: ['taal.g5.klankgroepen'],
      uitleg: [
        { soort: 'stap', tekst: 'Eindigt het woord op m na een lange klank, dan komt -pje. Op ng of een korte klank plus medeklinker, dan vaak -etje. Anders -je of -tje.' },
        { soort: 'eenvoudig', tekst: 'Zeg het hardop: "boomje" klinkt fout, "boompje" goed. Je oor kent de regel al voordat je hem kunt opschrijven.' }],
      gen: { soort: 'verklein', woorden: [['boom', 'boompje'], ['ring', 'ringetje'], ['vis', 'visje'], ['man', 'mannetje'],
        ['koning', 'koninkje'], ['bloem', 'bloempje'], ['stoel', 'stoeltje'], ['huis', 'huisje'],
        ['bal', 'balletje'], ['raam', 'raampje'], ['deur', 'deurtje'], ['kar', 'karretje']] } },
    { id: 'taal.g6.cht-ch', naam: 'Woorden met cht en ch',
      les: 'Lucht, nacht en zacht: na een korte klank schrijf je meestal cht. Behalve in hij ligt en hij zegt -- dat is werkwoordspelling.',
      vereist: ['taal.g5.open-gesloten'],
      uitleg: [
        { soort: 'eenvoudig', tekst: 'Hoor je "gt" midden in een woord dat geen werkwoord is, dan schrijf je bijna altijd cht.' },
        { soort: 'praktijk', tekst: 'De uitzonderingen zijn werkwoorden: hij ligt, hij zegt. Daar komt de t van de vervoeging en niet van de klank.' }],
      gen: { soort: 'spel', fout: 'cht-gt',
        woorden: ['lucht', 'nacht', 'zacht', 'dochter', 'kracht', 'vrucht', 'gerecht', 'wachten', 'lachen', 'vlucht'] } },
    { id: 'taal.g6.zinsdelen', naam: 'Persoonsvorm en onderwerp',
      les: 'De persoonsvorm is het werkwoord dat verandert als je de zin naar de verleden tijd zet. Het onderwerp is wie of wat er iets doet.',
      vereist: ['taal.g4.woordsoorten'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet de zin in een andere tijd: het woord dat verandert, is de persoonsvorm. Vraag daarna "wie of wat?" plus die persoonsvorm; het antwoord is het onderwerp.' },
        { soort: 'praktijk', tekst: 'Zonder deze twee kun je de werkwoordspelling van groep 7 en 8 niet doen: de t hangt af van het onderwerp.' }],
      gen: { soort: 'zinsdeel',
        onderwerpen: ['de hond', 'mijn zus', 'de buurman', 'het meisje', 'die jongen', 'de meester'],
        werkwoorden: [
          ['eet', ['een appel', 'een boterham', 'de soep']],
          ['leest', ['het boek', 'de krant', 'een brief']],
          ['pakt', ['de bal', 'zijn jas', 'de sleutel']],
          ['schrijft', ['een brief', 'een verhaal', 'de brief']],
          ['koopt', ['een brood', 'de krant', 'een kaartje']],
          ['zoekt', ['de sleutel', 'zijn jas', 'de bal']]] } },
    { id: 'taal.g6.begrijpend-lezen', naam: 'Begrijpend lezen: het antwoord staat in de tekst',
      les: 'Lees eerst de vraag, dan de tekst. Zoek daarna het stukje waar het antwoord staat -- niet wat je zelf denkt, maar wat er staat.',
      vereist: ['taal.g4.woordenschat'],
      uitleg: [
        { soort: 'stap', tekst: 'Onderstreep in de vraag waar het om gaat. Zoek dat woord terug in de tekst en lees de zin ervoor en erna.' },
        { soort: 'eenvoudig', tekst: 'Een antwoord dat wel klopt maar niet in de tekst staat, is bij begrijpend lezen fout. De tekst is de baas.' }],
      gen: { soort: 'lezen' } }
  ]}
];
