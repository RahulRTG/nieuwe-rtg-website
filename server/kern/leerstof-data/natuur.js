/* RTG School, leerlijn natuur en techniek groep 4 t/m 8. Verkeer en Engels
   staan in ./verkeer-engels.js.

   Zelfde omslag als bij de andere vakken: de vier handgeschreven
   meerkeuzevragen per doel zijn vervangen door tabellen waar de motor uit put.
   Indelen in groepen (zoogdier, vogel, vis) levert per groep zoveel vragen als
   er voorbeelden zijn, en een tabel uitbreiden is een regel erbij. */
module.exports.NATUUR = [
  { groep: 4, doelen: [
    { id: 'natuur.g4.dieren', naam: 'Dieren en hun kenmerken',
      les: 'Zoogdieren drinken melk bij hun moeder, vogels hebben veren en leggen eieren, vissen ademen met kieuwen, insecten hebben zes poten.',
      uitleg: [
        { soort: 'stap', tekst: 'Kijk naar de buitenkant: veren horen bij vogels, schubben bij vissen, haren bij zoogdieren. Tel bij twijfel de poten.' },
        { soort: 'eenvoudig', tekst: 'Een dolfijn en een vleermuis zijn zoogdieren, ook al zwemt de een en vliegt de ander. Het gaat om de melk en de haren, niet om waar het dier leeft.' }],
      gen: { soort: 'indeling', vraag: 'Bij welke diergroep hoort %s?',
        groepen: { 'zoogdier': ['de dolfijn', 'de koe', 'de vleermuis', 'de mens', 'de olifant', 'de muis'],
          'vogel': ['de mus', 'de kip', 'de pinguin', 'de uil', 'de zwaan'],
          'vis': ['de haring', 'de haai', 'de snoek', 'de zalm'],
          'insect': ['de bij', 'de mier', 'de vlinder', 'de kever'] } } },
    { id: 'natuur.g4.seizoenen', naam: 'De seizoenen en de natuur',
      les: 'In de lente groeit alles, in de zomer is het warm, in de herfst vallen de bladeren en in de winter rusten planten en slapen sommige dieren.',
      uitleg: [
        { soort: 'praktijk', tekst: 'Kijk naar dezelfde boom in april en in november. Aan die ene boom zie je het hele verhaal van de seizoenen.' },
        { soort: 'stap', tekst: 'De seizoenen komen doordat de aarde scheef staat: de kant die naar de zon wijst, krijgt zomer.' }],
      gen: { soort: 'indeling', vraag: 'Bij welk seizoen hoort %s?',
        groepen: { 'lente': ['de eerste blaadjes', 'jonge dieren', 'bloesem aan de bomen'],
          'zomer': ['de langste dag', 'rijp fruit', 'warme nachten'],
          'herfst': ['vallende bladeren', 'paddenstoelen', 'vogels die wegtrekken'],
          'winter': ['kale takken', 'winterslaap', 'de kortste dag'] } } }
  ]},

  { groep: 5, doelen: [
    { id: 'natuur.g5.planten', naam: 'Hoe planten groeien',
      les: 'Een plant maakt zijn eigen voedsel met zonlicht, water en lucht; dat heet fotosynthese. De wortels drinken, de bladeren vangen het licht.',
      vereist: ['natuur.g4.seizoenen'],
      uitleg: [
        { soort: 'stap', tekst: 'Licht plus water plus koolstofdioxide uit de lucht wordt suiker en zuurstof. De plant eet de suiker; de zuurstof ademen wij in.' },
        { soort: 'praktijk', tekst: 'Zet een plant een week in het donker en je ziet wat er ontbreekt: zonder licht geen voedsel, hoeveel water je ook geeft.' }],
      gen: { soort: 'koppel', vraag: 'Wat doet %s bij een plant?',
        paren: [['de wortel', 'water en voeding opnemen'], ['het blad', 'licht opvangen'],
          ['de stengel', 'het water omhoog brengen'], ['de bloem', 'zorgen voor zaad'],
          ['de bij', 'stuifmeel overbrengen'], ['het zaad', 'een nieuwe plant beginnen']] } },
    { id: 'natuur.g5.voedselketen', naam: 'De voedselketen',
      les: 'Planten maken voedsel, planteneters eten planten, vleeseters eten dieren. Valt er een schakel weg, dan merkt de hele keten dat.',
      vereist: ['natuur.g5.planten'],
      uitleg: [
        { soort: 'visueel', tekst: 'Teken pijlen die wijzen naar wie eet: gras wijst naar konijn, konijn wijst naar vos. De pijl gaat de kant van de energie op.' },
        { soort: 'praktijk', tekst: 'Verdwijnen de bijen, dan komen er minder vruchten, en dus minder voedsel voor dieren die daarvan leven. Zo hangt alles samen.' }],
      gen: { soort: 'indeling', vraag: 'Wat is %s in de voedselketen?',
        groepen: { 'producent': ['gras', 'een boom', 'algen', 'een varen'],
          'planteneter': ['het konijn', 'de koe', 'de rups', 'het hert'],
          'vleeseter': ['de vos', 'de havik', 'de wolf', 'de snoek'] } } }
  ]},

  { groep: 6, doelen: [
    { id: 'natuur.g6.lichaam', naam: 'Het menselijk lichaam',
      les: 'Je hart pompt bloed rond, je longen halen zuurstof uit de lucht, je maag en darmen verteren wat je eet, je hersenen sturen alles aan.',
      vereist: ['natuur.g4.dieren'],
      uitleg: [
        { soort: 'stap', tekst: 'Volg de weg van het eten: mond, slokdarm, maag, dunne darm, dikke darm. En de weg van de lucht: neus, luchtpijp, longen.' },
        { soort: 'praktijk', tekst: 'Voel je hartslag in je pols na het rennen. Je hart klopt sneller omdat je spieren meer zuurstof vragen.' }],
      gen: { soort: 'koppel', vraag: 'Wat doet %s?',
        paren: [['het hart', 'bloed rondpompen'], ['de longen', 'zuurstof opnemen'],
          ['de maag', 'voedsel afbreken'], ['de nieren', 'het bloed schoonmaken'],
          ['de hersenen', 'alles aansturen'], ['de botten', 'het lichaam stevigheid geven'],
          ['de spieren', 'zorgen dat je beweegt'], ['de huid', 'beschermen en warmte regelen']] } },
    { id: 'natuur.g6.materialen', naam: 'Materialen en hun eigenschappen',
      les: 'Metaal geleidt stroom en warmte, hout drijft, glas laat licht door, plastic gaat lang mee -- ook als afval. Voor elk doel kies je een ander materiaal.',
      vereist: ['natuur.g4.seizoenen'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Waarom is een pan van metaal en het handvat van kunststof? Het ene geleidt warmte goed, het andere juist niet.' },
        { soort: 'stap', tekst: 'Vraag bij elk voorwerp: moet het sterk, licht, warm, waterdicht of doorzichtig zijn? Het antwoord bepaalt het materiaal.' }],
      gen: { soort: 'indeling', vraag: 'Welke eigenschap hoort vooral bij %s?',
        groepen: { 'geleidt stroom en warmte': ['koper', 'aluminium', 'ijzer'],
          'isoleert': ['piepschuim', 'wol', 'kunststof'],
          'laat licht door': ['glas', 'helder plastic', 'water'] } } }
  ]},

  { groep: 7, doelen: [
    { id: 'natuur.g7.energie', naam: 'Energie en duurzaamheid',
      les: 'Energie uit kolen, olie en gas raakt op en verwarmt de aarde. Zon, wind en water raken niet op: dat heet duurzame energie.',
      vereist: ['natuur.g6.materialen'],
      uitleg: [
        { soort: 'stap', tekst: 'Vraag bij elke bron: raakt hij op, en komt er CO2 bij vrij? Twee keer nee betekent duurzaam.' },
        { soort: 'praktijk', tekst: 'Een zonnepaneel op het dak levert stroom zolang de zon schijnt; een windmolen zolang het waait. Daarom is opslag in accu\'s zo belangrijk.' }],
      gen: { soort: 'indeling', vraag: 'Wat voor energiebron is %s?',
        groepen: { 'duurzaam': ['de zon', 'de wind', 'stromend water', 'aardwarmte'],
          'fossiel': ['steenkool', 'aardolie', 'aardgas'],
          'anders': ['kernenergie', 'biomassa'] } } },
    { id: 'natuur.g7.kracht', naam: 'Kracht, beweging en machines',
      les: 'Een kracht laat iets bewegen, stoppen of vervormen. Met een hefboom, een katrol of tandwielen doe je met weinig kracht veel werk.',
      vereist: ['natuur.g6.materialen'],
      uitleg: [
        { soort: 'visueel', tekst: 'Een wip is een hefboom: ver van het draaipunt duw je met minder kracht, maar je moet wel verder omlaag.' },
        { soort: 'praktijk', tekst: 'Een fiets zit vol machines: tandwielen, remmen als wrijving, en een frame dat de kracht verdeelt.' }],
      gen: { soort: 'koppel', vraag: 'Wat doet %s?',
        paren: [['een hefboom', 'kracht vergroten met een draaipunt'], ['een katrol', 'de richting van de kracht veranderen'],
          ['een tandwiel', 'kracht en snelheid overbrengen'], ['wrijving', 'beweging afremmen'],
          ['de zwaartekracht', 'alles naar de aarde trekken'], ['een veer', 'kracht opslaan en teruggeven']] } }
  ]},

  { groep: 8, doelen: [
    { id: 'natuur.g8.heelal', naam: 'De aarde en het heelal',
      les: 'De aarde draait in een dag om zichzelf (dag en nacht) en in een jaar om de zon (de seizoenen). De maan draait om de aarde en maakt eb en vloed.',
      vereist: ['natuur.g4.seizoenen'],
      uitleg: [
        { soort: 'stap', tekst: 'Twee bewegingen tegelijk: om je eigen as is dag en nacht, om de zon is het jaar. De scheve stand zorgt voor de seizoenen.' },
        { soort: 'praktijk', tekst: 'Eb en vloed komen door de aantrekkingskracht van de maan. Daarom is het getij elke dag iets later, net als de opkomst van de maan.' }],
      gen: { soort: 'koppel', vraag: 'Wat veroorzaakt %s?',
        paren: [['dag en nacht', 'de aarde draait om haar as'], ['de seizoenen', 'de scheve stand van de aarde'],
          ['eb en vloed', 'de aantrekkingskracht van de maan'], ['een jaar', 'de aarde draait om de zon'],
          ['een zonsverduistering', 'de maan schuift voor de zon'], ['de sterren die je ziet', 'zonnen heel ver weg']] } },
    { id: 'natuur.g8.milieu', naam: 'Kringlopen en afval',
      les: 'In de natuur is niets afval: alles wordt weer voedsel. Bij mensen wel, en daarom scheiden en hergebruiken we -- of we maken het spul zo dat het weer grondstof wordt.',
      vereist: ['natuur.g7.energie', 'natuur.g5.voedselketen'],
      uitleg: [
        { soort: 'stap', tekst: 'Voorkomen is beter dan hergebruiken, en hergebruiken beter dan recyclen. Verbranden is de laatste stap, niet de eerste.' },
        { soort: 'praktijk', tekst: 'Een appelklokhuis verteert in weken, een plastic fles doet er honderden jaren over. Dat verschil is precies waar het over gaat.' }],
      gen: { soort: 'indeling', vraag: 'Waar hoort %s?',
        groepen: { 'gft (composteert)': ['een appelklokhuis', 'bladeren', 'koffiedik'],
          'plastic en blik': ['een petfles', 'een blikje', 'een boterkuipje'],
          'papier': ['een krant', 'een kartonnen doos', 'een schrift'],
          'restafval': ['een kapotte pen', 'een luier', 'een chipszak'] } } }
  ]}
];
