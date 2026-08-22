/* RTG School, leerlijn vervolgonderwijs: het mbo.
   Zelfde vorm als de VO-leerlijn: blokken per vak met de fasen waarvoor ze
   gelden. Beroeps- en studievaardigheden in plaats van schoolvakken. */
const MBO = ['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4'];
const HBO = ['hbo-ad', 'hbo-b', 'hbo-m'];
const WO = ['wo-b', 'wo-m', 'wo-phd'];

module.exports.VERVOLG = [

  { vak: 'rekenen', fasen: MBO, doelen: [
    /* De voorkennis wijst hier naar de basisschool, en dat is geen slordigheid
       maar het punt van een graaf: een mbo'er die vastloopt op beroepsrekenen
       mist meestal geen beroepsuitleg maar de verhoudingstabel uit groep 7.
       De motor mag dat zeggen in plaats van meer van hetzelfde te geven. */
    { id: 'rekenen.mbo.beroep', naam: 'Rekenen op de werkvloer', ref: '2F',
      vereist: ['rekenen.g8.verhoudingen-procent'],
      les: 'Beroepsrekenen is verhoudingen: weet je de prijs of hoeveelheid van 1, dan kun je alles schalen. Reken altijd eerst terug naar 1.',
      uitleg: [
        { soort: 'stap', tekst: 'Zet de gegevens in twee rijen en reken eerst terug naar een stuk, een meter of een uur. Vanaf een is elke hoeveelheid een keersom.' },
        { soort: 'praktijk', tekst: 'Materiaal bestellen, een offerte narekenen, een receptuur opschalen: het is telkens dezelfde tabel met andere woorden erboven.' }],
      gen: { soort: 'verhouding', max: 60 } },
    { id: 'rekenen.mbo.geld', naam: 'Geldzaken en wisselgeld', ref: '2F',
      vereist: ['rekenen.g8.procenten-komma-breuk'],
      les: 'Tel terug vanaf het betaalde bedrag: van de prijs naar het ronde tientje, dan naar het betaalde bedrag. Zo klopt de kassa altijd.',
      uitleg: [
        { soort: 'stap', tekst: 'Ga van de prijs naar het eerstvolgende hele bedrag, dan met hele euro\'s naar het betaalde bedrag. Alles wat je onderweg optelde, is het wisselgeld.' },
        { soort: 'praktijk', tekst: 'Btw, korting en een fooi zijn procenten van een bedrag; het rijtje 10%, 5% en 1% is aan de kassa genoeg om alles uit het hoofd te doen.' }],
      gen: { soort: 'geld', max: 50 } }
  ]},
  { vak: 'burgerschap', fasen: MBO, doelen: [
    { id: 'burgerschap.mbo.kennis', naam: 'Burgerschap: hoe het land werkt', ref: '2F',
      vereist: ['maatschappijleer.vo.rechtsstaat'],
      les: 'De Tweede Kamer maakt wetten en controleert de regering; de rechter toetst onafhankelijk; de gemeente regelt wat dichtbij is, van paspoort tot vergunning.',
      uitleg: [
        { soort: 'stap', tekst: 'Vraag bij elk loket: is dit landelijk, provinciaal of gemeentelijk? Paspoort, uitkering en vergunning lopen bijna altijd via de gemeente.' },
        { soort: 'praktijk', tekst: 'Als werknemer heb je rechten die in wetten staan: minimumloon, vakantiedagen, veilig werk. Die gelden ook als je werkgever iets anders zegt.' }],
      gen: { soort: 'koppel', vraag: 'Wie regelt %s?',
        paren: [['een paspoort', 'de gemeente'], ['een wet', 'de Tweede en Eerste Kamer'],
          ['een uitspraak in een rechtszaak', 'de rechter'], ['het minimumloon', 'de landelijke overheid'],
          ['een bouwvergunning', 'de gemeente'], ['de controle op de regering', 'de Tweede Kamer']] } }
  ]},
  /* Uit vo3.js hierheen verhuisd: dit zijn geen vo-doelen maar mbo-, hbo- en
     wo-doelen, en ze horen bij de rest van het vervolgonderwijs te staan. Ze
     draaiden op vier handgeschreven vragen; nu op tabellen. */
  { vak: 'nederlands', fasen: MBO, doelen: [
    { id: 'nederlands.mbo.zakelijk', naam: 'Zakelijk schrijven', ref: '2F',
      vereist: ['taal.g8.formeel'],
      les: 'Een zakelijke mail heeft een duidelijke onderwerpregel, een nette aanhef, een kernboodschap in de eerste zin en een vriendelijke afsluiting.',
      uitleg: [
        { soort: 'stap', tekst: 'Zet de vraag of het verzoek in de eerste twee zinnen. Wie pas onderaan zegt wat hij wil, wordt de helft van de tijd niet gelezen.' },
        { soort: 'praktijk', tekst: 'Een onderwerpregel als "vraag" helpt niemand. "Vraag over factuur 2024-118" wel: de ontvanger weet meteen wat hij erbij moet pakken.' }],
      gen: { soort: 'koppel', vraag: 'Wat hoort bij %s?',
        paren: [['de aanhef', 'Geachte heer of mevrouw'], ['de onderwerpregel', 'kort waar de mail over gaat'],
          ['de eerste zin', 'de kernboodschap'], ['de afsluiting', 'Met vriendelijke groet'],
          ['een bijlage', 'noem hem in de tekst'], ['de toon', 'beleefd en zakelijk, ook bij een klacht']] } }
  ]},
  { vak: 'digitaal', fasen: MBO, doelen: [
    { id: 'digitaal.mbo.vaardig', naam: 'Digitaal vaardig op het werk', ref: '2F',
      vereist: ['informatica.havo.veilig'],
      les: 'Op het werk ga je zorgvuldig om met gegevens: sterke wachtwoorden, geen klantdata delen, en bij een verdacht bericht eerst checken voordat je klikt.',
      uitleg: [
        { soort: 'stap', tekst: 'Vraag bij elk verzoek om gegevens: mag deze persoon dit weten, en langs welk kanaal hoort dit te gaan? Bij twijfel niet doen en melden.' },
        { soort: 'praktijk', tekst: 'De meeste datalekken beginnen niet met een hack maar met een mens: een klik, een verkeerde geadresseerde of een groepsapp.' }],
      gen: { soort: 'indeling', vraag: 'Wat doe je met %s?',
        groepen: { 'melden en niet klikken': ['een verdachte mail met link', 'een onbekende usb-stick', 'een telefoontje dat om je wachtwoord vraagt'],
          'nooit delen': ['klantgegevens in een groepsapp', 'je wachtwoord met een collega', 'een dossier via een prive-account'],
          'gewoon doen': ['een update installeren', 'je scherm vergrendelen', 'tweestapsverificatie aanzetten'] } } }
  ]},
  { vak: 'loopbaan', fasen: MBO, doelen: [
    { id: 'loopbaan.mbo.solliciteren', naam: 'Solliciteren', ref: '2F',
      vereist: ['nederlands.mbo.zakelijk'],
      les: 'Een sollicitatie is geen levensverhaal maar een antwoord op een vacature: waarom deze functie, wat kun je, en wat heb je gedaan dat dat laat zien.',
      uitleg: [
        { soort: 'stap', tekst: 'Leg de vacature naast je brief. Elk gevraagd punt hoort een zin te krijgen met een voorbeeld erbij; wat er niet in staat, laat je weg.' },
        { soort: 'praktijk', tekst: 'Op de vraag naar een zwak punt hoort geen verkapt sterk punt ("ik ben te perfectionistisch") maar iets echts, met wat je eraan doet.' }],
      gen: { soort: 'indeling', vraag: 'Waar hoort %s?',
        groepen: { 'in de brief': ['waarom juist deze functie', 'een voorbeeld van wat je deed', 'wanneer je kunt beginnen'],
          'in het cv': ['je opleidingen met jaartallen', 'je werkervaring', 'je diploma\'s en certificaten'],
          'laat je weg': ['je burgerservicenummer', 'een verhaal over je vorige baas', 'een foto als er niet om gevraagd is'] } } },
    { id: 'loopbaan.mbo.arbeid', naam: 'Werken: contract en rechten', ref: '2F',
      vereist: ['burgerschap.mbo.kennis'],
      les: 'In je contract staat wat je doet, hoeveel je krijgt en voor hoe lang. Daarboven gelden wetten: minimumloon, vakantiedagen, veilige werkplek.',
      uitleg: [
        { soort: 'stap', tekst: 'Lees drie dingen altijd: de duur (tijdelijk of vast), de uren, en het uurloon. De rest is meestal cao of wet.' },
        { soort: 'praktijk', tekst: 'Afspraken die slechter zijn dan de wet, zijn ongeldig -- ook als je ze hebt getekend. Een handtekening zet de wet niet opzij.' }],
      gen: { soort: 'koppel', vraag: 'Wat is %s?',
        paren: [['een cao', 'afspraken voor een hele bedrijfstak'], ['het minimumloon', 'het wettelijk laagste uurloon'],
          ['een proeftijd', 'de periode waarin beide partijen snel kunnen stoppen'], ['een tijdelijk contract', 'een contract met een einddatum'],
          ['loonstrook', 'het overzicht van wat je verdiende en wat er af ging'], ['vakantiegeld', 'een percentage van je jaarloon, meestal in mei']] } }
  ]},
  { vak: 'veiligheid', fasen: MBO, doelen: [
    { id: 'veiligheid.mbo.werkplek', naam: 'Veilig werken', ref: '2F',
      les: 'Veilig werken is geen gevoel maar een gewoonte: ken de risico\'s van je werkplek, gebruik de middelen die er zijn, en meld wat bijna misging.',
      uitleg: [
        { soort: 'stap', tekst: 'Kijk voor je begint: wat kan hier misgaan, wat ligt er in de weg, en waar is de nooduitgang? Dertig seconden die een ongeluk schelen.' },
        { soort: 'praktijk', tekst: 'Een bijna-ongeluk melden voelt overdreven en is het niet: bijna-ongelukken zijn de goedkoopste manier om echte te voorkomen.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'beschermingsmiddel': ['veiligheidsbril', 'gehoorbescherming', 'werkhandschoenen', 'veiligheidsschoenen'],
          'risico': ['een kabel over de looproute', 'een geblokkeerde nooduitgang', 'tillen met een gedraaide rug'],
          'goede gewoonte': ['een bijna-ongeluk melden', 'machines uitzetten voor onderhoud', 'de werkplek opruimen'] } } }
  ]}
];
