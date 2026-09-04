/* ============================================================================
   DE BEGRIPPEN VAN EEN CORRECTIE -- de gronden, en wat er met opzet niet is.

   Afgesplitst van ./correctie.js, dat over de 10 KB ging (keuringsregel 13).
   De snede loopt langs dezelfde lijn als bij kern/commerce/retour.js en
   ./retourlijst.js: hier de VOCABULAIRE (wat kan een grond zijn, en wat wordt
   er bewust niet gebouwd), daar de MOTOR (wie mag wat zetten, wat gebeurt er
   met het geld). Dat is geen ceremonie: een grond erbij is een besluit van de
   eigenaar over zijn dagstaat, en dat besluit hoort niet verstopt te zitten
   tussen de rekenregels.

   Waarom deze weg er is, en welk dood spoor hij repareert, staat in de kop van
   ./correctie.js.
   ========================================================================== */
'use strict';

/* De gronden. `wie` zegt van wiens kant het signaal komt -- dat is geen
   bevoegdheid (corrigeren doet altijd een medewerker) maar het antwoord op de
   vraag die een eigenaar over zijn dagstaat stelt: kwam dit uit de keuken of
   van de gast? Een grond erbij is een besluit; het is een gesloten lijst omdat
   een vrij tekstveld hier binnen een maand veertig varianten van "fout" heeft. */
const GRONDEN = [
  { id: 'verkeerd-bereid', label: 'Verkeerd bereid', wie: 'gast',
    wat: 'De gast kreeg iets anders dan besteld, of het was niet in orde.' },
  { id: 'niet-gebracht', label: 'Niet gebracht', wie: 'gast',
    wat: 'Het stond op de bon maar is nooit op tafel gekomen.' },
  { id: 'teruggestuurd', label: 'Teruggestuurd', wie: 'gast',
    wat: 'De gast heeft het geproefd en teruggestuurd.' },
  { id: 'vergissing', label: 'Vergissing bij het aanslaan', wie: 'zaak',
    wat: 'De bediening heeft het verkeerd op de rekening gezet.' },
  { id: 'breuk', label: 'Breuk of gevallen', wie: 'zaak',
    wat: 'Het is onderweg naar de tafel misgegaan.' }
];
const GROND = new Map(GRONDEN.map(g => [g.id, g]));

/* Wat deze laag met opzet NIET doet. Staat hier en niet in een document, zodat
   wie de module opent het antwoord vindt op de vraag die hij komt stellen. */
const NIET_GEBOUWD = {
  'automatisch-terugboeken': 'Nooit. Is er al betaald, dan ontstaat er een teruggaveRECHT met een bevroren bedrag; een mens voert het uit langs kern/pay. GELD.md par. 3.',
  'correctie-door-de-gast': 'Een gast MELDT (kern/gast/verzoek.js) en een medewerker corrigeert. Een knop waarmee een gast zelf regels van de rekening haalt, is een kassa die iedereen mag bedienen.',
  'voorraad-afboeken': 'Een correctie zegt wat er met de REKENING gebeurde. Of het gerecht ook uit de voorraad moet, is een tweede handeling met een eigen grond -- kassa/derving doet dat, en die twee samenvoegen zou betekenen dat "niet gebracht" voorraad verbruikt.',
  'correctiepercentage-per-medewerker': 'Een getal naast een medewerker is een ranglijst op mensen. CLAUDE.md verbiedt dat, en HORECA.md herhaalt het.'
};


module.exports = { GRONDEN, GROND, NIET_GEBOUWD };
