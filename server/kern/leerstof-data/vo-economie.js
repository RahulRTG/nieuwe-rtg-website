/* RTG School, leerlijn voortgezet onderwijs: economie en informatica.
   Zie de kop van ./vo-wiskunde.js voor de opzet.

   Bij deze vakken is de verleiding het grootst om meningen te toetsen. Dat
   gebeurt hier niet: wat te toetsen valt zijn begrippen, verbanden en
   jaartallen. Wat een leerling van de slavernij, van klimaatbeleid of van
   ongelijkheid vindt, hoort in een gesprek in de klas en niet in een
   meerkeuzevraag met een goed antwoord. */
const VMBO = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl'];
const ALLE_VO = VMBO.concat(['havo', 'vwo']);
const MBO = ['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4'];


module.exports.VO_ECONOMIE = [
  { vak: 'economie', fasen: ['havo', 'vwo'].concat(MBO), doelen: [
    { id: 'economie.vo.btw', naam: 'Btw en procenten in het echt', ref: '3F',
      les: 'Btw is een percentage bovenop de prijs: 21% standaard, 9% op eten en boeken. Van bruto naar netto reken je terug, niet af.',
      vereist: ['wiskunde.vo.procenten'],
      uitleg: [
        { soort: 'stap', tekst: 'Prijs inclusief btw is 121% van de prijs exclusief. Terugrekenen doe je dus met delen door 1,21 en niet met 21% eraf halen.' },
        { soort: 'praktijk', tekst: 'Dat verschil is geen muggenzifterij: 21% eraf halen van een bedrag inclusief btw levert een te laag antwoord op, altijd.' }],
      gen: { soort: 'procent', procenten: [9, 21] } },
    { id: 'economie.vo.sparen', naam: 'Sparen, lenen en rente', ref: '3F',
      les: 'Rente is de prijs van geld. Bij sparen krijg je rente, bij lenen betaal je hem -- en rente op rente laat een bedrag sneller groeien dan je verwacht.',
      vereist: ['economie.vo.btw'],
      uitleg: [
        { soort: 'stap', tekst: 'Reken eerst een jaar uit, dan pas verder. Bij rente op rente reken je het tweede jaar over het nieuwe bedrag, niet over het oude.' },
        { soort: 'praktijk', tekst: 'Bij een rood staan of een creditcard is de rente per maand. Twee procent per maand is bijna 27 procent per jaar.' }],
      gen: { soort: 'formule', vraag: 'Je zet %a euro op een spaarrekening met %b procent rente per jaar. Hoeveel rente krijg je na een jaar?',
        a: [500, 5000, 100], b: [1, 5, 1], antwoord: 'a*b/100' } }
  ]},

  { vak: 'informatica', fasen: ['havo', 'vwo'], doelen: [
    { id: 'informatica.havo.begrippen', naam: 'Hoe computers denken', ref: '3F',
      les: 'Een computer kent alleen nullen en enen. Alles -- tekst, beeld, geluid -- is uiteindelijk een rij bits, en een programma is een reeks stappen.',
      uitleg: [
        { soort: 'stap', tekst: 'Acht bits zijn een byte, en een byte kan 256 waarden aan. Daarom loopt een teller in oude spellen na 255 weer terug naar nul.' },
        { soort: 'analogie', tekst: 'Een algoritme is een recept: dezelfde stappen leveren bij dezelfde ingredienten altijd hetzelfde gerecht op.' }],
      gen: { soort: 'koppel', vraag: 'Wat is %s?',
        paren: [['een bit', 'een nul of een een'], ['een byte', 'acht bits'],
          ['een algoritme', 'een reeks stappen die tot een uitkomst leidt'], ['de CPU', 'het rekenhart van de computer'],
          ['RAM', 'het werkgeheugen dat leegloopt bij uitzetten'], ['een compiler', 'een vertaler van code naar machinetaal']] } },
    { id: 'informatica.havo.veilig', naam: 'Digitale veiligheid', ref: '3F',
      les: 'Een sterk wachtwoord is lang en uniek, tweestapsverificatie houdt iemand met je wachtwoord alsnog buiten, en phishing werkt op haast en angst.',
      vereist: ['informatica.havo.begrippen'],
      uitleg: [
        { soort: 'stap', tekst: 'Lengte verslaat complexiteit: vier willekeurige woorden zijn veiliger dan Wachtwoord1!. En gebruik nooit hetzelfde wachtwoord twee keer.' },
        { soort: 'praktijk', tekst: 'Phishing herken je aan de haast ("binnen 24 uur"), het dreigement, en een link die net niet klopt. Bij twijfel: zelf naar de site typen.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s?',
        groepen: { 'veilig gedrag': ['een wachtwoordmanager gebruiken', 'tweestapsverificatie aanzetten', 'updates installeren'],
          'risico': ['overal hetzelfde wachtwoord', 'klikken op een link uit een onbekende mail', 'openbare wifi zonder vpn'],
          'aanvalstruc': ['phishing', 'een nepwinkel met te lage prijzen', 'een usb-stick op de parkeerplaats'] } } }
  ]}
];
