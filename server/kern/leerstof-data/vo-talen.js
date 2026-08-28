/* RTG School, leerlijn voortgezet onderwijs: de talen (Nederlands, Engels,
   Duits, Frans). Zie de kop van ./vo-wiskunde.js voor de opzet.

   De woordenschat draait op tabellen die heen en terug bevraagd worden -- van
   het Nederlands naar de vreemde taal en omgekeerd. Dat verschil is echt: een
   woord herkennen is iets anders dan het zelf kunnen produceren, en alleen
   herkennen brengt je in een gesprek niet ver. */
const VMBO = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl'];
const ALLE_VO = VMBO.concat(['havo', 'vwo']);

module.exports.VO_TALEN = [
  { vak: 'nederlands', fasen: ALLE_VO, doelen: [
    { id: 'nederlands.vo.dt', naam: 'Werkwoordspelling (d/t)', ref: '2F',
      les: 'Tegenwoordige tijd: ik = stam, hij/zij = stam + t. Twijfel je? Vervang het werkwoord door lopen: hoor je "loopt", dan hoort er een t.',
      vereist: ['taal.g8.ww-vt'],
      uitleg: [
        { soort: 'stap', tekst: 'Zoek het onderwerp, bepaal de stam, en kijk of er een t bij hoort. De loop-truc werkt omdat je bij lopen de t wel hoort.' },
        { soort: 'praktijk', tekst: 'In een sollicitatiebrief valt een d/t-fout meer op dan waar ook. Het is de fout waar lezers het snelst een oordeel aan hangen, terecht of niet.' }],
      gen: { soort: 'dt', tijd: 'tt', ww: [['worden', 'word', 'wordt'], ['vinden', 'vind', 'vindt'],
        ['antwoorden', 'antwoord', 'antwoordt'], ['branden', 'brand', 'brandt'], ['houden', 'houd', 'houdt'],
        ['bieden', 'bied', 'biedt'], ['rijden', 'rijd', 'rijdt']] } },
    { id: 'nederlands.vo.signaalwoorden', naam: 'Signaalwoorden en tekstverbanden', ref: '2F',
      les: 'Signaalwoorden verklappen het verband: "maar" is een tegenstelling, "omdat" een reden, "daarna" een tijdsvolgorde, "bijvoorbeeld" een voorbeeld.',
      vereist: ['taal.g7.signaalwoorden'],
      uitleg: [
        { soort: 'stap', tekst: 'Onderstreep bij een tekst eerst alle signaalwoorden. De structuur van het betoog staat er dan al, nog voordat je de inhoud kent.' },
        { soort: 'praktijk', tekst: 'Bij examens begrijpend lezen zit het antwoord bijna altijd vlak achter een signaalwoord: "daardoor", "toch", "kortom".' }],
      gen: { soort: 'koppel', vraag: 'Welk verband hoort bij "%s"?',
        paren: [['maar', 'tegenstelling'], ['omdat', 'oorzaak of reden'], ['daarna', 'tijdsvolgorde'],
          ['bijvoorbeeld', 'voorbeeld'], ['daarom', 'gevolg'], ['bovendien', 'opsomming'],
          ['kortom', 'samenvatting'], ['hoewel', 'toegeving']] } },
    { id: 'nederlands.vo.tekstsoorten', naam: 'Tekstsoorten herkennen', ref: '2F',
      les: 'Een betoog wil je overtuigen, een uiteenzetting wil uitleggen, een beschouwing zet standpunten naast elkaar. Wie de soort kent, weet wat hij moet zoeken.',
      vereist: ['nederlands.vo.signaalwoorden'],
      uitleg: [
        { soort: 'stap', tekst: 'Vraag: wil de schrijver dat ik iets vind, iets begrijp, of dat ik zelf kies? Dat zijn precies de drie soorten.' },
        { soort: 'praktijk', tekst: 'Een opiniestuk in de krant is een betoog, een uitlegvideo een uiteenzetting, een achtergrondartikel meestal een beschouwing.' }],
      gen: { soort: 'indeling', vraag: 'Wat voor tekst is %s?',
        groepen: { 'betoog': ['een opiniestuk', 'een reclamefolder', 'een pleidooi'],
          'uiteenzetting': ['een instructie', 'een encyclopedie-artikel', 'een uitlegvideo'],
          'beschouwing': ['een achtergrondartikel', 'een essay dat kanten afweegt', 'een documentaire zonder standpunt'] } } },
    { id: 'nederlands.vwo.stijlfiguren', naam: 'Stijlfiguren herkennen', ref: '4F', fasen: ['vwo'],
      les: 'Een metafoor vergelijkt zonder "als", een understatement zegt minder dan er is, een retorische vraag verwacht geen antwoord.',
      vereist: ['nederlands.vo.tekstsoorten'],
      uitleg: [
        { soort: 'stap', tekst: 'Vraag bij elke opvallende zin: staat hier meer dan er letterlijk staat? Zo ja, dan is er een stijlfiguur aan het werk.' },
        { soort: 'praktijk', tekst: 'In reclame en politiek zitten ze het dichtst op elkaar. Wie ze herkent, laat zich minder makkelijk meeslepen.' }],
      gen: { soort: 'koppel', vraag: 'Welke stijlfiguur is dit: %s',
        paren: [['"Hij is een leeuw in het veld"', 'metafoor'], ['"Niet slecht" over iets uitstekends', 'understatement'],
          ['"Wie wil dat nou niet?"', 'retorische vraag'], ['"Ik heb het duizend keer gezegd"', 'hyperbool'],
          ['"Zo zacht als fluweel"', 'vergelijking'], ['"De stad slaapt"', 'personificatie']] } }
  ]},

  { vak: 'engels', fasen: ALLE_VO, doelen: [
    { id: 'engels.vo.woordenschat', naam: 'Engelse basiswoordenschat', ref: '2F',
      les: 'Woorden leer je in tweetallen: het Engelse woord en het jouwe. Lees ze hardop; wat je hoort en zegt, onthoud je beter dan wat je alleen ziet.',
      vereist: ['engels.g8.zinnen'],
      uitleg: [
        { soort: 'stap', tekst: 'Oefen beide richtingen. Van Engels naar Nederlands is herkennen, van Nederlands naar Engels is kunnen -- en dat laatste heb je nodig om te spreken.' },
        { soort: 'praktijk', tekst: 'Zet je telefoon of een spel een maand op Engels. Dat levert meer woorden op dan een lijst stampen, omdat je ze in context ziet.' }],
      gen: { soort: 'koppel', vraag: 'Wat is "%s" in het Engels?', terug: 'Wat betekent "%s"?',
        paren: [['bijna', 'almost'], ['genoeg', 'enough'], ['misschien', 'maybe'], ['omdat', 'because'],
          ['tussen', 'between'], ['zonder', 'without'], ['moeilijk', 'difficult'], ['veilig', 'safe'],
          ['antwoord', 'answer'], ['voorbeeld', 'example'], ['belangrijk', 'important'], ['mogelijk', 'possible'],
          ['ervaring', 'experience'], ['keuze', 'choice'], ['reden', 'reason'], ['gevolg', 'consequence']] } },
    { id: 'engels.vo.tijden', naam: 'Engelse werkwoordstijden', ref: '3F',
      fasen: ['havo', 'vwo'],
      les: 'Present simple voor gewoontes (I work), present continuous voor nu (I am working), past simple voor afgelopen (I worked).',
      vereist: ['engels.vo.woordenschat'],
      uitleg: [
        { soort: 'stap', tekst: 'Vraag: gebeurt het altijd, gebeurt het nu, of is het klaar? Die drie vragen wijzen elk naar een tijd.' },
        { soort: 'analogie', tekst: 'Present continuous is een foto van dit moment, present simple is een beschrijving van hoe het meestal gaat.' }],
      gen: { soort: 'koppel', vraag: 'Welke tijd hoort bij "%s"?',
        paren: [['I work every day', 'present simple'], ['I am working right now', 'present continuous'],
          ['I worked yesterday', 'past simple'], ['I was working when he called', 'past continuous'],
          ['I have worked here for a year', 'present perfect'], ['I will work tomorrow', 'future']] } }
  ]},

  { vak: 'duits', fasen: ALLE_VO, doelen: [
    { id: 'duits.vo.woordenschat', naam: 'Duitse basiswoordenschat', ref: '2F',
      les: 'Duits lijkt op Nederlands, en juist daar zit het gevaar: "bellen" is blaffen en "See" is meer. Leer de valse vrienden apart.',
      uitleg: [
        { soort: 'stap', tekst: 'Let op de naamvallen: der, die, das veranderen naar den, dem, des naargelang de rol in de zin. Leer het lidwoord altijd bij het woord.' },
        { soort: 'praktijk', tekst: 'Valse vrienden zijn de meest gemaakte fout: "bellen" is blaffen, "See" is meer, "Meer" is zee, "mögen" is houden van.' }],
      gen: { soort: 'koppel', vraag: 'Wat betekent "%s"?', terug: 'Wat is "%s" in het Duits?',
        paren: [['das Haus', 'het huis'], ['die Schule', 'de school'], ['der Freund', 'de vriend'],
          ['arbeiten', 'werken'], ['sprechen', 'spreken'], ['die Stadt', 'de stad'],
          ['bellen', 'blaffen'], ['der See', 'het meer'], ['das Meer', 'de zee'], ['mögen', 'houden van'],
          ['immer', 'altijd'], ['vielleicht', 'misschien']] } }
  ]},

  { vak: 'frans', fasen: ['havo', 'vwo'], doelen: [
    { id: 'frans.havo.woordenschat', naam: 'Franse basiswoordenschat', ref: '3F',
      les: 'Frans schrijf je anders dan je het zegt. Leer daarom het woordbeeld en de uitspraak samen, en let op het geslacht: le of la.',
      uitleg: [
        { soort: 'stap', tekst: 'Leer bij elk zelfstandig naamwoord het lidwoord mee: la maison, le livre. Achteraf gokken kost meer tijd dan meteen leren.' },
        { soort: 'praktijk', tekst: 'Veel Franse woorden zitten al in het Nederlands: bureau, cadeau, restaurant, paraplu. Dat scheelt honderden woorden gratis.' }],
      gen: { soort: 'koppel', vraag: 'Wat betekent "%s"?', terug: 'Wat is "%s" in het Frans?',
        paren: [['la maison', 'het huis'], ['le livre', 'het boek'], ['manger', 'eten'],
          ['boire', 'drinken'], ['la ville', 'de stad'], ['l\'ecole', 'de school'],
          ['toujours', 'altijd'], ['peut-etre', 'misschien'], ['parce que', 'omdat'],
          ['travailler', 'werken'], ['le temps', 'de tijd'], ['l\'ami', 'de vriend']] } }
  ]}
];
