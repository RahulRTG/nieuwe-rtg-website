/* RTG School, leerlijn taal groep 7 en 8. Groep 8 werkt naar de
   referentieniveaus 1F en 1S toe; zie verder de kop van ./taal-g12.js. */
module.exports.TAAL_G78 = [
  { groep: 7, doelen: [
    { id: 'taal.g7.ww-tt', naam: 'Werkwoorden in de tegenwoordige tijd',
      les: 'Ik-vorm is de stam: ik loop. Bij jij, hij en zij komt er een t bij: hij loopt. Jij achter het werkwoord? Dan valt de t weer weg: loop jij.',
      vereist: ['taal.g6.zinsdelen'],
      uitleg: [
        { soort: 'stap', tekst: 'Zoek eerst het onderwerp. Is dat ik, dan alleen de stam. Is het jij, hij, zij of het, dan stam plus t -- behalve als jij erachter staat.' },
        { soort: 'analogie', tekst: 'De t hoort bij de ander, niet bij jezelf. Over jezelf praat je kaal: ik word. Over een ander met een t erbij: hij wordt.' },
        { soort: 'eenvoudig', tekst: 'De stam vind je door van het hele werkwoord -en af te halen: lopen wordt loop, worden wordt word.' }],
      gen: { soort: 'dt', tijd: 'tt', ww: [['lopen', 'loop', 'loopt'], ['worden', 'word', 'wordt'], ['vinden', 'vind', 'vindt'],
        ['antwoorden', 'antwoord', 'antwoordt'], ['rijden', 'rijd', 'rijdt'], ['branden', 'brand', 'brandt'],
        ['houden', 'houd', 'houdt'], ['bieden', 'bied', 'biedt'], ['redden', 'red', 'redt']] } },
    { id: 'taal.g7.leestekens', naam: 'Hoofdletters en leestekens',
      les: 'Een zin begint met een hoofdletter en eindigt met een punt, vraagteken of uitroepteken. Namen krijgen altijd een hoofdletter.',
      vereist: ['taal.g3.hoofdletter-punt'],
      uitleg: [
        { soort: 'stap', tekst: 'Een vraag krijgt een vraagteken, ook als het woord "of" erin staat. Een opsomming krijgt kommas, en voor het laatste deel meestal "en".' },
        { soort: 'praktijk', tekst: 'Lees je zin hardop. Waar je adem haalt, staat vaak een komma; waar je stem daalt en stopt, hoort een punt.' }],
      gen: { soort: 'kies', paren: [['Wij gaan morgen naar Ibiza.', 'wij gaan morgen naar ibiza'],
        ['Kom je ook?', 'Kom je ook.'], ['Amsterdam is een stad.', 'amsterdam is een stad.'],
        ['Ik kocht brood, kaas en melk.', 'Ik kocht brood kaas en melk.'],
        ['Wat een mooie dag!', 'wat een mooie dag']] } },
    { id: 'taal.g7.signaalwoorden', naam: 'Signaalwoorden en tekstverbanden',
      les: 'Signaalwoorden verraden hoe zinnen samenhangen: "maar" zet iets tegenover elkaar, "omdat" geeft een reden, "daarna" zet iets op volgorde.',
      vereist: ['taal.g6.begrijpend-lezen'],
      uitleg: [
        { soort: 'stap', tekst: 'Zoek in een tekst eerst de signaalwoorden. Ze vertellen je waar de schrijver een reden, een tegenstelling of een gevolg geeft.' },
        { soort: 'praktijk', tekst: 'Bij een toets begrijpend lezen zitten de antwoorden vaak precies achter het signaalwoord: "daardoor", "dus", "want".' }],
      gen: { soort: 'signaal', zinnen: [
        ['Ik wilde naar buiten, ___ het regende.', 'maar'],
        ['Hij bleef thuis ___ hij ziek was.', 'omdat'],
        ['Eerst eten we, ___ gaan we sporten.', 'daarna'],
        ['Het vroor hard. ___ was de sloot dicht.', 'daardoor'],
        ['Zij oefende elke dag, ___ won ze de wedstrijd.', 'dus']] } },
    { id: 'taal.g7.begrijpend-verwijzen', naam: 'Verwijswoorden begrijpen',
      les: 'Woorden als "hij", "die" en "dat" verwijzen naar iets dat eerder in de tekst stond. Wie dat kwijtraakt, raakt de tekst kwijt.',
      vereist: ['taal.g6.begrijpend-lezen'],
      uitleg: [
        { soort: 'stap', tekst: 'Kom je een verwijswoord tegen, kijk dan terug in de vorige zin: waar gaat dit over? Vervang het woord in gedachten door dat antwoord.' },
        { soort: 'eenvoudig', tekst: 'Als je "hij" tegenkomt en niet weet wie dat is, lees dan de zin ervoor opnieuw. Daar staat het bijna altijd.' }],
      gen: { soort: 'lezen', soort2: 'verwijzen' } }
  ]},

  { groep: 8, doelen: [
    { id: 'taal.g8.ww-vt', naam: 'Werkwoorden in de verleden tijd', ref: '1F',
      les: 'Kofschip-truc: eindigt de ik-vorm op een letter uit het kofschip (t, k, f, s, ch, p), dan krijgt de verleden tijd -te, anders -de. Werkte, maar speelde. Dit is het 1F-fundament.',
      vereist: ['taal.g7.ww-tt'],
      uitleg: [
        { soort: 'stap', tekst: 'Maak de stam: haal -en van het hele werkwoord. Kijk naar de laatste letter van de stam. Zit die in t-k-f-s-ch-p, dan -te(n), anders -de(n).' },
        { soort: 'analogie', tekst: 'Het kofschip is een ezelsbruggetje, geen regel over betekenis. Het gaat puur om de klank van de laatste letter van de stam.' },
        { soort: 'praktijk', tekst: 'Let op werkwoorden die op -zen of -ven eindigen: verhuizen wordt verhuisde, want de stam klinkt als verhuis maar hoort bij de z.' }],
      gen: { soort: 'dt', tijd: 'vt', ww: [['werken', 'werkte', 'werkten'], ['spelen', 'speelde', 'speelden'],
        ['fietsen', 'fietste', 'fietsten'], ['verhuizen', 'verhuisde', 'verhuisden'], ['praten', 'praatte', 'praatten'],
        ['leven', 'leefde', 'leefden'], ['blaffen', 'blafte', 'blaften'], ['bouwen', 'bouwde', 'bouwden']] } },
    { id: 'taal.g8.voltooid-dw', naam: 'Het voltooid deelwoord', ref: '1F',
      les: 'Gebeurd of gebeurt? Voltooid deelwoord maak je langer: het gebeurde ding -- dus een d. Hij gebeurt nu -- stam + t.',
      vereist: ['taal.g8.ww-vt'],
      uitleg: [
        { soort: 'stap', tekst: 'Zet het deelwoord voor een zelfstandig naamwoord: het gebeurde ongeluk, de gewerkte uren. Hoor je een d, schrijf dan d.' },
        { soort: 'eenvoudig', tekst: 'Staat er "is", "heeft" of "wordt" voor, dan gaat het om een voltooid deelwoord en niet om een gewone vervoeging.' }],
      gen: { soort: 'kies', paren: [['Het is gebeurd.', 'Het is gebeurt.'], ['Hij heeft gewerkt.', 'Hij heeft gewerkd.'],
        ['Zij is verhuisd.', 'Zij is verhuist.'], ['Het is gelukt.', 'Het is gelukd.'],
        ['De brief is verstuurd.', 'De brief is verstuurt.'], ['Ik heb geantwoord.', 'Ik heb geantwoordt.']] } },
    { id: 'taal.g8.samenstellingen', naam: 'Aan elkaar of los', ref: '1S',
      les: 'Samenstellingen schrijf je aan elkaar: basisschool, voetbalveld. Twijfel je? Als het een ding is, is het een woord.',
      vereist: ['taal.g5.open-gesloten'],
      uitleg: [
        { soort: 'stap', tekst: 'Vraag: is dit een ding op zichzelf? Een zonnebril is niet zomaar een bril van de zon; het is een soort bril. Dus aan elkaar.' },
        { soort: 'praktijk', tekst: 'Engelse invloed maakt dit lastig: in het Engels schrijf je "basic school" los. In het Nederlands niet.' }],
      gen: { soort: 'spel', fout: 'los',
        woorden: ['basisschool', 'voetbalveld', 'zonnebril', 'boekenkast', 'fietsenrek', 'huiswerk',
          'schoolplein', 'wintersport', 'keukentafel', 'kinderboek'] } },
    { id: 'taal.g8.formeel', naam: 'Formeel en informeel schrijven', ref: '1F',
      les: 'Tegen een vriend schrijf je anders dan tegen een gemeente. Formeel betekent: hele zinnen, geen afkortingen, u in plaats van jij.',
      vereist: ['taal.g7.leestekens'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Een sollicitatiebrief, een mail aan een leraar of een klacht bij een winkel: daar hoort formeel taalgebruik. In een appje aan je vriend niet.' },
        { soort: 'stap', tekst: 'Kijk naar de ontvanger. Ken je die persoonlijk en is het gelijkwaardig? Informeel. Is het een instantie of iemand hoger in rang? Formeel.' }],
      gen: { soort: 'kies', paren: [
        ['Geachte heer De Vries, hierbij stuur ik u mijn sollicitatie.', 'Hoi, hier is ff mn sollicitatie.'],
        ['Met vriendelijke groet, Sanne Bakker', 'Doeii, Sanne'],
        ['Kunt u mij laten weten of dit mogelijk is?', 'Kan dat ff?'],
        ['Ik wil graag een afspraak maken.', 'Ik wil ff langskomen ofzo.']] } }
  ]}
];
