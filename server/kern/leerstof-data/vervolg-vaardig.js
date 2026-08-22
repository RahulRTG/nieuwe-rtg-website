/* RTG School, leerlijn vervolgonderwijs: het hbo en het wo: communicatie, schrijven en projectwerk.
   Zelfde vorm als de VO-leerlijn: blokken per vak met de fasen waarvoor ze
   gelden. Beroeps- en studievaardigheden in plaats van schoolvakken. */
const MBO = ['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4'];
const HBO = ['hbo-ad', 'hbo-b', 'hbo-m'];
const WO = ['wo-b', 'wo-m', 'wo-phd'];

module.exports.VERVOLG_VAARDIG = [
  { vak: 'communicatie', fasen: HBO, doelen: [
    { id: 'communicatie.hbo.zakelijk', naam: 'Professioneel communiceren', ref: '4F',
      vereist: ['nederlands.mbo.zakelijk'],
      les: 'Professionele communicatie is afgestemd op de ontvanger: eerst luisteren en samenvatten, dan reageren. Feedback geef je concreet, over gedrag en niet over de persoon.',
      uitleg: [
        { soort: 'stap', tekst: 'Feedback in drie delen: wat zag ik, wat deed dat, wat wil ik voortaan. Geen oordeel over wie iemand is.' },
        { soort: 'praktijk', tekst: 'Samenvatten voordat je reageert kost tien seconden en voorkomt de helft van de misverstanden in een lastig gesprek.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'goede feedback': ['ik zag dat de deadline verschoof', 'dit rapport miste de bronnen', 'je onderbrak me drie keer'],
          'geen feedback maar oordeel': ['je bent onbetrouwbaar', 'je bent slordig', 'zo ben jij nu eenmaal'],
          'actief luisteren': ['samenvatten wat je hoorde', 'doorvragen', 'stil zijn en laten uitpraten'] } } }
  ]},
  { vak: 'academisch', fasen: WO, doelen: [
    { id: 'academisch.wo.schrijven', naam: 'Academisch schrijven', ref: '4F',
      vereist: ['onderzoek.hbo.bronnen'],
      les: 'Een academische tekst maakt elke bewering controleerbaar: bronvermelding, een heldere onderzoeksvraag, en een conclusie die niet verder gaat dan de data draagt.',
      uitleg: [
        { soort: 'stap', tekst: 'Schrijf de conclusie pas als de resultaten er staan, en leg hem er daarna naast: draagt dit dat echt?' },
        { soort: 'praktijk', tekst: 'Plagiaat is niet alleen knippen en plakken: ook een parafrase zonder bron is plagiaat. Bij twijfel: vermelden.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'hoort in een academische tekst': ['een afgebakende onderzoeksvraag', 'bronvermelding bij elke bewering', 'een conclusie binnen de data'],
          'plagiaat': ['tekst overnemen zonder bron', 'een parafrase zonder bron', 'een figuur zonder herkomst'],
          'zwakke onderbouwing': ['een enkele anekdote', 'een bron zonder auteur', 'een conclusie die verder gaat dan het onderzoek'] } } }
  ]},
  { vak: 'project', fasen: HBO, doelen: [
    { id: 'project.hbo.plannen', naam: 'Projectmatig werken', ref: '4F',
      vereist: ['communicatie.hbo.zakelijk'],
      les: 'Een project heeft een doel, een afbakening, een planning en een opdrachtgever. Wat er niet bij hoort, staat er even hard in als wat er wel bij hoort.',
      uitleg: [
        { soort: 'stap', tekst: 'Schrijf bij elk project op wat er NIET in zit. Die ene alinea voorkomt het grootste deel van de ruzies aan het eind.' },
        { soort: 'praktijk', tekst: 'Loopt een project uit, dan schuift er iets anders: tijd, geld of omvang. Alle drie tegelijk vasthouden werkt niet, hoe hard je ook plant.' }],
      gen: { soort: 'koppel', vraag: 'Wat hoort bij %s?',
        paren: [['de afbakening', 'wat er wel en niet in het project zit'], ['een mijlpaal', 'een moment waarop iets af moet zijn'],
          ['de opdrachtgever', 'degene die het resultaat afneemt'], ['een risico', 'iets dat mis kan gaan, met een plan erbij'],
          ['scope creep', 'stilletjes groeiende opdracht zonder extra tijd'], ['een deliverable', 'een concreet op te leveren product']] } }
  ]},
  { vak: 'wetenschap', fasen: WO, doelen: [
    { id: 'wetenschap.wo.ethiek', naam: 'Onderzoeksethiek en integriteit', ref: '4F',
      vereist: ['wetenschap.wo.methode'],
      les: 'Deelnemers geven vrijwillig en geinformeerd toestemming, gegevens worden veilig bewaard, en resultaten worden gepubliceerd -- ook als ze tegenvallen.',
      uitleg: [
        { soort: 'stap', tekst: 'Vier vragen vooraf: weet de deelnemer waar hij ja tegen zegt, kan hij stoppen, is de data beveiligd, en wie mag hem later inzien?' },
        { soort: 'praktijk', tekst: 'Alleen positieve uitkomsten publiceren vertekent een heel vakgebied. Een goed opgezet onderzoek dat niets vindt, is ook een resultaat.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'hoort zo': ['geinformeerde toestemming', 'data pseudonimiseren', 'ook negatieve resultaten publiceren'],
          'schending': ['data weglaten die niet uitkomt', 'deelnemers misleiden zonder noodzaak', 'auteurschap claimen zonder bijdrage'],
          'grijs gebied': ['een analyse achteraf aanpassen', 'een dataset hergebruiken zonder melding', 'een resultaat sterker formuleren dan het is'] } } },
    { id: 'academisch.wo.argumentatie', naam: 'Argumentatie en drogredenen', ref: '4F',
      vereist: ['academisch.wo.schrijven'],
      les: 'Een argument bestaat uit een standpunt en gronden die het dragen. Een drogreden lijkt te dragen maar doet dat niet -- meestal door de persoon of de emotie erbij te halen.',
      uitleg: [
        { soort: 'stap', tekst: 'Splits elke bewering in standpunt en grond. Vraag daarna: draagt deze grond dit standpunt echt, of alleen als je al overtuigd was?' },
        { soort: 'praktijk', tekst: 'De meest gebruikte drogreden in debatten is de stroman: je bestrijdt een standpunt dat de ander niet innam, en wint dat gevecht dan glansrijk.' }],
      gen: { soort: 'koppel', vraag: 'Welke drogreden is dit: %s',
        paren: [['"Dat zegt hij alleen omdat hij daar werkt"', 'op de persoon'],
          ['"Dus jij wilt helemaal geen regels"', 'stroman'],
          ['"Iedereen doet het, dus het mag"', 'beroep op de meerderheid'],
          ['"Dit is altijd zo geweest"', 'beroep op traditie'],
          ['"Als we dit toestaan, eindigt alles in chaos"', 'hellend vlak'],
          ['"Een expert zegt het, dus het klopt"', 'oneigenlijk beroep op autoriteit']] } }
  ]}
];
