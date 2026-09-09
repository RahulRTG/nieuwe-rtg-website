/* De statische voordeuren: publieke pagina's die WEL van RTG zijn maar GEEN
   RTG-server achter zich hebben.

   WAAROM DIT EEN EIGEN MODULE IS. Dit feit stond op twee plekken nodig te zijn
   en dat gaat een keer mis. De server heeft de lijst voor CORS: alleen deze
   oorsprongen mogen het antwoord van /api/talen en /api/vertaal/ui lezen. De
   browser heeft dezelfde lijst nodig om te weten WAAR hij die twee moet halen:
   op rahulrtg.github.io ligt geen API, dus daar wijst hij naar de app.

   Twee kopieen van een lijst lopen uit elkaar, en dat merk je pas als een taal
   het op een van de twee voordeuren niet meer doet. De browserkant kan deze
   module niet requiren; wat hem eerlijk houdt is test/i18n-auto.test.js, die de
   twee lijsten naast elkaar legt en zakt zodra ze verschillen. */
'use strict';

/* Waar de API woont voor een pagina die van een statische voordeur komt. */
const APP_OORSPRONG = 'https://app.rahultravelgroup.com';

const VOORDEUREN = [
  'https://rahulrtg.github.io',
  'https://rahultravelgroup.com',
  'https://www.rahultravelgroup.com'
];

module.exports = { VOORDEUREN, APP_OORSPRONG, OORSPRONGEN: new Set(VOORDEUREN) };
