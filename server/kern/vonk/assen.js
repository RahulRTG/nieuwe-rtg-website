/* RTG Vonk, deelbestand "assen": DE TABEL, en verder niets.

   Pure data, net als seed/genres-lijst.js: de onderwerpen waarop een lid kan
   zeggen wat er toe doet, met hun opties en hun standaard-zichtbaarheid. De
   bewerkingen erop (schoonmaken, botsen, wegen, uitleggen) staan in ./wensen.js.

   WAAROM APART. Een as toevoegen hoort een REGEL te zijn en geen ingreep. Staat
   de tabel tussen de logica, dan leest elke uitbreiding als een codewijziging en
   gaat er vroeg of laat een tweede lijst naast leven -- precies wat LAT.md regel
   4 verbiedt. Hier is de scheiding zichtbaar: dit bestand bevat geen enkele
   functie.

   GESLACHT, LEEFTIJD EN AFSTAND STAAN ER BEWUST NIET IN. Die zijn altijd hard en
   altijd wederzijds, en ze hebben hun eigen velden in het profiel. Zou je ze
   hierin trekken, dan werd "verplicht" voor die drie opeens optioneel. */

const GEWICHTEN = ['verplicht', 'sterk', 'mee'];
const ZICHT = ['kandidaten', 'match', 'engine'];

/* standaardZicht: waar een as begint als het lid niets kiest.

   Geloof en hoe zwaar het weegt beginnen op "match" en de rest op "kandidaten".
   Dat is geen willekeur: de app werkt volledig met een verborgen as (de engine
   gebruikt hem gewoon), dus het gevoelige veld kan de behoedzame kant op zonder
   dat iemand er iets voor inlevert. Wie het wel wil tonen, zet het om. */
const ASSEN = [
  { id: 'relatievorm', label: 'Wat u zoekt', standaardZicht: 'kandidaten',
    opties: [['serieus', 'Een serieuze relatie'], ['huwelijk', 'Gericht op trouwen'],
      ['ontdekken', 'Ik weet het nog niet'], ['casual', 'Geen serieuze relatie']] },
  { id: 'exclusiviteit', label: 'Relatievorm', standaardZicht: 'kandidaten',
    opties: [['monogaam', 'Monogaam'], ['open', 'Open'], ['poly', 'Polyamoreus']] },
  { id: 'kinderen', label: 'Kinderen', standaardZicht: 'kandidaten',
    opties: [['wil', 'Wil kinderen'], ['wilNiet', 'Wil geen kinderen'],
      ['heeftWilMeer', 'Heeft kinderen, wil er meer'], ['heeftGenoeg', 'Heeft kinderen, dat is genoeg'],
      ['weetNiet', 'Weet het nog niet']] },
  { id: 'geloof', label: 'Geloof', standaardZicht: 'match',
    opties: [['islam', 'Islam'], ['christendom', 'Christendom'], ['jodendom', 'Jodendom'],
      ['hindoeisme', 'Hindoeïsme'], ['boeddhisme', 'Boeddhisme'], ['anders', 'Anders'],
      ['geen', 'Geen geloof']] },
  /* De tweede geloofsas, en de belangrijkste van de twee: twee mensen van
     hetzelfde geloof kunnen enorm verschillen in wat het in hun dag betekent.
     Zonder deze as matcht Vonk op een etiket (ONTMOETEN.md par. 3.3). */
  { id: 'geloofWeegt', label: 'Hoe zwaar geloof weegt', standaardZicht: 'match',
    opties: [['niet', 'Speelt geen rol'], ['beetje', 'Cultureel'], ['belangrijk', 'Belangrijk'],
      ['leidend', 'Leidend in mijn dagelijks leven']] },
  { id: 'roken', label: 'Roken', standaardZicht: 'kandidaten',
    opties: [['nee', 'Niet'], ['soms', 'Soms'], ['ja', 'Ja']] },
  { id: 'alcohol', label: 'Alcohol', standaardZicht: 'kandidaten',
    opties: [['nee', 'Niet'], ['soms', 'Soms'], ['ja', 'Ja']] }
];


module.exports = { GEWICHTEN, ZICHT, ASSEN };
