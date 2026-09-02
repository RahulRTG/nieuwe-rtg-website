/* ============================================================================
   DE GRENSREGEL VAN RTG VEILIG -- op EEN plek, want hij stond er op twee.

   WAT HIER STAAT. De zin die zegt wat deze laag niet is. Hij hoort op elk
   scherm van RTG Veilig, hij hoort in het antwoord van de server, en sinds de
   Foundation ernaar verwijst hoort hij ook daar. Drie plekken, een belofte.

   WAAROM DIT BESTAND ER KOMT. Hij stond in twee versies naast elkaar:
   ./index.js gaf in veiligBeeld() een korte variant mee ("er wordt niemand
   gebeld en er kijkt geen mens mee"), en public/shared/veiligheid.js toonde een
   langere op het scherm ("er komt geen hulpdienst... zonder internet gaat er
   niets af"). Allebei waar, allebei anders, en niemand die merkt wanneer er een
   verschuift. Dat is LAT.md regel 4 op de gevaarlijkste soort tekst die dit
   huis heeft: een belofte over wat er NIET gebeurt als het misgaat.

   DE CLIENT KAN DIT BESTAND NIET LADEN, en daarom is er een toets in plaats van
   een import. test/veiligheidgrens.test.js houdt vast dat de clientlaag en de
   Foundation-pagina exact deze zinnen dragen; wijzigt er een, dan zakt de bouw.
   Zelfde vorm als test/genrecap.test.js voor citaten uit de lagenmodellen: een
   kopie die achterloopt op zijn bron is erger dan geen kopie, want hij leest als
   de waarheid.

   DE ZINNEN ZIJN MET OPZET KORT EN LOSSTAAND. Ze worden op drie plekken in een
   ander stukje HTML gezet; wie er een alinea van maakt, maakt de toets bros.
   ========================================================================== */
'use strict';

/* De vier dingen die niet gebeuren. Elk apart, zodat een scherm er een kan
   weglaten zonder de andere drie te verminken -- en zodat de toets per zin kan
   zeggen welke er is weggevallen. */
const NIET = [
  'RTG is geen alarmcentrale.',
  'Er wordt niemand gebeld, er kijkt geen mens mee, en er komt geen hulpdienst.',
  'Alleen de mensen die u zelf in uw kring zet krijgen bericht.',
  'Zonder internet, of als de server plat ligt, gaat er niets af.'
];

/* En de zin die er altijd achteraan hoort. Hij staat apart omdat hij het enige
   is wat de lezer WEL kan doen; de vier hierboven zeggen alleen wat er niet is. */
const WEL = 'Bij levensgevaar belt u het alarmnummer.';

const VOLLEDIG = NIET.join(' ') + ' ' + WEL;

module.exports = { NIET, WEL, VOLLEDIG };
